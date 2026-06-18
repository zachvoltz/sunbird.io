// Web Push (RFC 8291 message encryption with the `aes128gcm` content
// encoding + RFC 8292 VAPID) implemented from scratch on the Cloudflare
// Workers runtime. We intentionally avoid the `web-push` npm package (it pulls
// in Node crypto that doesn't run cleanly on Workers) and use only the
// standard WebCrypto `crypto.subtle` API plus `fetch`.

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string; // a mailto: or https: URL
} // keys are base64url (raw)

export interface WebPushResult {
  ok: boolean;
  status: number;
  error?: string;
  expired?: boolean;
}

// ---------------------------------------------------------------------------
// base64url helpers (no padding)
// ---------------------------------------------------------------------------

// Decode a base64url string (unpadded) into raw bytes.
function b64urlDecode(input: string): Uint8Array {
  // Convert base64url -> base64, then re-pad to a multiple of 4.
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Encode raw bytes into a base64url string (no padding).
function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// HKDF (RFC 5869) over HMAC-SHA-256
// ---------------------------------------------------------------------------

// HMAC-SHA-256 of `data` under `key` (raw bytes) -> 32-byte MAC.
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource);
  return new Uint8Array(sig);
}

// Full HKDF (extract + expand). `length` must be <= 32 for our uses, so a
// single expansion block (T(1)) is always sufficient.
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  // Extract: PRK = HMAC(salt, ikm).
  const prk = await hmacSha256(salt, ikm);
  // Expand: T(1) = HMAC(PRK, info || 0x01). We only need the first `length`
  // bytes, and length <= hashLen (32), so one block covers it.
  const input = new Uint8Array(info.length + 1);
  input.set(info, 0);
  input[info.length] = 0x01;
  const t = await hmacSha256(prk, input);
  return t.slice(0, length);
}

// ---------------------------------------------------------------------------
// VAPID JWT (ES256, RFC 8292)
// ---------------------------------------------------------------------------

// Build and sign the VAPID JWT for a given endpoint audience.
async function createVapidJwt(endpoint: string, vapid: VapidKeys): Promise<string> {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud,
    exp: now + 12 * 60 * 60, // 12 hours from now (RFC 8292 caps at 24h)
    sub: vapid.subject,
  };

  const enc = new TextEncoder();
  const headerB64 = b64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // The VAPID public key is a 65-byte uncompressed P-256 point: 0x04 || X || Y.
  // Reconstruct a private JWK so WebCrypto can import the ECDSA key.
  const publicBytes = b64urlDecode(vapid.publicKey);
  const x = b64urlEncode(publicBytes.slice(1, 33)); // 32-byte X coordinate
  const y = b64urlEncode(publicBytes.slice(33, 65)); // 32-byte Y coordinate
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: vapid.privateKey, // already base64url
    x,
    y,
    key_ops: ["sign"],
    ext: true,
  };

  const signingKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  // WebCrypto returns the ECDSA signature already as raw r||s (64 bytes), which
  // is exactly the JWS form — no DER decoding needed. base64url it directly.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    enc.encode(signingInput) as BufferSource,
  );
  const sigB64 = b64urlEncode(new Uint8Array(sig));

  return `${signingInput}.${sigB64}`;
}

// ---------------------------------------------------------------------------
// Payload encryption (RFC 8291, aes128gcm)
// ---------------------------------------------------------------------------

// Encrypt `payload` for the subscription and return the full HTTP body bytes
// (header || ciphertext), plus the salt is embedded in that header.
async function encryptPayload(
  sub: PushSubscriptionKeys,
  payload: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const authSecret = b64urlDecode(sub.auth); // 16 bytes
  const uaPublic = b64urlDecode(sub.p256dh); // 65 bytes: 0x04 || X || Y

  // 1. Generate an ephemeral (application-server) ECDH P-256 keypair.
  const asKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPublicRaw = new Uint8Array(
    (await crypto.subtle.exportKey("raw", asKeyPair.publicKey)) as ArrayBuffer,
  ); // 65 bytes

  // 2. ECDH: derive the shared secret between our ephemeral private key and the
  //    user agent's public key.
  const uaPublicKey = await crypto.subtle.importKey(
    "raw",
    uaPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      // The Workers types name this field `$public`, but the runtime (and the
      // WebCrypto spec) expects `public`; cast to keep both happy.
      { name: "ECDH", public: uaPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      asKeyPair.privateKey,
      256,
    ),
  ); // 32 bytes

  // 3. Derive the pseudo-random key (PRK) that binds the auth secret and both
  //    public keys (RFC 8291 §3.4). The key_info is:
  //      "WebPush: info\0" || ua_public(65) || as_public(65)
  const keyInfoLabel = enc.encode("WebPush: info\0");
  const keyInfo = new Uint8Array(keyInfoLabel.length + 65 + 65);
  keyInfo.set(keyInfoLabel, 0);
  keyInfo.set(uaPublic, keyInfoLabel.length);
  keyInfo.set(asPublicRaw, keyInfoLabel.length + 65);
  const prkKey = await hkdf(authSecret, ecdhSecret, keyInfo, 32); // 32-byte IKM

  // 4. Random 16-byte salt for this record; it travels in the body header.
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  // 5. Derive the content-encryption key (16 bytes) and nonce (12 bytes) from
  //    the PRK and salt using the fixed aes128gcm info strings.
  const cek = await hkdf(
    salt,
    prkKey,
    enc.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    prkKey,
    enc.encode("Content-Encoding: nonce\0"),
    12,
  );

  // 6. Plaintext is payload || 0x02 — the aes128gcm padding delimiter for the
  //    last (and only) record, with no extra padding.
  const payloadBytes = enc.encode(payload);
  const plaintext = new Uint8Array(payloadBytes.length + 1);
  plaintext.set(payloadBytes, 0);
  plaintext[payloadBytes.length] = 0x02;

  // 7. AES-128-GCM encrypt; WebCrypto appends the 16-byte auth tag to the
  //    ciphertext automatically.
  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 },
      cekKey,
      plaintext as BufferSource,
    ),
  );

  // 8. Assemble the aes128gcm body header:
  //      salt(16) || record_size(4, big-endian) || idlen(1) || as_public(65)
  //    followed by the ciphertext.
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // record_size = 4096 (0x00001000) big-endian.
  const recordSize = 4096;
  header[16] = (recordSize >>> 24) & 0xff;
  header[17] = (recordSize >>> 16) & 0xff;
  header[18] = (recordSize >>> 8) & 0xff;
  header[19] = recordSize & 0xff;
  header[20] = 65; // idlen: length of the key id (the as_public key)
  header.set(asPublicRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);
  return body;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Sends `payload` (a string, typically JSON) to one subscription. Returns
// { ok, status }. When the push service returns 404 or 410 the subscription is
// gone — sets expired:true so the caller can delete it. Never throws.
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: string,
  vapid: VapidKeys,
  opts?: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" },
): Promise<WebPushResult> {
  try {
    const jwt = await createVapidJwt(sub.endpoint, vapid);
    const body = await encryptPayload(sub, payload);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        // The encrypted body is opaque binary in the aes128gcm encoding.
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opts?.ttl ?? 2419200), // default: 28 days
        Urgency: opts?.urgency ?? "normal",
        // VAPID auth: the JWT under t= and the VAPID public key under k=. For
        // aes128gcm the public key lives here, so no separate Crypto-Key header.
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      },
      body: body as BufferSource,
    });

    return {
      ok: res.ok,
      status: res.status,
      // 404/410 mean the subscription no longer exists and should be deleted.
      expired: res.status === 404 || res.status === 410,
    };
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
}

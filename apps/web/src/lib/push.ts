// Web-push glue: service-worker registration + the standard VAPID key
// decoder. The notification-settings UI on Account uses these to (de)register
// a subscription. The service worker itself lives at /sw.js (public/sw.js so
// it builds to the site root and can control the whole origin).

// Convert a base64url-encoded VAPID public key into the Uint8Array that
// PushManager.subscribe expects for `applicationServerKey`.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  // Back the view with a concrete ArrayBuffer so it's accepted as a
  // BufferSource for applicationServerKey under TS's strict typed-array types.
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Register (idempotently) the root-scoped service worker and resolve once it's
// ready to accept a push subscription.
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  const reg = existing ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  return reg;
}

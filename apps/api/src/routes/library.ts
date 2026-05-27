import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createLibraryItemSchema, updateLibraryItemSchema } from "@sunbird/shared";

export const libraryRoutes = new Hono();

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function serialize(it: any) {
  return {
    id: it.id,
    coachId: it.coachId,
    kind: it.kind,
    title: it.title,
    subtitle: it.subtitle ?? null,
    tags: parseTags(it.tags),
    bpmStart: it.bpmStart ?? null,
    bpmEnd: it.bpmEnd ?? null,
    durationMin: it.durationMin ?? null,
    hasMidi: !!it.hasMidi,
    midiUrl: it.midiUrl ?? null,
    pdfUrl: it.pdfUrl ?? null,
    audioUrl: it.audioUrl ?? null,
    sortOrder: it.sortOrder ?? 0,
    createdAt: it.createdAt.toISOString(),
    updatedAt: it.updatedAt.toISOString(),
  };
}

// GET /api/library — list this coach's library items, sorted by kind
// then sortOrder so the UI can group them in section order.
libraryRoutes.get("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const items: any[] = await db.libraryItem.findMany({
    where: { coachId: user.id },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return c.json({ data: items.map(serialize) });
});

// POST /api/library — create a new library item for the calling coach.
libraryRoutes.post("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createLibraryItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const db = getDb();
  const created = await db.libraryItem.create({
    data: {
      coachId: user.id,
      kind: parsed.data.kind,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      tags: JSON.stringify(parsed.data.tags ?? []),
      bpmStart: parsed.data.bpmStart ?? null,
      bpmEnd: parsed.data.bpmEnd ?? null,
      durationMin: parsed.data.durationMin ?? null,
      hasMidi: !!parsed.data.hasMidi,
      midiUrl: parsed.data.midiUrl ?? null,
      pdfUrl: parsed.data.pdfUrl ?? null,
      audioUrl: parsed.data.audioUrl ?? null,
    },
  });
  return c.json({ data: serialize(created) }, 201);
});

// PUT /api/library/:id — partial update
libraryRoutes.put("/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateLibraryItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const db = getDb();
  const existing = await db.libraryItem.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.coachId !== user.id && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const data: any = {};
  if (parsed.data.kind !== undefined) data.kind = parsed.data.kind;
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.subtitle !== undefined) data.subtitle = parsed.data.subtitle ?? null;
  if (parsed.data.tags !== undefined) data.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.bpmStart !== undefined) data.bpmStart = parsed.data.bpmStart ?? null;
  if (parsed.data.bpmEnd !== undefined) data.bpmEnd = parsed.data.bpmEnd ?? null;
  if (parsed.data.durationMin !== undefined) data.durationMin = parsed.data.durationMin ?? null;
  if (parsed.data.hasMidi !== undefined) data.hasMidi = !!parsed.data.hasMidi;
  if (parsed.data.midiUrl !== undefined) data.midiUrl = parsed.data.midiUrl ?? null;
  if (parsed.data.pdfUrl !== undefined) data.pdfUrl = parsed.data.pdfUrl ?? null;
  if (parsed.data.audioUrl !== undefined) data.audioUrl = parsed.data.audioUrl ?? null;

  const updated = await db.libraryItem.update({ where: { id }, data });
  return c.json({ data: serialize(updated) });
});

// DELETE /api/library/:id
libraryRoutes.delete("/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const db = getDb();
  const existing = await db.libraryItem.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.coachId !== user.id && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }
  // Best-effort delete of the associated audio object before nuking the row.
  if (existing.audioUrl) {
    const bucket = (c.env as any)?.MEDIA_BUCKET as R2Bucket | undefined;
    const key = extractKeyFromAudioUrl(existing.audioUrl);
    if (bucket && key) {
      try { await bucket.delete(key); } catch { /* ignore */ }
    }
  }
  await db.libraryItem.delete({ where: { id } });
  return c.json({ data: { ok: true } });
});

// ── Audio uploads ─────────────────────────────────────────
//
// Files live in R2 under library/<coachId>/<itemId>/<filename>. We
// serve them back through the Worker (rather than exposing the bucket
// publicly) so coach-scoped access can be enforced later if needed —
// for now the GET is open so the HTML5 <audio> element can play them
// without auth headers.

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
]);
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

function extractKeyFromAudioUrl(url: string): string | null {
  // Our own URLs look like `/api/library/audio/<key>` (key may contain
  // slashes since we passed it through encodeURIComponent on the way in,
  // but here we just slice off the prefix and decode).
  const marker = "/api/library/audio/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

// POST /api/library/:id/audio — multipart upload, single "file" field.
libraryRoutes.post("/:id/audio", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const bucket = (c.env as any)?.MEDIA_BUCKET as R2Bucket | undefined;
  if (!bucket) {
    return c.json({
      error: "Audio uploads aren't available yet — the R2 bucket isn't bound.",
    }, 501);
  }

  const db = getDb();
  const existing = await db.libraryItem.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.coachId !== user.id && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "Expected multipart/form-data" }, 400);
  }
  // Workers FormData returns Blob (or File on browsers); we treat it as
  // a Blob-with-name since File-specific TS types aren't pulled in here.
  const entry = form.get("file");
  if (!entry || typeof entry === "string") {
    return c.json({ error: "Missing `file` field" }, 400);
  }
  const file = entry as Blob & { name?: string };
  // MediaRecorder (and some uploads) report mime types like
  // "audio/webm;codecs=opus" — strip the codec parameter before the
  // allowlist check.
  const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_AUDIO_TYPES.has(baseType)) {
    return c.json({
      error: `Unsupported file type: ${file.type || "unknown"}`,
    }, 415);
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return c.json({
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB; max 25 MB)`,
    }, 413);
  }

  // Replace any prior audio for this item to avoid orphaned objects.
  if (existing.audioUrl) {
    const oldKey = extractKeyFromAudioUrl(existing.audioUrl);
    if (oldKey) {
      try { await bucket.delete(oldKey); } catch { /* ignore */ }
    }
  }

  // Sanitize the filename and prefix-scope by coachId + itemId so the
  // path can't escape the item's namespace.
  const safeName = (file.name ?? "audio").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const key = `library/${user.id}/${id}/${Date.now()}-${safeName}`;
  // Stream the Blob into R2. R2's put() accepts ReadableStream | ArrayBuffer | Blob.
  // Store the base type so playback doesn't carry codec params back.
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: baseType || "application/octet-stream" },
  });

  const audioUrl = `/api/library/audio/${encodeURIComponent(key)}`;
  const updated = await db.libraryItem.update({
    where: { id },
    data: { audioUrl },
  });
  return c.json({ data: serialize(updated) });
});

// DELETE /api/library/:id/audio — clear the audio attachment.
libraryRoutes.delete("/:id/audio", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const db = getDb();
  const existing = await db.libraryItem.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.coachId !== user.id && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }
  const bucket = (c.env as any)?.MEDIA_BUCKET as R2Bucket | undefined;
  if (existing.audioUrl && bucket) {
    const key = extractKeyFromAudioUrl(existing.audioUrl);
    if (key) {
      try { await bucket.delete(key); } catch { /* ignore */ }
    }
  }
  const updated = await db.libraryItem.update({
    where: { id },
    data: { audioUrl: null },
  });
  return c.json({ data: serialize(updated) });
});

// GET /api/library/audio/* — stream audio bytes from R2. The wildcard
// path is everything after /audio/; we don't require auth here so a
// plain HTML5 <audio src="…"> element can play it.
libraryRoutes.get("/audio/*", async (c) => {
  const bucket = (c.env as any)?.MEDIA_BUCKET as R2Bucket | undefined;
  if (!bucket) return c.text("Audio storage not configured", 501);
  // Strip the leading "/api/library/audio/" prefix to recover the key.
  const fullPath = new URL(c.req.url).pathname;
  const prefix = "/api/library/audio/";
  if (!fullPath.startsWith(prefix)) return c.text("Bad path", 400);
  const key = decodeURIComponent(fullPath.slice(prefix.length));
  if (!key.startsWith("library/")) return c.text("Forbidden key", 403);

  const obj = await bucket.get(key);
  if (!obj) return c.text("Not found", 404);

  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "audio/mpeg",
      "content-length": String(obj.size),
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=300",
    },
  });
});

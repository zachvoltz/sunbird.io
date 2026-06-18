// Coach↔student messaging REST surface. Threads are 1:1 (one Conversation per
// pair); messages and auto-posted activity cards share the SessionMessage table.
// Live delivery + away-notifications are handled by the ConversationRoom DO via
// lib/conversations.postMessage. This file is the request/response edge.
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { getDb } from "../lib/db";
import { sendMessageSchema } from "@sunbird/shared";
import {
  ensureConversation,
  serializeConversationMessage,
  senderSelect,
  postMessage,
  messagePreview,
  parseAttachments,
  type ConversationEnv,
} from "../lib/conversations";

export const conversationRoutes = new Hono();

const userPublic = (u: any) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null, bio: u.bio ?? null });

/** Loads the conversation and asserts the caller is its coach or student. */
async function requireParticipant(c: any): Promise<{ conversation: any; user: any } | Response> {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const db = getDb();
  const conversation = await db.conversation.findUnique({
    where: { id },
    include: { coach: { select: senderSelect }, student: { select: senderSelect } },
  });
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);
  if (user.role !== "ADMIN" && conversation.coachId !== user.id && conversation.studentId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return { conversation, user };
}

const counterpartOf = (conversation: any, userId: string) =>
  conversation.coachId === userId ? conversation.student : conversation.coach;

// GET /api/conversations — the caller's threads, most-recent first, each with
// the other participant, a preview, and an unread count.
conversationRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const conversations = await db.conversation.findMany({
    where: { OR: [{ coachId: user.id }, { studentId: user.id }] },
    orderBy: { lastActivityAt: "desc" },
    include: {
      coach: { select: senderSelect },
      student: { select: senderSelect },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, attachments: true } },
    },
  });

  const items = await Promise.all(
    conversations.map(async (cv: any) => {
      const unreadCount = await db.sessionMessage.count({
        where: { conversationId: cv.id, NOT: { senderId: user.id }, reads: { none: { userId: user.id } } },
      });
      const last = cv.messages[0];
      return {
        id: cv.id,
        counterpart: userPublic(counterpartOf(cv, user.id)),
        lastActivityAt: cv.lastActivityAt.toISOString(),
        lastMessagePreview: last ? messagePreview(last.content, parseAttachments(last.attachments).length) : null,
        unreadCount,
      };
    }),
  );

  return c.json({ data: { items } });
});

// POST /api/conversations/with/:userId — open (creating if needed) the thread
// between the caller and another user. Resolves coach/student by role so the
// pair is stored in the canonical (coachId, studentId) order.
conversationRoutes.post("/with/:userId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const otherId = c.req.param("userId");
  if (otherId === user.id) return c.json({ error: "Cannot message yourself" }, 400);
  const db = getDb();
  const other = await db.user.findUnique({ where: { id: otherId }, select: { id: true, role: true } });
  if (!other) return c.json({ error: "User not found" }, 404);

  const coachId = user.role === "COACH" ? user.id : other.id;
  const studentId = user.role === "COACH" ? other.id : user.id;
  const conversation = await ensureConversation(db, coachId, studentId);
  return c.json({ data: { id: conversation.id } }, 201);
});

// GET /api/conversations/:id — thread metadata (the counterpart).
conversationRoutes.get("/:id", requireAuth, async (c) => {
  const check = await requireParticipant(c);
  if (check instanceof Response) return check;
  const { conversation, user } = check;
  return c.json({
    data: {
      id: conversation.id,
      counterpart: userPublic(counterpartOf(conversation, user.id)),
      lastActivityAt: conversation.lastActivityAt.toISOString(),
    },
  });
});

// GET /api/conversations/:id/messages?before=<ISO>&limit=<n> — history, oldest
// first within the page. `before` cursors into older messages for infinite
// scroll; `hasMore` signals another page exists.
conversationRoutes.get("/:id/messages", requireAuth, async (c) => {
  const check = await requireParticipant(c);
  if (check instanceof Response) return check;
  const { conversation } = check;
  const db = getDb();

  const limit = Math.min(Number(c.req.query("limit")) || 40, 100);
  const before = c.req.query("before");
  const rows = await db.sessionMessage.findMany({
    where: {
      conversationId: conversation.id,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: { sender: { select: senderSelect } },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  return c.json({ data: { items: page.map(serializeConversationMessage), hasMore } });
});

// POST /api/conversations/:id/messages — send text and/or attachments.
conversationRoutes.post("/:id/messages", requireAuth, async (c) => {
  const check = await requireParticipant(c);
  if (check instanceof Response) return check;
  const { conversation, user } = check;

  const body = await c.req.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const message = await postMessage(c.env as ConversationEnv, getDb(), {
    conversation,
    senderId: user.id,
    senderName: user.name,
    content: parsed.data.content ?? "",
    kind: "TEXT",
    attachments: parsed.data.attachments ?? null,
  });
  return c.json({ data: message }, 201);
});

// POST /api/conversations/:id/read — mark all incoming messages read for the
// caller (upserts a read receipt per unread message). Cheap idempotent bulk op.
conversationRoutes.post("/:id/read", requireAuth, async (c) => {
  const check = await requireParticipant(c);
  if (check instanceof Response) return check;
  const { conversation, user } = check;
  const db = getDb();

  const unread = await db.sessionMessage.findMany({
    where: { conversationId: conversation.id, NOT: { senderId: user.id }, reads: { none: { userId: user.id } } },
    select: { id: true },
  });
  if (unread.length > 0) {
    await db.sessionMessageRead.createMany({
      data: unread.map((m: any) => ({ messageId: m.id, userId: user.id })),
    });
  }
  return c.json({ data: { read: unread.length } });
});

// GET /api/conversations/:id/ws — upgrade to the live socket. The cookie auth
// already ran (sessionMiddleware); we forward the upgrade to the room DO tagged
// with this user so it can track presence and fan out.
conversationRoutes.get("/:id/ws", requireAuth, async (c) => {
  const check = await requireParticipant(c);
  if (check instanceof Response) return check;
  const { conversation, user } = check;

  const env = c.env as ConversationEnv;
  if (!env.CONVERSATION_ROOM) return c.json({ error: "Realtime not available" }, 501);
  if (c.req.header("Upgrade") !== "websocket") return c.json({ error: "Expected WebSocket" }, 426);

  const stub = env.CONVERSATION_ROOM.get(env.CONVERSATION_ROOM.idFromName(conversation.id));
  // Re-target the URL onto the DO while copying the original request (method,
  // headers, and crucially the WebSocket upgrade) via the init argument.
  return stub.fetch(new Request(`https://room/ws?userId=${encodeURIComponent(user.id)}`, c.req.raw));
});

// ─── Attachments (R2) ───

const CHAT_ATTACH_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/aac", "audio/mp4", "audio/x-m4a",
  "application/pdf",
]);
const MAX_CHAT_ATTACH_BYTES = 25 * 1024 * 1024; // 25 MB

// POST /api/conversations/:id/attachments — multipart (single "file" field).
// Stores in R2 and returns the attachment descriptor; the client then includes
// it in the next POST /messages.
conversationRoutes.post("/:id/attachments", requireAuth, async (c) => {
  const check = await requireParticipant(c);
  if (check instanceof Response) return check;
  const { conversation, user } = check;

  const bucket = (c.env as any)?.MEDIA_BUCKET as R2Bucket | undefined;
  if (!bucket) return c.json({ error: "Attachments aren't available — the R2 bucket isn't bound." }, 501);

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "Expected multipart/form-data" }, 400);
  }
  const entry = form.get("file");
  if (!entry || typeof entry === "string") return c.json({ error: "Missing `file` field" }, 400);
  const file = entry as Blob & { name?: string };
  const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (!CHAT_ATTACH_TYPES.has(baseType)) return c.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, 415);
  if (file.size > MAX_CHAT_ATTACH_BYTES) {
    return c.json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB; max 25 MB)` }, 413);
  }

  const safeName = (file.name ?? "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const key = `chat/${conversation.id}/${user.id}/${Date.now()}-${safeName}`;
  await bucket.put(key, file.stream(), { httpMetadata: { contentType: baseType || "application/octet-stream" } });

  return c.json({
    data: {
      r2Key: key,
      url: `/api/conversations/attachments/${encodeURIComponent(key)}`,
      mime: baseType,
      name: safeName,
      size: file.size,
    },
  });
});

// GET /api/conversations/attachments/* — stream an attachment. Auth-gated and
// scoped to a conversation the caller participates in (keys embed the
// conversation id). Cookies are sent on same-origin <img>/<audio> requests.
conversationRoutes.get("/attachments/*", requireAuth, async (c) => {
  const user = c.get("user")!;
  const bucket = (c.env as any)?.MEDIA_BUCKET as R2Bucket | undefined;
  if (!bucket) return c.text("Attachment storage not configured", 501);

  const prefix = "/api/conversations/attachments/";
  const fullPath = new URL(c.req.url).pathname;
  if (!fullPath.startsWith(prefix)) return c.text("Bad path", 400);
  const key = decodeURIComponent(fullPath.slice(prefix.length));
  const parts = key.split("/");
  if (parts[0] !== "chat" || parts.length < 4) return c.text("Forbidden key", 403);

  const conversationId = parts[1];
  const db = getDb();
  const conversation = await db.conversation.findUnique({ where: { id: conversationId }, select: { coachId: true, studentId: true } });
  if (!conversation) return c.text("Not found", 404);
  if (user.role !== "ADMIN" && conversation.coachId !== user.id && conversation.studentId !== user.id) {
    return c.text("Forbidden", 403);
  }

  const obj = await bucket.get(key);
  if (!obj) return c.text("Not found", 404);
  const headers = new Headers();
  if (obj.httpMetadata?.contentType) headers.set("Content-Type", obj.httpMetadata.contentType);
  headers.set("Cache-Control", "private, max-age=31536000");
  return new Response(obj.body, { headers });
});

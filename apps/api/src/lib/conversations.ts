// Shared helpers for the coach↔student conversation thread: resolving the
// Conversation row, serializing messages/cards, and the single write path
// (postMessage) that persists a row, bumps the thread, and hands off to the
// ConversationRoom Durable Object for live fan-out + notifications.
import type { NotificationEnv } from "../services/notifications.service";

export type ConversationEnv = NotificationEnv & {
  DB?: D1Database;
  CONVERSATION_ROOM?: DurableObjectNamespace;
};

export const senderSelect = { id: true, name: true, avatarUrl: true, bio: true };

export type MessageKind = "TEXT" | "TAKE_SUBMITTED" | "TAKE_REPLY" | "NOTES_SENT" | "ASSIGNMENT" | "SYSTEM";

export function parseAttachments(raw: string | null | undefined) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function serializeConversationMessage(m: any) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    sender: m.sender,
    content: m.content,
    kind: m.kind ?? "TEXT",
    refType: m.refType ?? null,
    refId: m.refId ?? null,
    attachments: parseAttachments(m.attachments),
    createdAt: m.createdAt.toISOString(),
  };
}

/** Find or create the single conversation for a (coach, student) pair. */
export async function ensureConversation(db: any, coachId: string, studentId: string) {
  return db.conversation.upsert({
    where: { coachId_studentId: { coachId, studentId } },
    update: {},
    create: { coachId, studentId },
  });
}

function getRoomStub(env: ConversationEnv, conversationId: string) {
  if (!env.CONVERSATION_ROOM) return null;
  const id = env.CONVERSATION_ROOM.idFromName(conversationId);
  return env.CONVERSATION_ROOM.get(id);
}

/** A short, human preview of a message for notifications + thread lists. */
export function messagePreview(content: string, attachmentCount: number): string {
  if (content && content.trim()) return content.trim();
  if (attachmentCount > 0) return attachmentCount === 1 ? "Sent an attachment" : `Sent ${attachmentCount} attachments`;
  return "New message";
}

export type PostMessageArgs = {
  conversation: { id: string; coachId: string; studentId: string };
  senderId: string;
  senderName?: string;
  content: string;
  kind?: MessageKind;
  refType?: string | null;
  refId?: string | null;
  attachments?: any[] | null;
  // When false, the message is still persisted and broadcast live to connected
  // sockets, but no away-notification is scheduled. Used for activity cards
  // (takes, replies) that already send their own bespoke email.
  notify?: boolean;
};

/**
 * The one write path for the thread. Persists the message, bumps the
 * conversation's lastActivityAt, then best-effort notifies the DO (which
 * broadcasts to live sockets and schedules an away-notification). The DO call
 * is fire-and-forget — a Durable Object hiccup must never fail the send.
 */
export async function postMessage(env: ConversationEnv, db: any, args: PostMessageArgs) {
  const attachments = args.attachments && args.attachments.length > 0 ? JSON.stringify(args.attachments) : null;
  const created = await db.sessionMessage.create({
    data: {
      conversationId: args.conversation.id,
      senderId: args.senderId,
      content: args.content,
      kind: args.kind ?? "TEXT",
      refType: args.refType ?? null,
      refId: args.refId ?? null,
      attachments,
    },
    include: { sender: { select: senderSelect } },
  });
  await db.conversation.update({
    where: { id: args.conversation.id },
    data: { lastActivityAt: created.createdAt },
  });

  const serialized = serializeConversationMessage(created);
  const recipientId = args.senderId === args.conversation.coachId ? args.conversation.studentId : args.conversation.coachId;
  const senderName = args.senderName ?? created.sender?.name ?? "Someone";

  const stub = getRoomStub(env, args.conversation.id);
  if (stub) {
    try {
      await stub.fetch("https://room/message", {
        method: "POST",
        body: JSON.stringify({
          message: serialized,
          // notify:false → broadcast live but skip the away-notification.
          recipientId: args.notify === false ? "" : recipientId,
          senderName,
          preview: messagePreview(args.content, args.attachments?.length ?? 0),
          messageId: created.id,
          conversationId: args.conversation.id,
        }),
      });
    } catch (err) {
      console.error("[conversations] DO fan-out failed:", err);
    }
  }

  return serialized;
}

/**
 * Post an auto-generated activity card into the (coach, student) thread —
 * resolving/creating the conversation first. `actorId` is who triggered it
 * (the student for a take, the coach for a reply/notes), so the card lands in
 * the *other* party's notifications. Best-effort; never throws.
 */
export async function postActivityCard(
  env: ConversationEnv,
  db: any,
  args: {
    coachId: string;
    studentId: string;
    actorId: string;
    actorName?: string;
    kind: MessageKind;
    content: string;
    refType?: string;
    refId?: string;
    notify?: boolean;
  },
) {
  try {
    const conversation = await ensureConversation(db, args.coachId, args.studentId);
    return await postMessage(env, db, {
      conversation,
      senderId: args.actorId,
      senderName: args.actorName,
      content: args.content,
      kind: args.kind,
      refType: args.refType ?? null,
      refId: args.refId ?? null,
      notify: args.notify,
    });
  } catch (err) {
    console.error("[conversations] postActivityCard failed:", err);
    return null;
  }
}

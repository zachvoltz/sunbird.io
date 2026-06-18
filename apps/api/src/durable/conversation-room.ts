// One Durable Object per Conversation. It owns the live side of a thread:
//   • WebSocket fan-out to the two participants (hibernatable sockets, so an
//     idle thread costs nothing);
//   • presence — who is currently connected (used to suppress notifications
//     for someone already looking at the thread);
//   • the debounced, quiet-hours-aware "away" notification alarm.
//
// The REST layer persists messages to D1, then calls this DO's internal
// `/message` endpoint to broadcast + schedule notifications. Sockets are tagged
// with the userId so presence is just `getWebSockets(userId).length`.
import { DurableObject } from "cloudflare:workers";
import { initDbD1, getDb } from "../lib/db";
import { dispatchNotification, getNotificationPref, quietHoursEndsAt, type NotificationEnv } from "../services/notifications.service";

type RoomEnv = NotificationEnv & { DB: D1Database };

// How long to wait after a message before notifying an absent recipient — gives
// them a chance to open the thread (which marks it read) first.
const DEBOUNCE_MS = 60_000;

// A queued notification, keyed by recipient userId in DO storage under "pending".
type Pending = {
  recipientId: string;
  messageId: string;
  conversationId: string;
  senderName: string;
  preview: string;
  fireAt: number; // epoch ms
};

export class ConversationRoom extends DurableObject<RoomEnv> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const userId = url.searchParams.get("userId");
      if (!userId) return new Response("Missing userId", { status: 400 });
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      // Tag the socket with the userId so presence + targeted fan-out are O(1).
      this.ctx.acceptWebSocket(server, [userId]);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/message" && request.method === "POST") {
      const body = (await request.json()) as {
        message: unknown;
        recipientId: string;
        senderName: string;
        preview: string;
        messageId: string;
        conversationId: string;
      };
      this.broadcast(JSON.stringify({ type: "message", message: body.message }));

      // recipientId === "" means the caller asked to broadcast only (activity
      // cards that send their own email) — fan out live but never notify.
      // Otherwise, if the recipient is connected they'll see it live, so we
      // only schedule an away-notification when they're absent.
      const present = !body.recipientId || this.ctx.getWebSockets(body.recipientId).length > 0;
      if (!present) {
        await this.queueNotification({
          recipientId: body.recipientId,
          messageId: body.messageId,
          conversationId: body.conversationId,
          senderName: body.senderName,
          preview: body.preview,
          fireAt: Date.now() + DEBOUNCE_MS,
        });
      }
      return Response.json({ ok: true, present });
    }

    if (url.pathname === "/presence") {
      const userId = url.searchParams.get("userId") ?? "";
      return Response.json({ present: this.ctx.getWebSockets(userId).length > 0 });
    }

    return new Response("Not found", { status: 404 });
  }

  // ─── WebSocket lifecycle (hibernation API) ───

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // The client only needs to keep-alive; reply to pings so proxies don't idle
    // the socket out. Everything else is server→client.
    if (typeof message === "string" && message === "ping") {
      ws.send("pong");
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code, "closing");
    } catch {
      /* already closed */
    }
  }

  async webSocketError(ws: WebSocket) {
    try {
      ws.close(1011, "error");
    } catch {
      /* ignore */
    }
  }

  private broadcast(data: string) {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        /* drop broken socket */
      }
    }
  }

  // ─── Notification scheduling ───

  private async queueNotification(p: Pending) {
    const pending = (await this.ctx.storage.get<Record<string, Pending>>("pending")) ?? {};
    const existing = pending[p.recipientId];
    // Keep the earliest fire time if one is already queued for this recipient.
    pending[p.recipientId] = existing && existing.fireAt < p.fireAt ? { ...p, fireAt: existing.fireAt } : p;
    await this.ctx.storage.put("pending", pending);
    await this.ensureAlarm(pending);
  }

  private async ensureAlarm(pending: Record<string, Pending>) {
    const next = Math.min(...Object.values(pending).map((p) => p.fireAt));
    if (!Number.isFinite(next)) return;
    const current = await this.ctx.storage.getAlarm();
    if (current == null || current > next) {
      await this.ctx.storage.setAlarm(next);
    }
  }

  async alarm() {
    const pending = (await this.ctx.storage.get<Record<string, Pending>>("pending")) ?? {};
    const now = Date.now();
    initDbD1(this.env.DB);
    const db = getDb();

    for (const [recipientId, p] of Object.entries(pending)) {
      if (p.fireAt > now) continue; // not due yet (a deferred entry)

      // Came back online during the debounce → they'll see it in-app.
      if (this.ctx.getWebSockets(recipientId).length > 0) {
        delete pending[recipientId];
        continue;
      }

      // Read it elsewhere (another device / the thread list) → skip.
      const read = await db.sessionMessageRead.findUnique({
        where: { messageId_userId: { messageId: p.messageId, userId: recipientId } },
      }).catch(() => null);
      if (read) {
        delete pending[recipientId];
        continue;
      }

      // Inside quiet hours → defer to the window's end instead of dropping.
      const pref = await getNotificationPref(db, recipientId);
      const deferTo = quietHoursEndsAt(pref, new Date(now));
      if (deferTo) {
        pending[recipientId] = { ...p, fireAt: deferTo.getTime() };
        continue;
      }

      // Deliver.
      const recipient = await db.user.findUnique({
        where: { id: recipientId },
        select: { id: true, email: true, name: true },
      });
      if (recipient?.email) {
        await dispatchNotification(this.env, db, {
          recipient: { id: recipient.id, email: recipient.email, name: recipient.name },
          senderName: p.senderName,
          preview: p.preview,
          conversationId: p.conversationId,
        });
      }
      delete pending[recipientId];
    }

    await this.ctx.storage.put("pending", pending);
    if (Object.keys(pending).length > 0) {
      await this.ensureAlarm(pending);
    }
  }
}

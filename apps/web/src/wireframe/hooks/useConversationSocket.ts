import { useEffect, useRef } from "react";
import type { ConversationMessagePublic } from "@sunbird/shared";
import { conversationsApi } from "@/lib/api";

// Opens the per-conversation WebSocket and pushes each incoming message to
// `onMessage`. Handles:
//   - ~25s "ping"/"pong" keep-alive so proxies don't drop the idle socket,
//   - exponential-backoff reconnect on unexpected close,
//   - clean teardown on unmount / conversation change.
//
// Dedupe of optimistically-rendered sends is the caller's job (match by id);
// the server echoes every message including the sender's own.
export function useConversationSocket(
  conversationId: string | undefined,
  onMessage: (message: ConversationMessagePublic) => void,
) {
  // Keep the latest handler in a ref so reconnects don't tear down the socket
  // just because the callback identity changed.
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!conversationId) return;

    let closedByUs = false;
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const connect = () => {
      ws = new WebSocket(conversationsApi.wsUrl(conversationId));

      ws.onopen = () => {
        attempt = 0;
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25_000);
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string") return;
        if (ev.data === "pong") return;
        try {
          const parsed = JSON.parse(ev.data) as {
            type?: string;
            message?: ConversationMessagePublic;
          };
          if (parsed.type === "message" && parsed.message) {
            handlerRef.current(parsed.message);
          }
        } catch {
          /* ignore non-JSON frames (e.g. stray "pong") */
        }
      };

      ws.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (closedByUs) return;
        // Exponential backoff, capped at 30s.
        const delay = Math.min(30_000, 1_000 * 2 ** attempt);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // Let onclose drive the reconnect; just close the broken socket.
        ws?.close();
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [conversationId]);
}

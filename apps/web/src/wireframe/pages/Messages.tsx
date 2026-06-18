// Coach ↔ student direct messaging. One component tree serves both roles —
// the counterpart is simply "whoever you're not". The conversation list lives
// at /messages and an open thread at /messages/:id.
//
// Frame: coaches get the DTFrame chrome, students the STFrame, chosen from the
// signed-in user's role so the nav/sidebar matches the rest of their app.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  ConversationMessagePublic,
  ConversationSummary,
  MessageAttachment,
  Role,
  UserPublic,
} from "@sunbird/shared";
import { DTFrame } from "../components/DTFrame";
import { STFrame } from "../components/STFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { useConversationSocket } from "../hooks/useConversationSocket";
import { useAuth } from "@/context/AuthContext";
import { conversationsApi } from "@/lib/api";

// ─── shared helpers ───

function isCoach(role: Role | undefined): boolean {
  return role === "COACH" || role === "ADMIN";
}

// Frame wrapper keyed off role so Messages drops into the right chrome.
function MessagesFrame({
  role,
  children,
}: {
  role: Role | undefined;
  children: React.ReactNode;
}) {
  return isCoach(role) ? (
    <DTFrame side="messages">{children}</DTFrame>
  ) : (
    <STFrame side="inbox">{children}</STFrame>
  );
}

function relTime(iso: string, now: number): string {
  const d = new Date(iso);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const diffDays = Math.floor((now - d.getTime()) / 86_400_000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Resolve where an activity card should deep-link, given the viewer's role.
// refType "take" → the take review/detail; "booking" → the lesson/notes page.
function activityLink(
  refType: string | null,
  refId: string | null,
  role: Role | undefined,
): string | null {
  if (!refType || !refId) return null;
  if (refType === "take") {
    return isCoach(role) ? `/coach/takes/${refId}` : `/my-takes`;
  }
  if (refType === "booking") {
    return isCoach(role) ? `/coach/session/${refId}` : `/my-bookings/${refId}`;
  }
  return null;
}

// ─── conversation list ───

export function MessagesListPage() {
  const { user } = useAuth();
  const role = user?.role;
  const [items, setItems] = useState<ConversationSummary[] | undefined>();
  const [loading, setLoading] = useState(true);
  const now = Date.now();

  useEffect(() => {
    let cancelled = false;
    conversationsApi
      .list()
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <MessagesFrame role={role}>
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Messages</h2>
          <div className="dt-sub">
            Direct chats with {isCoach(role) ? "your students" : "your coach"}.
          </div>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%", padding: 0 }}>
          <div className="panel-body scroll" style={{ padding: 0 }}>
            {loading && !items && (
              <div className="small muted" style={{ padding: 20 }}>loading…</div>
            )}
            {!loading && (items?.length ?? 0) === 0 && (
              <div className="small muted" style={{ padding: 24, textAlign: "center" }}>
                No conversations yet.
              </div>
            )}
            {(items ?? []).map((c) => (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={"msg-rail-row" + (c.unreadCount > 0 ? " unread" : "")}
              >
                <Avatar name={c.counterpart.name} size={36} />
                <div className="mrr-body">
                  <div className="mrr-name">{c.counterpart.name}</div>
                  <div className="mrr-preview">
                    {c.lastMessagePreview ?? "No messages yet"}
                  </div>
                </div>
                <span className="mrr-when">{relTime(c.lastActivityAt, now)}</span>
                {c.unreadCount > 0 && (
                  <span className="msg-unread-badge">{c.unreadCount}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </MessagesFrame>
  );
}

// ─── one message ───

function AttachmentView({ a }: { a: MessageAttachment }) {
  if (a.mime.startsWith("image/")) {
    return (
      <div className="msg-attach">
        <a href={a.url} target="_blank" rel="noreferrer">
          <img src={a.url} alt={a.name} />
        </a>
      </div>
    );
  }
  if (a.mime.startsWith("audio/")) {
    return (
      <div className="msg-attach">
        <audio controls src={a.url} />
      </div>
    );
  }
  // pdf / everything else → a download link.
  return (
    <div className="msg-attach">
      <a className="msg-attach-file" href={a.url} target="_blank" rel="noreferrer" download={a.name}>
        <Icon name="note" size={14} /> {a.name}
      </a>
    </div>
  );
}

function MessageRow({
  message,
  mine,
  role,
  pending,
}: {
  message: ConversationMessagePublic;
  mine: boolean;
  role: Role | undefined;
  pending?: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  // Non-TEXT kinds are activity cards rendered distinctly from chat bubbles.
  if (message.kind !== "TEXT") {
    const link = activityLink(message.refType, message.refId, role);
    return (
      <div className="msg-card">
        <span>{message.content}</span>
        {link && (
          <>
            {" "}
            <Link to={link}>open →</Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={"msg-row " + (mine ? "mine" : "theirs")}>
      <div className={"msg-bubble" + (pending ? " pending" : "")}>
        {message.content && <span>{message.content}</span>}
        {message.attachments.map((a) => (
          <AttachmentView key={a.r2Key} a={a} />
        ))}
      </div>
      <div className="msg-time">{time}</div>
    </div>
  );
}

// ─── composer ───

type PendingUpload = {
  localId: string;
  name: string;
  status: "uploading" | "done" | "error";
  attachment?: MessageAttachment;
};

function Composer({
  conversationId,
  onSend,
}: {
  conversationId: string;
  onSend: (body: { content?: string; attachments?: MessageAttachment[] }) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea with its content, up to the CSS max-height.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(140, ta.scrollHeight) + "px";
  }, [text]);

  const readyAttachments = uploads
    .filter((u) => u.status === "done" && u.attachment)
    .map((u) => u.attachment!) as MessageAttachment[];
  const anyUploading = uploads.some((u) => u.status === "uploading");
  const canSend = (text.trim().length > 0 || readyAttachments.length > 0) && !sending && !anyUploading;

  const pickFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const localId = `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2)}`;
      setUploads((prev) => [...prev, { localId, name: file.name, status: "uploading" }]);
      conversationsApi
        .uploadAttachment(conversationId, file)
        .then((attachment) =>
          setUploads((prev) =>
            prev.map((u) =>
              u.localId === localId ? { ...u, status: "done", attachment } : u,
            ),
          ),
        )
        .catch(() =>
          setUploads((prev) =>
            prev.map((u) => (u.localId === localId ? { ...u, status: "error" } : u)),
          ),
        );
    });
  };

  const removeUpload = (localId: string) =>
    setUploads((prev) => prev.filter((u) => u.localId !== localId));

  const doSend = async () => {
    if (!canSend) return;
    const content = text.trim();
    const attachments = readyAttachments;
    setSending(true);
    try {
      await onSend({
        content: content || undefined,
        attachments: attachments.length ? attachments : undefined,
      });
      setText("");
      setUploads([]);
    } catch {
      // onSend surfaces errors; keep the draft so nothing is lost.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="msg-composer">
      {uploads.length > 0 && (
        <div className="msg-pending-chips">
          {uploads.map((u) => (
            <span key={u.localId} className="msg-chip">
              {u.status === "uploading" && <span className="muted">⟳</span>}
              {u.status === "error" && <span style={{ color: "var(--accent)" }}>!</span>}
              <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.name}
              </span>
              <button type="button" onClick={() => removeUpload(u.localId)} title="remove">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="msg-composer-row">
        <button
          type="button"
          className="btn icon ghost"
          onClick={() => fileRef.current?.click()}
          title="attach a file"
          aria-label="attach a file"
        >
          ＋
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/aac,audio/mp4,audio/x-m4a,video/mp4,application/pdf"
          onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
        />
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter inserts a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              doSend();
            }
          }}
          placeholder="Write a message…"
          rows={1}
        />
        <button
          type="button"
          className="btn small primary"
          onClick={doSend}
          disabled={!canSend}
          title={canSend ? "send" : "nothing to send"}
        >
          <Icon name="send" size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── thread ───

const NEAR_BOTTOM_PX = 120;

export function MessageThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const role = user?.role;
  const navigate = useNavigate();

  const [counterpart, setCounterpart] = useState<UserPublic | null>(null);
  const [messages, setMessages] = useState<ConversationMessagePublic[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Track whether the user is pinned near the bottom so live messages only
  // auto-scroll when they would expect it.
  const nearBottomRef = useRef(true);
  // Set after the first page renders so we can jump to the bottom once.
  const didInitialScroll = useRef(false);

  const markRead = useCallback(() => {
    if (id) {
      conversationsApi.read(id)
        .then(() => window.dispatchEvent(new Event("sunbird:inbox-viewed")))
        .catch(() => { /* best-effort */ });
    }
  }, [id]);

  // Initial load: thread meta + latest page of messages.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    didInitialScroll.current = false;
    Promise.all([conversationsApi.get(id), conversationsApi.messages(id)])
      .then(([detail, page]) => {
        if (cancelled) return;
        setCounterpart(detail.counterpart);
        setMessages(page.items);
        setHasMore(page.hasMore);
        markRead();
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, markRead]);

  // Clear unread again whenever the tab/window regains focus.
  useEffect(() => {
    const onFocus = () => markRead();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [markRead]);

  // Live feed — append, dedupe against optimistic/own messages by id.
  const onLive = useCallback(
    (message: ConversationMessagePublic) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // A new inbound message while the thread is open clears its unread.
      markRead();
    },
    [markRead],
  );
  useConversationSocket(id, onLive);

  // Jump to bottom on first render, and keep pinned on new messages when the
  // user was already near the bottom.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!didInitialScroll.current && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
      return;
    }
    if (nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    // Infinite scroll: near the top, fetch an older page.
    if (el.scrollTop < 60 && hasMore && !loadingOlder && messages.length > 0 && id) {
      setLoadingOlder(true);
      const oldest = messages[0].createdAt;
      const prevHeight = el.scrollHeight;
      conversationsApi
        .messages(id, oldest)
        .then((page) => {
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const older = page.items.filter((m) => !known.has(m.id));
            return [...older, ...prev];
          });
          setHasMore(page.hasMore);
          // Preserve the viewport position after prepending older history.
          requestAnimationFrame(() => {
            const e2 = scrollRef.current;
            if (e2) e2.scrollTop = e2.scrollHeight - prevHeight + e2.scrollTop;
          });
        })
        .catch(() => { /* leave as-is */ })
        .finally(() => setLoadingOlder(false));
    }
  }, [hasMore, loadingOlder, messages, id]);

  // Optimistic send: render a temporary bubble, then reconcile with the
  // server message (the WS echo dedupes by id once it arrives).
  const handleSend = useCallback(
    async (body: { content?: string; attachments?: MessageAttachment[] }) => {
      if (!id || !user) return;
      const tempId = `temp-${Date.now()}`;
      const optimistic: ConversationMessagePublic = {
        id: tempId,
        conversationId: id,
        sender: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, bio: user.bio },
        content: body.content ?? "",
        kind: "TEXT",
        refType: null,
        refId: null,
        attachments: body.attachments ?? [],
        createdAt: new Date().toISOString(),
      };
      nearBottomRef.current = true;
      setMessages((prev) => [...prev, optimistic]);
      try {
        const saved = await conversationsApi.send(id, body);
        setMessages((prev) =>
          // Replace the optimistic row; drop any WS echo that already landed.
          prev
            .filter((m) => m.id !== saved.id)
            .map((m) => (m.id === tempId ? saved : m)),
        );
      } catch (err: any) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        window.alert(err?.body?.error ?? "Couldn't send message");
        throw err;
      }
    },
    [id, user],
  );

  const backLink = "/messages";

  if (notFound) {
    return (
      <MessagesFrame role={role}>
        <div className="dt-main-head">
          <div>
            <div className="dt-title">Conversation not found</div>
            <div className="dt-sub">It may have been removed.</div>
          </div>
          <Link to={backLink} className="btn small">back to messages</Link>
        </div>
      </MessagesFrame>
    );
  }

  return (
    <MessagesFrame role={role}>
      <div className="dt-main-body" style={{ padding: 0 }}>
        <div className="msg-thread">
          <div className="msg-thread-head">
            <button
              className="btn icon ghost"
              onClick={() => navigate(backLink)}
              title="back"
              aria-label="back"
            >
              <Icon name="back" size={14} />
            </button>
            <Avatar name={counterpart?.name ?? "?"} size={32} />
            <div style={{ minWidth: 0 }}>
              <div className="bold" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {counterpart?.name ?? "…"}
              </div>
            </div>
          </div>

          <div className="msg-scroll" ref={scrollRef} onScroll={onScroll}>
            {loading && messages.length === 0 && (
              <div className="small muted center">loading…</div>
            )}
            {loadingOlder && (
              <div className="small muted center">loading older…</div>
            )}
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                mine={m.sender.id === user?.id}
                role={role}
                pending={m.id.startsWith("temp-")}
              />
            ))}
            {!loading && messages.length === 0 && (
              <div className="small muted center" style={{ marginTop: 24 }}>
                No messages yet — say hello.
              </div>
            )}
          </div>

          {id && <Composer conversationId={id} onSend={handleSend} />}
        </div>
      </div>
    </MessagesFrame>
  );
}

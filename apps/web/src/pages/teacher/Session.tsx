import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type {
  BookingPublic,
  SessionMessagePublic,
  SessionResourcePublic,
  SessionResourceType,
} from "@sunbird/shared";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

const RESOURCE_TYPE_LABELS: Record<SessionResourceType, string> = {
  LINK: "Link",
  PDF: "PDF",
  AUDIO: "Audio",
};

const RESOURCE_TYPE_ICONS: Record<SessionResourceType, string> = {
  LINK: "\u{1F517}",
  PDF: "\u{1F4C4}",
  AUDIO: "\u{1F3B5}",
};

export function CoachSession() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingPublic | null>(null);
  const [messages, setMessages] = useState<SessionMessagePublic[]>([]);
  const [resources, setResources] = useState<SessionResourcePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Resource form state
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resType, setResType] = useState<SessionResourceType>("LINK");
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [addingResource, setAddingResource] = useState(false);

  const loadBooking = () =>
    apiFetch<{ data: BookingPublic }>(`/api/bookings/${bookingId}`)
      .then((res) => setBooking(res.data))
      .catch(() => setNotFound(true));

  const loadMessages = () =>
    apiFetch<{ data: SessionMessagePublic[] }>(`/api/bookings/${bookingId}/messages`)
      .then((res) => setMessages(res.data))
      .catch(() => {});

  const loadResources = () =>
    apiFetch<{ data: SessionResourcePublic[] }>(`/api/bookings/${bookingId}/resources`)
      .then((res) => setResources(res.data))
      .catch(() => {});

  useEffect(() => {
    if (!bookingId) return;
    Promise.all([loadBooking(), loadMessages(), loadResources()]).finally(() =>
      setLoading(false),
    );
  }, [bookingId]);

  // Poll for new messages every 15s
  useEffect(() => {
    if (!bookingId || notFound) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadMessages();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [bookingId, notFound]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await apiFetch<{ data: SessionMessagePublic }>(
        `/api/bookings/${bookingId}/messages`,
        { method: "POST", body: JSON.stringify({ content: chatInput.trim() }) },
      );
      setMessages((prev) => [...prev, res.data]);
      setChatInput("");
    } catch {
    } finally {
      setSendingChat(false);
    }
  };

  const addResource = async () => {
    if (!resTitle.trim() || !resUrl.trim() || addingResource) return;
    setAddingResource(true);
    try {
      const res = await apiFetch<{ data: SessionResourcePublic }>(
        `/api/bookings/${bookingId}/resources`,
        {
          method: "POST",
          body: JSON.stringify({ type: resType, title: resTitle.trim(), url: resUrl.trim() }),
        },
      );
      setResources((prev) => [res.data, ...prev]);
      setResTitle("");
      setResUrl("");
      setResType("LINK");
      setShowResourceForm(false);
    } catch {
    } finally {
      setAddingResource(false);
    }
  };

  const deleteResource = async (resourceId: string) => {
    try {
      await apiFetch(`/api/bookings/${bookingId}/resources/${resourceId}`, {
        method: "DELETE",
      });
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="py-16 px-6 md:px-10">
        <div className="mx-auto max-w-[900px] text-center">
          <h1 className="font-display text-3xl font-bold mb-4">
            Session not found
          </h1>
          <Link
            to="/coach"
            className="text-sm text-iris hover:text-iris-hover transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const student = booking.user;

  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[1200px]">
        {/* Breadcrumb */}
        <Link
          to="/coach"
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
        >
          &larr; Dashboard
        </Link>

        {/* Header */}
        <div className="mt-8 mb-10 flex items-baseline justify-between">
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Session
          </h1>
          <span
            className={`text-[11px] uppercase tracking-wider font-medium ${
              booking.status === "COMPLETED"
                ? "text-sage"
                : booking.status === "CANCELLED"
                  ? "text-coral"
                  : "text-iris"
            }`}
          >
            {booking.status}
          </span>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left column — Lesson, Student, Resources */}
          <div className="md:col-span-4 space-y-8">
            {/* Lesson Info */}
            <section>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
                Lesson
              </h2>
              <div className="bg-surface rounded-card shadow-card p-6">
                <h3 className="font-display text-lg font-semibold mb-1">
                  {booking.lessonType.title}
                </h3>
                {booking.lessonCategory && (
                  <p className="text-sm text-gold font-medium mb-2">
                    {booking.lessonCategory.title}
                  </p>
                )}
                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                  {booking.lessonType.description}
                </p>
                <p className="text-[12px] text-text-secondary">
                  {formatDate(booking.startsAt)}<br />
                  {formatTime(booking.startsAt)} &ndash; {formatTime(booking.endsAt)}
                </p>
              </div>
            </section>

            {/* Student Info */}
            <section>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
                Student
              </h2>
              <div className="bg-surface rounded-card shadow-card p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-warm-gray flex items-center justify-center">
                    {student?.avatarUrl ? (
                      <img
                        src={student.avatarUrl}
                        alt={student.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="font-display text-sm font-semibold text-text-secondary">
                        {student?.name?.charAt(0) ?? "?"}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold">
                      {student?.name ?? "Unknown student"}
                    </h3>
                    {student?.bio && (
                      <p className="text-sm text-text-secondary mt-1">
                        {student.bio}
                      </p>
                    )}
                  </div>
                </div>
                {booking.studentNote && (
                  <p className="text-sm text-text-secondary mt-4 pt-4 border-t border-charcoal/5 italic">
                    "{booking.studentNote}"
                  </p>
                )}
              </div>
            </section>

            {/* Resources */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                  Resources
                </h2>
                {!showResourceForm && (
                  <button
                    onClick={() => setShowResourceForm(true)}
                    className="text-[12px] font-medium text-iris hover:text-iris-hover transition-colors"
                  >
                    + Add
                  </button>
                )}
              </div>

              {showResourceForm && (
                <div className="bg-surface rounded-card shadow-card p-5 mb-3 space-y-3">
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value as SessionResourceType)}
                    className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
                  >
                    <option value="LINK">Link</option>
                    <option value="PDF">PDF</option>
                    <option value="AUDIO">Audio</option>
                  </select>
                  <input
                    type="text"
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none transition-colors"
                  />
                  <input
                    type="url"
                    value={resUrl}
                    onChange={(e) => setResUrl(e.target.value)}
                    placeholder="URL (e.g. https://...)"
                    className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none transition-colors"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={addResource}
                      disabled={addingResource || !resTitle.trim() || !resUrl.trim()}
                      className="text-[13px] font-medium text-cream bg-iris px-4 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
                    >
                      {addingResource ? "Adding..." : "Add"}
                    </button>
                    <button
                      onClick={() => {
                        setShowResourceForm(false);
                        setResTitle("");
                        setResUrl("");
                      }}
                      className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {resources.length === 0 && !showResourceForm ? (
                <div className="bg-surface rounded-card shadow-card p-5">
                  <p className="text-sm text-text-secondary text-center py-2">
                    No resources shared yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {resources.map((r) => (
                    <div
                      key={r.id}
                      className="bg-surface rounded-card shadow-card p-4 flex items-center gap-3"
                    >
                      <span className="text-base" title={RESOURCE_TYPE_LABELS[r.type]}>
                        {RESOURCE_TYPE_ICONS[r.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-charcoal hover:text-iris transition-colors truncate block"
                        >
                          {r.title}
                        </a>
                        <p className="text-[11px] text-text-secondary">
                          {RESOURCE_TYPE_LABELS[r.type]}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteResource(r.id)}
                        className="text-[11px] text-text-secondary hover:text-coral transition-colors shrink-0"
                        title="Remove resource"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right column — Chat */}
          <div className="md:col-span-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
              Chat
            </h2>
            <div className="bg-surface rounded-card shadow-card overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-text-secondary text-center py-8">
                    No messages yet. Start the conversation.
                  </p>
                )}
                {messages.map((m) => {
                  const isMe = m.sender.id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isMe
                            ? "bg-iris text-cream"
                            : "bg-warm-gray/60 text-charcoal"
                        }`}
                      >
                        {!isMe && (
                          <p className="text-[11px] font-medium mb-0.5 opacity-70">
                            {m.sender.name}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-line">{m.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isMe ? "text-cream/60" : "text-text-secondary"
                          }`}
                        >
                          {formatTimestamp(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-charcoal/10 p-4 flex gap-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 text-sm bg-cream border border-charcoal/10 rounded-full focus:border-charcoal/30 focus:outline-none transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={sendingChat || !chatInput.trim()}
                  className="text-[13px] font-medium text-cream bg-iris px-5 py-2.5 rounded-full hover:bg-iris-hover transition-colors disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

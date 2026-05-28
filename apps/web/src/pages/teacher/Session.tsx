import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VideoCall } from "@/components/session/VideoCall";
import { DTFrame } from "@/wireframe/components/DTFrame";
import type {
  BookingPublic,
  NoteSections,
  SessionMessagePublic,
  SessionResourcePublic,
  SessionResourceType,
  SkillTreeFull,
  StudentProgressPublic,
} from "@sunbird/shared";

type NoteSectionKey = keyof Pick<
  NoteSections,
  "intro" | "scalesExercises" | "topics" | "songWork" | "nextTime"
>;

const NOTE_SECTIONS: Array<{
  key: NoteSectionKey;
  label: string;
  placeholder: string;
}> = [
  {
    key: "intro",
    label: "Intro",
    placeholder: "How they showed up, what was on their mind, anything to set the tone…",
  },
  {
    key: "scalesExercises",
    label: "Exercises done",
    placeholder: "Scales, technical work, warmups — what you ran and how it went.",
  },
  {
    key: "topics",
    label: "Topics discussed",
    placeholder: "Concepts, theory, listening references, anything you talked through.",
  },
  {
    key: "songWork",
    label: "Song work",
    placeholder: "Pieces worked on, sections drilled, performance notes.",
  },
  {
    key: "nextTime",
    label: "Next time",
    placeholder: "What to bring, what to practice, what you'll pick up next lesson.",
  },
];

const EMPTY_SECTIONS: Record<NoteSectionKey, string> = {
  intro: "",
  scalesExercises: "",
  topics: "",
  songWork: "",
  nextTime: "",
};

function SessionShell({ children }: { children: React.ReactNode }) {
  // Sidebar highlights Calendar — bookings are scheduled there, and the
  // coach lands on a session from a calendar event, so it's the natural
  // parent. There's no dedicated session item in the left nav.
  return (
    <DTFrame side="calendar">
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          background: "var(--color-cream)",
        }}
      >
        {children}
      </div>
    </DTFrame>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
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

type Phase = "upcoming" | "live" | "next";

const PHASES: readonly Phase[] = ["upcoming", "live", "next"] as const;

const PHASE_LABELS: Record<Phase, string> = {
  upcoming: "Upcoming",
  live: "Live",
  next: "Next",
};

// 15-minute padding around the booking window — coaches typically join a
// few minutes before, and "Live" should remain selected briefly after the
// scheduled end so they can finish up notes/chat in the same flow.
const LIVE_PAD_MS = 15 * 60 * 1000;

function getDefaultPhase(booking: BookingPublic, now = Date.now()): Phase {
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
    return "next";
  }
  const start = new Date(booking.startsAt).getTime();
  const end = new Date(booking.endsAt).getTime();
  if (now < start - LIVE_PAD_MS) return "upcoming";
  if (now > end + LIVE_PAD_MS) return "next";
  return "live";
}

function formatRelative(ms: number, suffix: "from now" | "ago"): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min}m ${suffix}`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ${suffix}`;
  const day = Math.round(hr / 24);
  return `${day}d ${suffix}`;
}

function phaseHint(booking: BookingPublic, phase: Phase, now = Date.now()): string {
  const start = new Date(booking.startsAt).getTime();
  const end = new Date(booking.endsAt).getTime();
  if (phase === "upcoming") {
    if (now >= start) return "starts now";
    return `starts ${formatRelative(start - now, "from now")}`;
  }
  if (phase === "live") {
    if (now < start) return "starts shortly";
    if (now > end) return "wrapping up";
    return "live now";
  }
  if (booking.status === "CANCELLED") return "cancelled";
  if (booking.status === "COMPLETED") return "completed";
  if (now <= end) return "ready to wrap";
  return `ended ${formatRelative(now - end, "ago")}`;
}

export function CoachSession() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingPublic | null>(null);
  const [messages, setMessages] = useState<SessionMessagePublic[]>([]);
  const [resources, setResources] = useState<SessionResourcePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Workflow phase — defaults to whichever bucket the current time falls
  // in (see getDefaultPhase) but the coach can switch freely. Seeded once
  // from the booking; we don't keep snapping back to the auto value so a
  // manual switch sticks.
  const [phase, setPhase] = useState<Phase>("upcoming");
  const seededPhase = useRef(false);

  // Most recent COMPLETED session this coach had with this student
  // before the current booking, used by the Upcoming tab's "Last time"
  // recap. `undefined` = not loaded yet, `null` = no prior session.
  const [lastSession, setLastSession] = useState<BookingPublic | null | undefined>(undefined);

  // Next-week scheduling card state (Next tab). Optimistic: once the
  // POST returns we stash the new booking so the card switches to a
  // "scheduled" confirmation and links to the new session.
  const [nextWeekBooking, setNextWeekBooking] = useState<BookingPublic | null>(null);
  const [bookingNextWeek, setBookingNextWeek] = useState(false);
  const [nextWeekError, setNextWeekError] = useState<string | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Curriculum state
  const [curriculum, setCurriculum] = useState<SkillTreeFull | null>(null);
  const [progress, setProgress] = useState<StudentProgressPublic[]>([]);

  // Resource form state
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resType, setResType] = useState<SessionResourceType>("LINK");
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [addingResource, setAddingResource] = useState(false);

  // Lesson notes state — five labeled sections, persisted as
  // booking.noteSections (JSON) with a flattened practiceNotes string
  // generated server-side for the student email.
  const [sections, setSections] = useState<Record<NoteSectionKey, string>>(EMPTY_SECTIONS);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [savedSections, setSavedSections] = useState<Record<NoteSectionKey, string>>(EMPTY_SECTIONS);

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

  useEffect(() => {
    if (!booking || seededPhase.current) return;
    setPhase(getDefaultPhase(booking));
    seededPhase.current = true;
  }, [booking]);

  // Fetch the prior completed session once the booking is loaded. Cheap
  // single query on the server; fine to fire even when the coach lands
  // on Live/Next since they might still tab back to Upcoming.
  useEffect(() => {
    if (!bookingId || !booking) return;
    apiFetch<{ data: BookingPublic | null }>(`/api/bookings/${bookingId}/previous`)
      .then((res) => setLastSession(res.data))
      .catch(() => setLastSession(null));
  }, [bookingId, booking?.id]);

  // Seed the section textareas from the booking once it loads (without
  // clobbering whatever the coach has typed locally).
  const seededFromBooking = useRef(false);
  useEffect(() => {
    if (!booking || seededFromBooking.current) return;
    const next: Record<NoteSectionKey, string> = { ...EMPTY_SECTIONS };
    const fromServer = booking.noteSections;
    if (fromServer) {
      for (const { key } of NOTE_SECTIONS) {
        const val = (fromServer as Partial<Record<NoteSectionKey, string>>)[key];
        if (typeof val === "string") next[key] = val;
      }
    } else if (booking.practiceNotes) {
      // Legacy bookings stored everything in `intro` — surface it so the
      // coach can split it across sections rather than lose context.
      next.intro = booking.practiceNotes;
    }
    setSections(next);
    setSavedSections(next);
    seededFromBooking.current = true;
  }, [booking]);

  // Load skill tree + student progress once booking is loaded
  useEffect(() => {
    if (!booking) return;
    const categoryId = booking.category?.id;
    if (!categoryId) return;

    // First get the tree list (summaries), then fetch the full tree
    apiFetch<{ data: Array<{ id: string; title: string }> }>(`/api/skill-trees/by-category/${categoryId}`)
      .then((res) => {
        const trees = res.data;
        const treeId = booking.skillTree?.id
          ? trees.find((t) => t.id === booking.skillTree!.id)?.id
          : trees[0]?.id;
        if (!treeId) return;
        // Fetch the full tree with nodes and edges
        return apiFetch<{ data: SkillTreeFull }>(`/api/skill-trees/${treeId}`);
      })
      .then((res) => {
        if (!res) return;
        setCurriculum(res.data);
        if (booking.user?.id) {
          return apiFetch<{ data: StudentProgressPublic[] }>(
            `/api/skill-trees/${res.data.id}/progress/${booking.user.id}`,
          );
        }
      })
      .then((res) => {
        if (res) setProgress(res.data);
      })
      .catch(() => {});
  }, [booking?.id]);

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

  // Scroll chat to bottom only when the user sends a message
  const shouldScrollChat = useRef(false);
  useEffect(() => {
    if (shouldScrollChat.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldScrollChat.current = false;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await apiFetch<{ data: SessionMessagePublic }>(
        `/api/bookings/${bookingId}/messages`,
        { method: "POST", body: JSON.stringify({ content: chatInput.trim() }) },
      );
      shouldScrollChat.current = true;
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

  const saveNotes = async () => {
    if (!bookingId || savingNotes) return;
    const trimmed: Record<NoteSectionKey, string> = { ...EMPTY_SECTIONS };
    let hasAny = false;
    for (const { key } of NOTE_SECTIONS) {
      const v = sections[key].trim();
      trimmed[key] = v;
      if (v) hasAny = true;
    }
    if (!hasAny) {
      setNotesError("Add at least one section before sending.");
      return;
    }
    setSavingNotes(true);
    setNotesError(null);
    try {
      const res = await apiFetch<{ data: BookingPublic }>(
        `/api/bookings/${bookingId}/notes`,
        {
          method: "PATCH",
          body: JSON.stringify({ noteSections: trimmed }),
        },
      );
      setBooking(res.data);
      setSavedSections(trimmed);
      setNotesSavedAt(new Date().toISOString());
    } catch (err: any) {
      setNotesError(err?.body?.error ?? "Couldn't save notes. Try again.");
    } finally {
      setSavingNotes(false);
    }
  };

  const sectionsDirty = NOTE_SECTIONS.some(
    ({ key }) => sections[key].trim() !== savedSections[key].trim(),
  );
  const sectionsTotalChars = NOTE_SECTIONS.reduce(
    (sum, { key }) => sum + sections[key].length,
    0,
  );
  const hasPriorNotes = !!booking?.practiceNotes;

  const bookSameTimeNextWeek = async () => {
    if (!bookingId || bookingNextWeek || nextWeekBooking) return;
    setBookingNextWeek(true);
    setNextWeekError(null);
    try {
      const res = await apiFetch<{ data: BookingPublic }>(
        `/api/bookings/${bookingId}/next-week`,
        { method: "POST" },
      );
      setNextWeekBooking(res.data);
    } catch (err: any) {
      setNextWeekError(err?.body?.error ?? "Couldn't schedule next week. Try picking another time.");
    } finally {
      setBookingNextWeek(false);
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

  const completedNodeIds = new Set(progress.map((p) => p.nodeId));

  // Build prereq map for determining locked state
  const prereqMap = new Map<string, string[]>();
  for (const edge of curriculum?.edges ?? []) {
    const existing = prereqMap.get(edge.toNodeId) ?? [];
    existing.push(edge.fromNodeId);
    prereqMap.set(edge.toNodeId, existing);
  }

  const toggleNodeProgress = async (nodeId: string) => {
    if (!curriculum || !booking?.user?.id) return;
    const isCompleted = completedNodeIds.has(nodeId);
    if (isCompleted) {
      try {
        await apiFetch(`/api/skill-trees/${curriculum.id}/progress`, {
          method: "DELETE",
          body: JSON.stringify({ nodeId, studentId: booking.user.id }),
        });
        setProgress((prev) => prev.filter((p) => p.nodeId !== nodeId));
      } catch {}
    } else {
      try {
        const res = await apiFetch<{ data: StudentProgressPublic }>(
          `/api/skill-trees/${curriculum.id}/progress`,
          {
            method: "POST",
            body: JSON.stringify({ nodeId, studentId: booking.user.id }),
          },
        );
        setProgress((prev) => [...prev, res.data]);
      } catch {}
    }
  };

  if (loading) {
    return (
      <SessionShell>
        <div className="h-full flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
        </div>
      </SessionShell>
    );
  }

  if (notFound || !booking) {
    return (
      <SessionShell>
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
      </SessionShell>
    );
  }

  const student = booking.user;

  return (
    <SessionShell>
      <div className="py-10 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px]">
        {/* Workflow phase — Upcoming | Live | Next. Default is time-aware
            (getDefaultPhase) but the coach can switch freely; the manual
            choice sticks for the rest of the visit. */}
        <div className="mb-8 flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center bg-warm-gray/30 rounded-card p-1">
            {PHASES.map((p) => {
              const active = phase === p;
              return (
                <button
                  key={p}
                  onClick={() => setPhase(p)}
                  className={`text-[12px] font-medium uppercase tracking-[0.1em] px-4 py-1.5 rounded-card transition-colors ${
                    active
                      ? "bg-iris text-cream shadow-sm"
                      : "text-text-secondary hover:text-charcoal"
                  }`}
                >
                  {p === "live" && active && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cream mr-2 align-middle animate-pulse" />
                  )}
                  {PHASE_LABELS[p]}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-text-secondary">
            {phaseHint(booking, phase)}
          </span>
          <span
            className={`text-[11px] uppercase tracking-wider font-medium ml-auto ${
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

        {/* Video call for online sessions */}
        {phase === "live" && booking.mode === "ONLINE" && booking.status === "CONFIRMED" && (
          <div className="mb-8">
            <VideoCall
              bookingId={bookingId!}
              localUserName={user?.name ?? "You"}
              remoteUserName={student?.name ?? "Student"}
            />
          </div>
        )}

        {/* Lesson notes — captured during Live, finalized/sent in Next.
            Hidden in Upcoming so the pre-lesson view is prep-focused.
            Saves to booking.noteSections and emails the student via
            PATCH /api/bookings/:id/notes. */}
        {(phase === "live" || phase === "next") && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
              Lesson notes for {student?.name?.split(" ")[0] ?? "student"}
            </h2>
            {hasPriorNotes && (
              <span className="text-[11px] text-text-secondary">
                {notesSavedAt
                  ? "Sent just now"
                  : booking.completedAt
                    ? `Sent ${new Date(booking.completedAt).toLocaleDateString()}`
                    : "Sent"}
              </span>
            )}
          </div>
          <div className="bg-surface rounded-card shadow-card p-5">
            {/* Labels sit in a 140px column to the left of each textarea,
                matching the StudentPage's .note-sections grid. */}
            <div
              className="note-sections"
              style={{ rowGap: 14, alignItems: "start" }}
            >
              {NOTE_SECTIONS.map(({ key, label, placeholder }) => (
                <div key={key} className="ns-row">
                  <label
                    htmlFor={`note-${key}`}
                    className="ns-label"
                    style={{ paddingTop: 10 }}
                  >
                    {label}
                  </label>
                  <textarea
                    id={`note-${key}`}
                    value={sections[key]}
                    onChange={(e) => {
                      setSections((prev) => ({ ...prev, [key]: e.target.value }));
                      if (notesError) setNotesError(null);
                    }}
                    placeholder={placeholder}
                    rows={2}
                    maxLength={2000}
                    className="ns-body w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none transition-colors resize-y leading-relaxed"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap pt-5 mt-5 border-t border-charcoal/10">
              <p className="text-[11px] text-text-secondary">
                Saving emails the notes to {student?.name?.split(" ")[0] ?? "the student"}.{" "}
                <span className="text-text-secondary/70">{sectionsTotalChars} chars</span>
              </p>
              <div className="flex items-center gap-3">
                {notesError && (
                  <span className="text-[12px] text-coral">{notesError}</span>
                )}
                {notesSavedAt && !notesError && !sectionsDirty && (
                  <span className="text-[12px] text-sage">Saved &amp; sent.</span>
                )}
                <button
                  onClick={saveNotes}
                  disabled={savingNotes || !sectionsDirty || sectionsTotalChars === 0}
                  className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
                >
                  {savingNotes
                    ? "Sending…"
                    : hasPriorNotes
                      ? "Update & resend"
                      : "Save & send to student"}
                </button>
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Schedule next week — Next-tab quick action. One click books
            the same student at the same time + 7 days; on conflict, the
            coach falls back to /coach/calendar via the secondary link. */}
        {phase === "next" && (() => {
          const nextStart = new Date(new Date(booking.startsAt).getTime() + 7 * 24 * 60 * 60 * 1000);
          const nextEnd = new Date(new Date(booking.endsAt).getTime() + 7 * 24 * 60 * 60 * 1000);
          const studentFirst = student?.name?.split(" ")[0] ?? "student";
          return (
            <section className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                  Next time
                </h2>
              </div>
              <div className="bg-surface rounded-card shadow-card p-5">
                {nextWeekBooking ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-charcoal">
                        Scheduled with {studentFirst}.
                      </p>
                      <p className="text-[12px] text-text-secondary mt-1">
                        {formatDate(nextWeekBooking.startsAt)} &middot;{" "}
                        {formatTime(nextWeekBooking.startsAt)} – {formatTime(nextWeekBooking.endsAt)}
                        {nextWeekBooking.mode === "ONLINE" ? " · online" : " · in person"}
                      </p>
                    </div>
                    <Link
                      to={`/coach/session/${nextWeekBooking.id}`}
                      className="text-[13px] font-medium text-iris hover:text-iris-hover transition-colors"
                    >
                      open new session →
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm text-charcoal">
                        Same lesson, same time, next week.
                      </p>
                      <p className="text-[12px] text-text-secondary mt-1">
                        {formatDate(nextStart.toISOString())} &middot;{" "}
                        {formatTime(nextStart.toISOString())} – {formatTime(nextEnd.toISOString())}
                        {booking.mode === "ONLINE" ? " · online" : " · in person"}
                      </p>
                      {nextWeekError && (
                        <p className="text-[12px] text-coral mt-2">{nextWeekError}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <Link
                        to="/coach/calendar"
                        className="text-[12px] font-medium text-text-secondary hover:text-charcoal transition-colors"
                      >
                        pick another time →
                      </Link>
                      <button
                        onClick={bookSameTimeNextWeek}
                        disabled={bookingNextWeek}
                        className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
                      >
                        {bookingNextWeek ? "Booking…" : "Book same time next week"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* Last time — recap of the most recent completed session with
            this student. Upcoming-only prep card; renders an empty state
            when there's no prior session. */}
        {phase === "upcoming" && (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                Last time
              </h2>
              {lastSession && (
                <span className="text-[11px] text-text-secondary">
                  {formatDate(lastSession.startsAt)} &middot; {formatTime(lastSession.startsAt)}
                </span>
              )}
            </div>
            <div className="bg-surface rounded-card shadow-card p-5">
              {lastSession === undefined ? (
                <p className="text-sm text-text-secondary text-center py-2">
                  Loading…
                </p>
              ) : lastSession === null ? (
                <p className="text-sm text-text-secondary text-center py-2">
                  First session with {student?.name?.split(" ")[0] ?? "this student"}. No previous notes to recap.
                </p>
              ) : (
                (() => {
                  const prior = lastSession.noteSections as Partial<Record<NoteSectionKey, string>> | null;
                  const filled = NOTE_SECTIONS.filter(
                    ({ key }) => prior?.[key]?.trim(),
                  );
                  if (filled.length === 0 && !lastSession.practiceNotes) {
                    return (
                      <p className="text-sm text-text-secondary text-center py-2">
                        Last session completed without notes.
                      </p>
                    );
                  }
                  if (filled.length === 0 && lastSession.practiceNotes) {
                    // Legacy booking — only flat practiceNotes string.
                    return (
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {lastSession.practiceNotes}
                      </p>
                    );
                  }
                  return (
                    <div className="note-sections" style={{ rowGap: 14, alignItems: "start" }}>
                      {filled.map(({ key, label }) => (
                        <div key={key} className="ns-row">
                          <label className="ns-label" style={{ paddingTop: 2 }}>
                            {label}
                          </label>
                          <p className="ns-body text-sm leading-relaxed whitespace-pre-line text-charcoal">
                            {prior?.[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </section>
        )}

        {/* Two-column layout — left column widens when chat is hidden so
            the sidebar cards don't sit next to dead space. */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left column — Lesson, Student, Curriculum, Resources */}
          <div className={`${phase === "live" ? "md:col-span-4" : "md:col-span-12 md:grid md:grid-cols-3 md:gap-8 md:space-y-0"} space-y-8`}>
            {/* Lesson Info */}
            <section>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
                Lesson
              </h2>
              <div className="bg-surface rounded-card shadow-card p-6">
                <h3 className="font-display text-lg font-semibold mb-1">
                  {booking.category?.title ?? "Open"}
                </h3>
                {booking.skillTree && (
                  <p className="text-sm text-gold font-medium mb-2">
                    {booking.skillTree.title}
                  </p>
                )}
                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                  {booking.category?.description ?? ""}
                </p>
                <p className="text-[12px] text-text-secondary">
                  {formatDate(booking.startsAt)}<br />
                  {formatTime(booking.startsAt)} &ndash; {formatTime(booking.endsAt)}
                </p>
                {booking.mode === "IN_PERSON" && (
                  <p className="text-[12px] text-text-secondary mt-3">
                    In person
                  </p>
                )}
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

            {/* Curriculum Progress */}
            {curriculum && curriculum.nodes.length > 0 && (
              <section className="mb-8">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
                  Curriculum ({completedNodeIds.size}/{curriculum.nodes.length})
                </h2>
                <div className="bg-surface rounded-card shadow-card p-5 space-y-1">
                  {curriculum.nodes.map((node) => {
                    const isCompleted = completedNodeIds.has(node.id);
                    const prereqs = prereqMap.get(node.id) ?? [];
                    const isLocked = prereqs.length > 0 && !prereqs.every((p) => completedNodeIds.has(p));

                    return (
                      <button
                        key={node.id}
                        onClick={() => !isLocked && toggleNodeProgress(node.id)}
                        disabled={isLocked}
                        className={`w-full flex items-center gap-3 py-2 px-2 rounded text-left transition-colors ${
                          isLocked
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-warm-gray/20"
                        }`}
                      >
                        <span
                          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                            isCompleted
                              ? "bg-sage border-sage text-cream"
                              : isLocked
                                ? "border-charcoal/20"
                                : "border-charcoal/30"
                          }`}
                        >
                          {isCompleted && "✓"}
                        </span>
                        <span
                          className={`text-sm ${
                            isCompleted
                              ? "text-text-secondary line-through"
                              : "text-charcoal"
                          }`}
                        >
                          {node.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

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

          {/* Right column — Chat. Live only: pre-lesson messaging
              belongs in inbox, post-session messaging too. */}
          {phase === "live" && (
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
          )}
        </div>
      </div>
      </div>
    </SessionShell>
  );
}

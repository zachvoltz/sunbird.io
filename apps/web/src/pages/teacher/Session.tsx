import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VideoCall } from "@/components/session/VideoCall";
import { DTFrame } from "@/wireframe/components/DTFrame";
import { CurrentRoutine } from "@/components/coach/CurrentRoutine";
import { SessionStepper } from "@/components/SessionStepper";
import { useAdjacentLessons } from "@/hooks/useAdjacentLessons";
import { GoalCard } from "@/components/GoalCard";
import { Badge } from "@/components/ui/Badge";
import type {
  BookingPublic,
  GoalPublic,
  NextSuggestedSessionPublic,
  NoteSections,
  RoutinePublic,
  SessionMessagePublic,
  SkillTreeFull,
  StudentDetailPublic,
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

function SessionShell({
  children,
  immersive = false,
}: {
  children: React.ReactNode;
  /** Live-tab full-bleed layout: dark bg, no auto-scroll on the shell so the
   *  page can use an absolute video layer + a separately-scrolling overlay. */
  immersive?: boolean;
}) {
  // Sidebar highlights Calendar — bookings are scheduled there, and the
  // coach lands on a session from a calendar event, so it's the natural
  // parent. There's no dedicated session item in the left nav.
  return (
    <DTFrame side="calendar">
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: immersive ? "hidden" : "auto",
          position: "relative",
          background: immersive ? "#1a1612" : "var(--color-cream)",
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

type Phase = "upcoming" | "live" | "followup";

const PHASES: readonly Phase[] = ["upcoming", "live", "followup"] as const;

const PHASE_LABELS: Record<Phase, string> = {
  upcoming: "Upcoming",
  live: "Live",
  followup: "Follow-up",
};

const STEPPER_STEPS = PHASES.map((p) => ({ key: p, label: PHASE_LABELS[p] }));

// 15-minute padding around the booking window — coaches typically join a
// few minutes before, and "Live" should remain selected briefly after the
// scheduled end so they can finish up notes/chat in the same flow.
const LIVE_PAD_MS = 15 * 60 * 1000;

function getDefaultPhase(booking: BookingPublic, now = Date.now()): Phase {
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
    return "followup";
  }
  const start = new Date(booking.startsAt).getTime();
  const end = new Date(booking.endsAt).getTime();
  if (now < start - LIVE_PAD_MS) return "upcoming";
  if (now > end + LIVE_PAD_MS) return "followup";
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
  const navigate = useNavigate();
  const adjacent = useAdjacentLessons(bookingId);

  const [booking, setBooking] = useState<BookingPublic | null>(null);
  const [messages, setMessages] = useState<SessionMessagePublic[]>([]);
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

  // Chat state. `chatOpen` controls the Live-tab floating chat panel —
  // collapsed it becomes a small toggle pill at the right edge.
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Curriculum state
  const [curriculum, setCurriculum] = useState<SkillTreeFull | null>(null);
  const [progress, setProgress] = useState<StudentProgressPublic[]>([]);

  // Current routine — fetched after the booking loads so we know the
  // student. Upcoming read-only; Follow-up editable (coach updates it
  // as part of the post-lesson plan).
  const [routine, setRoutine] = useState<RoutinePublic | null>(null);

  // Full student detail — goals (shared) + streak feed the Upcoming prep
  // column. Loaded alongside the routine.
  const [studentDetail, setStudentDetail] = useState<StudentDetailPublic | null>(null);

  // Book-next gate — fires on "End lesson" when there's no future booking.
  const [gateOpen, setGateOpen] = useState(false);
  const [nextSuggested, setNextSuggested] = useState<NextSuggestedSessionPublic | null>(null);

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

  useEffect(() => {
    if (!bookingId) return;
    Promise.all([loadBooking(), loadMessages()]).finally(() =>
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

  // Load the student's current routine once we know who they are.
  useEffect(() => {
    const studentId = booking?.user?.id;
    if (!studentId) return;
    apiFetch<{ data: StudentDetailPublic }>(`/api/coaches/students/${studentId}`)
      .then((res) => {
        setStudentDetail(res.data);
        setRoutine(res.data.routine);
      })
      .catch(() => {});
  }, [booking?.user?.id]);

  // Pre-load the next-session suggestion so the gate + Follow-up cards know
  // whether a future booking already exists.
  useEffect(() => {
    if (!bookingId || !booking) return;
    apiFetch<{ data: NextSuggestedSessionPublic }>(`/api/bookings/${bookingId}/next-suggested`)
      .then((res) => setNextSuggested(res.data))
      .catch(() => {});
  }, [bookingId, booking?.id, nextWeekBooking?.id]);

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

  // "End lesson" — gate the move into Follow-up on booking the next session.
  // If one's already on the books we go straight to Follow-up; otherwise the
  // book-next modal opens.
  const handleEndLesson = () => {
    if (nextSuggested && !nextSuggested.alreadyBooked && !nextWeekBooking) {
      setGateOpen(true);
    } else {
      setPhase("followup");
    }
  };

  // Book from the gate, then continue into Follow-up. Reuses the same
  // same-time-next-week booking the Follow-up card uses.
  const bookFromGate = async () => {
    await bookSameTimeNextWeek();
    setGateOpen(false);
    setPhase("followup");
  };

  const skipFromGate = () => {
    // Leaving it unbooked drops a to-do into the coach's Needs you column
    // (computed server-side in the dashboard).
    setGateOpen(false);
    setPhase("followup");
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
  const isLive = phase === "live";

  return (
    <SessionShell immersive={isLive}>
      {/* Live-tab background layer — video (when online & confirmed) or a
          dark placeholder otherwise. Stays put while the overlay above
          scrolls; the cards already use opaque bg-surface so they read
          cleanly against the dark backdrop. */}
      {isLive && (
        <div className="absolute inset-0 z-0">
          {booking.mode === "ONLINE" && booking.status === "CONFIRMED" ? (
            <div className="w-full h-full p-4 md:p-6">
              <VideoCall
                bookingId={bookingId!}
                localUserName={user?.name ?? "You"}
                remoteUserName={student?.name ?? "Student"}
              />
            </div>
          ) : (
            <div className="w-full h-full" style={{ background: "#1a1612" }} />
          )}
        </div>
      )}
      <div
        className={
          isLive
            ? "absolute inset-0 z-10 overflow-y-auto py-10 px-6 md:px-10 pointer-events-none"
            : "py-10 px-6 md:px-10"
        }
      >
        <div
          className="mx-auto max-w-[1200px]"
          style={isLive ? { pointerEvents: "auto" } : undefined}
        >
        {/* Workflow phase — Upcoming → Live → Follow-up. Default is
            time-aware (getDefaultPhase) but the coach can switch freely;
            the manual choice sticks for the rest of the visit. Booking the
            next session gates the move into Follow-up (see handleEndLesson). */}
        <SessionStepper
          steps={STEPPER_STEPS}
          activeKey={phase}
          onSelect={(key) => setPhase(key as Phase)}
          showNav
          hasPrev={!!adjacent.prev}
          hasNext={!!adjacent.next}
          onPrev={() => adjacent.prev && navigate(`/coach/session/${adjacent.prev.id}`)}
          onNext={() => adjacent.next && navigate(`/coach/session/${adjacent.next.id}`)}
          meta={
            <span className="flex items-center gap-3">
              <span>{phaseHint(booking, phase)}</span>
              {student?.name && (
                <span>
                  {student.name.split(" ")[0]}
                  {booking.category?.title ? ` · ${booking.category.title}` : ""}
                </span>
              )}
            </span>
          }
        />

        {/* During Live, "End lesson" is what triggers the book-next gate. */}
        {phase === "live" && (
          <div className="mb-8 -mt-4 flex items-center gap-3 pointer-events-auto">
            <span className="inline-flex items-center text-[12px] font-medium text-iris">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-iris mr-2 animate-pulse" />
              in session
            </span>
            <button
              onClick={handleEndLesson}
              className="ml-auto text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors"
            >
              End lesson →
            </button>
          </div>
        )}

        {/* (Live video lives in the SessionShell background layer above —
            rendered once per page when phase === "live".) */}

        {/* Schedule next week — Next-tab quick action, placed above the
            routine/notes columns so the coach books the follow-up first.
            One click books the same student at the same time + 7 days; on
            conflict, the coach falls back to /coach/calendar. */}
        {phase === "followup" && (() => {
          const nextStart = new Date(new Date(booking.startsAt).getTime() + 7 * 24 * 60 * 60 * 1000);
          const nextEnd = new Date(new Date(booking.endsAt).getTime() + 7 * 24 * 60 * 60 * 1000);
          const studentFirst = student?.name?.split(" ")[0] ?? "student";
          return (
            <section className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                  Next session
                </h2>
                {nextWeekBooking || nextSuggested?.alreadyBooked ? (
                  <Badge variant="success">booked</Badge>
                ) : (
                  <Badge variant="warning">not booked</Badge>
                )}
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
                {!nextWeekBooking && !nextSuggested?.alreadyBooked && (
                  <p className="text-[11px] text-text-secondary mt-3 pt-3 border-t border-charcoal/10">
                    You skipped booking at the end of the lesson — this is sitting in your{" "}
                    <Link to="/coach" className="text-iris hover:text-iris-hover">Needs you</Link> column until booked.
                  </p>
                )}
              </div>
            </section>
          );
        })()}

        {/* Lesson notes — drafted on the Next tab as the coach wraps up.
            Hidden during Live (the lesson itself) and Upcoming (the
            pre-lesson prep view). Saves to booking.noteSections and
            emails the student via PATCH /api/bookings/:id/notes. */}
        {phase === "followup" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start mb-10">
          {/* Routine for next time — editable post-lesson plan, narrow
              column beside the wider lesson-notes editor. */}
          {booking.user?.id && (
          <section className="md:col-span-4">
            <CurrentRoutine
              routine={routine ?? { items: [], updatedAt: null }}
              editable
              startInEditMode
              saveUrl={`/api/coaches/students/${booking.user.id}/routine`}
              bookingId={booking.id}
              onSaved={setRoutine}
              title="Routine for next time"
            />
          </section>
          )}

          {/* Lesson notes */}
          <section className={booking.user?.id ? "md:col-span-8" : "md:col-span-12"}>
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

            {/* AI summary of this lesson, when generated — sent alongside the note. */}
            {studentDetail?.latestLessonSummary &&
              studentDetail.latestLessonSummary.bookingId === booking.id &&
              studentDetail.latestLessonSummary.bullets.length > 0 && (
              <div className="ai-summary mt-4">
                <div className="ai-summary-head">
                  <span className="ai-badge">✦ AI</span>
                  <span className="ai-title">lesson summary</span>
                  {studentDetail.latestLessonSummary.durationMin && (
                    <span className="ai-meta">{studentDetail.latestLessonSummary.durationMin} min · from recording</span>
                  )}
                </div>
                <ul className="ai-bullets">
                  {studentDetail.latestLessonSummary.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

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
        </div>
        )}

        {/* Upcoming prep — three columns mirroring the design: last
            session's note (+ AI summary), the daily routine the student's
            practicing, and a prep column (shared goals + today's agenda). */}
        {phase === "upcoming" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start mb-10">
          {/* Last session — recap of the most recent completed session with
              this student, plus its AI summary if one exists. */}
          <section className="md:col-span-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                Last session
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

              {/* AI summary of the last lesson, when generated. */}
              {studentDetail?.latestLessonSummary &&
                studentDetail.latestLessonSummary.bullets.length > 0 && (
                <div className="ai-summary compact mt-4">
                  <div className="ai-summary-head">
                    <span className="ai-badge">✦ AI</span>
                    <span className="ai-title">summary</span>
                    {studentDetail.latestLessonSummary.durationMin && (
                      <span className="ai-meta">{studentDetail.latestLessonSummary.durationMin} min</span>
                    )}
                  </div>
                  <ul className="ai-bullets">
                    {studentDetail.latestLessonSummary.bullets.slice(0, 3).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Daily routine — what the student is practicing until today. */}
          {booking.user?.id && (
          <section className="md:col-span-4">
            <CurrentRoutine
              routine={routine ?? { items: [], updatedAt: null }}
              editable={false}
              title="Daily routine"
              emptyHint="No routine set yet — set one in Follow-up after the lesson."
            />
            {studentDetail?.streak && studentDetail.streak.currentDays > 0 && (
              <p className="text-[12px] text-text-secondary mt-3">
                🔥 {studentDetail.streak.currentDays}-day practice streak
              </p>
            )}
          </section>
          )}

          {/* Prep — shared goals + today's agenda (derived from new goals and
              the student's "bring up" note on this booking). */}
          <section className="md:col-span-3 space-y-5">
            {(() => {
              const goals = studentDetail?.goals ?? [];
              const newGoals = goals.filter((g) => g.isNew && g.status === "ACTIVE");
              const studentNoteItems = (booking.studentNote ?? "")
                .split(/\n+/)
                .map((s) => s.trim())
                .filter(Boolean);
              return (
                <>
                  {goals.length > 0 && (
                    <div>
                      <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                        {student?.name?.split(" ")[0] ?? "Student"}'s goals · shared
                      </h2>
                      <div className="space-y-3">
                        {goals.slice(0, 3).map((g) => (
                          <GoalCard key={g.id} goal={g} compact showShared={false} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                      Today's agenda
                    </h2>
                    <div className="bg-surface rounded-card shadow-card p-4 space-y-2">
                      {newGoals.length === 0 && studentNoteItems.length === 0 ? (
                        <p className="text-[12px] text-text-secondary">
                          Nothing flagged yet — new goals and the student's questions land here.
                        </p>
                      ) : (
                        <>
                          {newGoals.map((g) => (
                            <div key={g.id} className="flex items-start gap-2 rounded-card bg-blush border border-iris px-2.5 py-1.5">
                              <span className="text-iris text-xs mt-0.5">✨</span>
                              <div className="min-w-0">
                                <div className="text-[12.5px] font-medium text-charcoal leading-tight">{g.title}</div>
                                <div className="text-[10.5px] text-iris">new goal · talk through approach</div>
                              </div>
                            </div>
                          ))}
                          {studentNoteItems.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-iris text-xs mt-1">›</span>
                              <span className="text-[12.5px] text-charcoal leading-snug">{item}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </section>
        </div>
        )}

        {/* Two-column layout — left column widens when chat is hidden so
            the sidebar cards don't sit next to dead space. */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left column — Curriculum. */}
          <div className={`${phase === "live" ? "md:col-span-4" : "md:col-span-12 md:grid md:grid-cols-3 md:gap-8 md:space-y-0"} space-y-8`}>
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

          </div>

        </div>
        </div>

      </div>

      {/* Floating chat — Live only. Anchored to the right edge of the
          SessionShell so it stays put while the page content scrolls.
          Collapses into a small pill at the same right edge so the
          video has room to breathe. */}
      {isLive && (
        <div
          className="absolute z-20"
          style={{ right: 24, top: 96, bottom: 24, pointerEvents: "auto" }}
        >
          {chatOpen ? (
            <div
              className="flex flex-col rounded-card overflow-hidden border border-cream/10 backdrop-blur"
              style={{
                width: "min(320px, calc(100vw - 48px))",
                height: "min(520px, 100%)",
                background: "rgba(26, 22, 18, 0.35)",
              }}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-cream/10">
                <span className="text-[11px] font-medium uppercase tracking-wider text-cream/70">
                  Chat{messages.length > 0 ? ` · ${messages.length}` : ""}
                </span>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-cream/70 hover:text-cream text-[16px] leading-none px-2"
                  aria-label="Collapse chat"
                  title="Collapse chat"
                >
                  ›
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                  <p className="text-[12px] text-cream/60 text-center py-6">
                    No messages yet.
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
                        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                          isMe
                            ? "bg-iris text-cream"
                            : "bg-warm-gray/70 text-charcoal"
                        }`}
                      >
                        {!isMe && (
                          <p className="text-[10px] font-medium mb-0.5 opacity-70">
                            {m.sender.name}
                          </p>
                        )}
                        <p className="text-[13px] whitespace-pre-line">{m.content}</p>
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
              <div className="border-t border-cream/10 p-2 flex gap-2">
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
                  placeholder="Message…"
                  className="flex-1 px-3 py-1.5 text-[13px] bg-cream/90 border border-cream/10 rounded-full focus:border-cream/40 focus:outline-none transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={sendingChat || !chatInput.trim()}
                  className="text-[12px] font-medium text-cream bg-iris px-3 py-1.5 rounded-full hover:bg-iris-hover transition-colors disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="text-[12px] font-medium text-cream bg-iris/90 backdrop-blur rounded-card shadow-card px-3 py-2 hover:bg-iris transition-colors"
              aria-label="Open chat"
            >
              ‹ Chat{messages.length > 0 ? ` · ${messages.length}` : ""}
            </button>
          )}
        </div>
      )}

      {/* Book-next gate — fires on "End lesson" when no future booking exists.
          Booking continues into Follow-up; skipping leaves a to-do in the
          coach's Needs you column. */}
      {gateOpen && (() => {
        const first = student?.name?.split(" ")[0] ?? "the student";
        const suggested = nextSuggested?.suggested;
        const recurring = nextSuggested?.recurring;
        const suggestedLabel = suggested
          ? `${formatDate(suggested.startsAt)} · ${formatTime(suggested.startsAt)}`
          : null;
        return (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-6" style={{ background: "rgba(26,22,18,0.45)", pointerEvents: "auto" }}>
            <div className="w-full max-w-[520px] bg-surface rounded-card shadow-elevated overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal/10">
                <h3 className="font-display text-2xl font-bold">Book {first}'s next session</h3>
                <button onClick={() => setGateOpen(false)} className="text-text-secondary hover:text-charcoal text-lg leading-none" aria-label="Close">×</button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-2 rounded-card bg-blush border border-iris px-3 py-2.5">
                  <span className="text-iris font-bold">!</span>
                  <span className="text-[13px] text-charcoal">No next session is on the calendar yet. Lock it in before {first} leaves.</span>
                </div>

                {suggested && (
                  <div className="rounded-card border-2 border-iris p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-charcoal">
                          {recurring ? "Repeat weekly · " : ""}{suggestedLabel}
                        </div>
                        <div className="text-[12px] text-text-secondary mt-0.5">
                          {recurring ? `${first}'s usual slot · ` : ""}same time next week
                        </div>
                      </div>
                      <Badge variant="default">recommended</Badge>
                    </div>
                    {nextWeekError && <p className="text-[12px] text-coral mt-2">{nextWeekError}</p>}
                  </div>
                )}

                <Link
                  to="/coach/calendar"
                  className="block text-[12px] font-medium text-text-secondary hover:text-charcoal transition-colors"
                >
                  or pick another time →
                </Link>
              </div>
              <div className="flex items-center gap-3 px-6 py-4 border-t border-charcoal/10">
                <div className="leading-tight">
                  <button onClick={skipFromGate} className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors">
                    skip — remind me later
                  </button>
                  <div className="text-[11px] text-text-secondary mt-0.5">adds a to-do to your <span className="font-medium">Needs you</span> column</div>
                </div>
                <button
                  onClick={bookFromGate}
                  disabled={bookingNextWeek || !suggested}
                  className="ml-auto text-[13px] font-medium text-cream bg-iris px-5 py-2.5 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
                >
                  {bookingNextWeek ? "Booking…" : "book & go to follow-up →"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </SessionShell>
  );
}

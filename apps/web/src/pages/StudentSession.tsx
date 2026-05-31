import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VideoCall } from "@/components/session/VideoCall";
import { STFrame } from "@/wireframe/components/STFrame";
import { SessionStepper } from "@/components/SessionStepper";
import { GoalCard } from "@/components/GoalCard";
import { Badge } from "@/components/ui/Badge";
import type {
  BookingPublic,
  NextSuggestedSessionPublic,
  NoteSections,
  SessionMessagePublic,
  StudentDetailPublic,
} from "@sunbird/shared";

function SessionShell({ children }: { children: React.ReactNode }) {
  return (
    <STFrame side="lessons">
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--color-cream)" }}>
        {children}
      </div>
    </STFrame>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type Phase = "upcoming" | "live" | "followup";
const PHASES: readonly Phase[] = ["upcoming", "live", "followup"] as const;
const STEP_LABELS: Record<Phase, string> = { upcoming: "Upcoming", live: "Live", followup: "Follow-up" };
const STEPPER_STEPS = PHASES.map((p) => ({ key: p, label: STEP_LABELS[p] }));

const LIVE_PAD_MS = 15 * 60 * 1000;
function getDefaultPhase(b: BookingPublic, now = Date.now()): Phase {
  if (b.status === "COMPLETED" || b.status === "CANCELLED") return "followup";
  const start = new Date(b.startsAt).getTime();
  const end = new Date(b.endsAt).getTime();
  if (now < start - LIVE_PAD_MS) return "upcoming";
  if (now > end + LIVE_PAD_MS) return "followup";
  return "live";
}

// The teacher's note as a clean recap — sections if present, else the flat
// practiceNotes string.
function NoteRecap({ sections, flat }: { sections: NoteSections | null; flat: string | null }) {
  const filled = sections
    ? (Object.entries(sections) as [keyof NoteSections, string | undefined][]).filter(([, v]) => v?.trim())
    : [];
  if (filled.length === 0 && flat) {
    return <p className="text-sm leading-relaxed whitespace-pre-line text-charcoal">{flat}</p>;
  }
  if (filled.length === 0) {
    return <p className="text-sm text-text-secondary">No note from your teacher yet.</p>;
  }
  const LABELS: Record<string, string> = {
    intro: "Intro", scalesExercises: "Exercises", topics: "Topics", songWork: "Song work", nextTime: "Next time",
  };
  return (
    <div className="note-sections" style={{ rowGap: 12, alignItems: "start" }}>
      {filled.map(([key, v]) => (
        <div key={key} className="ns-row">
          <label className="ns-label" style={{ paddingTop: 2 }}>{LABELS[key] ?? key}</label>
          <p className="ns-body text-sm leading-relaxed whitespace-pre-line text-charcoal">{v}</p>
        </div>
      ))}
    </div>
  );
}

const ROUTINE_KIND_ICON: Record<string, string> = { warmup: "🔥", exercise: "♪", song: "🎵" };

export function StudentSession() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingPublic | null>(null);
  const [messages, setMessages] = useState<SessionMessagePublic[]>([]);
  const [detail, setDetail] = useState<StudentDetailPublic | null>(null);
  const [nextSuggested, setNextSuggested] = useState<NextSuggestedSessionPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [phase, setPhase] = useState<Phase>("upcoming");
  const seededPhase = useRef(false);

  // "Bring up with my coach" note → persists to booking.studentNote.
  const [bringUp, setBringUp] = useState("");
  const [savedBringUp, setSavedBringUp] = useState("");
  const [savingBringUp, setSavingBringUp] = useState(false);

  // Chat state (kept for the Live phase)
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    Promise.all([
      loadBooking(),
      loadMessages(),
      apiFetch<{ data: StudentDetailPublic }>("/api/me/student-data")
        .then((res) => setDetail(res.data))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    if (!booking || seededPhase.current) return;
    setPhase(getDefaultPhase(booking));
    seededPhase.current = true;
    setBringUp(booking.studentNote ?? "");
    setSavedBringUp(booking.studentNote ?? "");
  }, [booking]);

  useEffect(() => {
    if (!bookingId || !booking) return;
    apiFetch<{ data: NextSuggestedSessionPublic }>(`/api/bookings/${bookingId}/next-suggested`)
      .then((res) => setNextSuggested(res.data))
      .catch(() => {});
  }, [bookingId, booking?.id]);

  // Poll messages every 15s
  useEffect(() => {
    if (!bookingId || notFound) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadMessages();
    }, 15000);
    return () => clearInterval(interval);
  }, [bookingId, notFound]);

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

  const saveBringUp = async () => {
    if (savingBringUp || bringUp.trim() === savedBringUp.trim()) return;
    setSavingBringUp(true);
    try {
      const res = await apiFetch<{ data: BookingPublic }>(`/api/bookings/${bookingId}/student-note`, {
        method: "PATCH",
        body: JSON.stringify({ studentNote: bringUp.trim() }),
      });
      setBooking(res.data);
      setSavedBringUp(res.data.studentNote ?? "");
    } catch {
    } finally {
      setSavingBringUp(false);
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
        <div className="py-16 px-6 md:px-10 text-center">
          <h1 className="font-display text-3xl font-bold mb-4">Session not found</h1>
          <Link to="/my-bookings" className="text-sm text-iris hover:text-iris-hover">Back to my bookings</Link>
        </div>
      </SessionShell>
    );
  }

  const coach = booking.coach;
  const isLive = phase === "live";
  const goals = detail?.goals ?? [];
  const routineItems = detail?.routine?.items ?? [];
  const recentDays = detail?.recentPracticeDays ?? [];
  const streak = detail?.streak;

  // This-week practice days (last 7 calendar days present in recentPracticeDays).
  const weekKeys = (() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() - i * 86_400_000);
      keys.push(d.toISOString().slice(0, 10));
    }
    return new Set(keys);
  })();
  const daysThisWeek = recentDays.filter((d) => weekKeys.has(d)).length;

  return (
    <SessionShell>
      {isLive && (
        <div className="absolute inset-0 z-0">
          {booking.mode === "ONLINE" && booking.status === "CONFIRMED" ? (
            <div className="w-full h-full p-4 md:p-6">
              <VideoCall bookingId={bookingId!} localUserName={user?.name ?? "You"} remoteUserName={coach?.name ?? "Coach"} />
            </div>
          ) : (
            <div className="w-full h-full" style={{ background: "#1a1612" }} />
          )}
        </div>
      )}

      <div className={isLive ? "absolute inset-0 z-10 overflow-y-auto py-8 px-6 md:px-10 pointer-events-none" : "py-10 px-6 md:px-10"}>
        <div className="mx-auto max-w-[1000px]" style={isLive ? { pointerEvents: "auto" } : undefined}>
          {/* Phase stepper — walks Upcoming → Live → Follow-up */}
          <SessionStepper
            steps={STEPPER_STEPS}
            activeKey={phase}
            onSelect={(k) => setPhase(k as Phase)}
            meta={
              <span>
                {coach?.name ? `with ${coach.name.split(" ")[0]}` : ""} · {formatShortDate(booking.startsAt)} · {formatTime(booking.startsAt)}
              </span>
            }
          />

          {/* ── UPCOMING ───────────────────────────────────── */}
          {phase === "upcoming" && (
            <div className="space-y-6">
              {/* Practice CTA */}
              <div className="bg-surface rounded-card shadow-card p-5 border-2 border-iris">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="font-display text-2xl font-bold leading-tight">Practice your routine</h2>
                    <p className="text-[12px] text-text-secondary mt-1">
                      {routineItems.length} {routineItems.length === 1 ? "stop" : "stops"} · before your lesson
                    </p>
                  </div>
                  {streak && streak.currentDays > 0 && <Badge variant="warning">🔥 {streak.currentDays}</Badge>}
                </div>
                <Link
                  to="/practice"
                  className="block text-center mt-4 text-[13px] font-medium text-cream bg-iris px-5 py-2.5 rounded-card hover:bg-iris-hover transition-colors"
                >
                  Open practice path →
                </Link>
              </div>

              {/* Practice stats */}
              <section>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">Your practice</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { v: streak?.currentDays ?? 0, l: "day streak" },
                    { v: `${daysThisWeek}/7`, l: "this week" },
                    { v: detail?.takes?.length ?? 0, l: "takes sent" },
                  ].map((s, i) => (
                    <div key={i} className="bg-surface rounded-card shadow-card py-4 text-center">
                      <div className="font-display text-2xl font-bold leading-none">{s.v}</div>
                      <div className="text-[11px] text-text-secondary mt-1">{s.l}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Teacher note from last lesson */}
              <section>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                  From {coach?.name?.split(" ")[0] ?? "your teacher"} · last lesson
                </h2>
                <div className="bg-surface rounded-card shadow-card p-5">
                  <NoteRecap sections={detail?.latestNoteSections ?? null} flat={detail?.latestNotePracticeNotes ?? null} />
                </div>
              </section>

              {/* Goals (shared) */}
              {goals.length > 0 && (
                <section>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">Your goals · shared</h2>
                    <Link to="/my-goals" className="text-[11px] font-medium text-iris hover:text-iris-hover">all goals →</Link>
                  </div>
                  <div className="space-y-3">
                    {goals.slice(0, 2).map((g) => (
                      <GoalCard key={g.id} goal={g} compact />
                    ))}
                  </div>
                </section>
              )}

              {/* Bring up with coach → studentNote */}
              <section>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                  Bring up with {coach?.name?.split(" ")[0] ?? "your coach"}
                </h2>
                <div className="bg-surface rounded-card shadow-card p-5">
                  <textarea
                    value={bringUp}
                    onChange={(e) => setBringUp(e.target.value)}
                    onBlur={saveBringUp}
                    placeholder="A question or something you're stuck on — e.g. “bar 22 keeps tripping me up”…"
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none resize-y leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-text-secondary italic">
                      ✦ these pop up as agenda items at the start of your lesson
                    </p>
                    <button
                      onClick={saveBringUp}
                      disabled={savingBringUp || bringUp.trim() === savedBringUp.trim()}
                      className="text-[12px] font-medium text-iris hover:text-iris-hover disabled:opacity-40"
                    >
                      {savingBringUp ? "Saving…" : bringUp.trim() === savedBringUp.trim() ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ── LIVE ───────────────────────────────────────── */}
          {phase === "live" && (
            <div className="space-y-4 max-w-[420px]">
              <div className="bg-surface/95 backdrop-blur rounded-card shadow-card p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center text-[12px] font-medium text-iris">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-iris mr-2 animate-pulse" />
                    in your lesson
                  </span>
                  <span className="text-[11px] text-text-secondary ml-auto">your lesson is being recorded</span>
                </div>
              </div>

              {/* Lightweight chat alongside the call */}
              <div className="bg-surface/95 backdrop-blur rounded-card shadow-card overflow-hidden flex flex-col" style={{ height: "min(420px, 50vh)" }}>
                <div className="px-4 py-2 border-b border-charcoal/10 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  Chat{messages.length > 0 ? ` · ${messages.length}` : ""}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && <p className="text-[12px] text-text-secondary text-center py-6">No messages yet.</p>}
                  {messages.map((m) => {
                    const isMe = m.sender.id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? "bg-iris text-cream" : "bg-warm-gray/70 text-charcoal"}`}>
                          <p className="text-[13px] whitespace-pre-line">{m.content}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? "text-cream/60" : "text-text-secondary"}`}>{formatTimestamp(m.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t border-charcoal/10 p-2 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Message…"
                    className="flex-1 px-3 py-1.5 text-[13px] bg-cream border border-charcoal/10 rounded-full focus:border-charcoal/30 focus:outline-none"
                  />
                  <button onClick={sendMessage} disabled={sendingChat || !chatInput.trim()} className="text-[12px] font-medium text-cream bg-iris px-3 py-1.5 rounded-full hover:bg-iris-hover disabled:opacity-50">Send</button>
                </div>
              </div>
            </div>
          )}

          {/* ── FOLLOW-UP ──────────────────────────────────── */}
          {phase === "followup" && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="font-display text-2xl font-bold">Lesson done! 🎉</h2>
                <p className="text-[12px] text-text-secondary mt-1">Nice work today.</p>
              </div>

              {/* Teacher note + summary */}
              <section>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                  From {coach?.name?.split(" ")[0] ?? "your teacher"}
                </h2>
                <div className="bg-surface rounded-card shadow-card p-5">
                  <NoteRecap sections={detail?.latestNoteSections ?? null} flat={detail?.latestNotePracticeNotes ?? null} />
                  {detail?.latestLessonSummary && detail.latestLessonSummary.bullets.length > 0 && (
                    <div className="ai-summary compact mt-4">
                      <div className="ai-summary-head">
                        <span className="ai-badge">✦ AI</span>
                        <span className="ai-title">summary</span>
                      </div>
                      <ul className="ai-bullets">
                        {detail.latestLessonSummary.bullets.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {/* Next routine */}
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">Your routine</h2>
                  <Link to="/practice" className="text-[11px] font-medium text-iris hover:text-iris-hover">start practicing →</Link>
                </div>
                <div className="bg-surface rounded-card shadow-card p-5 space-y-2">
                  {routineItems.length === 0 ? (
                    <p className="text-sm text-text-secondary">No routine assigned yet.</p>
                  ) : (
                    routineItems.map((it) => (
                      <div key={it.id} className="flex items-center gap-3 py-1.5">
                        <span aria-hidden>{ROUTINE_KIND_ICON[it.kind] ?? "♪"}</span>
                        <div className="min-w-0 grow">
                          <div className="text-[13px] font-medium text-charcoal truncate">{it.title}</div>
                          <div className="text-[11px] text-text-secondary">
                            {it.kind}{it.bpmEnd ? ` · ${it.bpmEnd} bpm` : ""}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Book next */}
              <section>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">Next lesson</h2>
                {nextSuggested?.alreadyBooked ? (
                  <div className="bg-surface rounded-card shadow-card p-5 flex items-center gap-3">
                    <span className="text-sage">✓</span>
                    <span className="text-sm text-charcoal">You're booked for your next lesson.</span>
                    <Link to="/my-bookings" className="ml-auto text-[12px] font-medium text-iris hover:text-iris-hover">view →</Link>
                  </div>
                ) : (
                  <div className="bg-surface rounded-card shadow-card p-5 border-2 border-iris text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-iris font-bold">!</span>
                      <span className="text-sm font-medium text-charcoal">Not booked yet</span>
                    </div>
                    {nextSuggested?.suggested && (
                      <p className="text-[12px] text-text-secondary mt-1">
                        {coach?.name?.split(" ")[0] ?? "Your coach"} usually sees you{" "}
                        {formatShortDate(nextSuggested.suggested.startsAt)} at {formatTime(nextSuggested.suggested.startsAt)}.
                      </p>
                    )}
                    <Link
                      to="/book"
                      className="block mt-3 text-[13px] font-medium text-cream bg-iris px-5 py-2.5 rounded-card hover:bg-iris-hover transition-colors"
                    >
                      Book your next lesson →
                    </Link>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </SessionShell>
  );
}

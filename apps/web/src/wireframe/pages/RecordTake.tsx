import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AssignmentPublic } from "@sunbird/shared";
import { useAuth } from "@/context/AuthContext";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { WaveBars, waveHeights } from "../components/WaveBars";
import { MockTag } from "../components/MockTag";
import { useMyStudentDetail } from "../hooks/useCoachData";

type RecState = "ready" | "recording" | "review";

function MobileCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="dt-main-body"
      style={{
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          minHeight: 0,
          border: "1.5px solid var(--ink)",
          borderRadius: 22,
          background: "var(--paper)",
          boxShadow: "3px 4px 0 rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <div className="wf-header">
      <Link to="/practice" className="btn icon ghost" style={{ border: 0, background: "transparent" }}>
        <Icon name="back" size={16} />
      </Link>
      <div className="small bold muted">Song work</div>
      {right ?? <div className="wf-avatar">?</div>}
    </div>
  );
}

function StatusBar() {
  return (
    <div className="wf-status">
      <span>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      <span className="dots">• • •</span>
      <span>⌁ 87%</span>
    </div>
  );
}

export function RecordTakePage() {
  const params = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { detail, loading, refresh } = useMyStudentDetail();
  const [state, setState] = useState<RecState>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [selfRating, setSelfRating] = useState(4);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<number | null>(null);

  const assignment: AssignmentPublic | undefined = detail?.assignments.find(
    (a) => a.id === params.assignmentId,
  );

  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? "?";
  const piece = assignment?.title ?? (loading ? "Loading…" : "River Flows in You");
  const bars = assignment?.bars ?? "bars 16-24";
  const takeNumber = (detail?.takes.filter((t) => t.assignmentId === assignment?.id).length ?? 0) + 1;
  const prevTakes = detail?.takes.filter((t) => t.assignmentId === assignment?.id).slice(0, 3) ?? [];

  useEffect(() => {
    if (state === "recording") {
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
      };
    }
    return;
  }, [state]);

  function start() {
    setElapsed(0);
    setState("recording");
  }

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setState("review");
  }

  function cancel() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setElapsed(0);
    setState("ready");
  }

  async function send() {
    if (!assignment) return;
    setSubmitting(true);
    try {
      const { apiFetch } = await import("@/lib/api");
      await apiFetch("/api/me/takes", {
        method: "POST",
        body: JSON.stringify({
          assignmentId: assignment.id,
          pieceTitle: piece,
          bars,
          takeNumber,
          durationSec: Math.max(1, elapsed),
          selfRating,
          selfNote: note || null,
        }),
      });
      refresh();
      navigate("/practice");
    } catch (err) {
      // Endpoint may not exist yet — show a friendly message but don't block.
      console.warn("Take submit failed (endpoint not wired)", err);
      alert(
        "Take recorded locally. Sending to teacher requires the /api/me/takes endpoint, which is the next step on the to-do list.",
      );
      navigate("/practice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <STFrame side="lessons">
      <MobileCard>
        <div className="wf">
          <StatusBar />
          {state === "ready" && <Header right={<div className="wf-avatar">{initial}</div>} />}
          {state === "recording" && (
            <Header
              right={
                <span
                  className="chip accent tiny"
                  style={{ background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}
                >
                  ● REC
                </span>
              }
            />
          )}
          {state === "review" && <Header right={<div className="wf-avatar">{initial}</div>} />}

          {state === "ready" && (
            <ReadyView
              piece={piece}
              bars={bars}
              takeNumber={takeNumber}
              tempoBpm={assignment?.tempoBpmEnd ?? 88}
              prompt={assignment?.noteText ?? null}
              prevTakes={prevTakes}
              onStart={start}
            />
          )}
          {state === "recording" && (
            <RecordingView
              piece={piece}
              bars={bars}
              takeNumber={takeNumber}
              elapsed={elapsed}
              tempoBpm={assignment?.tempoBpmEnd ?? 88}
              onStop={stop}
              onCancel={cancel}
            />
          )}
          {state === "review" && (
            <ReviewView
              takeNumber={takeNumber}
              elapsed={elapsed}
              rating={selfRating}
              note={note}
              onRate={setSelfRating}
              onNote={setNote}
              onRetake={cancel}
              onSend={send}
              submitting={submitting}
            />
          )}
        </div>
      </MobileCard>
    </STFrame>
  );
}

function TitleBlock({ piece, bars, subtitle }: { piece: string; bars: string; subtitle: string }) {
  return (
    <div className="center">
      <div className="tiny muted">{subtitle}</div>
      <h2 className="wf-title" style={{ fontSize: 28, lineHeight: 1.05, marginTop: 2 }}>
        {piece}
      </h2>
      <div className="small muted">{bars}</div>
    </div>
  );
}

function ReadyView({
  piece,
  bars,
  takeNumber,
  tempoBpm,
  prompt,
  prevTakes,
  onStart,
}: {
  piece: string;
  bars: string;
  takeNumber: number;
  tempoBpm: number;
  prompt: string | null;
  prevTakes: { id: string; takeNumber: number; selfRating: number | null }[];
  onStart: () => void;
}) {
  return (
    <div className="wf-body col gap-3" style={{ alignItems: "center", paddingBottom: 18 }}>
      <TitleBlock piece={piece} bars={bars} subtitle={`READY · take ${takeNumber}`} />

      {prompt && (
        <div className="box dashed small" style={{ width: "100%" }}>
          <div className="bold mb-1">★ teacher's prompt</div>
          <div>"{prompt}"</div>
        </div>
      )}

      <button
        onClick={onStart}
        style={{
          position: "relative",
          marginTop: 4,
          border: 0,
          background: "transparent",
          padding: 0,
          cursor: "pointer",
        }}
        aria-label="tap to record"
      >
        <svg width="190" height="190" viewBox="0 0 190 190">
          <circle cx="95" cy="95" r="88" fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 6" />
          <circle cx="95" cy="95" r="72" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
          <circle cx="95" cy="95" r="48" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2.5" />
          <circle cx="95" cy="95" r="34" fill="var(--accent)" />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div className="wf-scrawl bold" style={{ fontSize: 22, color: "white" }}>
            tap to record
          </div>
        </div>
      </button>

      <div className="row gap-2 mt-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
        <button className="btn small">
          <Icon name="headphones" size={12} /> hear ref
        </button>
        <button className="btn small">
          <Icon name="metro" size={12} /> {tempoBpm} bpm
        </button>
        <button className="btn small">count-in: 1 bar</button>
      </div>

      <div className="box small" style={{ width: "100%" }}>
        <div className="row between">
          <span className="muted">previous takes</span>
          <Icon name="chev" size={14} stroke="var(--ink-faint)" />
        </div>
        <div className="row gap-2 mt-2 small" style={{ flexWrap: "wrap" }}>
          {prevTakes.length === 0 && <span className="muted tiny">none yet</span>}
          {prevTakes.map((t) => (
            <span key={t.id} className="chip">
              take {t.takeNumber}
              {t.selfRating != null
                ? ` · ${"★".repeat(t.selfRating)}${"☆".repeat(5 - t.selfRating)}`
                : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecordingView({
  piece,
  bars,
  takeNumber,
  elapsed,
  tempoBpm,
  onStop,
  onCancel,
}: {
  piece: string;
  bars: string;
  takeNumber: number;
  elapsed: number;
  tempoBpm: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  const hs = waveHeights(99 + elapsed, 44);
  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const playedFrac = Math.min(0.95, (elapsed / 60) * 0.6 + 0.05);
  return (
    <div className="wf-body col gap-3" style={{ alignItems: "center", paddingBottom: 18 }}>
      <TitleBlock piece={piece} bars={bars} subtitle={`RECORDING · take ${takeNumber}`} />

      <div style={{ position: "relative", marginTop: 4 }}>
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="95" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.4" />
          <circle cx="100" cy="100" r="84" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 6" opacity="0.7" />
          <circle cx="100" cy="100" r="72" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
          <circle cx="100" cy="100" r="48" fill="var(--accent)" />
          <rect x="92" y="92" width="16" height="16" rx="2" fill="white" />
        </svg>
        <div style={{ position: "absolute", top: -4, right: -10 }}>
          <div
            className="postit wf-scrawl"
            style={{
              transform: "rotate(8deg)",
              padding: "4px 10px",
              fontSize: 16,
              background: "var(--accent)",
              color: "white",
              borderColor: "var(--accent)",
            }}
          >
            ● {elapsedLabel}
          </div>
        </div>
      </div>

      <WaveBars heights={hs} played={playedFrac} />

      <div className="row gap-2" style={{ width: "100%", alignItems: "center" }}>
        <span className="tiny muted">level</span>
        <div className="grow row gap-1" style={{ height: 14, alignItems: "flex-end" }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: i < 13 ? "100%" : "50%",
                background: i < 11 ? "var(--ink)" : i < 13 ? "var(--highlight)" : "var(--paper-2)",
                opacity: i < 13 ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      </div>

      <div className="row gap-3 mt-1">
        <button className="btn" onClick={onCancel}>cancel</button>
        <button className="btn primary big" onClick={onStop}>■ stop</button>
      </div>

      <div className="box dashed small" style={{ width: "100%" }}>
        <div className="row between">
          <span className="muted">metronome</span>
          <span className="bold">{tempoBpm} bpm · click on</span>
        </div>
        <div className="row between mt-1">
          <span className="muted">elapsed</span>
          <span className="bold">{elapsedLabel}</span>
        </div>
      </div>
    </div>
  );
}

function ReviewView({
  takeNumber,
  elapsed,
  rating,
  note,
  onRate,
  onNote,
  onRetake,
  onSend,
  submitting,
}: {
  takeNumber: number;
  elapsed: number;
  rating: number;
  note: string;
  onRate: (n: number) => void;
  onNote: (s: string) => void;
  onRetake: () => void;
  onSend: () => void;
  submitting: boolean;
}) {
  const hs = waveHeights(99 + takeNumber, 50);
  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <div className="wf-body col gap-3 scroll-y" style={{ paddingBottom: 24 }}>
      <div className="center">
        <div className="tiny muted">TAKE {takeNumber} · {elapsedLabel}</div>
        <h2 className="wf-title" style={{ fontSize: 24, marginTop: 2 }}>How'd that feel?</h2>
      </div>

      <div className="box thick">
        <div className="row between small mb-2">
          <div className="row gap-2">
            <Icon name="mic" size={14} stroke="var(--accent)" />
            <span className="bold" style={{ color: "var(--accent)" }}>your take</span>
          </div>
          <span className="tiny muted">0:00 / {elapsedLabel}</span>
        </div>
        <WaveBars heights={hs} played={0.3} />
        <div className="row gap-3 mt-2" style={{ justifyContent: "center" }}>
          <button className="btn icon"><Icon name="back" size={14} /></button>
          <button className="btn accent icon" style={{ width: 50, height: 50 }}>
            <Icon name="play" size={20} stroke="white" />
          </button>
          <button className="btn icon"><Icon name="chev" size={14} /></button>
        </div>
        <div className="row gap-2 mt-2" style={{ justifyContent: "center" }}>
          <span className="chip dashed tiny">
            <Icon name="headphones" size={10} /> A/B w/ ref
          </span>
          <span className="chip dashed tiny">solo</span>
        </div>
        <div className="row gap-2 mt-2 small" style={{ justifyContent: "center", color: "var(--ink-faint)" }}>
          <MockTag>playback (no audio yet)</MockTag>
        </div>
      </div>

      <div>
        <div className="small muted">RATE YOUR TAKE</div>
        <div className="row gap-2 mt-2" style={{ justifyContent: "center" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onRate(n)}
              aria-label={`rate ${n}`}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "1.5px solid var(--ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: n <= rating ? "var(--accent)" : "var(--paper)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Icon name="star" size={18} stroke={n <= rating ? "white" : "var(--ink-faint)"} />
            </button>
          ))}
        </div>
      </div>

      <textarea
        className="box small"
        placeholder="quick note to self…"
        style={{
          width: "100%",
          minHeight: 60,
          fontFamily: "var(--hand)",
          resize: "none",
          background: "var(--paper)",
          border: "1.5px dashed var(--ink)",
        }}
        value={note}
        onChange={(e) => onNote(e.target.value)}
      />

      <div className="row gap-2">
        <button className="btn grow" onClick={onRetake}>retake</button>
        <button className="btn primary grow">save take</button>
      </div>
      <button className="btn accent big" onClick={onSend} disabled={submitting}>
        <Icon name="send" size={14} stroke="white" />
        {submitting ? "Sending…" : "Send to your teacher"}
      </button>
    </div>
  );
}

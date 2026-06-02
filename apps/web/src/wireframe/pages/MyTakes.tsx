import { Link } from "react-router-dom";
import type { StudentDetailPublic } from "@sunbird/shared";
import { STFrame } from "../components/STFrame";
import { Squiggle } from "../components/Squiggle";
import { Tag } from "../components/Tag";
import { useMyStudentDetail } from "../hooks/useCoachData";

type Take = StudentDetailPublic["takes"][number];

function fmtDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function statusLabel(status: Take["status"]): { label: string; color?: "coral" } {
  if (status === "REPLIED") return { label: "replied", color: "coral" };
  if (status === "REVIEWING") return { label: "in review" };
  return { label: "waiting" };
}

function TakeCard({ take }: { take: Take }) {
  const { label, color } = statusLabel(take.status);
  const reply = take.replies[0];
  const noteCount = take.annotations.length;
  const created = new Date(take.createdAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="box" style={{ padding: 14 }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="bold">
            {take.pieceTitle}
            {take.bars ? <span className="muted"> · {take.bars}</span> : null}
          </div>
          <div className="tiny muted mt-1">
            take {take.takeNumber} · {fmtDuration(take.durationSec)} · {created}
          </div>
        </div>
        <Tag color={color}>{label}</Tag>
      </div>

      {take.audioUrl && (
        <audio
          controls
          src={take.audioUrl}
          style={{ width: "100%", marginTop: 10, height: 36 }}
        />
      )}

      {reply ? (
        <div
          className="box small"
          style={{ marginTop: 10, background: "var(--paper-2, var(--paper))" }}
        >
          <div className="tiny muted">
            {reply.author?.name ?? "Your coach"} replied
            {noteCount > 0
              ? ` · ${noteCount} note${noteCount === 1 ? "" : "s"} on the audio`
              : ""}
          </div>
          {reply.text && <div className="small mt-1">{reply.text}</div>}
          {reply.voiceUrl && (
            <audio
              controls
              src={reply.voiceUrl}
              style={{ width: "100%", marginTop: 8, height: 32 }}
            />
          )}
        </div>
      ) : (
        <div className="tiny muted mt-2">
          {take.status === "REVIEWING"
            ? "Your coach is reviewing this take."
            : "Waiting for your coach to review."}
        </div>
      )}
    </div>
  );
}

function TakesEmpty() {
  return (
    <div
      className="box dashed"
      style={{
        textAlign: "center",
        padding: "32px 24px",
        color: "var(--ink-soft)",
      }}
    >
      <svg width="80" height="100" viewBox="0 0 80 100" fill="none" aria-hidden style={{ margin: "0 auto 6px" }}>
        <rect x="28" y="14" width="24" height="44" rx="12"
          stroke="var(--ink)" strokeWidth="2" fill="var(--paper)" />
        <path d="M 20 50 a 20 20 0 0 0 40 0"
          stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <line x1="40" y1="70" x2="40" y2="84" stroke="var(--ink)" strokeWidth="2" />
        <line x1="28" y1="84" x2="52" y2="84" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="40" cy="30" r="3" fill="var(--accent)" />
      </svg>
      <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
        No takes yet.
      </div>
      <Squiggle w={80} color="var(--ink-faint)" />
      <div className="small muted mt-2" style={{ maxWidth: 380, margin: "8px auto 0" }}>
        When you record a take for a song or exercise, it'll land here. Your teacher
        listens back and pins feedback to specific moments, and you can play it
        alongside their notes.
      </div>
      <div className="row gap-2 mt-3" style={{ justifyContent: "center" }}>
        <Link to="/practice" className="btn small primary">record a take</Link>
        <Link to="/my-bookings" className="btn small">view lessons</Link>
      </div>
    </div>
  );
}

export function MyTakesPage() {
  const { detail, loading } = useMyStudentDetail();
  const takes = [...(detail?.takes ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <STFrame side="takes">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">My takes</h2>
          <div className="dt-sub">
            Recordings you've sent your teacher &amp; the notes back.
          </div>
        </div>
        <div className="row gap-2">
          <Link to="/practice" className="btn small primary">＋ record new take</Link>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-body scroll col gap-3" style={{ padding: "12px 4px" }}>
            {loading && takes.length === 0 ? (
              <div className="small muted" style={{ padding: 18 }}>Loading takes…</div>
            ) : takes.length === 0 ? (
              <TakesEmpty />
            ) : (
              takes.map((t) => <TakeCard key={t.id} take={t} />)
            )}
          </div>
        </div>
      </div>
    </STFrame>
  );
}

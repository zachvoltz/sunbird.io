// Coach take-review — load a real take, pin annotations (love / watch / try-
// this) at a timeline second or score bar, and send a written reply. Replaces
// the earlier mock; the decorative staff notation is dropped because takes
// carry audio, not parsed score data.

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { TakePublic, TakeAnnotationPublic, UserPublic } from "@sunbird/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { useIsMobile } from "../hooks/useIsMobile";

type TakeWithStudent = TakePublic & { student: UserPublic };
type Kind = "LOVE" | "WATCH" | "TRY_THIS";

const KIND_META: Record<Kind, { label: string; glyph: string; color?: "coral" | "yellow" }> = {
  LOVE: { label: "love", glyph: "♥", color: "coral" },
  WATCH: { label: "watch", glyph: "⚠" },
  TRY_THIS: { label: "try this", glyph: "🎯", color: "yellow" },
};

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function positionLabel(a: TakeAnnotationPublic): string {
  if (a.targetType === "SCORE_BAR" && a.targetBar != null) return `bar ${a.targetBar}`;
  if (a.targetTimeSec != null) return mmss(a.targetTimeSec);
  return "—";
}

function useTakeReview(takeId: string | undefined) {
  const [take, setTake] = useState<TakeWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!takeId) return;
    return apiFetch<{ data: TakeWithStudent }>(`/api/coaches/takes/${takeId}`)
      .then((r) => setTake(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.body.error : "Couldn't load this take"))
      .finally(() => setLoading(false));
  }, [takeId]);
  useEffect(() => { refetch(); }, [refetch]);

  return { take, loading, error, refetch };
}

function AnnotationComposer({ takeId, onAdded }: { takeId: string; onAdded: () => void }) {
  const [kind, setKind] = useState<Kind>("LOVE");
  const [byBar, setByBar] = useState(false);
  const [pos, setPos] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const body: any = { kind, targetType: byBar ? "SCORE_BAR" : "TIMELINE", text: text || undefined };
      const n = parseFloat(pos);
      if (!isNaN(n)) body[byBar ? "targetBar" : "targetTimeSec"] = byBar ? Math.round(n) : n;
      await apiFetch(`/api/coaches/takes/${takeId}/annotations`, { method: "POST", body: JSON.stringify(body) });
      setPos(""); setText("");
      onAdded();
    } catch (e: any) {
      window.alert(e?.body?.error ?? "Couldn't add annotation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="box dashed">
      <div className="small muted mb-2">＋ pin an annotation</div>
      <div className="row gap-2 mb-2" style={{ flexWrap: "wrap" }}>
        {(Object.keys(KIND_META) as Kind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className="btn small" style={{ outline: kind === k ? "2px solid var(--accent)" : "none" }}>
            <Tag color={KIND_META[k].color}>{KIND_META[k].glyph} {KIND_META[k].label}</Tag>
          </button>
        ))}
      </div>
      <div className="row gap-2 mb-2" style={{ alignItems: "center" }}>
        <button className="btn small ghost" onClick={() => setByBar((b) => !b)}>
          {byBar ? "by bar #" : "by time (s)"}
        </button>
        <input
          type="number" min={0} value={pos} onChange={(e) => setPos(e.target.value)}
          placeholder={byBar ? "bar" : "seconds"}
          style={{ width: 90, fontFamily: "var(--hand)", fontSize: 13, padding: "5px 8px", border: "1.5px solid var(--ink-faint)", borderRadius: 6, background: "var(--paper)", color: "var(--ink)" }}
        />
      </div>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} placeholder="note (optional)…"
        style={{ width: "100%", minHeight: 42, fontFamily: "var(--hand)", fontSize: 13, padding: "6px 8px", border: "1.5px solid var(--ink-faint)", borderRadius: 6, background: "var(--paper)", color: "var(--ink)", resize: "vertical" }}
      />
      <div className="row mt-2" style={{ justifyContent: "flex-end" }}>
        <button className="btn small primary" onClick={add} disabled={busy}>{busy ? "adding…" : "add pin"}</button>
      </div>
    </div>
  );
}

function AnnotationRow({ a, takeId, onChanged }: { a: TakeAnnotationPublic; takeId: string; onChanged: () => void }) {
  const meta = KIND_META[a.kind as Kind] ?? { label: a.kind, glyph: "•" };
  const remove = async () => {
    try {
      await apiFetch(`/api/coaches/takes/${takeId}/annotations/${a.id}`, { method: "DELETE" });
      onChanged();
    } catch (e: any) {
      window.alert(e?.body?.error ?? "Couldn't remove");
    }
  };
  return (
    <div className="box">
      <div className="row between">
        <div className="row gap-2 small">
          <Tag color={meta.color}>{meta.glyph} {meta.label}</Tag>
          <Tag>{positionLabel(a)}</Tag>
        </div>
        <button className="btn small ghost" onClick={remove} aria-label="remove">✕</button>
      </div>
      {a.text && <div className="small mt-2">{a.text}</div>}
    </div>
  );
}

function ReplyComposer({ take, onSent }: { take: TakeWithStudent; onSent: () => void }) {
  const existing = take.replies[take.replies.length - 1];
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim() && !summary.trim()) {
      window.alert("Add a note or a summary first.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/coaches/takes/${take.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ text: text || undefined, summaryText: summary || undefined, starRating: stars || undefined }),
      });
      setText(""); setSummary(""); setStars(0);
      onSent();
    } catch (e: any) {
      window.alert(e?.body?.error ?? "Couldn't send reply");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col gap-3">
      {existing && (
        <div className="box accent" style={{ borderWidth: 2 }}>
          <div className="row between">
            <span className="small bold">Last reply sent</span>
            {existing.starRating != null && <span className="small">{"★".repeat(existing.starRating)}{"☆".repeat(5 - existing.starRating)}</span>}
          </div>
          {existing.text && <div className="small mt-1">{existing.text}</div>}
          {existing.summaryText && <div className="tiny muted mt-1">"{existing.summaryText}"</div>}
        </div>
      )}
      <div className="box dashed">
        <div className="small muted mb-1">{existing ? "send another note" : "write your reply"}</div>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} placeholder="what you noticed, what to work on…"
          style={{ width: "100%", minHeight: 70, fontFamily: "var(--hand)", fontSize: 14, padding: "6px 8px", border: "1.5px solid var(--ink-faint)", borderRadius: 6, background: "var(--paper)", color: "var(--ink)", resize: "vertical" }}
        />
        <div className="small muted mt-2 mb-1">summary (one line)</div>
        <input
          value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="really lovely take overall"
          style={{ width: "100%", fontFamily: "var(--hand)", fontSize: 13, padding: "5px 8px", border: "1.5px solid var(--ink-faint)", borderRadius: 6, background: "var(--paper)", color: "var(--ink)" }}
        />
        <div className="row gap-1 mt-2" style={{ alignItems: "center" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n === stars ? 0 : n)} className="btn icon ghost" style={{ padding: 2 }} aria-label={`${n} stars`}>
              <Icon name="star" size={20} stroke={n <= stars ? "var(--accent)" : "var(--ink-faint)"} />
            </button>
          ))}
          <button className="btn small accent" style={{ marginLeft: "auto" }} onClick={send} disabled={busy}>
            <Icon name="send" size={11} stroke="white" /> {busy ? "sending…" : "send reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewInner({ take, refetch }: { take: TakeWithStudent; refetch: () => void }) {
  return (
    <>
      <div className="small muted mb-2">TAKE · {mmss(take.durationSec)}</div>
      {take.audioUrl ? (
        <audio controls src={take.audioUrl} style={{ width: "100%" }} />
      ) : (
        <div className="box small muted">No audio attached to this take yet.</div>
      )}
      {(take.selfRating != null || take.selfNote) && (
        <div className="row gap-2 mt-2 small" style={{ alignItems: "center", flexWrap: "wrap" }}>
          {take.selfRating != null && <Tag>{"★".repeat(take.selfRating)}{"☆".repeat(5 - take.selfRating)} self</Tag>}
          {take.selfNote && <span className="tiny muted">"{take.selfNote}"</span>}
        </div>
      )}

      <div className="hr-hand" />
      <div className="small muted mb-2">ANNOTATIONS · {take.annotations.length}</div>
      <div className="col gap-2">
        {take.annotations.map((a) => (
          <AnnotationRow key={a.id} a={a} takeId={take.id} onChanged={refetch} />
        ))}
      </div>
      <div className="mt-2"><AnnotationComposer takeId={take.id} onAdded={refetch} /></div>
    </>
  );
}

export function TakeReviewPage() {
  const { takeId } = useParams<{ takeId: string }>();
  const isMobile = useIsMobile();
  const { take, loading, error, refetch } = useTakeReview(takeId);

  const wrap = (content: React.ReactNode) =>
    isMobile ? <WFFrame navActive="home">{content}</WFFrame> : <DTFrame side="inbox">{content}</DTFrame>;

  if (loading) {
    return wrap(<div className="dt-main-head"><div><h2 className="dt-title">Loading…</h2></div></div>);
  }
  if (error || !take) {
    return wrap(
      <div className="dt-main-head">
        <div><h2 className="dt-title">Take not found</h2><div className="dt-sub">{error}</div></div>
        <Link to="/coach" className="btn small primary">back</Link>
      </div>
    );
  }

  const name = take.student.name;
  const statusTag = take.status === "REPLIED" ? "replied" : take.status === "REVIEWING" ? "reviewing" : "new";

  return wrap(
    <>
      <div className="dt-main-head">
        <div className="row gap-3" style={{ alignItems: "center" }}>
          <Link to="/coach" className="btn icon ghost"><Icon name="back" size={14} /></Link>
          <Avatar name={name} size={40} />
          <div>
            <h2 className="dt-title" style={{ fontSize: 24 }}>{name} · {take.pieceTitle}</h2>
            <div className="dt-sub">
              take {take.takeNumber}{take.bars ? ` · bars ${take.bars}` : ""} · {mmss(take.durationSec)} · {new Date(take.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <Tag color={take.status === "REPLIED" ? "coral" : undefined}>{statusTag}</Tag>
      </div>

      <div className="dt-main-body" style={{ paddingBottom: 14 }}>
        <div className="dt-cols" style={{ gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr", gap: 14, height: "100%" }}>
          <div className="panel" style={{ padding: "12px 14px" }}>
            <div className="panel-body scroll">
              <ReviewInner take={take} refetch={refetch} />
            </div>
          </div>
          <div className="panel tinted">
            <div className="panel-head"><div className="panel-title">Notes for {name.split(" ")[0]}</div></div>
            <div className="panel-body scroll">
              <ReplyComposer take={take} onSent={refetch} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

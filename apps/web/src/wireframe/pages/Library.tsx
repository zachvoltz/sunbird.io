import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { LibItem } from "../components/LibItem";
import { useIsMobile } from "../hooks/useIsMobile";
import { PathsBrowsePane, PathsMobile, useCoachPaths } from "./Paths";
import { apiFetch } from "@/lib/api";
import type { LibraryItemKind, LibraryItemPublic, PathSummary } from "@sunbird/shared";

const KIND_ICON: Record<LibraryItemKind, "metro" | "note" | "mic"> = {
  warmup: "metro",
  exercise: "note",
  song: "mic",
};

// Render the item metadata under each row. If the coach wrote
// freeform notes, surface those; otherwise derive a short summary
// from structured fields (kind + duration + PDF flag).
function formatItemSubtitle(it: LibraryItemPublic): string {
  if (it.subtitle && it.subtitle.trim().length > 0) return it.subtitle;
  const parts: string[] = [it.kind];
  if (it.durationMin != null) parts.push(`${it.durationMin} min`);
  if (it.pdfUrl) parts.push("PDF");
  return parts.join(" · ");
}

function useLibraryItems() {
  const [items, setItems] = useState<LibraryItemPublic[] | undefined>();
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: LibraryItemPublic[] }>("/api/library")
      .then((r) => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, loading, refresh };
}

async function promptCreateLibraryItem(): Promise<LibraryItemPublic | null> {
  const title = window.prompt("Title for the new exercise:")?.trim();
  if (!title) return null;
  const kindRaw = window
    .prompt("Kind — warmup / exercise / song:", "exercise")
    ?.trim()
    .toLowerCase();
  const kind: LibraryItemKind =
    kindRaw === "warmup" || kindRaw === "song" ? kindRaw : "exercise";
  try {
    const res = await apiFetch<{ data: LibraryItemPublic }>("/api/library", {
      method: "POST",
      body: JSON.stringify({ title, kind }),
    });
    return res.data;
  } catch (err: any) {
    window.alert(err?.body?.error ?? "Couldn't create exercise.");
    return null;
  }
}

async function promptCreatePath(): Promise<string | null> {
  const title = window.prompt("Name this path:")?.trim();
  if (!title) return null;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  if (!slug) {
    window.alert("Couldn't derive a URL slug from that name.");
    return null;
  }
  try {
    await apiFetch<{ data: PathSummary }>("/api/paths", {
      method: "POST",
      body: JSON.stringify({
        slug,
        title,
        shape: "linear",
        status: "draft",
        nodes: [],
        edges: [],
      }),
    });
    return slug;
  } catch (err: any) {
    window.alert(err?.body?.error ?? "Couldn't create path.");
    return null;
  }
}

type LibTab = "exercises" | "paths";

function useLibTab(): [LibTab, (t: LibTab) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("tab");
  const initial: LibTab = fromUrl === "paths" ? "paths" : "exercises";
  const [tab, setTab] = useState<LibTab>(initial);
  const update = (t: LibTab) => {
    setTab(t);
    const next = new URLSearchParams(params);
    if (t === "paths") next.set("tab", "paths");
    else next.delete("tab");
    setParams(next, { replace: true });
  };
  return [tab, update];
}

// Top-level tab pills (items vs paths) — sits in the panel header.
function TabPills({
  tab,
  onChange,
  itemCount,
  pathCount,
}: {
  tab: LibTab;
  onChange: (t: LibTab) => void;
  itemCount: number;
  pathCount: number;
}) {
  return (
    <div className="pill-row" style={{ marginBottom: 0 }}>
      <span
        className={"p" + (tab === "exercises" ? " on" : "")}
        onClick={() => onChange("exercises")}
        style={{ cursor: "pointer" }}
      >
        exercises · {itemCount}
      </span>
      <span
        className={"p" + (tab === "paths" ? " on" : "")}
        onClick={() => onChange("paths")}
        style={{ cursor: "pointer" }}
      >
        paths · {pathCount}
      </span>
    </div>
  );
}

// Horizontal tag filter strip — sits above the list. The set of chips
// is derived from whatever tags the coach has actually applied to
// their library items, so the filter grows organically as they add
// more. Filter is single-select; `null` shows everything.
function TagFilter({
  active,
  onChange,
  tags,
  totalCount,
}: {
  active: string | null;
  onChange: (t: string | null) => void;
  /** Tags in display order, paired with how many items carry each one. */
  tags: Array<{ tag: string; count: number }>;
  totalCount: number;
}) {
  return (
    <div className="row gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <span className="small muted" style={{ letterSpacing: "0.08em" }}>TAGS</span>
      <div className="pill-row" style={{ marginBottom: 0, flexWrap: "wrap" }}>
        <span
          className={"p" + (active === null ? " on" : "")}
          onClick={() => onChange(null)}
          style={{ cursor: "pointer" }}
        >
          all{totalCount > 0 ? ` · ${totalCount}` : ""}
        </span>
        {tags.map(({ tag, count }) => (
          <span
            key={tag}
            className={"p" + (active === tag ? " on" : "")}
            onClick={() => onChange(active === tag ? null : tag)}
            style={{ cursor: "pointer" }}
          >
            #{tag} · {count}
          </span>
        ))}
        {tags.length === 0 && (
          <span className="small muted" style={{ marginLeft: 4 }}>
            No tags yet — add #yourtag in the item editor.
          </span>
        )}
      </div>
    </div>
  );
}

// Parse a hashtag-style input ("#scales #warmup #used-18x") OR the
// legacy comma format ("scales, warmup") into a clean string[]. We
// store tag values without the leading `#`; the UI prepends it for
// display.
function parseTagsInput(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // If the user wrote any '#' anywhere, treat the whole field as
  // hashtag-style. Otherwise fall back to comma-separated for the
  // small bit of legacy seed data that used that form.
  if (trimmed.includes("#")) {
    return Array.from(
      new Set(
        trimmed
          .split(/[\s,]+/)
          .map((t) => t.replace(/^#+/, "").trim())
          .filter((t) => t.length > 0),
      ),
    );
  }
  return Array.from(
    new Set(
      trimmed
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    ),
  );
}

function tagsToInputValue(tags: string[]): string {
  return tags.map((t) => `#${t}`).join(" ");
}

function formatRecElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Inline-edit row for a library item. View mode renders like LibItem
// but with an "edit" button; edit mode expands the row into a small
// form with save / cancel / delete. Saves PUT, deletes DELETE; both
// call `onChange` (typically refreshItems) so the list re-fetches.
const editInputStyle: React.CSSProperties = {
  fontFamily: "var(--hand)",
  fontSize: 14,
  padding: "4px 8px",
  border: "1.5px solid var(--ink-faint)",
  borderRadius: 6,
  background: "var(--paper)",
  color: "var(--ink)",
  outline: "none",
};

function LibraryRow({
  item,
  onChange,
}: {
  item: LibraryItemPublic;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LibraryItemPublic>(item);
  const [tagsInput, setTagsInput] = useState<string>(tagsToInputValue(item.tags));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Mic recording state. We accumulate Blob chunks while recording, then
  // wrap them in a File on stop and hand off to uploadAudio.
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);

  // Best-effort cleanup if the row unmounts mid-recording.
  useEffect(() => {
    return () => {
      recStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    };
  }, []);

  // MediaRecorder might be missing on older browsers; hide the button
  // when it is.
  const recSupported =
    typeof window !== "undefined" &&
    typeof (window as any).MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const startRecording = async () => {
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      recChunksRef.current = [];
      // Prefer webm/opus when supported (Chrome/Firefox); Safari uses mp4.
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType =
        candidates.find((m) => (window as any).MediaRecorder.isTypeSupported?.(m)) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const fullType = recorder.mimeType || "audio/webm";
        const baseType = fullType.split(";")[0];
        const ext = baseType.includes("mp4") ? "m4a"
          : baseType.includes("webm") ? "webm"
          : "bin";
        const blob = new Blob(recChunksRef.current, { type: baseType });
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: baseType });
        await uploadAudio(file);
        // Cleanup mic stream + timer regardless of upload result.
        recStreamRef.current?.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        if (recTimerRef.current) {
          window.clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        setRecElapsed(0);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecElapsed(0);
      recTimerRef.current = window.setInterval(() => setRecElapsed((e) => e + 1), 1000);
    } catch (err: any) {
      setUploadError(
        err?.name === "NotAllowedError"
          ? "Microphone access denied. Allow it in your browser to record."
          : err?.message ?? "Couldn't start recording",
      );
    }
  };

  const stopRecording = () => {
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
  };

  const uploadAudio = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // Plain fetch — apiFetch hardcodes Content-Type: application/json
      // which would break multipart boundary detection.
      const res = await fetch(`/api/library/${item.id}/audio`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? `Upload failed (${res.status})`);
      }
      onChange();
    } catch (err: any) {
      setUploadError(err?.message ?? "Couldn't upload audio");
    } finally {
      setUploading(false);
    }
  };

  const clearAudio = async () => {
    if (!window.confirm("Remove the audio from this item?")) return;
    try {
      await apiFetch(`/api/library/${item.id}/audio`, { method: "DELETE" });
      onChange();
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't remove audio");
    }
  };

  // Re-sync local draft if the parent's item reference changes (e.g.
  // after refresh) — but only when we're not in the middle of an edit.
  useEffect(() => {
    if (!editing) {
      setDraft(item);
      setTagsInput(tagsToInputValue(item.tags));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.updatedAt]);

  const cancel = () => {
    setDraft(item);
    setTagsInput(tagsToInputValue(item.tags));
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const tags = parseTagsInput(tagsInput);
      await apiFetch(`/api/library/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          kind: draft.kind,
          title: draft.title,
          subtitle: draft.subtitle ?? undefined,
          tags,
          bpmStart: draft.bpmStart ?? undefined,
          bpmEnd: draft.bpmEnd ?? undefined,
          durationMin: draft.durationMin ?? undefined,
          hasMidi: draft.hasMidi,
        }),
      });
      setEditing(false);
      onChange();
    } catch (err: any) {
      setError(err?.body?.error ?? "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      await apiFetch(`/api/library/${item.id}`, { method: "DELETE" });
      onChange();
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't delete");
    }
  };

  if (!editing) {
    return (
      <div className="box small mb-2">
        <div className="row gap-3" style={{ alignItems: "center" }}>
          <span className="drag-handle">⋮⋮</span>
          <Icon name={KIND_ICON[item.kind]} size={16} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold">{item.title}</div>
            <div className="tiny muted">{formatItemSubtitle(item)}</div>
          </div>
          {item.tags.map((t) => <Tag key={t}>#{t}</Tag>)}
          <button className="btn small ghost" onClick={() => setEditing(true)}>edit</button>
        </div>
        {item.audioUrl && (
          <div className="mt-2">
            <audio
              src={item.audioUrl}
              controls
              preload="none"
              style={{ width: "100%", height: 32 }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="box small mb-2" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
      <div className="col gap-2">
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Title"
            style={{ ...editInputStyle, flex: "1 1 200px", minWidth: 0 }}
          />
          <select
            value={draft.kind}
            onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as LibraryItemKind }))}
            style={{ ...editInputStyle, flex: "0 0 auto" }}
          >
            <option value="warmup">warmup</option>
            <option value="exercise">exercise</option>
            <option value="song">song</option>
          </select>
        </div>

        <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <label className="tiny muted">min</label>
          <input
            type="number"
            value={draft.durationMin ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, durationMin: e.target.value ? Number(e.target.value) : null }))}
            placeholder=""
            style={{ ...editInputStyle, width: 70 }}
          />
        </div>

        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="#scales #warmup #recital"
          style={{ ...editInputStyle, width: "100%" }}
        />

        <div className="col gap-1">
          <label className="tiny muted">notes</label>
          <textarea
            value={draft.subtitle ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value || null }))}
            placeholder="anything you want to remember about this item…"
            rows={2}
            style={{ ...editInputStyle, width: "100%", resize: "vertical" }}
          />
        </div>

        {/* Audio upload + recording */}
        <div className="col gap-1">
          <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <label className="tiny muted" style={{ minWidth: 36 }}>audio</label>
            <input
              type="file"
              accept="audio/*"
              disabled={uploading || recording}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAudio(f);
                // Reset the input so the same file can be re-picked.
                e.target.value = "";
              }}
              style={{ ...editInputStyle, padding: "3px 6px", flex: "1 1 200px" }}
            />
            {recSupported && !recording && (
              <button
                className="btn small"
                onClick={startRecording}
                disabled={uploading}
                title="record from microphone"
              >
                ● record
              </button>
            )}
            {recording && (
              <button
                className="btn small"
                onClick={stopRecording}
                style={{
                  background: "var(--accent)",
                  color: "var(--paper)",
                  borderColor: "var(--accent)",
                }}
              >
                ◼ stop · {formatRecElapsed(recElapsed)}
              </button>
            )}
            {uploading && <span className="small muted">uploading…</span>}
            {item.audioUrl && !uploading && !recording && (
              <button
                className="btn small ghost"
                onClick={clearAudio}
                style={{ color: "var(--accent)" }}
              >
                remove
              </button>
            )}
          </div>
          {item.audioUrl && (
            <audio
              src={item.audioUrl}
              controls
              preload="none"
              style={{ width: "100%", height: 32, marginTop: 2 }}
            />
          )}
          {uploadError && (
            <div className="small" style={{ color: "var(--accent)" }}>{uploadError}</div>
          )}
        </div>

        {error && <div className="small" style={{ color: "var(--accent)" }}>{error}</div>}

        <div className="row gap-2" style={{ alignItems: "center" }}>
          <button className="btn small primary" onClick={save} disabled={saving || !draft.title.trim()}>
            {saving ? "saving…" : "save"}
          </button>
          <button className="btn small ghost" onClick={cancel}>cancel</button>
          <span className="grow" />
          <button
            className="btn small ghost"
            onClick={del}
            style={{ color: "var(--accent)" }}
          >
            delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ExercisesPane({
  items,
  loading,
  onCreate,
  onChange,
}: {
  items: LibraryItemPublic[] | undefined;
  loading: boolean;
  onCreate: () => void;
  onChange: () => void;
}) {
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Tag chip set + counts. Sorted by frequency desc so the most-used
  // tags are reachable first — the rest fall through naturally.
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items ?? []) {
      for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [items]);

  // If the active tag disappears (last item with it deleted or
  // renamed), drop the filter so the user doesn't end up staring at an
  // empty list with no obvious way out.
  useEffect(() => {
    if (tagFilter && !tagOptions.some((t) => t.tag === tagFilter)) {
      setTagFilter(null);
    }
  }, [tagOptions, tagFilter]);

  const filtered = useMemo(() => {
    const all = items ?? [];
    if (!tagFilter) return all;
    return all.filter((it) => it.tags.includes(tagFilter));
  }, [items, tagFilter]);

  const total = items?.length ?? 0;
  const visibleCount = filtered.length;

  return (
    <>
      <TagFilter
        active={tagFilter}
        onChange={setTagFilter}
        tags={tagOptions}
        totalCount={total}
      />

      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", marginTop: 12 }}>
        {loading && !items && (
          <div className="small muted" style={{ padding: "20px 4px" }}>loading library…</div>
        )}

        {!loading && total === 0 && (
          <div className="box dashed" style={{ textAlign: "center", padding: "32px 16px", color: "var(--ink-soft)" }}>
            <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
              Empty library.
            </div>
            <div className="small muted mt-2 mb-3">
              Add an exercise — tag it with #scales, #warmup, etc. to organize.
            </div>
            <button className="btn primary" onClick={onCreate}>＋ add an exercise</button>
          </div>
        )}

        {!loading && total > 0 && visibleCount === 0 && (
          <div className="small muted center" style={{ padding: "20px 4px" }}>
            No exercises tagged #{tagFilter}.
          </div>
        )}

        {filtered.map((it) => (
          <LibraryRow key={it.id} item={it} onChange={onChange} />
        ))}
      </div>
    </>
  );
}

function LibraryDesktop() {
  const [tab, setTab] = useLibTab();
  const isPaths = tab === "paths";
  const { paths, loading: pathsLoading, refresh: refreshPaths } = useCoachPaths();
  const { items, loading: itemsLoading, refresh: refreshItems } = useLibraryItems();
  const navigate = useNavigate();

  const pathCount = paths?.length ?? 0;
  const itemCount = items?.length ?? 0;

  const handleCreatePath = async () => {
    const newSlug = await promptCreatePath();
    if (newSlug) {
      refreshPaths();
      navigate(`/coach/library/paths/${newSlug}`);
    }
  };

  const handleCreateItem = async () => {
    const created = await promptCreateLibraryItem();
    if (created) refreshItems();
  };

  return (
    <DTFrame side="library">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Library</h2>
          <div className="dt-sub">
            {isPaths
              ? "your paths — drag onto a student's week"
              : "your exercises, organized by tag — type #yourtag to categorize"}
          </div>
        </div>
        <div className="row gap-2">
          {isPaths ? (
            <button className="btn small primary" onClick={handleCreatePath}>＋ new path</button>
          ) : (
            <>
              <button className="btn small ghost" onClick={handleCreateItem}>＋ quick add</button>
              <Link to="/coach/midi/capture" className="btn small primary">＋ record new</Link>
            </>
          )}
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%", padding: "12px 16px" }}>
          {/* Top header row: tab pills + search + sort */}
          <div className="row between mb-3" style={{ flexWrap: "wrap", gap: 12 }}>
            <TabPills tab={tab} onChange={setTab} itemCount={itemCount} pathCount={pathCount} />
            <div className="row gap-2">
              <div className="dt-search" style={{ flex: "0 0 220px", padding: "4px 12px" }}>
                <span>⌕</span>
                <span>search {isPaths ? "paths" : "library"}…</span>
              </div>
              <div className="pill-row">
                <span className="p on">recent</span>
                <span className="p">A–Z</span>
                <span className="p">most-used</span>
              </div>
            </div>
          </div>

          {isPaths ? (
            <PathsBrowsePane
              paths={paths}
              loading={pathsLoading}
              onCreate={handleCreatePath}
            />
          ) : (
            <ExercisesPane
              items={items}
              loading={itemsLoading}
              onCreate={handleCreateItem}
              onChange={refreshItems}
            />
          )}
        </div>
      </div>
    </DTFrame>
  );
}

function LibraryMobile() {
  const [tab, setTab] = useLibTab();
  const { items, loading, refresh } = useLibraryItems();

  if (tab === "paths") return <PathsMobile />;

  const count = items?.length ?? 0;

  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Library</h2>
          <div className="wf-subtitle">
            {loading ? "loading…" : `${count} exercise${count === 1 ? "" : "s"}`}
          </div>
        </div>
        <button
          className="btn icon ghost"
          onClick={async () => {
            const created = await promptCreateLibraryItem();
            if (created) refresh();
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="wf-body col gap-2 scroll-y">
        <div className="dt-search" style={{ padding: "4px 12px" }}>
          <span>⌕</span><span>search…</span>
        </div>
        <div className="seg">
          <div className="s on" onClick={() => setTab("exercises")}>exercises</div>
          <div className="s" onClick={() => setTab("paths")}>paths</div>
          <div className="s">shared</div>
        </div>

        {!loading && count === 0 && (
          <div className="small muted center" style={{ marginTop: 18 }}>
            No exercises yet — tap ＋ to add one.
          </div>
        )}

        {(items ?? []).map((it) => (
          <LibItem
            key={it.id}
            icon={KIND_ICON[it.kind]}
            title={it.title}
            sub={formatItemSubtitle(it)}
            tags={it.tags.map((t) => `#${t}`)}
          />
        ))}

        {count > 0 && (
          <div className="postit small wf-scrawl" style={{ transform: "rotate(0.4deg)" }}>
            Tap any item to assign · long-press to multi-select
          </div>
        )}
      </div>
    </WFFrame>
  );
}

export function LibraryPage() {
  const isMobile = useIsMobile();
  return isMobile ? <LibraryMobile /> : <LibraryDesktop />;
}

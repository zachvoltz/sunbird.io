import type { RoutineItem, RoutinePublic, LibraryItemKind } from "@sunbird/shared";

const KINDS: ReadonlySet<LibraryItemKind> = new Set(["warmup", "exercise", "song"]);

function isKind(v: unknown): v is LibraryItemKind {
  return typeof v === "string" && KINDS.has(v as LibraryItemKind);
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Parse the JSON blob stored in User.currentRoutine. Tolerates legacy
 * formats and stray fields — returns an empty routine if the blob is
 * missing or unparseable so callers can render an empty state instead
 * of an error.
 */
export function parseRoutine(raw: string | null | undefined): RoutinePublic {
  if (!raw) return { items: [], updatedAt: null };
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], updatedAt: null };
  }
  const rawItems: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.items)
    ? parsed.items
    : [];
  const items: RoutineItem[] = [];
  for (const it of rawItems) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    if (!isKind(o.kind) || typeof o.title !== "string" || !o.title.trim()) continue;
    items.push({
      id: typeof o.id === "string" && o.id ? o.id : Math.random().toString(36).slice(2, 10),
      libraryItemId: asStr(o.libraryItemId),
      kind: o.kind,
      title: o.title,
      bars: asStr(o.bars),
      bpmStart: asNum(o.bpmStart),
      bpmEnd: asNum(o.bpmEnd),
      durationMin: asNum(o.durationMin),
      note: asStr(o.note),
    });
  }
  return {
    items,
    updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null,
  };
}

/**
 * Serialize a user-supplied routine for storage. Strips unknown fields,
 * caps the item count (defense against malicious payloads), and stamps
 * a fresh updatedAt.
 */
export function serializeRoutine(items: RoutineItem[]): string {
  const capped = items.slice(0, 50).map((it) => ({
    id: it.id,
    libraryItemId: it.libraryItemId ?? null,
    kind: it.kind,
    title: it.title,
    bars: it.bars ?? null,
    bpmStart: it.bpmStart ?? null,
    bpmEnd: it.bpmEnd ?? null,
    durationMin: it.durationMin ?? null,
    note: it.note ?? null,
  }));
  return JSON.stringify({ items: capped, updatedAt: new Date().toISOString() });
}

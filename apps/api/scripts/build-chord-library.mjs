// Build the Chord Flash Cards chord library by ingesting tombatossals/chords-db.
//
// Per the handoff (chord-library-taxonomy.md §0, §10): note SPELLINGS are
// generated from theory (deterministic, safe); FRET POSITIONS are sourced from
// the verified chords-db dataset (never hand-authored). Output conforms to
// chord-library.schema.json and is validated with ajv before writing.
//
// Run: node apps/api/scripts/build-chord-library.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import Ajv2020 from "ajv/dist/2020.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const guitar = require("@tombatossals/chords-db/lib/guitar.json");

// Schema is vendored next to this script so regeneration is reproducible.
const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "chord-library.schema.json"), "utf8"));
const OUT_PATH = path.resolve(__dirname, "../src/lib/chordLibrary.json");

// ── music theory: spell notes from a root + interval formula ──────────────
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function parseNote(name) {
  const letter = name[0];
  let acc = 0;
  for (const ch of name.slice(1)) acc += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return { letterIdx: LETTERS.indexOf(letter), pc: (LETTER_PC[letter] + acc + 120) % 12 };
}

// interval number → [letter steps, semitones] (before the accidental)
const INTERVAL_BASE = {
  1: [0, 0], 2: [1, 2], 3: [2, 4], 4: [3, 5], 5: [4, 7], 6: [5, 9], 7: [6, 11],
  9: [1, 14], 11: [3, 17], 13: [5, 21],
};

function accStr(diff) {
  if (diff === 0) return "";
  return (diff > 0 ? "#" : "b").repeat(Math.abs(diff));
}

// Spell one interval token (e.g. "b7", "#11") above a root note.
function spellInterval(root, token) {
  const m = /^(#{1,2}|b{1,2})?(\d+)$/.exec(token);
  const accShift = m[1] ? (m[1][0] === "#" ? m[1].length : -m[1].length) : 0;
  const num = Number(m[2]);
  const [steps, baseSemis] = INTERVAL_BASE[num];
  const targetLetterIdx = (root.letterIdx + steps) % 7;
  const targetPc = (root.pc + baseSemis + accShift + 120) % 12;
  const natural = LETTER_PC[LETTERS[targetLetterIdx]];
  let diff = ((targetPc - natural + 6 + 12) % 12) - 6; // nearest, range -6..5
  if (Math.abs(diff) <= 2) return LETTERS[targetLetterIdx] + accStr(diff);
  return SHARP_NAMES[targetPc]; // fallback for triple-accidental cases (rare)
}

function spellChord(rootName, formula) {
  const root = parseNote(rootName);
  return formula.map((tok) => spellInterval(root, tok));
}

// ── tiers (verbatim from the handoff example, the source of truth) ──────────
const tiers = [
  { order: 1, name: "Open majors & minors", description: "Foundational open 'cowboy' chords and power chords.", prerequisiteTier: null, qualityIds: ["5", "major", "minor"] },
  { order: 2, name: "First hurdles, open 7ths & suspended", description: "F/B hard-open shapes plus open 7th, maj7, m7, sus, add9.", prerequisiteTier: 1, qualityIds: ["7", "maj7", "m7", "sus2", "sus4", "add9"] },
  { order: 3, name: "Barre chords", description: "Movable major/minor via E- and A-shape barres; CAGED.", prerequisiteTier: 2, qualityIds: ["major", "minor"] },
  { order: 4, name: "Movable 7ths & color chords", description: "Barre and shell 7ths, 6, m6, 6/9, add9, 7sus4.", prerequisiteTier: 3, qualityIds: ["mmaj7", "6", "m6", "69", "m69", "7sus4", "madd9"] },
  { order: 5, name: "Extended chords", description: "9, 11, 13 families; drop-2 introduced.", prerequisiteTier: 4, qualityIds: ["9", "maj9", "m9", "11", "m11", "maj11", "13", "maj13"] },
  { order: 6, name: "Diminished & augmented", description: "Symmetrical and half-diminished sonorities.", prerequisiteTier: 5, qualityIds: ["dim", "aug", "dim7", "m7b5", "7sharp5", "7flat5", "maj7sharp5", "maj7flat5"] },
  { order: 7, name: "Jazz voicings & altered dominants", description: "Altered dominants, rootless/drop voicings, inversions & slash chords.", prerequisiteTier: 6, qualityIds: ["7flat9", "7sharp9", "9sharp11", "alt"] },
];

// ── quality registry: id, symbol, formula, family, tier, chords-db suffix ──
// `open` marks qualities that have friendly open shapes (tier depends on
// whether a given root actually has an open voicing).
const Q = [
  { id: "5", symbol: "5", fullName: "Power chord", formula: ["1", "5"], family: "power", difficultyTier: 1, suffix: "__power__" },
  { id: "major", symbol: "", aliases: ["maj"], fullName: "Major", formula: ["1", "3", "5"], family: "triad", difficultyTier: 1, suffix: "major", openTier: 1, barreTier: 3 },
  { id: "minor", symbol: "m", aliases: ["min", "-"], fullName: "Minor", formula: ["1", "b3", "5"], family: "triad", difficultyTier: 1, suffix: "minor", openTier: 1, barreTier: 3 },
  { id: "7", symbol: "7", aliases: ["dom7"], fullName: "Dominant seventh", formula: ["1", "3", "5", "b7"], family: "seventh", difficultyTier: 2, suffix: "7", openTier: 2, barreTier: 4 },
  { id: "maj7", symbol: "maj7", aliases: ["M7", "Δ"], fullName: "Major seventh", formula: ["1", "3", "5", "7"], family: "seventh", difficultyTier: 2, suffix: "maj7", openTier: 2, barreTier: 4 },
  { id: "m7", symbol: "m7", aliases: ["min7", "-7"], fullName: "Minor seventh", formula: ["1", "b3", "5", "b7"], family: "seventh", difficultyTier: 2, suffix: "m7", openTier: 2, barreTier: 4 },
  { id: "sus2", symbol: "sus2", fullName: "Suspended second", formula: ["1", "2", "5"], family: "suspended", difficultyTier: 2, suffix: "sus2", openTier: 2, barreTier: 4 },
  { id: "sus4", symbol: "sus4", fullName: "Suspended fourth", formula: ["1", "4", "5"], family: "suspended", difficultyTier: 2, suffix: "sus4", openTier: 2, barreTier: 4 },
  { id: "add9", symbol: "add9", fullName: "Added ninth", formula: ["1", "3", "5", "9"], family: "added", difficultyTier: 2, suffix: "add9", openTier: 2, barreTier: 4 },
  { id: "mmaj7", symbol: "m(maj7)", aliases: ["mM7", "-Δ"], fullName: "Minor-major seventh", formula: ["1", "b3", "5", "7"], family: "seventh", difficultyTier: 4, suffix: "mmaj7" },
  { id: "7sus4", symbol: "7sus4", fullName: "Dominant seventh suspended fourth", formula: ["1", "4", "5", "b7"], family: "suspended", difficultyTier: 4, suffix: "7sus4" },
  { id: "6", symbol: "6", fullName: "Major sixth", formula: ["1", "3", "5", "6"], family: "sixth", difficultyTier: 4, suffix: "6", openTier: 4, barreTier: 4 },
  { id: "m6", symbol: "m6", fullName: "Minor sixth", formula: ["1", "b3", "5", "6"], family: "sixth", difficultyTier: 4, suffix: "m6" },
  { id: "69", symbol: "6/9", fullName: "Six-nine", formula: ["1", "3", "5", "6", "9"], family: "sixth", difficultyTier: 4, suffix: "69" },
  { id: "m69", symbol: "m6/9", fullName: "Minor six-nine", formula: ["1", "b3", "5", "6", "9"], family: "sixth", difficultyTier: 4, suffix: "m69" },
  { id: "madd9", symbol: "m(add9)", fullName: "Minor added ninth", formula: ["1", "b3", "5", "9"], family: "added", difficultyTier: 4, suffix: "madd9" },
  { id: "9", symbol: "9", fullName: "Dominant ninth", formula: ["1", "3", "5", "b7", "9"], family: "extended", difficultyTier: 5, suffix: "9" },
  { id: "maj9", symbol: "maj9", fullName: "Major ninth", formula: ["1", "3", "5", "7", "9"], family: "extended", difficultyTier: 5, suffix: "maj9" },
  { id: "m9", symbol: "m9", fullName: "Minor ninth", formula: ["1", "b3", "5", "b7", "9"], family: "extended", difficultyTier: 5, suffix: "m9" },
  { id: "11", symbol: "11", fullName: "Dominant eleventh", formula: ["1", "3", "5", "b7", "9", "11"], family: "extended", difficultyTier: 5, suffix: "11" },
  { id: "m11", symbol: "m11", fullName: "Minor eleventh", formula: ["1", "b3", "5", "b7", "9", "11"], family: "extended", difficultyTier: 5, suffix: "m11" },
  { id: "maj11", symbol: "maj11", fullName: "Major eleventh", formula: ["1", "3", "5", "7", "9", "11"], family: "extended", difficultyTier: 5, suffix: "maj11" },
  { id: "13", symbol: "13", fullName: "Dominant thirteenth", formula: ["1", "3", "5", "b7", "9", "13"], family: "extended", difficultyTier: 5, suffix: "13" },
  { id: "maj13", symbol: "maj13", fullName: "Major thirteenth", formula: ["1", "3", "5", "7", "9", "13"], family: "extended", difficultyTier: 5, suffix: "maj13" },
  { id: "dim", symbol: "dim", aliases: ["°"], fullName: "Diminished triad", formula: ["1", "b3", "b5"], family: "triad", difficultyTier: 6, suffix: "dim" },
  { id: "aug", symbol: "aug", aliases: ["+"], fullName: "Augmented triad", formula: ["1", "3", "#5"], family: "triad", difficultyTier: 6, suffix: "aug" },
  { id: "dim7", symbol: "dim7", aliases: ["°7"], fullName: "Diminished seventh", formula: ["1", "b3", "b5", "bb7"], family: "seventh", difficultyTier: 6, suffix: "dim7" },
  { id: "m7b5", symbol: "m7b5", aliases: ["ø"], fullName: "Half-diminished", formula: ["1", "b3", "b5", "b7"], family: "seventh", difficultyTier: 6, suffix: "m7b5" },
  { id: "7sharp5", symbol: "7#5", aliases: ["aug7", "7+"], fullName: "Dominant seventh sharp five", formula: ["1", "3", "#5", "b7"], family: "altered", difficultyTier: 6, suffix: "aug7" },
  { id: "7flat5", symbol: "7b5", fullName: "Dominant seventh flat five", formula: ["1", "3", "b5", "b7"], family: "altered", difficultyTier: 6, suffix: "7b5" },
  { id: "maj7sharp5", symbol: "maj7#5", fullName: "Major seventh sharp five", formula: ["1", "3", "#5", "7"], family: "seventh", difficultyTier: 6, suffix: "maj7#5" },
  { id: "maj7flat5", symbol: "maj7b5", fullName: "Major seventh flat five", formula: ["1", "3", "b5", "7"], family: "seventh", difficultyTier: 6, suffix: "maj7b5" },
  { id: "7flat9", symbol: "7b9", fullName: "Dominant seventh flat nine", formula: ["1", "3", "5", "b7", "b9"], family: "altered", difficultyTier: 7, suffix: "7b9" },
  { id: "7sharp9", symbol: "7#9", aliases: ["7+9"], fullName: "Dominant seventh sharp nine", formula: ["1", "3", "5", "b7", "#9"], family: "altered", difficultyTier: 7, suffix: "7#9" },
  { id: "9sharp11", symbol: "9#11", fullName: "Dominant ninth sharp eleven", formula: ["1", "3", "5", "b7", "9", "#11"], family: "altered", difficultyTier: 7, suffix: "9#11" },
  { id: "alt", symbol: "alt", fullName: "Altered dominant", formula: ["1", "3", "b7", "#9"], family: "altered", difficultyTier: 7, suffix: "alt" },
];
const Q_BY_SUFFIX = new Map(Q.map((q) => [q.suffix, q]));

// ── helpers for voicing conversion ──────────────────────────────────────────
function rootId(key) {
  return key.replace("#", "sharp").toLowerCase();
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function isOpenVoicing(pos) {
  return pos.baseFret === 1 && (!pos.barres || pos.barres.length === 0) && pos.frets.some((f) => f === 0);
}
function categoryOf(pos, qid) {
  if (qid === "5") return "power";
  if (pos.barres && pos.barres.length > 0) return "barre";
  if (isOpenVoicing(pos)) return "open";
  return "caged"; // movable, no barre
}
// chords-db barres are bare fret numbers; infer the string span from the strings
// actually fretted at that window-fret.
function barreObjs(pos) {
  if (!pos.barres || pos.barres.length === 0) return [];
  return pos.barres.map((fret) => {
    const idx = pos.frets.map((f, i) => (f === fret ? i : -1)).filter((i) => i >= 0);
    return { fret, fromString: Math.min(...idx), toString: Math.max(...idx) };
  });
}
function labelOf(cat, baseFret) {
  if (cat === "open") return "Open position";
  if (cat === "power") return "Power chord";
  if (cat === "barre") return `Barre, ${ordinal(baseFret)} fret`;
  return `Movable, ${ordinal(baseFret)} fret`;
}

// Generate movable power chords for a root (chords-db has no "5"): a
// 6th-string-root (E-shape) and a 5th-string-root (A-shape) voicing. The lower
// on the neck is recommended. Both are root-5th-octave shapes.
function powerVoicings(rootPc) {
  const mk = (id, label, frets, fingers, baseFret, caged) => ({
    id, label, frets, fingers, baseFret, barres: [], category: "power",
    cagedShape: caged, inversionBass: null, difficultyTier: 1, recommendedForTier: false,
  });
  const fE = (rootPc - 4 + 12) % 12; // root fret on the low-E (6th) string
  const fA = (rootPc - 9 + 12) % 12; // root fret on the A (5th) string
  const eShape = fE === 0
    ? mk("power-e-open", "Power chord (open, 6th-string root)", [0, 2, 2, -1, -1, -1], [0, 1, 2, 0, 0, 0], 1, "E")
    : mk(`power-e-${fE}fr`, "Power chord (6th-string root)", [1, 3, 3, -1, -1, -1], [1, 3, 4, 0, 0, 0], fE, "E");
  const aShape = fA === 0
    ? mk("power-a-open", "Power chord (open, 5th-string root)", [-1, 0, 2, 2, -1, -1], [0, 0, 1, 2, 0, 0], 1, "A")
    : mk(`power-a-${fA}fr`, "Power chord (5th-string root)", [-1, 1, 3, 3, -1, -1], [0, 1, 3, 4, 0, 0], fA, "A");
  const arr = [eShape, aShape].sort((a, b) => a.baseFret - b.baseFret);
  arr[0].recommendedForTier = true;
  return arr;
}

const MAX_VOICINGS = 4;

// ── build ────────────────────────────────────────────────────────────────
const chords = [];
const flagged = [];

for (const key of guitar.keys) {
  const rid = rootId(key);
  const dbEntries = guitar.chords[key.replace("#", "sharp")] || [];

  // Power chords (generated, all 12 roots).
  {
    const { pc } = parseNote(key);
    chords.push({
      id: `${rid}-5`, canonicalName: `${key}5`, displayAliases: [], root: key, quality: "5",
      formula: ["1", "5"], spelling: spellChord(key, ["1", "5"]), difficultyTier: 1, voicings: powerVoicings(pc),
    });
  }

  for (const q of Q) {
    if (q.suffix === "__power__") continue;
    const entry = dbEntries.find((e) => e.suffix === q.suffix);
    if (!entry || !entry.positions || entry.positions.length === 0) {
      flagged.push(`${key} ${q.suffix}`);
      continue;
    }
    const spelling = spellChord(key, q.formula);
    const hasOpen = entry.positions.some(isOpenVoicing);
    const chordTier = q.openTier
      ? hasOpen
        ? q.openTier
        : q.barreTier
      : q.difficultyTier;

    // Sort voicings: open first, then by baseFret; cap the count.
    const sorted = [...entry.positions].sort((a, b) => {
      const ao = isOpenVoicing(a) ? 0 : 1;
      const bo = isOpenVoicing(b) ? 0 : 1;
      return ao - bo || a.baseFret - b.baseFret;
    });
    const seen = new Set();
    const voicings = [];
    for (const pos of sorted) {
      if (voicings.length >= MAX_VOICINGS) break;
      const cat = categoryOf(pos, q.id);
      let vid = `${cat}-${pos.baseFret}fr`;
      while (seen.has(vid)) vid += "b";
      seen.add(vid);
      const open = isOpenVoicing(pos);
      const voicing = {
        id: vid,
        label: labelOf(cat, pos.baseFret),
        frets: pos.frets,
        fingers: pos.fingers,
        baseFret: pos.baseFret,
        barres: barreObjs(pos),
        category: cat,
        cagedShape: null,
        inversionBass: null,
        difficultyTier: open ? chordTier : Math.max(chordTier, 3),
        recommendedForTier: voicings.length === 0,
      };
      if (pos.capo) voicing.capo = true;
      if (Array.isArray(pos.midi)) voicing.midi = pos.midi;
      voicings.push(voicing);
    }

    chords.push({
      id: `${rid}-${q.id}`,
      canonicalName: `${key}${q.symbol}`,
      displayAliases: (q.aliases || []).map((a) => `${key}${a}`),
      root: key,
      quality: q.id,
      formula: q.formula,
      spelling,
      difficultyTier: chordTier,
      voicings,
    });
  }

  // Slash chords / inversions (chords-db bass-note suffixes) → tier 7.
  for (const e of dbEntries) {
    if (!e.suffix.includes("/")) continue;
    const isMinor = e.suffix.startsWith("m/");
    const bass = e.suffix.split("/")[1];
    const base = isMinor ? Q_BY_SUFFIX.get("minor") : Q_BY_SUFFIX.get("major");
    if (!e.positions || e.positions.length === 0) continue;
    const voicings = e.positions.slice(0, MAX_VOICINGS).map((pos, i) => ({
      id: `inversion-${i}`,
      label: i === 0 ? `${bass} in bass` : `${bass} in bass, ${ordinal(pos.baseFret)} fret`,
      frets: pos.frets,
      fingers: pos.fingers,
      baseFret: pos.baseFret,
      barres: barreObjs(pos),
      category: "inversion",
      cagedShape: null,
      inversionBass: bass,
      difficultyTier: 7,
      recommendedForTier: i === 0,
      ...(Array.isArray(pos.midi) ? { midi: pos.midi } : {}),
    }));
    chords.push({
      id: `${rid}-slash-${rootId(bass)}${isMinor ? "-m" : ""}`,
      canonicalName: `${key}${base.symbol}/${bass}`,
      displayAliases: [],
      root: key,
      quality: base.id,
      formula: base.formula,
      spelling: spellChord(key, base.formula),
      difficultyTier: 7,
      tags: ["slash", "inversion"],
      voicings,
    });
  }
}

// Qualities registry for the file (drop the internal openTier/barreTier/suffix
// helper keys; keep sourceSuffix for provenance).
const qualities = Q.map((q) => ({
  id: q.id,
  symbol: q.symbol,
  ...(q.aliases ? { aliases: q.aliases } : {}),
  fullName: q.fullName,
  formula: q.formula,
  family: q.family,
  difficultyTier: q.difficultyTier,
  ...(q.suffix !== "__power__" ? { sourceSuffix: q.suffix } : {}),
}));

const library = {
  meta: {
    schemaVersion: "1.0.0",
    instrument: "guitar",
    stringCount: 6,
    tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
    fretConvention: "frets[] low E -> high E; -1 muted, 0 open, N = Nth fret in window (1 = baseFret). Absolute fret = baseFret + N - 1.",
  },
  tiers,
  qualities,
  chords,
};

// ── validate ────────────────────────────────────────────────────────────────
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
if (!validate(library)) {
  console.error("❌ Schema validation FAILED:");
  console.error(validate.errors.slice(0, 20));
  process.exit(1);
}

fs.writeFileSync(OUT_PATH, JSON.stringify(library) + "\n");
const perTier = tiers.map((t) => `T${t.order}:${chords.filter((c) => c.difficultyTier === t.order).length}`).join("  ");
console.log(`✅ Wrote ${chords.length} chords (${library.qualities.length} qualities, ${tiers.length} tiers) to ${path.relative(process.cwd(), OUT_PATH)}`);
console.log(`   per tier: ${perTier}`);
console.log(`   voicings: ${chords.reduce((n, c) => n + c.voicings.length, 0)} total`);
console.log(`   flagged (no dataset match): ${flagged.length}${flagged.length ? " — e.g. " + flagged.slice(0, 8).join(", ") : ""}`);

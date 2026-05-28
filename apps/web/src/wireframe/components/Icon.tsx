// Thin lucide-react adapter for the wireframe's icon vocabulary.
//
// Every name here resolves to a real lucide icon so the whole app
// renders a single, consistent icon set. We keep the local `Icon`
// component (rather than spreading lucide imports across all 90+
// callsites) so the wireframe pages can use musical-domain names
// like `metro` or `chev` without each file knowing the lucide name.

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  DollarSign,
  Flame,
  GraduationCap,
  Headphones,
  Home,
  Inbox,
  Library,
  Map,
  Mic,
  Music,
  Music2,
  NotebookPen,
  Pause,
  Pin,
  Play,
  Plus,
  Send,
  Star,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type IconName =
  | "play" | "pause" | "note" | "mic" | "record" | "fire" | "clock"
  | "chev" | "star" | "metro" | "plus" | "back" | "pin" | "headphones" | "send"
  | "home" | "inbox" | "cal" | "lib" | "money" | "user" | "journal" | "map" | "cap";

// Some icons read better filled (play triangle, record dot, gold
// star) — keep that legacy treatment so visual weight stays close
// to the hand-drawn originals.
const FILLED: Partial<Record<IconName, true>> = {
  play: true,
  record: true,
  star: true,
};

const MAP: Record<IconName, LucideIcon> = {
  play: Play,
  pause: Pause,
  note: Music2,        // two notes joined — matches the original eighth-note pair
  mic: Mic,
  record: Circle,
  fire: Flame,
  clock: Clock,
  chev: ChevronRight,
  star: Star,
  metro: Music,        // no metronome in lucide; Music carries the warmup vibe
  plus: Plus,
  back: ChevronLeft,
  pin: Pin,
  headphones: Headphones,
  send: Send,
  home: Home,
  inbox: Inbox,
  cal: Calendar,
  lib: Library,
  money: DollarSign,
  user: User,
  journal: NotebookPen,
  map: Map,
  cap: GraduationCap,
};

export function Icon({
  name,
  size = 18,
  stroke = "currentColor",
}: {
  name: IconName;
  size?: number;
  /** kept for compat — passes through to lucide's `color` */
  stroke?: string;
}) {
  const Cmp = MAP[name];
  const fill = FILLED[name] ? stroke : "none";
  return <Cmp size={size} color={stroke} strokeWidth={1.75} fill={fill} />;
}

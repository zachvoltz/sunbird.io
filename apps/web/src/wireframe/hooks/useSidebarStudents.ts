import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { SidebarStudent } from "../components/DTFrame";

type StudentInfo = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
  bookingCount: number;
  lastLessonAt: string;
  status?: "ACTIVE" | "PENDING";
  inviteId?: string;
};

type BookingMin = {
  id: string;
  status: string;
  startsAt: string;
  user?: { id: string } | null;
};

// Module-level cache so every page shares one fetch.
let cachedStudents: SidebarStudent[] | null = null;
let inflight: Promise<SidebarStudent[]> | null = null;
const subscribers = new Set<(s: SidebarStudent[]) => void>();

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (ymd(d) === ymd(today)) {
    return (
      "today " +
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        .replace(" ", "")
        .toLowerCase()
    );
  }
  const t2 = new Date(today);
  t2.setDate(today.getDate() + 1);
  if (ymd(d) === ymd(t2)) return "tomorrow";
  const diff = Math.floor((+d - +today) / (1000 * 60 * 60 * 24));
  if (diff >= 0 && diff <= 6) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function build(students: StudentInfo[], bookings: BookingMin[]): SidebarStudent[] {
  const next = new Map<string, string>();
  for (const b of bookings) {
    if (b.status !== "CONFIRMED") continue;
    if (!b.user) continue;
    const prev = next.get(b.user.id);
    if (!prev || b.startsAt < prev) next.set(b.user.id, b.startsAt);
  }
  return students
    .slice()
    .sort((a, b) => {
      // Pending (invited) students always sort to the bottom.
      const ap = a.status === "PENDING";
      const bp = b.status === "PENDING";
      if (ap !== bp) return ap ? 1 : -1;
      const an = next.get(a.id);
      const bn = next.get(b.id);
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      if (an && bn) return an.localeCompare(bn);
      return a.name.localeCompare(b.name);
    })
    .map((s): SidebarStudent => {
      if (s.status === "PENDING") {
        return {
          id: s.id,
          n: s.name,
          dot: false,
          when: "invited",
          status: "PENDING",
          inviteId: s.inviteId,
        };
      }
      const when = next.get(s.id);
      const isToday = when ? ymd(new Date(when)) === ymd(new Date()) : false;
      return {
        id: s.id,
        n: s.name,
        today: isToday,
        dot: false,
        when: when ? relativeDay(when) : "—",
        status: "ACTIVE",
      };
    });
}

function fetchOnce(): Promise<SidebarStudent[]> {
  if (cachedStudents) return Promise.resolve(cachedStudents);
  if (inflight) return inflight;
  inflight = Promise.all([
    apiFetch<{ data: StudentInfo[] }>("/api/coaches/students").catch(() => ({ data: [] as StudentInfo[] })),
    apiFetch<{ data: BookingMin[] }>("/api/bookings").catch(() => ({ data: [] as BookingMin[] })),
  ]).then(([s, b]) => {
    const out = build(s.data, b.data);
    cachedStudents = out;
    inflight = null;
    for (const cb of subscribers) cb(out);
    return out;
  });
  return inflight;
}

// Bust the module cache and refetch, notifying every mounted subscriber.
// Call after mutating the roster (e.g. inviting or revoking a student).
export function refreshSidebarStudents(): void {
  cachedStudents = null;
  inflight = null;
  fetchOnce();
}

export function useSidebarStudents(): SidebarStudent[] | undefined {
  const [students, setStudents] = useState<SidebarStudent[] | undefined>(cachedStudents ?? undefined);

  useEffect(() => {
    let mounted = true;
    if (!cachedStudents) {
      fetchOnce().then((s) => mounted && setStudents(s));
    }
    const sub = (s: SidebarStudent[]) => mounted && setStudents(s);
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);

  return students;
}

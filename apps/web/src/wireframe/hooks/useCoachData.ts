import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { BookingPublic, CoachDashboardPublic, StudentDetailPublic } from "@sunbird/shared";

export type StudentInfo = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
  bookingCount: number;
  lastLessonAt: string;
};

// Shared, in-memory caches. Avoid refetching across pages within a session.
let studentsCache: StudentInfo[] | null = null;
let studentsInflight: Promise<StudentInfo[]> | null = null;
let bookingsCache: BookingPublic[] | null = null;
let bookingsInflight: Promise<BookingPublic[]> | null = null;
const detailCache = new Map<string, StudentDetailPublic>();
const detailInflight = new Map<string, Promise<StudentDetailPublic | undefined>>();

function fetchStudents(): Promise<StudentInfo[]> {
  if (studentsCache) return Promise.resolve(studentsCache);
  if (studentsInflight) return studentsInflight;
  studentsInflight = apiFetch<{ data: StudentInfo[] }>("/api/coaches/students")
    .then((r) => {
      studentsCache = r.data;
      studentsInflight = null;
      return r.data;
    })
    .catch(() => {
      studentsInflight = null;
      return [];
    });
  return studentsInflight;
}

function fetchBookings(): Promise<BookingPublic[]> {
  if (bookingsCache) return Promise.resolve(bookingsCache);
  if (bookingsInflight) return bookingsInflight;
  bookingsInflight = apiFetch<{ data: BookingPublic[] }>("/api/bookings")
    .then((r) => {
      bookingsCache = r.data;
      bookingsInflight = null;
      return r.data;
    })
    .catch(() => {
      bookingsInflight = null;
      return [];
    });
  return bookingsInflight;
}

function fetchStudentDetail(id: string): Promise<StudentDetailPublic | undefined> {
  const cached = detailCache.get(id);
  if (cached) return Promise.resolve(cached);
  const inflight = detailInflight.get(id);
  if (inflight) return inflight;
  const p = apiFetch<{ data: StudentDetailPublic }>(`/api/coaches/students/${id}`)
    .then((r) => {
      detailCache.set(id, r.data);
      detailInflight.delete(id);
      return r.data;
    })
    .catch(() => {
      detailInflight.delete(id);
      return undefined;
    });
  detailInflight.set(id, p);
  return p;
}

export function useStudent(studentId: string | undefined): {
  student: StudentInfo | undefined;
  bookings: BookingPublic[];
  loading: boolean;
} {
  const [student, setStudent] = useState<StudentInfo | undefined>(undefined);
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let alive = true;
    Promise.all([fetchStudents(), fetchBookings()]).then(([students, allBookings]) => {
      if (!alive) return;
      setStudent(students.find((s) => s.id === studentId));
      setBookings(allBookings.filter((b) => b.user?.id === studentId));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [studentId]);

  return { student, bookings, loading };
}

let dashboardCache: CoachDashboardPublic | null = null;
let dashboardInflight: Promise<CoachDashboardPublic | undefined> | null = null;

function fetchDashboard(): Promise<CoachDashboardPublic | undefined> {
  if (dashboardCache) return Promise.resolve(dashboardCache);
  if (dashboardInflight) return dashboardInflight;
  dashboardInflight = apiFetch<{ data: CoachDashboardPublic }>("/api/coaches/dashboard")
    .then((r) => {
      dashboardCache = r.data;
      dashboardInflight = null;
      return r.data;
    })
    .catch(() => {
      dashboardInflight = null;
      return undefined;
    });
  return dashboardInflight;
}

export function useCoachDashboard(): {
  dashboard: CoachDashboardPublic | undefined;
  loading: boolean;
} {
  const [dashboard, setDashboard] = useState<CoachDashboardPublic | undefined>(
    dashboardCache ?? undefined,
  );
  const [loading, setLoading] = useState(!dashboard);
  useEffect(() => {
    let alive = true;
    fetchDashboard().then((d) => {
      if (!alive) return;
      setDashboard(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { dashboard, loading };
}

// Self-data: same shape, fetched via /api/me/student-data (no role required).
let selfDetailCache: StudentDetailPublic | null = null;
let selfDetailInflight: Promise<StudentDetailPublic | undefined> | null = null;

function fetchSelfDetail(): Promise<StudentDetailPublic | undefined> {
  if (selfDetailCache) return Promise.resolve(selfDetailCache);
  if (selfDetailInflight) return selfDetailInflight;
  selfDetailInflight = apiFetch<{ data: StudentDetailPublic }>("/api/me/student-data")
    .then((r) => {
      selfDetailCache = r.data;
      selfDetailInflight = null;
      return r.data;
    })
    .catch(() => {
      selfDetailInflight = null;
      return undefined;
    });
  return selfDetailInflight;
}

export function useMyStudentDetail(): {
  detail: StudentDetailPublic | undefined;
  loading: boolean;
  error: boolean;
  refresh: () => void;
} {
  const [detail, setDetail] = useState<StudentDetailPublic | undefined>(
    selfDetailCache ?? undefined,
  );
  const [loading, setLoading] = useState(!detail);
  // fetchSelfDetail resolves undefined only on failure, so a falsy result with
  // no cached detail means the load errored.
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchSelfDetail().then((d) => {
      if (!alive) return;
      setDetail(d);
      setError(!d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  const refresh = () => {
    selfDetailCache = null;
    setError(false);
    fetchSelfDetail().then((d) => { setDetail(d); setError(!d); });
  };
  return { detail, loading, error, refresh };
}

export function useStudentDetail(studentId: string | undefined): {
  detail: StudentDetailPublic | undefined;
  loading: boolean;
} {
  const [detail, setDetail] = useState<StudentDetailPublic | undefined>(
    studentId ? detailCache.get(studentId) : undefined,
  );
  const [loading, setLoading] = useState(!detail);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetchStudentDetail(studentId).then((d) => {
      if (!alive) return;
      setDetail(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [studentId]);

  return { detail, loading };
}

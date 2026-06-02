// Remembers which role a visitor intended when they entered signup from a
// role-aware entry point ("Sign up as a student" / "Become a coach"). Stored in
// localStorage so it survives the full-page Google OAuth redirect roundtrip
// (query params on /login don't, since Google redirects straight to
// /onboarding/role). Consumed + cleared by the role picker, which still asks the
// user to confirm (the role choice is one-time).

export type IntendedRole = "STUDENT" | "COACH";

const KEY = "birdie_intended_role";

export function setIntendedRole(role: IntendedRole): void {
  try { localStorage.setItem(KEY, role); } catch { /* ignore */ }
}

export function getIntendedRole(): IntendedRole | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "STUDENT" || v === "COACH" ? v : null;
  } catch {
    return null;
  }
}

export function clearIntendedRole(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { getIntendedRole, clearIntendedRole } from "@/lib/signupIntent";

type Choice = "STUDENT" | "COACH";

const OPTIONS: { role: Choice; title: string; blurb: string }[] = [
  {
    role: "STUDENT",
    title: "I'm a student",
    blurb: "Book lessons, practice with assignments, and submit takes for feedback.",
  },
  {
    role: "COACH",
    title: "I'm a coach",
    blurb: "Set your availability, build a library, and run lessons with your students.",
  },
];

// Post-signup step: a brand-new user picks student vs coach before landing in
// the app. AuthGate funnels any unchosen user here; choosing locks in the role
// (POST /api/me/role) and routes to the matching dashboard.
export function RolePicker() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState<Choice | null>(null);
  const [error, setError] = useState("");
  // Role the visitor signaled at a "Sign up as a …" entry point. We pre-emphasize
  // it but still require a tap — the choice is one-time.
  const [intended] = useState(() => getIntendedRole());

  const choose = async (role: Choice) => {
    setError("");
    setSubmitting(role);
    try {
      await apiFetch("/api/me/role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      clearIntendedRole();
      await refresh();
      navigate(role === "COACH" ? "/coach/roster" : "/today", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.body.error : "Something went wrong. Please try again.");
      setSubmitting(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-cream">
      <div className="w-full max-w-xl">
        <h1 className="font-display text-3xl font-bold text-charcoal text-center mb-2">
          How will you use Birdie?
        </h1>
        <p className="text-sm text-text-secondary text-center mb-10">
          You can't change this later, so pick the one that fits.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((opt) => {
            const highlighted = intended === opt.role;
            return (
              <button
                key={opt.role}
                type="button"
                disabled={submitting !== null}
                onClick={() => choose(opt.role)}
                className={`relative text-left border rounded-xl p-6 bg-surface hover:border-charcoal hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  highlighted ? "border-charcoal ring-2 ring-charcoal/15" : "border-warm-gray"
                }`}
              >
                {highlighted && (
                  <span className="absolute top-3 right-3 text-[10px] font-medium uppercase tracking-[0.1em] text-iris">
                    Based on your signup
                  </span>
                )}
                <div className="font-display text-xl font-bold text-charcoal mb-2">
                  {submitting === opt.role ? "Setting up…" : opt.title}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{opt.blurb}</p>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-6 bg-coral/10 text-coral text-sm px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import type { BookingState } from "./BookPage";
import { stashBookingForGoogle } from "./bookingResume";

type Props = {
  // The in-progress booking, stashed before the Google redirect so it can be
  // restored when the student lands back on /book.
  state: BookingState;
  // Called after a successful in-flow (email) sign-in / sign-up. The Confirm
  // step wires this to submit the booking immediately.
  onAuthed: () => void;
};

type Tab = "signin" | "register";

// Booking a lesson is unambiguously a student action, so accounts created here
// are assigned the STUDENT role automatically — no onboarding role-picker detour.
const GOOGLE_HREF = `/api/auth/oauth/google?redirect=${encodeURIComponent("/book")}&role=STUDENT`;

export function BookingAuthPanel({ state, onAuthed }: Props) {
  const { login, register, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      if (tab === "signin") {
        await login(email, password);
      } else {
        await register({ name, email, password });
        // Lock in STUDENT so this signup skips the role picker. Ignore a 409 in
        // the unlikely case the account already had a role.
        await apiFetch("/api/me/role", {
          method: "POST",
          body: JSON.stringify({ role: "STUDENT" }),
        }).catch(() => {});
        await refresh();
      }
      onAuthed();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.error);
        if (err.body.details) setFieldErrors(err.body.details);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
    // On success we leave `loading` true — the booking submit takes over.
  };

  const handleGoogle = () => {
    stashBookingForGoogle(state);
  };

  return (
    <div className="bg-surface rounded-card shadow-card p-8">
      <h3 className="font-display text-xl font-bold mb-1">
        {tab === "signin" ? "Sign in to finish booking" : "Create an account to finish"}
      </h3>
      <p className="text-sm text-text-secondary mb-6">
        Your lesson details above are saved — just confirm who you are.
      </p>

      {/* Tab toggle */}
      <div className="flex border-b border-warm-gray mb-6">
        <button
          type="button"
          onClick={() => { setTab("register"); setError(""); setFieldErrors({}); }}
          className={`flex-1 pb-3 text-sm font-medium tracking-wide transition-colors ${
            tab === "register"
              ? "text-charcoal border-b-2 border-charcoal"
              : "text-text-secondary hover:text-charcoal"
          }`}
        >
          Create Account
        </button>
        <button
          type="button"
          onClick={() => { setTab("signin"); setError(""); setFieldErrors({}); }}
          className={`flex-1 pb-3 text-sm font-medium tracking-wide transition-colors ${
            tab === "signin"
              ? "text-charcoal border-b-2 border-charcoal"
              : "text-text-secondary hover:text-charcoal"
          }`}
        >
          Sign In
        </button>
      </div>

      {/* Google OAuth */}
      <a
        href={GOOGLE_HREF}
        onClick={handleGoogle}
        className="flex items-center justify-center gap-3 w-full border border-warm-gray rounded-lg px-4 py-3 text-sm font-medium text-charcoal hover:bg-cream transition-colors mb-6"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </a>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-warm-gray" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-4 text-text-secondary">or</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {tab === "register" && (
          <div>
            <label htmlFor="ba-name" className="block text-sm font-medium text-charcoal mb-1.5">Name</label>
            <input
              id="ba-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-warm-gray rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors"
              placeholder="Your name"
            />
            {fieldErrors.name && <p className="text-coral text-xs mt-1">{fieldErrors.name[0]}</p>}
          </div>
        )}

        <div>
          <label htmlFor="ba-email" className="block text-sm font-medium text-charcoal mb-1.5">Email</label>
          <input
            id="ba-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-warm-gray rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors"
            placeholder="you@example.com"
          />
          {fieldErrors.email && <p className="text-coral text-xs mt-1">{fieldErrors.email[0]}</p>}
        </div>

        <div>
          <label htmlFor="ba-password" className="block text-sm font-medium text-charcoal mb-1.5">Password</label>
          <input
            id="ba-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full border border-warm-gray rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors"
            placeholder={tab === "register" ? "At least 8 characters" : "••••••••"}
          />
          {fieldErrors.password && <p className="text-coral text-xs mt-1">{fieldErrors.password[0]}</p>}
        </div>

        {error && <div className="bg-coral/10 text-coral text-sm px-4 py-3 rounded-lg">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-[14px] font-medium text-cream bg-iris py-3 rounded-card hover:bg-iris-hover transition-all duration-300 disabled:opacity-50"
        >
          {loading ? "Booking…" : tab === "signin" ? "Sign in & book" : "Create account & book"}
        </button>
      </form>
    </div>
  );
}

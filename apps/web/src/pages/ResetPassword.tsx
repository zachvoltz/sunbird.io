import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiFetch, ApiError } from "@/lib/api";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // If we have a token, show the reset form. Otherwise show the forgot form.
  if (token) {
    return <ResetForm token={token} />;
  }
  return <ForgotForm />;
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.error);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-3xl font-bold text-charcoal mb-4">Check your email</h1>
          <p className="text-text-secondary mb-8">
            If an account exists with <strong>{email}</strong>, we've sent a password reset link.
          </p>
          <Link to="/login" className="text-sm font-medium text-charcoal hover:text-ink transition-colors underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-bold text-charcoal text-center mb-3">
          Reset your password
        </h1>
        <p className="text-text-secondary text-center text-sm mb-8">
          Enter your email and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-warm-gray rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <div className="bg-coral/10 text-coral text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-charcoal text-cream text-sm font-medium py-3 rounded-lg hover:bg-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>

          <div className="text-center">
            <Link to="/login" className="text-xs text-text-secondary hover:text-charcoal transition-colors">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.error);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-3xl font-bold text-charcoal mb-4">Password reset!</h1>
          <p className="text-text-secondary mb-8">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link
            to="/login"
            className="inline-block bg-charcoal text-cream text-sm font-medium px-8 py-3 rounded-lg hover:bg-ink transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-bold text-charcoal text-center mb-3">
          Set a new password
        </h1>
        <p className="text-text-secondary text-center text-sm mb-8">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-charcoal mb-1.5">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-warm-gray rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-charcoal mb-1.5">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="w-full border border-warm-gray rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors"
              placeholder="Repeat your password"
            />
          </div>

          {error && (
            <div className="bg-coral/10 text-coral text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-charcoal text-cream text-sm font-medium py-3 rounded-lg hover:bg-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}

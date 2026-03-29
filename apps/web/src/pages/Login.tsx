import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

type Tab = "signin" | "register";

export function Login() {
  const [tab, setTab] = useState<Tab>("signin");
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

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
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.error);
        if (err.body.details) setFieldErrors(err.body.details);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-bold text-charcoal text-center mb-8">
          {tab === "signin" ? "Welcome back" : "Create your account"}
        </h1>

        {/* Tab toggle */}
        <div className="flex border-b border-warm-gray mb-8">
          <button
            onClick={() => { setTab("signin"); setError(""); setFieldErrors({}); }}
            className={`flex-1 pb-3 text-sm font-medium tracking-wide transition-colors ${
              tab === "signin"
                ? "text-charcoal border-b-2 border-charcoal"
                : "text-text-secondary hover:text-charcoal"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab("register"); setError(""); setFieldErrors({}); }}
            className={`flex-1 pb-3 text-sm font-medium tracking-wide transition-colors ${
              tab === "register"
                ? "text-charcoal border-b-2 border-charcoal"
                : "text-text-secondary hover:text-charcoal"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Google OAuth */}
        <a
          href="/api/auth/oauth/google"
          className="flex items-center justify-center gap-3 w-full border border-warm-gray rounded-lg px-4 py-3 text-sm font-medium text-charcoal hover:bg-cream transition-colors mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "register" && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-charcoal mb-1.5">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-warm-gray rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors"
                placeholder="Your name"
              />
              {fieldErrors.name && (
                <p className="text-coral text-xs mt-1">{fieldErrors.name[0]}</p>
              )}
            </div>
          )}

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
            {fieldErrors.email && (
              <p className="text-coral text-xs mt-1">{fieldErrors.email[0]}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-charcoal">
                Password
              </label>
              {tab === "signin" && (
                <Link
                  to="/reset-password"
                  className="text-xs text-text-secondary hover:text-charcoal transition-colors"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-warm-gray rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors"
              placeholder={tab === "register" ? "At least 8 characters" : "••••••••"}
            />
            {fieldErrors.password && (
              <p className="text-coral text-xs mt-1">{fieldErrors.password[0]}</p>
            )}
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
            {loading
              ? "Please wait..."
              : tab === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

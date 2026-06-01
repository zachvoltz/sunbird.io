import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Fresh signups haven't picked student/coach yet — funnel them to the
  // onboarding picker before any app route. The path guard avoids a loop on
  // the picker itself.
  if (user && !user.roleChosen && location.pathname !== "/onboarding/role") {
    return <Navigate to="/onboarding/role" replace />;
  }

  return <>{children}</>;
}

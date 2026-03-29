import type { ReactNode } from "react";
import type { Role } from "@sunbird/shared";
import { useAuth } from "@/context/AuthContext";

interface RoleGateProps {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ roles, children, fallback }: RoleGateProps) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return (
      fallback ?? (
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-charcoal mb-2">Access denied</h2>
            <p className="text-text-secondary text-sm">
              You don't have permission to view this page.
            </p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

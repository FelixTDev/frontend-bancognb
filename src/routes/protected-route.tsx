import {
  Navigate,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import type { UserRole } from "../shared/types/domain";
import { useAuth } from "../features/auth/auth-context";
import { homeForRole, isRoleAllowed } from "../features/auth/roles";
import { getSafeReturnTo } from "../features/auth/return-to";

export function ProtectedRoute({
  roles,
}: {
  readonly roles: readonly UserRole[];
}) {
  const { session, isRestoring } = useAuth();
  const location = useLocation();
  if (isRestoring)
    return (
      <div className="route-loader" role="status">
        <LoaderCircle aria-hidden="true" className="spin" />
        <span>Restaurando tu sesión</span>
      </div>
    );
  if (!session)
    return (
      <Navigate
        to="/ingresar"
        replace
        state={{ from: location.pathname, reason: "session-required" }}
      />
    );
  if (!isRoleAllowed(session.user.role, roles))
    return <Navigate to="/sin-acceso" replace />;
  return <Outlet />;
}

export function GuestRoute() {
  const { session, isRestoring } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  if (isRestoring)
    return (
      <div className="route-loader" role="status">
        <LoaderCircle aria-hidden="true" className="spin" />
        <span>Preparando el acceso</span>
      </div>
    );
  if (!session) return <Outlet />;
  const locationState = location.state as { from?: string } | null;
  const returnTo =
    getSafeReturnTo(searchParams.get("returnTo")) ??
    getSafeReturnTo(locationState?.from);
  return (
    <Navigate to={returnTo ?? homeForRole(session.user.role)} replace />
  );
}

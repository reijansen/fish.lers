import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import LoadingOverlay from './LoadingOverlay';

type Props = {
  children: JSX.Element;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  forbidAdmin?: boolean;
  requireStudent?: boolean;
  requirePending?: boolean;
  forbidPending?: boolean;
};

export default function ProtectedRoute({
  children,
  requireAdmin,
  requireSuperAdmin,
  forbidAdmin,
  requireStudent,
  requirePending,
  forbidPending,
}: Props) {
  const { user, loading, isAdmin, isSuperAdmin } = useAuth();
  const loc = useLocation();
  const { trackUnauthorizedRouteHit } = useTelemetry();
  const lastUnauthorizedKeyRef = React.useRef<string>("");

  let unauthorizedAction: string | null = null;
  if (!loading && user) {
    if (requireAdmin && !isAdmin) {
      unauthorizedAction = "require_admin";
      console.warn('Access denied: Admin required. User role:', user?.role, 'Is admin:', isAdmin);
    } else if (requireSuperAdmin && !isSuperAdmin) {
      unauthorizedAction = "require_super_admin";
      console.warn('Access denied: Super Admin required. User role:', user?.role, 'Is super admin:', isSuperAdmin);
    } else if (forbidAdmin && isAdmin) {
      unauthorizedAction = "forbid_admin";
      console.warn('Access denied: Student only. User is admin.');
    } else if (requireStudent && user.role !== "student") {
      unauthorizedAction = "require_student";
      console.warn("Access denied: Student role required. User role:", user?.role);
    } else if (requirePending && user.role !== "admin-pending") {
      unauthorizedAction = "require_pending";
      console.warn("Access denied: Pending approval role required. User role:", user?.role);
    } else if (forbidPending && user.role === "admin-pending") {
      unauthorizedAction = "forbid_pending";
      console.warn("Access denied: Pending approval users are not allowed here.");
    }
  }

  React.useEffect(() => {
    if (loading || !user) return;
    if (!unauthorizedAction) return;
    const key = `${unauthorizedAction}:${loc.pathname}:${user?.uid || "unknown"}`;
    if (lastUnauthorizedKeyRef.current === key) return;
    lastUnauthorizedKeyRef.current = key;
    trackUnauthorizedRouteHit({
      path: loc.pathname,
      action: unauthorizedAction,
      actorRole: user?.role,
      isSuperAdmin,
    });
  }, [loading, loc.pathname, unauthorizedAction, trackUnauthorizedRouteHit, user?.uid, user?.role, isSuperAdmin]);

  // If loading or we have a token but user isn't loaded yet, show loading overlay
  const hasAuthToken = localStorage.getItem("authToken");
  if (loading || (hasAuthToken && !user)) return <LoadingOverlay show message="Checking your session..." />;
  
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;

  if (unauthorizedAction === "require_admin") {
    // Pending-approval users should never be routed into student pages.
    // Also treat role=admin but missing admin claim as pending approval (claims are the runtime gate).
    if (user.role !== "student") return <Navigate to="/login" replace state={{ pendingApproval: true }} />;
    return <Navigate to="/student" replace />;
  }

  if (unauthorizedAction === "require_super_admin" || unauthorizedAction === "forbid_admin") {
    return <Navigate to="/admindashboard" replace />;
  }

  if (unauthorizedAction === "require_student") {
    if (user.role === "admin-pending") return <Navigate to="/login" replace state={{ pendingApproval: true }} />;
    return <Navigate to="/admindashboard" replace />;
  }

  if (unauthorizedAction === "require_pending") {
    // If they are a normal student, bring them to their home. If they are an admin, bring them to admin.
    return user.role === "student" ? <Navigate to="/student" replace /> : <Navigate to="/admindashboard" replace />;
  }

  if (unauthorizedAction === "forbid_pending") {
    return <Navigate to="/login" replace state={{ pendingApproval: true }} />;
  }
  
  return children;
}

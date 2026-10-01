import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "./AuthProvider";

export function ProtectedAdminRoute() {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="route-loading" aria-live="polite">
        <span className="route-loading__indicator" aria-hidden="true" />
        Memeriksa sesi admin…
      </main>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

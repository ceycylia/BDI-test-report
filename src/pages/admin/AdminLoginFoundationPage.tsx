import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppMark } from "../../components/ui/AppMark";
import { AdminApiError } from "../../features/admin-auth/admin-api";
import { useAdminAuth } from "../../features/admin-auth/AuthProvider";

export function AdminLoginFoundationPage() {
  const { admin, loading, login } = useAdminAuth();

  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const destination =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "object" &&
    location.state.from !== null &&
    "pathname" in location.state.from &&
    typeof location.state.from.pathname === "string"
      ? location.state.from.pathname
      : "/admin";

  if (!loading && admin) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      await login(
        String(form.get("username") ?? ""),
        String(form.get("password") ?? ""),
      );

      navigate(destination, { replace: true });
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Login tidak dapat diproses. Silakan coba kembali.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-login-shell">
      <section
        className="admin-login-card"
        aria-labelledby="login-title"
      >
        <div className="admin-login-brand">
          <AppMark compact />
        </div>

        <h1 id="login-title">
          Masuk ke pengelolaan tes
        </h1>

        <form
          className="admin-login-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label>
            <span>Username</span>

            <input
              name="username"
              required
              autoComplete="username"
              autoFocus
            />
          </label>

          <label>
            <span>Password</span>

            <div className="password-field">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
              />

              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword
                    ? "Sembunyikan password"
                    : "Tampilkan password"
                }
                title={
                  showPassword
                    ? "Sembunyikan password"
                    : "Tampilkan password"
                }
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5.5 9 5.5a16.4 16.4 0 01-2.4 3M6.2 6.2C4.1 7.6 3 9.5 3 9.5S6.5 15 12 15a10.5 10.5 0 003-.4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 12s3.5-5.5 9-5.5S21 12 21 12s-3.5 5.5-9 5.5S3 12 3 12z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error && (
            <p
              className="form-message is-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            className="button admin-login-submit"
            type="submit"
            disabled={submitting || loading}
          >
            {submitting ? "Memeriksa…" : "Masuk"}
          </button>
        </form>

        <Link
          className="admin-login-back"
          to="/"
        >
          ← Kembali ke halaman peserta
        </Link>
      </section>
    </main>
  );
}
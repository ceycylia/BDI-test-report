import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppMark } from "../components/ui/AppMark";

type PublicLayoutProps = {
  children: ReactNode;
  showAdminLink?: boolean;
};

export function PublicLayout({
  children,
  showAdminLink = false,
}: PublicLayoutProps) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-header__inner">
          <AppMark />

          {showAdminLink && (
            <Link className="public-admin-link" to="/admin/login">
              Masuk sebagai admin
            </Link>
          )}
        </div>
      </header>

      <main className="public-main">{children}</main>
    </div>
  );
}
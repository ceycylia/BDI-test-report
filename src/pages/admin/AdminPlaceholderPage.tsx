import { useLocation } from "react-router-dom";
import { FoundationNotice } from "../../components/ui/FoundationNotice";

const titles: Record<string, string> = {
  "/admin/bank-soal": "Bank Soal",
  "/admin/pelatihan": "Pelatihan/Test",
  "/admin/hasil": "Hasil",
};

export function AdminPlaceholderPage() {
  const location = useLocation();
  const title = titles[location.pathname] ?? "Halaman Admin";

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="section-label">Admin</p>
          <h1>{title}</h1>
        </div>
      </header>
      <FoundationNotice>
        Modul ini akan diaktifkan pada fase implementasinya.
      </FoundationNotice>
    </>
  );
}

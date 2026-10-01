import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { adminMutation, AdminApiError } from "../../features/admin-auth/admin-api";
import { useAdminAuth } from "../../features/admin-auth/AuthProvider";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";

export function AdminAccountPage() {
  const { admin, refreshAdmin } = useAdminAuth();
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfileBusy(true); setMessage(null); setError(null);
    try {
      await adminMutation("/api/admin/account", { method: "PATCH", body: JSON.stringify({ name: form.get("name"), username: form.get("username") }) });
      await refreshAdmin();
      setMessage("Profil berhasil diperbarui.");
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Profil tidak dapat diperbarui."); }
    finally { setProfileBusy(false); }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPasswordBusy(true); setMessage(null); setError(null);
    try {
      await adminMutation("/api/admin/account/password", { method: "PATCH", body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) });
      formElement.reset();
      setMessage("Password berhasil diperbarui.");
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Password tidak dapat diperbarui."); }
    finally { setPasswordBusy(false); }
  }

  return <>
    <header className="admin-page-header"><div><p className="section-label">Akun Saya</p><h1>Pengaturan akun</h1><p className="page-description">Kelola identitas dan keamanan akun yang sedang digunakan.</p></div></header>
    {message && <p className="form-message is-success">{message}</p>}
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    <section className="account-summary panel"><span className="account-summary__avatar">{admin?.name.charAt(0).toUpperCase()}</span><div><h2>{admin?.name}</h2><p>@{admin?.username}</p></div><dl><div><dt>Role</dt><dd><ShieldCheck /> {admin?.role === "SUPERADMIN" ? "Superadmin" : "Admin"}</dd></div><div><dt>Status</dt><dd><span className="status-dot" /> Aktif</dd></div></dl></section>
    <div className="account-grid">
      <section className="panel account-form-card"><div className="panel-heading"><UserRound /><div><h2>Informasi akun</h2><p>Perbarui nama dan username Anda.</p></div></div><form className="form-stack" onSubmit={(event) => void updateProfile(event)}><label>Nama lengkap<input name="name" defaultValue={admin?.name} required minLength={2} maxLength={120} /></label><label>Username<input name="username" defaultValue={admin?.username} required minLength={3} maxLength={80} /></label><button className="button" disabled={profileBusy}>{profileBusy ? "Menyimpan…" : "Simpan perubahan"}</button></form></section>
      <section className="panel account-form-card"><div className="panel-heading"><KeyRound /><div><h2>Ubah password</h2><p>Gunakan minimal 12 karakter.</p></div></div><form className="form-stack" onSubmit={(event) => void updatePassword(event)}><label>Password saat ini<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>Password baru<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><button className="button" disabled={passwordBusy}>{passwordBusy ? "Menyimpan…" : "Ubah password"}</button></form></section>
    </div>
  </>;
}

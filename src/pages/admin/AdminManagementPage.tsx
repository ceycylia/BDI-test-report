import { KeyRound, Pencil, Plus, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminMutation, adminQuery, AdminApiError } from "../../features/admin-auth/admin-api";
import { useAdminAuth } from "../../features/admin-auth/AuthProvider";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { StatusIcon } from "../../components/ui/IconActionButton";

type AdminListItem = {
  id: string;
  name: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN";
  isActive: boolean;
  createdAt: string;
};

export function AdminManagementPage() {
  const { admin } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [selected, setSelected] = useState<AdminListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  const [error, setError] = useState<string | null>(null);
  const [newAdmin, setNewAdmin] = useState({ name: "", username: "", role: "ADMIN" as AdminListItem["role"], password: "" });

  const loadAdmins = async () => {
    const payload = await adminQuery<{ admins: AdminListItem[] }>("/api/admin/admins");
    setAdmins(payload.admins);
    setSelected((current) => current ? payload.admins.find((item) => item.id === current.id) ?? null : null);
  };

  useEffect(() => {
    if (admin?.role !== "SUPERADMIN") { setLoading(false); return; }
    void loadAdmins().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Daftar admin tidak dapat dimuat.")).finally(() => setLoading(false));
  }, [admin?.role]);

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setMessage(null); setError(null);
    try {
      await adminMutation("/api/admin/admins", { method: "POST", body: JSON.stringify({ name: form.get("name"), username: form.get("username"), password: form.get("password"), role: form.get("role") }) });
      setNewAdmin({ name: "", username: "", role: "ADMIN", password: "" }); formElement.reset(); await loadAdmins(); setMessage("Admin baru berhasil dibuat.");
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Admin tidak dapat dibuat."); }
    finally { setBusy(false); }
  }

  async function updateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage(null); setError(null);
    try {
      await adminMutation(`/api/admin/admins/${selected.id}`, { method: "PATCH", body: JSON.stringify({ name: form.get("name"), username: form.get("username"), role: form.get("role"), isActive: selected.id === admin?.id || form.get("isActive") === "on" }) });
      await loadAdmins(); setMessage("Data admin berhasil diperbarui.");
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Data admin tidak dapat diperbarui."); }
    finally { setBusy(false); }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setMessage(null); setError(null);
    try {
      await adminMutation(`/api/admin/admins/${selected.id}/password`, { method: "PATCH", body: JSON.stringify({ password: form.get("password") }) });
      formElement.reset(); setMessage(`Password ${selected.name} berhasil direset.`);
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Password tidak dapat direset."); }
    finally { setBusy(false); }
  }

  if (admin?.role !== "SUPERADMIN") return <section className="panel access-denied"><ShieldCheck /><h1>Akses terbatas</h1><p>Halaman Kelola Admin hanya tersedia untuk Superadmin.</p></section>;

  return <>
    <header className="admin-page-header"><div><p className="section-label">Pengaturan</p><h1>Kelola Admin</h1><p className="page-description">Tambah dan kelola akun tanpa menghapus riwayat audit.</p></div><div className="page-header-actions"><Link className="button button--secondary" to="/admin/akun">Akun Saya</Link></div></header>
    {message && <p className="form-message is-success">{message}</p>}{error && <p className="form-message is-error" role="alert">{error}</p>}
    <div className="admin-management-grid">
      <section className="panel"><div className="panel-heading"><Users /><div><h2>Daftar admin</h2><p>{admins.length} akun terdaftar</p></div></div>
        {loading ? <p className="muted">Memuat daftar admin…</p> : <div className="admin-list">{admins.map((item) => <button type="button" className={`admin-list__item admin-list__button${selected?.id === item.id ? " is-selected" : ""}`} key={item.id} onClick={() => setSelected(item)}><span className="admin-list__avatar">{item.name.charAt(0).toUpperCase()}</span><span className="admin-list__identity"><strong>{item.name}</strong><small>@{item.username} · {item.role === "SUPERADMIN" ? "Superadmin" : "Admin"}</small></span><StatusIcon active={item.isActive} /></button>)}</div>}
      </section>
      <section className="panel"><div className="panel-heading"><Plus /><div><h2>Tambah admin</h2><p>Buat akun dengan akses yang sesuai.</p></div></div>
        <form className="form-stack" autoComplete="off" onSubmit={(event) => void createAdmin(event)}><label>Nama<input name="name" value={newAdmin.name} onChange={(event) => setNewAdmin((value) => ({ ...value, name: event.target.value }))} required minLength={2} maxLength={120} autoComplete="off" /></label><label>Username<input name="username" value={newAdmin.username} onChange={(event) => setNewAdmin((value) => ({ ...value, username: event.target.value }))} required minLength={3} maxLength={80} autoComplete="off" /></label><label>Role<select name="role" value={newAdmin.role} onChange={(event) => setNewAdmin((value) => ({ ...value, role: event.target.value as AdminListItem["role"] }))}><option value="ADMIN">Admin</option><option value="SUPERADMIN">Superadmin</option></select></label><label>Password awal<input name="password" type="password" value={newAdmin.password} onChange={(event) => setNewAdmin((value) => ({ ...value, password: event.target.value }))} required minLength={12} maxLength={128} autoComplete="new-password" /><small>Minimal 12 karakter.</small></label><button className="button" disabled={busy}><Plus />{busy ? "Menyimpan…" : "Tambah admin"}</button></form>
      </section>
    </div>
    {selected && <div className="admin-edit-grid">
      <section className="panel"><div className="panel-heading"><Pencil /><div><h2>Edit {selected.name}</h2><p>Perubahan status tidak menghapus riwayat.</p></div></div>
        <form className="form-stack" key={`edit-${selected.id}-${selected.name}-${selected.isActive}`} onSubmit={(event) => void updateAdmin(event)}><label>Nama<input name="name" defaultValue={selected.name} required /></label><label>Username<input name="username" defaultValue={selected.username} required /></label><label>Role<select name="role" defaultValue={selected.role}><option value="ADMIN">Admin</option><option value="SUPERADMIN">Superadmin</option></select></label><label className="toggle-row"><input name="isActive" type="checkbox" defaultChecked={selected.isActive} disabled={selected.id === admin.id} /><span><strong>Akun aktif</strong><small>{selected.id === admin.id ? "Akun yang sedang digunakan harus tetap aktif." : "Admin nonaktif tidak dapat login."}</small></span></label><button className="button" disabled={busy}>Simpan perubahan</button></form>
      </section>
      <section className="panel"><div className="panel-heading"><KeyRound /><div><h2>Reset password</h2><p>Tetapkan password baru untuk akun ini.</p></div></div><form className="form-stack" onSubmit={(event) => void resetPassword(event)}><label>Password baru<input name="password" type="password" required minLength={12} maxLength={128} /><small>Minimal 12 karakter.</small></label><button className="button button--secondary" disabled={busy}><KeyRound />Reset password</button></form></section>
    </div>}
  </>;
}

import { useEffect, useState, type FormEvent } from "react";
import { ClipboardCopy, Link2, Trash2, X } from "lucide-react";
import { adminMutation, adminQuery, AdminApiError } from "../../features/admin-auth/admin-api";
import { fundingSourceLabel } from "../../features/funding-source/funding-source";
import { ConfirmDeleteModal } from "../ui/ConfirmDeleteModal";
import { ModalPortal } from "../ui/ModalPortal";

type Cohort = { id: string; training_id: string; name: string; funding_source: "RUPIAH_MURNI" | "PNBP" };
type LinkRow = {
  id: string; token: string; cohort_id: string; cohort_name: string;
  training_id: string; training_name: string;
};

export function ParticipantLinksModal({ trainings, cohorts, year, onClose }: {
  trainings: Array<{ id: string; name: string }>;
  cohorts: Cohort[];
  year: number;
  onClose: () => void;
}) {
  const [trainingId, setTrainingId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [selected, setSelected] = useState<LinkRow | null>(null);
  const [removing, setRemoving] = useState<LinkRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const result = await adminQuery<{ links: LinkRow[] }>(`/api/admin/participant-links?year=${year}`);
    setLinks(result.links);
  }
  useEffect(() => { void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Link peserta tidak dapat dimuat.")); }, [year]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!trainingId || !cohortId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await adminMutation<{ link: LinkRow; reused: boolean }>("/api/admin/participant-links", {
        method: "POST", body: JSON.stringify({ trainingId, cohortId, year }),
      });
      setSelected(result.link);
      setMessage(result.reused ? "Link yang sudah ada ditampilkan." : "Link peserta berhasil dibuat.");
      await refresh();
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Link peserta tidak dapat dibuat."); }
    finally { setBusy(false); }
  }
  async function copy(link: LinkRow) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/daftar/${link.token}`);
      setMessage("Link peserta disalin."); setError("");
    } catch { setError("Link tidak dapat disalin. Salin alamat yang ditampilkan secara manual."); }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true); setError("");
    try {
      await adminMutation(`/api/admin/participant-links/${removing.id}?year=${year}`, { method: "DELETE" });
      if (selected?.id === removing.id) setSelected(null);
      setRemoving(null); setMessage("Link peserta berhasil dihapus.");
      await refresh();
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Link peserta tidak dapat dihapus."); }
    finally { setBusy(false); }
  }

  return <>
    <ModalPortal onClose={onClose} blocked={busy || Boolean(removing)}>
      <section className="participant-modal participant-links-modal" role="dialog" aria-modal="true" aria-labelledby="participant-links-title">
        <header className="participant-modal__header"><div><p className="section-label">Pendaftaran peserta</p><h2 id="participant-links-title">Link Peserta</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup link peserta" disabled={busy} onClick={onClose}><X /></button></header>
        <div className="participant-modal__form form-stack">
          <form className="participant-links-form" onSubmit={(event) => void create(event)}>
            <label>Pelatihan<select required value={trainingId} onChange={(event) => { setTrainingId(event.target.value); setCohortId(""); setSelected(null); }}><option value="">Pilih pelatihan</option>{trainings.map((training) => <option key={training.id} value={training.id}>{training.name}</option>)}</select></label>
            <label>Angkatan<select required disabled={!trainingId} value={cohortId} onChange={(event) => { setCohortId(event.target.value); setSelected(null); }}><option value="">Pilih angkatan</option>{cohorts.filter((cohort) => cohort.training_id === trainingId).map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} · {fundingSourceLabel(cohort.funding_source)}</option>)}</select></label>
            <button className="button" disabled={busy || !cohortId}><Link2 />{busy ? "Menyiapkan…" : "Buat Link"}</button>
          </form>
          {selected && <div className="participant-links-result"><strong>Link pendaftaran</strong><input readOnly aria-label="Link pendaftaran peserta" value={`${window.location.origin}/daftar/${selected.token}`} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="button button--secondary button--small" onClick={() => void copy(selected)}><ClipboardCopy /> Salin</button></div>}
          {error && <p className="form-message is-error" role="alert">{error}</p>}
          {message && <p className="form-message is-success" role="status">{message}</p>}
          <div className="participant-links-list"><h3>Link yang sudah dibuat</h3><div className="data-table-wrap"><table className="clean-table"><thead><tr><th>Pelatihan</th><th>Angkatan</th><th>Link</th><th>Aksi</th></tr></thead><tbody>{links.map((link) => <tr key={link.id}><td>{link.training_name}</td><td>{link.cohort_name}</td><td><span className="participant-links-short-url">{`${window.location.origin}/daftar/${link.token}`}</span></td><td><div className="participant-links-actions"><button type="button" className="button button--secondary button--small" onClick={() => void copy(link)}>Salin</button><button type="button" className="button button--secondary button--small danger-button" onClick={() => setRemoving(link)}><Trash2 /> Hapus</button></div></td></tr>)}</tbody></table>{!links.length && <p className="muted">Belum ada link peserta untuk tahun dan sumber aktif ini.</p>}</div></div>
        </div>
      </section>
    </ModalPortal>
    <ConfirmDeleteModal open={Boolean(removing)} title="Hapus link peserta?" itemName={removing ? `${removing.training_name} · ${removing.cohort_name}` : undefined} description="Link ini tidak dapat digunakan untuk pendaftaran baru. Peserta yang sudah terdaftar tetap dapat membuka dashboard dan mengerjakan tes." confirmLabel="Hapus Link" busy={busy} onCancel={() => setRemoving(null)} onConfirm={() => void remove()} />
  </>;
}

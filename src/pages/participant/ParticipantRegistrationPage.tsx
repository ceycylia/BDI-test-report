import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PublicLayout } from "../../layouts/PublicLayout";
import { optimizeImage } from "../../features/media/optimize-image";
import { readRememberedParticipant, rememberParticipant } from "../../features/participant-entry/remembered-participant";

type Registration = { cohort_id: string; cohort_name: string; training_id: string; training_name: string };

export function ParticipantRegistrationPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [name, setName] = useState(() => readRememberedParticipant(window.localStorage)?.name ?? "");
  const [nik, setNik] = useState(() => readRememberedParticipant(window.localStorage)?.nik ?? "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/public/participants/registration/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json() as { registration?: Registration; error?: { message?: string } };
        if (!response.ok || !data.registration) throw new Error(data.error?.message ?? "Link pendaftaran tidak tersedia.");
        if (active) setRegistration(data.registration);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Link pendaftaran tidak tersedia."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registration) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const photo = form.get("photo");
      if (photo instanceof File && photo.size) form.set("photo", await optimizeImage(photo));
      const response = await fetch(`/api/public/participants/registration/${encodeURIComponent(token)}`, {
        method: "POST", body: form, headers: { Accept: "application/json" },
      });
      const payload = await response.json() as { participant?: { name: string; nik: string }; error?: { message?: string } };
      if (!response.ok || !payload.participant) throw new Error(payload.error?.message ?? "Pendaftaran tidak dapat disimpan.");
      rememberParticipant(window.localStorage, { name: payload.participant.name, nik: payload.participant.nik, cohortId: registration.cohort_id });
      navigate("/peserta", {
        replace: true,
        state: { prefill: { name: payload.participant.name, nik: payload.participant.nik } },
      });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pendaftaran tidak dapat disimpan."); }
    finally { setBusy(false); }
  }

  return <PublicLayout><section className="entry-card participant-registration-card" aria-labelledby="registration-title">
    <Link className="participant-home-back" to="/">← Halaman utama</Link>
    <p className="entry-card__eyebrow">Pendaftaran peserta</p>
    <h1 id="registration-title">{registration?.training_name ?? "Pendaftaran Peserta"}</h1>
    {registration && <p className="entry-card__lead participant-registration-cohort"><strong>{registration.cohort_name}</strong></p>}
    {loading && <p>Memuat pendaftaran…</p>}
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    {registration && <form className="participant-entry-form participant-registration-form" onSubmit={(event) => void submit(event)}>
      <label>Nama Lengkap<input name="name" required minLength={2} maxLength={150} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>NIK<input name="nik" required minLength={3} maxLength={40} inputMode="numeric" pattern="[0-9]+" value={nik} onChange={(event) => setNik(event.target.value.replace(/\D/gu, "").slice(0, 40))} /></label>
      <label>Tempat Lahir<input name="birthPlace" maxLength={120} /></label>
      <label>Tanggal Lahir<input name="birthDate" type="date" /></label>
      <label>Alamat KTP<textarea name="address" maxLength={500} rows={3} /></label>
      <label>Pas Foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
      <button className="button participant-primary-button" disabled={busy}>{busy ? "Menyimpan…" : "Daftar & Lanjutkan"}</button>
    </form>}
  </section></PublicLayout>;
}

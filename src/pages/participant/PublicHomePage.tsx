import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../../layouts/PublicLayout";

type RegistrationLink = {
  id: string; token: string; training_name: string; cohort_name: string;
};

type OpenEvaluation = {
  id: string; slug: string; name: string; trainingName: string;
  cohortNames: string[]; closeAt: string | null;
};

function closeTime(value: string | null) {
  if (!value) return "ditutup panitia";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)).replace(".", ":");
}

export function PublicHomePage() {
  const [registrations, setRegistrations] = useState<RegistrationLink[]>([]);
  const [evaluations, setEvaluations] = useState<OpenEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let expiryRefresh: number | undefined;
    const load = async () => {
      try {
        const [registrationResponse, evaluationResponse] = await Promise.all([
          fetch("/api/public/participants/registrations", { headers: { Accept: "application/json" }, cache: "no-store" }),
          fetch("/api/public/training", { headers: { Accept: "application/json" } }),
        ]);
        if (!registrationResponse.ok || !evaluationResponse.ok) throw new Error("Pendaftaran tidak dapat dimuat.");
        const [{ registrations: availableRegistrations }, { evaluations: availableEvaluations }] = await Promise.all([
          registrationResponse.json() as Promise<{ registrations: RegistrationLink[] }>,
          evaluationResponse.json() as Promise<{ evaluations: OpenEvaluation[] }>,
        ]);
        if (!active) return;
        setRegistrations(availableRegistrations);
        setEvaluations(availableEvaluations ?? []);
        const nextCloseAt = (availableEvaluations ?? [])
          .map((item) => item.closeAt ? Date.parse(item.closeAt) : Number.POSITIVE_INFINITY)
          .filter((value) => Number.isFinite(value) && value > Date.now())
          .sort((left, right) => left - right)[0];
        if (expiryRefresh) window.clearTimeout(expiryRefresh);
        if (nextCloseAt) expiryRefresh = window.setTimeout(() => void load(), Math.max(0, nextCloseAt - Date.now() + 250));
      } catch {
        if (active) { setRegistrations([]); setEvaluations([]); }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    // Also catches a schedule opening while this page remains open.
    const periodicRefresh = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(periodicRefresh); window.removeEventListener("focus", load); if (expiryRefresh) window.clearTimeout(expiryRefresh); };
  }, []);

  return (
    <PublicLayout showAdminLink>
      <section className="public-home" aria-labelledby="public-title">
        <div className="public-home__content">
          <p className="public-home__label">Sistem Tes Pelatihan BDI</p>

          <h1 id="public-title">
            Daftar sesuai nama pelatihan dan angkatan
          </h1>
          <Link className="button public-dashboard-link" to="/peserta">Login Peserta →</Link>

          <div className="public-training-area">
            {loading && (
              <p className="public-training-loading">
                Memeriksa pendaftaran yang tersedia…
              </p>
            )}

            {!loading && registrations.length > 0 && (
              <>
                <p className="public-training-title">
                  Link pendaftaran yang sedang dibuka
                </p>

                <div className="public-training-list">
                  {registrations.map((registration) => (
                    <Link
                      key={registration.id}
                      className="public-training-link public-training-link--registration"
                      to={`/daftar/${registration.token}`}
                    >
                      <span>
                        <strong>{registration.training_name} - {registration.cohort_name}</strong>
                      </span>

                      <span className="public-training-link__arrow">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {!loading && evaluations.length > 0 && (
              <>
                <p className="public-training-title">
                  Evaluasi yang sedang dibuka
                </p>

                <div className="public-training-list">
                  {evaluations.map((evaluation) => (
                    <Link
                      key={evaluation.id}
                      className="public-training-link"
                      to={`/e/${evaluation.slug}`}
                    >
                      <span>
                        <strong>{evaluation.name} — Evaluasi</strong>
                        <small>{evaluation.trainingName} · {evaluation.cohortNames.join(" & ")} · Tersedia sampai {closeTime(evaluation.closeAt)}</small>
                      </span>

                      <span className="public-training-link__arrow">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {!loading && registrations.length === 0 && evaluations.length === 0 && (
              <p className="public-training-empty">
                Belum ada link pendaftaran atau Evaluasi yang sedang dibuka.
              </p>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

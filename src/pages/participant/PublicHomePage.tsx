import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../../layouts/PublicLayout";

type OpenTest = {
  id: string; sessionId: string; slug: string; trainingName: string; materialName: string;
  cohortName: string; stage: "PRE" | "POST"; closeAt: string | null;
};

function closeTime(value: string | null) {
  if (!value) return "ditutup panitia";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)).replace(".", ":");
}

export function PublicHomePage() {
  const [tests, setTests] = useState<OpenTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let expiryRefresh: number | undefined;
    const load = async () => {
      try {
        const response = await fetch("/api/public/training", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Pelatihan tidak dapat dimuat.");
        const payload = await response.json() as { tests: OpenTest[] };
        if (!active) return;
        setTests(payload.tests);
        const nextCloseAt = payload.tests
          .map((test) => test.closeAt ? Date.parse(test.closeAt) : Number.POSITIVE_INFINITY)
          .filter((value) => Number.isFinite(value) && value > Date.now())
          .sort((left, right) => left - right)[0];
        if (expiryRefresh) window.clearTimeout(expiryRefresh);
        if (nextCloseAt) expiryRefresh = window.setTimeout(() => void load(), Math.max(0, nextCloseAt - Date.now() + 250));
      } catch {
        if (active) setTests([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    // Also catches a schedule opening while this page remains open.
    const periodicRefresh = window.setInterval(() => void load(), 30_000);
    return () => { active = false; window.clearInterval(periodicRefresh); if (expiryRefresh) window.clearTimeout(expiryRefresh); };
  }, []);

  return (
    <PublicLayout showAdminLink>
      <section className="public-home" aria-labelledby="public-title">
        <div className="public-home__content">
          <p className="public-home__label">Sistem Tes Pelatihan BDI</p>

          <h1 id="public-title">
            Buka link pelatihan yang dibagikan panitia
          </h1>

          <div className="public-training-area">
            {loading && (
              <p className="public-training-loading">
                Memeriksa pelatihan yang tersedia…
              </p>
            )}

            {!loading && tests.length > 0 && (
              <>
                <p className="public-training-title">
                  Test yang sedang dibuka
                </p>

                <div className="public-training-list">
                  {tests.map((test) => (
                    <Link
                      key={test.id}
                      className="public-training-link"
                      to={`/t/${test.slug}`}
                    >
                      <span>
                        <strong>{test.materialName} — {test.stage === "PRE" ? "Pre-Test" : "Post-Test"}</strong>
                        <small>{test.cohortName} · Tersedia sampai {closeTime(test.closeAt)}</small>
                      </span>

                      <span className="public-training-link__arrow">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {!loading && tests.length === 0 && (
              <p className="public-training-empty">
                Belum ada Test yang sedang dibuka.
              </p>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

import { Link } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";

export function NotFoundPage() {
  return (
    <PublicLayout>
      <section className="entry-card" aria-labelledby="not-found-title">
        <div className="entry-card__eyebrow">Halaman tidak ditemukan</div>
        <h1 id="not-found-title">Periksa kembali alamat yang Anda buka</h1>
        <p className="entry-card__lead">
          Link pelatihan mungkin salah atau sudah tidak tersedia.
        </p>
        <Link className="button" to="/">
          Ke halaman awal
        </Link>
      </section>
    </PublicLayout>
  );
}

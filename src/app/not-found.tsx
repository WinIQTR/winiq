import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-shell">
      <section className="login-card" aria-live="polite">
        <div className="login-mark" data-no-translate>
          W
        </div>
        <p className="member-eyebrow" data-no-translate>
          WINIQ
        </p>
        <h1>Sayfa bulunamadı</h1>
        <p>Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.</p>
        <Link
          href="/"
          className="primary-button"
          style={{ display: "inline-block", textDecoration: "none" }}
        >
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}

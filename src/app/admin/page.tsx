import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth-session";
import { ACTIVE_SEASON_LABEL } from "@/config/season";

export default async function AdminSystemHealthPage() {
  await requireAdmin();

  const apiFootballConfigured = Boolean(process.env.API_FOOTBALL_KEY?.trim());
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

  return (
    <PageShell>
      <header className="topbar dashboard-topbar">
        <div>
          <p className="eyebrow">SİSTEM SAĞLIĞI</p>
          <h1>Bağlantılar ve durum</h1>
          <p className="subtitle">
            Canlı üretim sezonu {ACTIVE_SEASON_LABEL}. Operasyonel kontrol paneli ayrıdır.
          </p>
        </div>
        <div className="member-actions">
          <Link className="member-plan-link" href="/admin-dashboard">
            Kontrol paneline git
          </Link>
          <span className="mode-badge">ADMIN</span>
        </div>
      </header>

      <section className="admin-grid" style={{ padding: "0 24px 32px" }}>
        <article className="admin-card">
          <p className="eyebrow">API-FOOTBALL</p>
          <h2>{apiFootballConfigured ? "Anahtar yüklü" : "Anahtar eksik"}</h2>
          <p className="admin-description">
            Ultra / season erişimi için ortam değişkeni gerekir. Durum JSON’u admin oturumu ister.
          </p>
          <Link className="member-plan-link" href="/api/football/status">
            /api/football/status
          </Link>
        </article>

        <article className="admin-card">
          <p className="eyebrow">VERİTABANI</p>
          <h2>{databaseConfigured ? "DATABASE_URL tanımlı" : "DATABASE_URL eksik"}</h2>
          <p className="admin-description">Neon / Postgres bağlantısı tahmin ve üyelik için zorunludur.</p>
          <Link className="member-plan-link" href="/admin/data-coverage">
            Veri kapsamı
          </Link>
        </article>

        <article className="admin-card">
          <p className="eyebrow">OPERASYON</p>
          <h2>Günlük işler</h2>
          <p className="admin-description">Refresh, snapshot ve bildirim akışları Operasyon ekranından izlenir.</p>
          <Link className="member-plan-link" href="/operations">
            Operasyon paneli
          </Link>
        </article>

        <article className="admin-card">
          <p className="eyebrow">ÜYELİK</p>
          <h2>Üye ve gelen kutusu</h2>
          <p className="admin-description">Paket, süre, yükseltme talepleri ve mesajlar.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="member-plan-link" href="/admin/members">
              Üyeler
            </Link>
            <Link className="member-plan-link" href="/admin/messages">
              Gelen kutusu
            </Link>
          </div>
        </article>
      </section>
    </PageShell>
  );
}

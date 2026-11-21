import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { ACTIVE_SEASON_LABEL, ACTIVE_SEASON_YEAR } from "@/config/season";
import { requireAdmin } from "@/lib/auth-session";

export default async function SettingsPage() {
  await requireAdmin();

  return (
    <PageShell>
      <header className="topbar">
        <div>
          <p className="eyebrow">AYARLAR</p>
          <h1>Ayarlar</h1>
          <p className="subtitle">Canlı sezon ve operasyon kısayolları (salt okunur).</p>
        </div>
      </header>

      <section className="admin-card settings-card">
        <p className="eyebrow">CANLI SEZON</p>
        <h2>
          {ACTIVE_SEASON_LABEL} ({ACTIVE_SEASON_YEAR})
        </h2>
        <p className="subtitle">
          Canlı sayfalar yalnızca bu sezonu kullanır. Sezon değişimi ortam / config ile yapılır;
          bu ekranda kayıtlı form yoktur.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <Link className="member-plan-link" href="/operations">
            Operasyon paneli →
          </Link>
          <Link className="member-plan-link" href="/admin/data-coverage">
            Veri kapsamı →
          </Link>
          <Link className="member-plan-link" href="/admin/members/preview?plan=PROFESSIONAL">
            Üye önizleme →
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

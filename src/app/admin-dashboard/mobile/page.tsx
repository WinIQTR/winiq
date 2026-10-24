import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth-session";

export default async function AdminMobilePreviewPage() {
  await requireAdmin();

  return (
    <PageShell>
      <header className="topbar dashboard-topbar">
        <div>
          <p className="eyebrow">MOBİL ÖNİZLEME</p>
          <h1>Üye mobil deneyimi</h1>
          <p className="subtitle">
            Üye mobil ekranı `/mobile` üye oturumu ister. Paket görünümlerini önizleme ile kontrol edin.
          </p>
        </div>
      </header>
      <section style={{ padding: "0 24px 32px", display: "grid", gap: 12, maxWidth: 720 }}>
        <Link className="member-plan-link" href="/admin/members/preview?plan=BASIC">
          Temel üye önizlemesi
        </Link>
        <Link className="member-plan-link" href="/admin/members/preview?plan=ANALYSIS">
          Analiz üye önizlemesi
        </Link>
        <Link className="member-plan-link" href="/admin/members/preview?plan=PROFESSIONAL">
          Profesyonel üye önizlemesi
        </Link>
        <p className="subtitle">
          Gerçek üye mobil yolu: <code>/mobile</code> (üye girişi gerekir). Eski Smart Picks / Garanti
          kupon ekranları Kupon merkezi ve Özel liste altında toplanmıştır.
        </p>
      </section>
    </PageShell>
  );
}

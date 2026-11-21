import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth-session";

const links = [
  { href: "/fixtures", title: "Fikstürler", desc: "Haftalık maçlar, skorlar, detay." },
  { href: "/teams", title: "Takımlar", desc: "Puan durumu ve takım verileri." },
  { href: "/players", title: "Oyuncular", desc: "Kadro ve oyuncu istatistikleri." },
  { href: "/top-scorers", title: "Gol krallığı", desc: "Sezon golcüleri." },
  { href: "/admin/data-coverage", title: "Veri kapsamı", desc: "Import ve lig kapsama durumu." },
] as const;

export default async function AdminDataCentrePage() {
  await requireAdmin();

  return (
    <PageShell>
      <header className="topbar dashboard-topbar">
        <div>
          <p className="eyebrow">VERİ</p>
          <h1>Veri merkezi</h1>
          <p className="subtitle">Fikstür, takım, oyuncu ve kapsam — tek giriş.</p>
        </div>
      </header>

      <section className="admin-grid" style={{ padding: "0 24px 32px" }}>
        {links.map((item) => (
          <article className="admin-card" key={item.href}>
            <h2>{item.title}</h2>
            <p className="admin-description">{item.desc}</p>
            <Link className="member-plan-link" href={item.href}>
              Aç →
            </Link>
          </article>
        ))}
      </section>
    </PageShell>
  );
}

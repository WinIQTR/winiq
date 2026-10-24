import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth-session";
import { BET_MARKET_COUNT } from "@/lib/bet-market-catalog";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin-dashboard" : "/member");

  return (
    <main className="landing-shell">
      <header className="landing-top">
        <strong data-no-translate>
          WIN<span>IQ</span>
        </strong>
        <div className="landing-top-actions">
          <LanguageSwitcher />
          <Link href="/login">Üye girişi</Link>
        </div>
      </header>

      <section className="landing-hero">
        <p>AI FUTBOL TAHMİNLERİ</p>
        <h1 data-no-translate>WINIQ</h1>
        <span>
          Günlük maç tahminleri, kupon önerileri ve sonuç takibi — sade, net, üyelik paketlerinize göre.
        </span>
        <div className="landing-cta">
          <Link href="/login">Giriş yap</Link>
          <a href="#paketler">Paketleri gör</a>
        </div>
      </section>

      <section className="landing-features" id="paketler">
        <article>
          <small>TEMEL</small>
          <h2>6 pazar</h2>
          <p>Günün tahminleri ve günlük kupon özeti.</p>
        </article>
        <article>
          <small>ANALİZ</small>
          <h2>19 pazar</h2>
          <p>Olasılıklar, model oranı ve daha geniş kuponlar.</p>
        </article>
        <article>
          <small>PROFESYONEL</small>
          <h2>{BET_MARKET_COUNT} pazar</h2>
          <p>Tam katalog, değer seçimleri, fikstür ve özel liste.</p>
        </article>
      </section>

      <footer className="landing-footer">
        <b data-no-translate>WINIQ</b>
        <span>Bilgi amaçlıdır; kazanç garantisi sunulmaz.</span>
        <small>Kayıtlar yönetici onayıyla açılır.</small>
      </footer>
    </main>
  );
}

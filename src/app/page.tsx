import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LanguageSwitcher } from "@/components/language-switcher";
import { getCurrentUser } from "@/lib/auth-session";
import { BET_MARKET_COUNT } from "@/lib/bet-market-catalog";

import styles from "./landing.module.css";

function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M3.5 12.5 12 17l8.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3.5 16.5 12 21l8.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconBars() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V10M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16.5 9.5 11l3.5 3.5L20 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.5 7.5H20v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 19 6.5v5.2c0 4.4-2.9 7.5-7 9.3-4.1-1.8-7-4.9-7-9.3V6.5L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 10.5v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1" fill="currentColor" />
    </svg>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/predictions" : "/member");

  return (
    <main className={styles.shell}>
      <div className={styles.atmosphere} aria-hidden />

      <header className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="WINIQ" data-no-translate>
          WIN<span>IQ</span>
        </Link>
        <div className={styles.topActions}>
          <LanguageSwitcher hideLabel />
          <Link className={styles.memberLogin} href="/login">
            Üye Girişi
          </Link>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="landing-hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>AI FUTBOL TAHMİNLERİ</p>
          <h1 id="landing-hero-title">
            Futbol verisini, <em>daha net yorumlayın.</em>
          </h1>
          <p className={styles.lede}>
            Günlük maçların olasılıklarını, detaylı analizlerini ve sonuç takibini tek platformda
            inceleyin.
          </p>
          <div className={styles.ctaRow}>
            <Link className={styles.ctaPrimary} href="/login">
              Giriş yap →
            </Link>
            <a className={styles.ctaSecondary} href="#paketler">
              Paketleri gör
            </a>
          </div>
        </div>

        <aside className={styles.preview} aria-label="Örnek maç tahmini">
          <div className={styles.previewGlow} aria-hidden />
          <div className={styles.previewCard}>
            <div className={styles.previewHead}>
              <div className={styles.previewTitle}>
                <IconBars />
                Maç Tahmini
              </div>
              <span className={styles.leagueBadge}>Premier League</span>
            </div>

            <div className={styles.matchup}>
              <div className={styles.team}>
                <Image
                  className={styles.logo}
                  src="https://media.api-sports.io/football/teams/50.png"
                  alt=""
                  width={48}
                  height={48}
                />
                <strong>Manchester City</strong>
              </div>
              <span className={styles.versus}>VS</span>
              <div className={styles.team}>
                <Image
                  className={styles.logo}
                  src="https://media.api-sports.io/football/teams/36.png"
                  alt=""
                  width={48}
                  height={48}
                />
                <strong>Fulham</strong>
              </div>
            </div>

            <div className={styles.probs}>
              <div className={styles.probsLabel}>Maç Olasılıkları</div>
              <div className={styles.probGrid}>
                <div className={styles.prob} data-active="true">
                  <strong>%68</strong>
                  <span>Ev Sahibi Kazanır</span>
                </div>
                <div className={styles.prob}>
                  <strong>%20</strong>
                  <span>Beraberlik</span>
                </div>
                <div className={styles.prob}>
                  <strong>%12</strong>
                  <span>Deplasman Kazanır</span>
                </div>
              </div>
            </div>

            <div className={styles.trend}>
              <div className={styles.trendHead}>
                <span>Olasılık Trendi</span>
                <b>+12%</b>
              </div>
              <div className={styles.chart} aria-hidden>
                <svg viewBox="0 0 320 72" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="landingTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(34,197,94,0.35)" />
                      <stop offset="100%" stopColor="rgba(34,197,94,0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 58 C40 54, 55 50, 80 46 S130 42, 160 34 S220 28, 250 18 S290 12, 320 8 L320 72 L0 72 Z"
                    fill="url(#landingTrendFill)"
                  />
                  <path
                    d="M0 58 C40 54, 55 50, 80 46 S130 42, 160 34 S220 28, 250 18 S290 12, 320 8"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.plans} id="paketler" aria-label="Üyelik paketleri">
        <article className={styles.plan}>
          <span className={styles.planIcon}>
            <IconLayers />
          </span>
          <small>TEMEL</small>
          <h2>6 pazar</h2>
          <p>Günün tahminleri ve günlük kupon özeti.</p>
        </article>
        <article className={styles.plan} data-tone="analysis">
          <span className={styles.planIcon}>
            <IconBars />
          </span>
          <small>ANALİZ</small>
          <h2>19 pazar</h2>
          <p>Olasılıklar, model oranı ve daha geniş kuponlar.</p>
        </article>
        <article className={styles.plan} data-tone="pro">
          <span className={styles.planIcon}>
            <IconTrend />
          </span>
          <small>PROFESYONEL</small>
          <h2>{BET_MARKET_COUNT} pazar</h2>
          <p>Tam katalog, değer seçimleri, fikstür ve özel liste.</p>
        </article>
      </section>

      <footer className={styles.footer}>
        <b className={styles.footerBrand} data-no-translate>
          WINIQ
        </b>
        <span className={styles.footerNote}>
          <IconInfo />
          Bilgi amaçlıdır; kazanç garantisi sunulmaz.
        </span>
        <span className={styles.footerGuard}>
          <IconShield />
          Kayıtlar yönetici onayıyla açılır.
        </span>
      </footer>
    </main>
  );
}

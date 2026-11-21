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

function TacticsOverlay() {
  return (
    <svg className={styles.tactics} viewBox="0 0 1200 700" fill="none" aria-hidden>
      <path
        d="M180 520 C320 430, 420 360, 560 300 S820 210, 980 160"
        stroke="rgba(34,197,94,0.55)"
        strokeWidth="3"
        strokeDasharray="10 10"
      />
      <path
        d="M220 560 C360 470, 470 390, 620 340 S860 260, 1020 220"
        stroke="rgba(34,197,94,0.35)"
        strokeWidth="2"
        strokeDasharray="6 10"
      />
      <circle cx="560" cy="300" r="8" fill="#22c55e" />
      <circle cx="720" cy="250" r="7" fill="#22c55e" />
      <circle cx="880" cy="190" r="7" fill="#22c55e" />
      <path d="M548 288 l24 24M572 288 l-24 24" stroke="#22c55e" strokeWidth="3" />
      <path d="M708 238 l24 24M732 238 l-24 24" stroke="#22c55e" strokeWidth="3" />
      <text x="500" y="275" fill="#4ade80" fontSize="22" fontWeight="700">
        68%
      </text>
      <text x="690" y="225" fill="#86efac" fontSize="18" fontWeight="700">
        20%
      </text>
      <text x="860" y="165" fill="#bbf7d0" fontSize="16" fontWeight="700">
        12%
      </text>
      <circle cx="980" cy="160" r="14" fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="2" />
      <circle cx="980" cy="160" r="5" fill="#22c55e" />
    </svg>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/predictions" : "/member");

  return (
    <main className={styles.shell}>
      <div className={styles.backdrop} aria-hidden>
        <Image
          className={styles.backdropImage}
          src="/brand/landing-pitch.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.backdropScrim} />
        <TacticsOverlay />
      </div>

      <header className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="WINIQ" data-no-translate>
          WIN<span>IQ</span>
        </Link>
        <div className={styles.topActions}>
          <LanguageSwitcher hideLabel />
          <Link className={styles.memberLogin} href="/login">
            Member Login
          </Link>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="landing-hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>AI FOOTBALL PREDICTIONS</p>
          <h1 id="landing-hero-title">
            Interpret football data, <em>more clearly.</em>
          </h1>
          <p className={styles.lede}>
            Examine daily match probabilities, detailed analysis, and result tracking on one
            platform.
          </p>
          <div className={styles.ctaRow}>
            <Link className={styles.ctaPrimary} href="/login">
              Sign in →
            </Link>
            <a className={styles.ctaSecondary} href="#paketler">
              See plans
            </a>
          </div>
        </div>

        <aside className={styles.preview} aria-label="Sample match prediction">
          <div className={styles.previewGlow} aria-hidden />
          <div className={styles.previewCard}>
            <div className={styles.previewHead}>
              <div className={styles.previewTitle}>
                <IconBars />
                Match Prediction
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
              <div className={styles.probsLabel}>Match Probabilities</div>
              <div className={styles.probGrid}>
                <div className={styles.prob} data-active="true">
                  <strong>%68</strong>
                  <span>Home Win</span>
                </div>
                <div className={styles.prob}>
                  <strong>%20</strong>
                  <span>Draw</span>
                </div>
                <div className={styles.prob}>
                  <strong>%12</strong>
                  <span>Away Win</span>
                </div>
              </div>
            </div>

            <div className={styles.trend}>
              <div className={styles.trendHead}>
                <span>Probability Trend</span>
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

      <section className={styles.plans} id="paketler" aria-label="Membership plans">
        <article className={styles.plan}>
          <span className={styles.planIcon}>
            <IconLayers />
          </span>
          <small>BASIC</small>
          <h2>6 markets</h2>
          <p>Daily predictions and daily coupon summary.</p>
        </article>
        <article className={styles.plan} data-tone="analysis">
          <span className={styles.planIcon}>
            <IconBars />
          </span>
          <small>ANALYSIS</small>
          <h2>19 markets</h2>
          <p>Probabilities, model odds, and wider coupons.</p>
        </article>
        <article className={styles.plan} data-tone="pro">
          <span className={styles.planIcon}>
            <IconTrend />
          </span>
          <small>PROFESSIONAL</small>
          <h2>{BET_MARKET_COUNT} markets</h2>
          <p>Full catalog, value picks, fixtures, and special list.</p>
        </article>
      </section>

      <footer className={styles.footer}>
        <b className={styles.footerBrand} data-no-translate>
          WIN<span>IQ</span>
        </b>
        <span className={styles.footerNote}>
          <IconInfo />
          For information only; no profit guarantee.
        </span>
        <span className={styles.footerGuard}>
          <IconShield />
          Registrations open with administrator approval.
        </span>
      </footer>
    </main>
  );
}

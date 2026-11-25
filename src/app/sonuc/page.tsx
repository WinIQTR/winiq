import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { LEGAL_DISCLAIMER_EN } from "@/lib/legal-disclaimer";
import { loadPublicTrackRecordSummary } from "@/lib/public-track-record";

import styles from "./sonuc.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${rate.toFixed(1)}%`;
}

function formatGeneratedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function PublicTrackRecordPage() {
  const summary = await loadPublicTrackRecordSummary();

  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="WINIQ" data-no-translate>
          WIN<span>IQ</span>
        </Link>
        <div className={styles.topActions}>
          <LanguageSwitcher hideLabel />
          <Link className={styles.login} href="/login">
            Member Login
          </Link>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="sonuc-title">
        <p className={styles.eyebrow}>PUBLIC TRACK RECORD</p>
        <h1 id="sonuc-title">Settled pick summary</h1>
        <p className={styles.lede}>
          Aggregate hit rate from published Smart Picks. Voids are shown separately and are
          not counted in the hit-rate denominator. Per-match picks stay behind membership.
        </p>
        <p className={styles.meta}>
          Updated {formatGeneratedAt(summary.generatedAtIso)} · Europe/Istanbul
        </p>
      </section>

      <section className={styles.summary} aria-label="Overall hit rate">
        <article className={styles.stat}>
          <span>Hit rate</span>
          <strong>{formatRate(summary.hitRate)}</strong>
          <small>
            {summary.wins} won · {summary.losses} lost · {summary.evaluated} evaluated
          </small>
        </article>
        <article className={styles.stat}>
          <span>Voids</span>
          <strong>{summary.voids}</strong>
          <small>Excluded from hit rate</small>
        </article>
        <article className={styles.stat}>
          <span>Odds missing</span>
          <strong>{summary.oddsMissing}</strong>
          <small>Settled rows outside 1.10+ bands</small>
        </article>
      </section>

      <section className={styles.block} aria-labelledby="strength-title">
        <h2 id="strength-title">By strength</h2>
        <div className={styles.grid}>
          {summary.strength.map((band) => (
            <article key={band.key} className={styles.card}>
              <header>
                <h3>{band.label}</h3>
                <em>{formatRate(band.rate)}</em>
              </header>
              <p>
                {band.wins}W · {band.losses}L · {band.voids} void · {band.samples} samples
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.block} aria-labelledby="odds-title">
        <h2 id="odds-title">By odds band</h2>
        <div className={styles.grid}>
          {summary.oddsBands.map((band) => (
            <article key={band.key} className={styles.card}>
              <header>
                <h3 data-no-translate>{band.label}</h3>
                <em>{formatRate(band.rate)}</em>
              </header>
              <p>
                {band.wins}W · {band.losses}L · {band.samples} samples
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.legal} aria-labelledby="legal-title">
        <h2 id="legal-title">{LEGAL_DISCLAIMER_EN.title}</h2>
        <p className={styles.legalShort}>{LEGAL_DISCLAIMER_EN.short}</p>
        <ul>
          {LEGAL_DISCLAIMER_EN.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <Link href="/">← Home</Link>
        <Link href="/login">Sign in →</Link>
      </footer>
    </main>
  );
}

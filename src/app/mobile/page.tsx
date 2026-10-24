import Link from "next/link";
import { requireMember } from "@/lib/auth-session";
import { BET_MARKET_COUNT } from "@/lib/bet-market-catalog";
import { MEMBERSHIP_PLAN_MARKET_LIMITS } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import styles from "./mobile.module.css";

export const dynamic = "force-dynamic";

export default async function MobilePage() {
  const user = await requireMember();
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 14);
  const predictions = (await loadDashboardPredictionSnapshot(5000))
    .filter(
      (p) =>
        p.kickoffAt >= now &&
        p.kickoffAt < end &&
        (p.settlementStatus === undefined || p.settlementStatus === "PENDING"),
    )
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  return (
    <main className={styles.page}>
      <MemberPortalHeader plan={user.plan} active="home" />
      <section className={styles.hero}>
        <span>WINIQ MOBILE</span>
        <h1>Maç önerileri ve kuponlar</h1>
        <p>Günlük programı tek ekranda keşfedin.</p>
      </section>
      <nav className={styles.tabs}>
        <Link className={styles.active} href="/mobile">
          Öneriler
        </Link>
        <Link href="/member/coupons">Kuponlar</Link>
        <Link href="/member/results">Sonuçlarım</Link>
        <Link href="/member">Panele dön</Link>
      </nav>
      <section className={styles.metrics}>
        <article>
          <small>14 günlük maç</small>
          <b>{predictions.length}</b>
        </article>
        <article>
          <small>Güçlü seçim</small>
          <b>{predictions.filter((p) => p.confidenceScore >= 70).length}</b>
        </article>
        <article>
          <small>Bahis pazarı</small>
          <b>
            {MEMBERSHIP_PLAN_MARKET_LIMITS[user.plan]}/{BET_MARKET_COUNT}
          </b>
        </article>
      </section>
      <section className={styles.panel}>
        <header>
          <div>
            <span>ÖNERİLER</span>
            <h2>En yüksek güvenli seçimler</h2>
          </div>
          <strong>{predictions.length} seçim</strong>
        </header>
        <div className={styles.list}>
          {predictions.slice(0, 30).map((p, i) => (
            <article key={p.matchId}>
              <b className={styles.rank}>{i + 1}</b>
              <div>
                <small>
                  {p.leagueName} ·{" "}
                  {new Intl.DateTimeFormat("tr-TR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(p.kickoffAt)}
                </small>
                <h3>
                  {p.homeTeam} <i>VS</i> {p.awayTeam}
                </h3>
                <span>
                  Önerilen:{" "}
                  {p.predictedOutcome === "HOME"
                    ? "Ev sahibi"
                    : p.predictedOutcome === "AWAY"
                      ? "Deplasman"
                      : "Beraberlik"}
                </span>
              </div>
              <em data-tier={p.confidenceScore >= 70 ? "strong" : p.confidenceScore >= 55 ? "medium" : "weak"}>
                %{p.confidenceScore.toFixed(0)}
              </em>
              <strong>{(100 / p.predictedProbability).toFixed(2)}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

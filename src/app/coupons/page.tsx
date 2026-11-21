import Link from "next/link";

import { CouponPerformanceWorkspace } from "@/components/coupon-performance-workspace";
import { GuaranteedCouponWorkspace } from "@/components/guaranteed-coupon-workspace";
import { PageShell } from "@/components/page-shell";
import { SmartCouponWorkspace } from "@/components/smart-coupon-workspace";
import { requireAdmin } from "@/lib/auth-session";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { buildSmartCouponCenter } from "@/lib/smart-coupon-engine";
import { loadSmartCouponPerformance } from "@/lib/smart-coupon-performance-data";
import { serializeCouponCenter } from "@/lib/smart-coupon-view";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import {
  buildBankrollBacktestReport,
  couponsToBacktestInputs,
} from "@/modules/bankroll-backtest";
import styles from "./smart-coupons-page.module.css";
import perfStyles from "../coupon-performance/coupon-performance-page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type View = "center" | "performance" | "guaranteed";

function viewOf(value: string | string[] | undefined): View {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "performance" || raw === "guaranteed") return raw;
  return "center";
}

export default async function SmartCouponsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  await requireAdmin();
  const view = viewOf((await searchParams)?.view);

  const data = await loadValueBetDashboardSnapshot();
  const center = buildSmartCouponCenter(data.upcoming, {
    historicalRows: data.settled,
  });
  const serialized = serializeCouponCenter(center);

  const tabs = (
    <nav className="coupon-center-tabs" aria-label="Kupon merkezi sekmeleri">
      <Link className={view === "center" ? "active" : ""} href="/coupons">
        Günlük kuponlar
      </Link>
      <Link className={view === "performance" ? "active" : ""} href="/coupons?view=performance">
        Performans
      </Link>
      <Link className={view === "guaranteed" ? "active" : ""} href="/coupons?view=guaranteed">
        Garanti / güvenli
      </Link>
      <Link href="/special">Özel liste →</Link>
    </nav>
  );

  if (view === "performance") {
    const performance = await loadSmartCouponPerformance();
    const rows = performance.rows.map((row) => ({
      ...row,
      publishedAt: row.publishedAt.toISOString(),
      settledAt: row.settledAt?.toISOString() ?? null,
      legs: row.legs.map((leg) => ({ ...leg, kickoffAt: leg.kickoffAt.toISOString() })),
    }));
    const bankroll = buildBankrollBacktestReport(
      couponsToBacktestInputs(performance.rows),
      {
        initialBankroll: 1000,
        includeTuning: false,
        strategy: {
          minEv: -1,
          minProbability: 0,
          minOdds: 1.01,
          maxOdds: 1000,
          sizer: "fixed_fraction",
          sizeParam: 0.02,
        },
      },
    );
    const m = bankroll.metrics;
    return (
      <PageShell>
        <header className="topbar dashboard-topbar">
          <div>
            <p className="eyebrow">KUPON MERKEZİ</p>
            <h1>Kupon performansı</h1>
            <p className="subtitle">Yayımlanan kuponların sonuç özeti — tek ekranda.</p>
          </div>
        </header>
        {tabs}
        <main className={perfStyles.page}>
          <section className={perfStyles.summary} aria-label="Bankroll backtest">
            <article><span>Yield</span><strong>{m.yieldPct == null ? "—" : `${m.yieldPct.toFixed(1)}%`}</strong></article>
            <article><span>ROI</span><strong>{m.roiPct.toFixed(1)}%</strong></article>
            <article><span>Max DD</span><strong>{m.maxDrawdownPct.toFixed(1)}%</strong></article>
            <article><span>Sharpe</span><strong>{m.sharpe == null ? "—" : m.sharpe.toFixed(2)}</strong></article>
            <article><span>CAGR</span><strong>{m.cagrPct == null ? "—" : `${m.cagrPct.toFixed(1)}%`}</strong></article>
            {bankroll.bankrollSparkline ? (
              <article>
                <span>Equity</span>
                <svg viewBox="0 0 100 28" width="120" height="36" aria-hidden>
                  <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={bankroll.bankrollSparkline} />
                </svg>
              </article>
            ) : null}
          </section>
          <CouponPerformanceWorkspace rows={rows} report={performance.report} />
        </main>
      </PageShell>
    );
  }

  if (view === "guaranteed") {
    const guaranteedCenter = buildSmartCouponCenter(data.upcoming, {
      historicalRows: data.settled,
      horizonDays: 28,
    });
    const guaranteedSerialized = serializeCouponCenter(guaranteedCenter);
    const performance = await loadSmartCouponPerformance(500);
    const performanceLegs = performance.rows.flatMap((row) =>
      row.legs.map((leg) => ({ ...leg, result: leg.result })),
    );
    const snapshot = await loadDashboardPredictionSnapshot(20_000);
    const snapshotLegs = snapshot.flatMap((prediction) => [
      {
        matchId: prediction.matchId,
        kickoffAt: prediction.kickoffAt,
        leagueName: prediction.leagueName,
        homeTeam: prediction.homeTeam,
        awayTeam: prediction.awayTeam,
        market: "Maç Sonucu",
        marketKey: "MATCH_RESULT",
        selection: "HOME",
        odds: prediction.homeProbability ? 100 / prediction.homeProbability : 0,
        modelProbability: prediction.homeProbability,
        result: prediction.settlementStatus ?? "PENDING",
        actualHomeScore: prediction.finalHomeScore ?? null,
        actualAwayScore: prediction.finalAwayScore ?? null,
      },
      ...(prediction.topPicks ?? []).map((pick) => ({
        matchId: prediction.matchId,
        kickoffAt: prediction.kickoffAt,
        leagueName: prediction.leagueName,
        homeTeam: prediction.homeTeam,
        awayTeam: prediction.awayTeam,
        market: pick.category || pick.market,
        marketKey: pick.market,
        selection: pick.selection,
        odds: pick.fairOdds ?? (pick.probability ? 100 / pick.probability : 0),
        modelProbability: pick.probability,
        result: prediction.settlementStatus ?? "PENDING",
        actualHomeScore: prediction.finalHomeScore ?? null,
        actualAwayScore: prediction.finalAwayScore ?? null,
      })),
    ]);
    return (
      <PageShell>
        <header className="topbar dashboard-topbar">
          <div>
            <p className="eyebrow">KUPON MERKEZİ</p>
            <h1>Garanti / güvenli kuponlar</h1>
            <p className="subtitle">Daha muhafazakâr kupon setleri — özel listeden ayrı.</p>
          </div>
        </header>
        {tabs}
        <GuaranteedCouponWorkspace
          coupons={[...guaranteedSerialized.coupons, ...guaranteedSerialized.fallbackCoupons]}
          performanceLegs={[...performanceLegs, ...snapshotLegs]}
          generatedAt={guaranteedSerialized.generatedAt}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="topbar dashboard-topbar">
        <div>
          <p className="eyebrow">KUPON MERKEZİ</p>
          <h1>Günlük ve haftalık kuponlar</h1>
          <p className="subtitle">Kupon üretimi burada; performans ve garanti sekmelerde. Özel liste ayrı ekran.</p>
        </div>
      </header>
      {tabs}
      <main className={styles.page}>
        <SmartCouponWorkspace
          {...serialized}
          missing={center.missing}
          eligibleCandidates={center.eligibleCandidates}
          advisoryCandidates={center.advisoryCandidates}
          rejectedCandidates={center.rejectedCandidates}
          rejectionBreakdown={center.rejectionBreakdown}
          access="ADMIN"
        />
      </main>
    </PageShell>
  );
}

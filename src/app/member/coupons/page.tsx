import Link from "next/link";
import { redirect } from "next/navigation";

import { CouponPerformanceWorkspace } from "@/components/coupon-performance-workspace";
import { GuaranteedCouponWorkspace } from "@/components/guaranteed-coupon-workspace";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { SmartCouponWorkspace } from "@/components/smart-coupon-workspace";
import couponStyles from "@/app/coupons/smart-coupons-page.module.css";
import perfStyles from "@/app/coupon-performance/coupon-performance-page.module.css";
import { requireMember } from "@/lib/auth-session";
import { hasMembershipPermission } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { buildSmartCouponCenter } from "@/lib/smart-coupon-engine";
import { loadSmartCouponPerformance } from "@/lib/smart-coupon-performance-data";
import { serializeCouponCenter } from "@/lib/smart-coupon-view";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import {
  buildBankrollBacktestReport,
  couponsToBacktestInputs,
} from "@/modules/bankroll-backtest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type View = "center" | "performance" | "guaranteed";

function viewOf(value: string | string[] | undefined): View {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "performance" || raw === "guaranteed") return raw;
  return "center";
}

export default async function MemberCouponsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  const user = await requireMember();
  if (!hasMembershipPermission(user.plan, "DAILY_COUPONS")) {
    redirect("/member/plans");
  }

  const requested = viewOf((await searchParams)?.view);
  const canPerformance = hasMembershipPermission(user.plan, "COUPON_ANALYTICS");
  const canGuaranteed =
    hasMembershipPermission(user.plan, "SURPRISE_COUPONS") || user.plan === "PROFESSIONAL";
  const view: View =
    requested === "performance" && !canPerformance
      ? "center"
      : requested === "guaranteed" && !canGuaranteed
        ? "center"
        : requested;

  const data = await loadValueBetDashboardSnapshot();
  const center = buildSmartCouponCenter(data.upcoming, {
    historicalRows: data.settled,
  });
  const serialized = serializeCouponCenter(center);

  const tabs = (
    <nav className="coupon-center-tabs" aria-label="Coupon centre">
      <Link className={view === "center" ? "active" : ""} href="/member/coupons">
        Daily coupons
      </Link>
      {canPerformance ? (
        <Link
          className={view === "performance" ? "active" : ""}
          href="/member/coupons?view=performance"
        >
          Performance
        </Link>
      ) : null}
      {canGuaranteed ? (
        <Link
          className={view === "guaranteed" ? "active" : ""}
          href="/member/coupons?view=guaranteed"
        >
          Safe / guaranteed
        </Link>
      ) : null}
      {user.plan === "PROFESSIONAL" ? (
        <Link href="/member/professional/special">Special List →</Link>
      ) : null}
    </nav>
  );

  if (view === "performance" && canPerformance) {
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
      <main className={member.shell}>
        <MemberPortalHeader plan={user.plan} active="coupons" memberName={user.name} />
        <div className={member.page}>
          <section className={member.welcome}>
            <div>
              <p data-no-translate>WINIQ · COUPONS</p>
              <h1>Coupon performance</h1>
              <span>Published coupon results in one place.</span>
            </div>
          </section>
          {tabs}
          <div className={perfStyles.page}>
            <section className={perfStyles.summary} aria-label="Bankroll backtest">
              <article>
                <span>Yield</span>
                <strong>
                  {m.yieldPct == null ? "—" : `${m.yieldPct.toFixed(1)}%`}
                </strong>
              </article>
              <article>
                <span>Yield CI</span>
                <strong>
                  {bankroll.yieldCI
                    ? `${(bankroll.yieldCI.lower * 100).toFixed(1)}…${(bankroll.yieldCI.upper * 100).toFixed(1)}%`
                    : "—"}
                </strong>
              </article>
              <article>
                <span>ROI</span>
                <strong>{m.roiPct.toFixed(1)}%</strong>
              </article>
              <article>
                <span>Max DD</span>
                <strong>{m.maxDrawdownPct.toFixed(1)}%</strong>
              </article>
              <article>
                <span>Sharpe</span>
                <strong>{m.sharpe == null ? "—" : m.sharpe.toFixed(2)}</strong>
              </article>
              <article>
                <span>CAGR</span>
                <strong>
                  {m.cagrPct == null ? "—" : `${m.cagrPct.toFixed(1)}%`}
                </strong>
              </article>
              {bankroll.bankrollSparkline ? (
                <article>
                  <span>Equity</span>
                  <svg viewBox="0 0 100 28" width="120" height="36" aria-hidden>
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      points={bankroll.bankrollSparkline}
                    />
                  </svg>
                </article>
              ) : null}
            </section>
            <CouponPerformanceWorkspace rows={rows} report={performance.report} />
          </div>
        </div>
      </main>
    );
  }

  if (view === "guaranteed" && canGuaranteed) {
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
      <main className={member.shell}>
        <MemberPortalHeader plan={user.plan} active="coupons" memberName={user.name} />
        <div className={member.page}>
          <section className={member.welcome}>
            <div>
              <p data-no-translate>WINIQ · COUPONS</p>
              <h1>Safe / guaranteed coupons</h1>
              <span>More conservative coupon sets.</span>
            </div>
          </section>
          {tabs}
          <GuaranteedCouponWorkspace
            coupons={[...guaranteedSerialized.coupons, ...guaranteedSerialized.fallbackCoupons]}
            performanceLegs={[...performanceLegs, ...snapshotLegs]}
            generatedAt={guaranteedSerialized.generatedAt}
          />
        </div>
      </main>
    );
  }

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="coupons" memberName={user.name} />
      <div className={member.page}>
        <section className={member.welcome}>
          <div>
            <p data-no-translate>WINIQ · COUPONS</p>
            <h1>Coupon centre</h1>
            <span>Daily and weekly coupon suggestions available on your plan.</span>
          </div>
        </section>
        {tabs}
        <div className={couponStyles.page}>
          <SmartCouponWorkspace
            {...serialized}
            missing={center.missing}
            eligibleCandidates={center.eligibleCandidates}
            advisoryCandidates={center.advisoryCandidates}
            rejectedCandidates={center.rejectedCandidates}
            rejectionBreakdown={center.rejectionBreakdown}
            access={user.plan}
          />
        </div>
      </div>
    </main>
  );
}

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
    <nav className="coupon-center-tabs" aria-label="Kupon merkezi sekmeleri">
      <Link className={view === "center" ? "active" : ""} href="/member/coupons">
        Günlük kuponlar
      </Link>
      {canPerformance ? (
        <Link
          className={view === "performance" ? "active" : ""}
          href="/member/coupons?view=performance"
        >
          Performans
        </Link>
      ) : null}
      {canGuaranteed ? (
        <Link
          className={view === "guaranteed" ? "active" : ""}
          href="/member/coupons?view=guaranteed"
        >
          Garanti / güvenli
        </Link>
      ) : null}
      {user.plan === "PROFESSIONAL" ? (
        <Link href="/member/professional/special">Özel liste →</Link>
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
    return (
      <main className={member.shell}>
        <MemberPortalHeader plan={user.plan} active="coupons" memberName={user.name} />
        <div className={member.page}>
          <section className={member.welcome}>
            <div>
              <p data-no-translate>WINIQ · KUPONLAR</p>
              <h1>Kupon performansı</h1>
              <span>Yayımlanan kuponların sonuç özeti.</span>
            </div>
          </section>
          {tabs}
          <div className={perfStyles.page}>
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
              <p data-no-translate>WINIQ · KUPONLAR</p>
              <h1>Garanti / güvenli kuponlar</h1>
              <span>Daha muhafazakâr kupon setleri.</span>
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
            <p data-no-translate>WINIQ · KUPONLAR</p>
            <h1>Kupon merkezi</h1>
            <span>Paketinize açık günlük ve haftalık kupon önerileri.</span>
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

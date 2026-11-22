import { readFile } from "node:fs/promises";

import { MemberSmartDashboard } from "@/components/member-smart-dashboard";
import { requireMember } from "@/lib/auth-session";
import { collectMarketLineMoveQueries } from "@/lib/market-line-move-queries";
import { loadMarketLineMoves } from "@/lib/market-line-move";
import { marketLineMovesToRecord } from "@/lib/market-line-move-shared";
import { loadMemberPastPerformance } from "@/lib/member-past-performance";
import { buildMemberV2Desk } from "@/lib/member-v2-desk";
import {
  loadDashboardPredictionSnapshot,
  PREDICTION_DASHBOARD_SNAPSHOT_PATH,
} from "@/lib/prediction-dashboard-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function snapshotGeneratedAtIso() {
  try {
    const raw = JSON.parse(await readFile(PREDICTION_DASHBOARD_SNAPSHOT_PATH, "utf8")) as {
      generatedAt?: string;
    };
    if (raw.generatedAt && !Number.isNaN(new Date(raw.generatedAt).getTime())) {
      return raw.generatedAt;
    }
  } catch {
    /* fall through */
  }
  return new Date().toISOString();
}

export default async function MemberPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const user = await requireMember();
  const query = searchParams ? await searchParams : {};
  const [allPredictions, updatedAtIso, past] = await Promise.all([
    loadDashboardPredictionSnapshot(5_000),
    snapshotGeneratedAtIso(),
    loadMemberPastPerformance({ matchLimit: 40 }),
  ]);
  const predictions = allPredictions
    .slice()
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())
    .slice(0, 2_000);
  const lineMoves = marketLineMovesToRecord(
    await loadMarketLineMoves(collectMarketLineMoveQueries(predictions)),
  );
  const v2Desk = buildMemberV2Desk({
    predictions,
    lineMoves,
    matchPathPrefix: "/member/matches",
    recentResults: past.v2.recentResults,
    loggedBeforeKickoffPct: past.v2.loggedBeforeKickoffPct,
    homeBaselineHitRate: past.v2.homeBaselineHitRate,
  });

  return (
    <MemberSmartDashboard
      name={user.name}
      plan={user.plan}
      predictions={predictions}
      selectedDate={query.date}
      performance={past.performance}
      updatedAtIso={updatedAtIso}
      lineMoves={lineMoves}
      v2Desk={v2Desk}
    />
  );
}

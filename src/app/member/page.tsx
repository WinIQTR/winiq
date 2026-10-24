import { readFile } from "node:fs/promises";

import { MemberSmartDashboard, type MemberPerformance } from "@/components/member-smart-dashboard";
import { requireMember } from "@/lib/auth-session";
import { buildMarketPerformanceArchive } from "@/lib/market-performance-archive";
import {
  loadDashboardPredictionSnapshot,
  PREDICTION_DASHBOARD_SNAPSHOT_PATH,
} from "@/lib/prediction-dashboard-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function performanceOf(predictions: Awaited<ReturnType<typeof loadDashboardPredictionSnapshot>>): MemberPerformance {
  const rows = buildMarketPerformanceArchive(predictions, { from: new Date(0), to: new Date() });
  const band = (tier: "STRONG" | "MEDIUM" | "WEAK") => {
    const tierRows = rows.filter((item) => item.tier === tier);
    const wins = tierRows.filter((item) => item.result === "WON").length;
    const losses = tierRows.filter((item) => item.result === "LOST").length;
    const voids = tierRows.filter((item) => item.result === "VOID").length;
    const unavailable = tierRows.filter((item) => item.result === "DATA_MISSING").length;
    const evaluated = wins + losses;
    return {
      rate: evaluated ? (wins / evaluated) * 100 : null,
      samples: evaluated,
      wins,
      losses,
      voids,
      unavailable,
      total: tierRows.length,
    };
  };
  return { strong: band("STRONG"), medium: band("MEDIUM"), weak: band("WEAK") };
}

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
  const [allPredictions, updatedAtIso] = await Promise.all([
    loadDashboardPredictionSnapshot(5_000),
    snapshotGeneratedAtIso(),
  ]);
  const predictions = allPredictions
    .slice()
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())
    .slice(0, 2_000);

  return (
    <MemberSmartDashboard
      name={user.name}
      plan={user.plan}
      predictions={predictions}
      selectedDate={query.date}
      performance={performanceOf(allPredictions)}
      updatedAtIso={updatedAtIso}
    />
  );
}

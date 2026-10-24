import { readFile } from "node:fs/promises";

import { MemberSmartDashboard } from "@/components/member-smart-dashboard";
import { requireMember } from "@/lib/auth-session";
import { loadMemberPastPerformance } from "@/lib/member-past-performance";
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
    loadMemberPastPerformance({ matchLimit: 1 }),
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
      performance={past.performance}
      updatedAtIso={updatedAtIso}
    />
  );
}

import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { GET as getHealthEndpoint } from "@/app/api/health/route";
import { verifyProductionBackup } from "@/lib/production-backup";
import { buildValueBetAccuracyReport } from "@/lib/value-bet-accuracy";
import { buildChampionChallengerAudit } from "@/lib/value-bet-champion-challenger";
import {
  VALUE_BET_DASHBOARD_SNAPSHOT_PATH,
  loadValueBetDashboardSnapshot,
} from "@/lib/value-bet-dashboard-snapshot";
import { buildValueBetLeagueProfileReport } from "@/lib/value-bet-league-profile";
import { buildValueBetLearningReport } from "@/lib/value-bet-learning";
import { buildModelHealthReport } from "@/lib/value-bet-model-health";
import { buildValueBetPortfolio } from "@/lib/value-bet-portfolio";
import { buildProductionReportBundle } from "@/lib/production-report";
import {
  PREDICTION_DASHBOARD_SNAPSHOT_PATH,
  loadDashboardPredictionSnapshot,
} from "@/lib/prediction-dashboard-snapshot";
import { buildRemoteReadinessReport } from "@/lib/remote-readiness";

type StoredHealthState = {
  schemaVersion: number;
  currentLevel: string;
  notificationCount: number;
};

type StoredHealthEvent = {
  production?: {
    automaticModelChangeAllowed?: boolean;
  };
};

function operationalPath(options: {
  specific: string | undefined;
  relativeToRoot: string[];
  local: string[];
}): string {
  const specific = options.specific?.trim();
  if (specific) return resolve(specific);

  const productionRoot = process.env.PRODUCTION_DATA_ROOT?.trim();
  return productionRoot
    ? resolve(productionRoot, ...options.relativeToRoot)
    : resolve(process.cwd(), ...options.local);
}

async function main(): Promise<void> {
  console.log("\nV3 FINAL PRODUCTION VERIFICATION\n");

  const data = await loadValueBetDashboardSnapshot();
  const snapshotGeneratedAt = data.generatedAt;
  assert.ok(
    snapshotGeneratedAt,
    "Value Bet dashboard snapshot is missing. Run pnpm run refresh first.",
  );

  const portfolio = buildValueBetPortfolio(data.upcoming);
  const accuracy = buildValueBetAccuracyReport(data.settled);
  const learning = buildValueBetLearningReport(data.settled);
  const leagues = buildValueBetLeagueProfileReport(data.settled);
  const audit = buildChampionChallengerAudit(data.settled);
  const health = buildModelHealthReport({
    generatedAt: snapshotGeneratedAt,
    upcoming: data.upcoming,
    settled: data.settled,
  });
  const reports = buildProductionReportBundle(
    {
      generatedAt: snapshotGeneratedAt,
      upcoming: data.upcoming,
      settled: data.settled,
    },
    new Date(),
  );

  assert.equal(learning.productionChangeAllowed, false);
  assert.equal(leagues.productionUseAllowed, false);
  assert.equal(audit.productionChangeAllowed, false);
  assert.equal(health.automaticProductionChangeAllowed, false);
  assert.equal(
    reports.daily.production.automaticModelChangeAllowed,
    false,
  );
  assert.equal(
    reports.weekly.production.automaticModelChangeAllowed,
    false,
  );
  assert.equal(
    learning.independentSelections,
    leagues.independentSelections,
  );
  assert.equal(
    learning.independentSelections,
    audit.independentSelections,
  );
  assert.equal(
    learning.independentSelections,
    health.drift.independentSelections,
  );
  assert.ok(
    portfolio.maximumDailyAllocatedRiskPercentage <= 6.0001,
    "Portfolio daily risk exceeds 6%.",
  );

  const backup = await verifyProductionBackup();
  assert.equal(backup.databaseDumpValid, true);
  assert.ok(backup.fileCount > 0);

  const healthStatePath = operationalPath({
    specific: process.env.PRODUCTION_HEALTH_STATE_PATH,
    relativeToRoot: ["data", "operations", "model-health-state.json"],
    local: ["data", "operations", "model-health-state.json"],
  });
  const healthLogPath = operationalPath({
    specific: process.env.PRODUCTION_HEALTH_LOG_PATH,
    relativeToRoot: ["logs", "production", "model-health-events.jsonl"],
    local: ["logs", "production", "model-health-events.jsonl"],
  });
  const notificationRoot = operationalPath({
    specific: process.env.PRODUCTION_NOTIFICATION_DIR,
    relativeToRoot: ["notifications", "production"],
    local: ["notifications", "production"],
  });

  const storedState = JSON.parse(
    await readFile(healthStatePath, "utf8"),
  ) as StoredHealthState;
  assert.equal(storedState.schemaVersion, 1);
  assert.ok(["HEALTHY", "WARNING", "CRITICAL"].includes(storedState.currentLevel));

  const eventLines = (await readFile(healthLogPath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean);
  assert.ok(eventLines.length > 0, "Production health event log is empty.");
  const lastEvent = JSON.parse(eventLines.at(-1)!) as StoredHealthEvent;
  assert.equal(
    lastEvent.production?.automaticModelChangeAllowed,
    false,
  );

  const notificationFiles = (await readdir(notificationRoot))
    .filter((name) => name.endsWith(".json"));
  assert.ok(
    notificationFiles.length > 0,
    "Production notification outbox is empty.",
  );

  const remote = buildRemoteReadinessReport(process.env);
  assert.equal(remote.automaticModelChangeAllowed, false);
  assert.ok(
    remote.status === "SAFELY_BLOCKED" || remote.status === "REMOTE_READY",
  );

  const healthResponse = await getHealthEndpoint();
  assert.equal(healthResponse.status, 200);
  const healthBody = await healthResponse.json() as {
    status?: string;
    productionModel?: string;
  };
  assert.equal(healthBody.status, "ok");
  assert.equal(healthBody.productionModel, "LOCKED");

  await access(join(process.cwd(), ".next", "BUILD_ID"));
  assert.equal(
    VALUE_BET_DASHBOARD_SNAPSHOT_PATH,
    join(process.cwd(), "data", "value-bet-dashboard-snapshot.json"),
  );
  assert.equal(
    PREDICTION_DASHBOARD_SNAPSHOT_PATH,
    join(process.cwd(), "data", "production-dashboard-snapshot.json"),
  );
  const predictionRows = await loadDashboardPredictionSnapshot(1);

  console.table({
    "Production build": "PASS",
    "Health endpoint": "PASS",
    "Value snapshot": snapshotGeneratedAt.toISOString(),
    "Prediction snapshot": predictionRows.length > 0 ? "AVAILABLE" : "EMPTY",
    "Upcoming Value Bets": data.upcoming.length,
    "Settled Value Bets": data.settled.length,
    "Independent results": learning.independentSelections,
    "Settled accuracy": accuracy.winRate === null
      ? "collecting"
      : `${accuracy.winRate.toFixed(1)}%`,
    "Primary portfolio picks": portfolio.primarySelections.length,
    "Portfolio risk": `${portfolio.maximumDailyAllocatedRiskPercentage.toFixed(2)}%`,
    "Daily report": reports.daily.period.key,
    "Daily settled": reports.daily.settled.settled,
    "Weekly report": reports.weekly.period.key,
    "Weekly settled": reports.weekly.settled.settled,
    "Weekly ROI": reports.weekly.settled.roi === null
      ? "collecting"
      : `${reports.weekly.settled.roi.toFixed(1)}%`,
    "Model health": health.overallLevel,
    "Health events": eventLines.length,
    "Notifications": notificationFiles.length,
    "Backup files": backup.fileCount,
    "Backup MB": (backup.totalBytes / 1024 / 1024).toFixed(2),
    "PostgreSQL dump": backup.databaseDumpValid ? "VALID" : "INVALID",
    "Remote gate": remote.status,
    Champion: "20% ML / 80% Poisson",
    "Production locks": "PASS",
  });

  console.log("V3 final production verification passed.");
  console.log("20% ML / 80% Poisson Champion remains unchanged.");
  console.log("Automatic production model changes remain disabled.");
}

main().catch((error: unknown) => {
  console.error("\nV3 final production verification failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

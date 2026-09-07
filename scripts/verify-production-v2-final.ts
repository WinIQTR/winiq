import assert from "node:assert/strict";

import { buildValueBetAccuracyReport } from "@/lib/value-bet-accuracy";
import { buildChampionChallengerAudit } from "@/lib/value-bet-champion-challenger";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import { buildValueBetLeagueProfileReport } from "@/lib/value-bet-league-profile";
import { buildValueBetLearningReport } from "@/lib/value-bet-learning";
import { buildModelHealthReport } from "@/lib/value-bet-model-health";
import { buildValueBetPortfolio } from "@/lib/value-bet-portfolio";

async function main(): Promise<void> {
  const data = await loadValueBetDashboardSnapshot();
  assert.ok(data.generatedAt, "Value Bet dashboard snapshot is missing. Run pnpm run refresh first.");

  const portfolio = buildValueBetPortfolio(data.upcoming);
  const accuracy = buildValueBetAccuracyReport(data.settled);
  const learning = buildValueBetLearningReport(data.settled);
  const leagues = buildValueBetLeagueProfileReport(data.settled);
  const audit = buildChampionChallengerAudit(data.settled);
  const health = buildModelHealthReport({ generatedAt: data.generatedAt, upcoming: data.upcoming, settled: data.settled });

  assert.equal(learning.productionChangeAllowed, false, "Historical Learning production lock is open.");
  assert.equal(leagues.productionUseAllowed, false, "League Profile production lock is open.");
  assert.equal(audit.productionChangeAllowed, false, "Champion-Challenger production lock is open.");
  assert.equal(health.automaticProductionChangeAllowed, false, "Health Monitor automatic action lock is open.");
  assert.equal(learning.independentSelections, leagues.independentSelections, "Learning and League Profile independent samples differ.");
  assert.equal(learning.independentSelections, audit.independentSelections, "Learning and Ensemble Audit independent samples differ.");
  assert.equal(learning.independentSelections, health.drift.independentSelections, "Learning and Drift Monitor independent samples differ.");
  assert.ok(portfolio.maximumDailyAllocatedRiskPercentage <= 6.0001, "Portfolio daily risk exceeds 6%.");

  console.log("\nV2 FINAL PRODUCTION VERIFICATION\n");
  console.table({
    "Snapshot generated": data.generatedAt.toISOString(),
    "Upcoming Value Bets": data.upcoming.length,
    "Settled Value Bets": data.settled.length,
    "Independent results": learning.independentSelections,
    "Primary portfolio picks": portfolio.primarySelections.length,
    "Portfolio risk": `${portfolio.maximumDailyAllocatedRiskPercentage.toFixed(2)}%`,
    "Settled accuracy": accuracy.winRate === null ? "collecting" : `${accuracy.winRate.toFixed(1)}%`,
    "Historical Learning": learning.status,
    "League profiles": leagues.leagues.length,
    "Ensemble audit": audit.status,
    "Model health": health.overallLevel,
    "Drift monitor": health.drift.status,
    "Production locks": "PASS",
  });

  console.log("V2 final production verification passed.");
  console.log("20% ML / 80% Poisson Champion remains unchanged.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

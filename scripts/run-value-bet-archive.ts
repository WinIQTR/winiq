import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { runValueBetArchiveAutomation } from "@/lib/value-bet-archive";

async function main(): Promise<void> {
  console.log("");
  console.log("==============================================");
  console.log("VALUE BET ARCHIVE V2");
  console.log("==============================================");

  const result = await runValueBetArchiveAutomation();

  console.table({
    "Matches evaluated": result.publication.matchesEvaluated,
    Comparisons: result.publication.comparisons,
    "Publishable found": result.publication.publishableFound,
    "Newly published": result.publication.published,
    "Duplicates skipped": result.publication.duplicatesSkipped,
    "Calculation failures": result.publication.calculationFailures,
    "Pending evaluated": result.settlement.pendingEvaluated,
    Won: result.settlement.won,
    Lost: result.settlement.lost,
    Void: result.settlement.voided,
    "Dashboard upcoming": result.dashboard.upcoming,
    "Dashboard settled": result.dashboard.settled,
    "Snapshot generated": result.dashboard.generatedAt.toISOString(),
    "Coupons published": result.coupons.published,
    "Coupon duplicates": result.coupons.duplicatesSkipped,
    "Coupons won": result.coupons.won,
    "Coupons lost": result.coupons.lost,
    "Coupons void": result.coupons.voided,
  });

  for (const warning of result.warnings) {
    console.warn(`WARNING: ${warning}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error("Value Bet archive failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

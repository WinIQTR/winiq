import "dotenv/config";

import { deliverDailyNetThree } from "../src/lib/member-daily-net-three-notify";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log("\nDAILY NET THREE NOTIFY\n");
  const result = await deliverDailyNetThree({ dryRun });
  console.table({
    Day: result.dayKey,
    Picks: result.pickCount,
    Recipients: result.recipients,
    Notified: result.notified,
    Skipped: result.skipped,
    Failed: result.failed,
    DryRun: result.dryRun,
  });
  for (const pick of result.picks) {
    console.log(
      `- ${pick.homeTeam}–${pick.awayTeam} · ${pick.selection} · %${Math.round(pick.confidence)}`,
    );
  }
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error("Daily net-three notify failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

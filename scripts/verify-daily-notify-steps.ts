/**
 * Non-payment smoke: expiry dry-run + net-3 dry-run + ops checklist.
 * Expects prod DB via DOTENV_CONFIG_PATH / process env (daily collector loads it).
 */
import "dotenv/config";

import {
  buildDailyOpsChecklist,
  writeDailyOpsChecklist,
} from "../src/lib/daily-ops-checklist";
import { deliverDailyNetThree } from "../src/lib/member-daily-net-three-notify";
import { deliverMembershipExpiryReminders } from "../src/lib/membership-expiry-reminder";

async function main() {
  console.log("\nVERIFY DAILY NOTIFY STEPS (non-payment)\n");

  const expiry = await deliverMembershipExpiryReminders({ dryRun: true });
  console.table({
    ExpiryTarget: expiry.targetDate,
    ExpiryCandidates: expiry.candidates,
    ExpiryDryRun: expiry.dryRun,
  });

  const net3 = await deliverDailyNetThree({ dryRun: true });
  console.table({
    Net3Day: net3.dayKey,
    Net3Picks: net3.pickCount,
    Net3Recipients: net3.recipients,
    Net3DryRun: net3.dryRun,
  });

  const checklist = await buildDailyOpsChecklist();
  const path = await writeDailyOpsChecklist(checklist);
  console.log(`Checklist overall(non-payment)=${checklist.overall}`);
  console.log(`Checklist payment(deferred)=${checklist.paymentOverall}`);
  console.log(`Wrote ${path}`);
  for (const item of checklist.items) {
    const tag = item.deferred ? "DEFER" : item.tone;
    console.log(`- [${tag}] ${item.label}: ${item.detail}`);
  }

  if (checklist.overall === "RED") process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

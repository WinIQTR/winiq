import "dotenv/config";

import { deliverMembershipExpiryReminders } from "../src/lib/membership-expiry-reminder";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log("\nMEMBERSHIP EXPIRY REMINDERS (T-7d)\n");
  const result = await deliverMembershipExpiryReminders({ dryRun });
  console.table({
    Now: result.nowIso,
    Target: result.targetDate,
    Candidates: result.candidates,
    "Already sent": result.alreadySent,
    Notified: result.notified,
    Failed: result.failed,
    DryRun: result.dryRun,
  });
  for (const row of result.details) {
    console.log(
      `- ${row.email} · ends ${row.endsAt} · ${row.status}${row.channels ? ` · ${row.channels}` : ""}`,
    );
  }
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error("Membership expiry reminder failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

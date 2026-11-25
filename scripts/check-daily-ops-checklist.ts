import "dotenv/config";

import {
  buildDailyOpsChecklist,
  writeDailyOpsChecklist,
} from "../src/lib/daily-ops-checklist";

async function main(): Promise<void> {
  console.log("\nDAILY OPS CHECKLIST\n");
  const checklist = await buildDailyOpsChecklist();
  const path = await writeDailyOpsChecklist(checklist);
  console.log(`Overall: ${checklist.overall}`);
  console.log(`Wrote: ${path}`);
  for (const item of checklist.items) {
    console.log(`- [${item.tone}] ${item.label}: ${item.detail}`);
  }
  if (checklist.overall === "RED") process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error("Daily ops checklist failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

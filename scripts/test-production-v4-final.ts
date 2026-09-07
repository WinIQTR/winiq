import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

async function main(): Promise<void> {
  const source = await readFile(
    join(
      process.cwd(),
      "scripts",
      "verify-production-v4-final.ts",
    ),
    "utf8",
  );

  assert.match(source, /runV3FinalVerification\(\)/);
  assert.match(source, /process\.env\.ComSpec \|\| "cmd\.exe"/);
  assert.match(source, /pnpm\.cmd run verify:v3-final/);
  assert.doesNotMatch(
    source,
    /process\.platform === "win32"[\s\S]{0,120}\? "pnpm\.cmd"/,
  );
  assert.match(source, /ACTIVE_SEASON_YEAR[\s\S]*2026/);
  assert.match(source, /BetProjectDailyCollection/);
  assert.match(source, /Get-ScheduledTaskInfo/);
  assert.match(
    source,
    /\[PSCustomObject\]@\{ taskName = \$task\.TaskName;/,
  );
  assert.doesNotMatch(source, /\[PSCustomObject\]@\{"\s*,/);
  assert.match(source, /prisma\.match\.count/);
  assert.ok(
    source.includes("await prisma\\.match\\.findMany"),
  );
  assert.ok(
    source.includes("fixtures=\\{fixtures\\}"),
  );
  assert.match(source, /buildProductionDeploymentGate/);
  assert.match(source, /buildNotificationDeliveryReadiness/);
  assert.match(source, /"SAFELY_BLOCKED"/);
  assert.match(source, /20% ML \/ 80% Poisson/);
  assert.match(source, /Automatic model change": "LOCKED"/);
  assert.doesNotMatch(source, /Start-ScheduledTask/);
  assert.doesNotMatch(source, /notifications:deliver-v4/);
  assert.doesNotMatch(source, /PRODUCTION_LEARNING_APPROVED\s*=\s*true/);
  assert.doesNotMatch(source, /PRODUCTION_DEPLOYMENT_APPROVED\s*=\s*true/);

  console.log(
    "V4 Final Production Verification safety tests passed.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

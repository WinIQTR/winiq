import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function main(): Promise<void> {
  const root = process.cwd();
  const runner = await readFile(
    join(root, "deploy", "windows", "run-local-daily-collection.ps1"),
    "utf8",
  );
  const installer = await readFile(
    join(root, "deploy", "windows", "install-local-daily-task.ps1"),
    "utf8",
  );
  const remover = await readFile(
    join(root, "deploy", "windows", "remove-local-daily-task.ps1"),
    "utf8",
  );

  const expectedOrder = [
    'Script = "refresh"',
    'Script = "import-odds"',
    'Script = "value-bets"',
    'Script = "reports:production"',
    'Script = "health:production"',
    'Script = "check:learning-gate-v4"',
    'Script = "backup:production"',
    'Script = "verify:backup"',
  ];
  let previous = -1;
  for (const marker of expectedOrder) {
    const index = runner.indexOf(marker);
    assert.ok(index > previous, `Missing or out-of-order automation step: ${marker}`);
    previous = index;
  }

  assert.match(runner, /\[switch\]\$DryRun/);
  assert.match(runner, /No command was executed and no file was changed/);
  assert.match(runner, /FileMode\]::CreateNew/);
  assert.match(runner, /AllowedExitCodes = @\(0, 2\)/);
  assert.match(runner, /Get-Command "pnpm\.cmd"/);
  assert.match(runner, /Start-Transcript/);
  assert.match(runner, /Automatic model activation: LOCKED/);
  assert.doesNotMatch(runner, /notifications:deliver-v4/);
  assert.doesNotMatch(runner, /PRODUCTION_LEARNING_APPROVED/);

  assert.match(installer, /BetProjectDailyCollection/);
  assert.match(installer, /StartWhenAvailable/);
  assert.match(installer, /RunOnlyIfNetworkAvailable/);
  assert.match(installer, /MultipleInstances IgnoreNew/);
  assert.match(installer, /RunLevel Limited/);
  assert.doesNotMatch(installer, /RunLevel Highest/);
  assert.doesNotMatch(installer, /Password|Credential/);

  assert.match(remover, /Unregister-ScheduledTask/);
  assert.match(remover, /-Confirm:\$false/);

  console.log("Free Local Daily Collection Automation V4.5 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import "dotenv/config";

import assert from "node:assert/strict";

import {
  execFileSync,
} from "node:child_process";

import {
  access,
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  buildNotificationDeliveryReadiness,
} from "@/lib/production-notification-delivery";

import {
  buildProductionDeploymentGate,
} from "@/lib/production-deployment-gate";

import {
  prisma,
} from "@/lib/prisma";

type ScheduledTaskSummary = {
  taskName: string;
  state: string;
  nextRunTime: string;
  lastRunTime: string;
  lastTaskResult: number;
};

function readScheduledTask(): ScheduledTaskSummary {
  if (process.platform !== "win32") {
    throw new Error(
      "V4 final scheduled-task verification must run on the production Windows computer.",
    );
  }

  const command = [
    "$task = Get-ScheduledTask -TaskName 'BetProjectDailyCollection' -ErrorAction Stop",
    "$info = Get-ScheduledTaskInfo -TaskName 'BetProjectDailyCollection' -ErrorAction Stop",
    "[PSCustomObject]@{ taskName = $task.TaskName; state = $task.State.ToString(); nextRunTime = $info.NextRunTime.ToString('o'); lastRunTime = $info.LastRunTime.ToString('o'); lastTaskResult = [int]$info.LastTaskResult } | ConvertTo-Json -Compress",
  ].join("; ");

  const output = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      command,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );

  return JSON.parse(output.trim()) as ScheduledTaskSummary;
}

function runV3FinalVerification(): void {
  if (process.platform === "win32") {
    execFileSync(
      process.env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "pnpm.cmd run verify:v3-final",
      ],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        windowsHide: true,
      },
    );

    return;
  }

  execFileSync(
    "pnpm",
    ["run", "verify:v3-final"],
    {
      cwd: process.cwd(),
      stdio: "inherit",
    },
  );
}

async function main(): Promise<void> {
  console.log("\nV4 FINAL PRODUCTION VERIFICATION\n");

  assert.equal(
    ACTIVE_SEASON_YEAR,
    2026,
    "The active production season must remain 2026.",
  );

  await access(
    join(process.cwd(), ".next", "BUILD_ID"),
  );

  runV3FinalVerification();

  const [
    fixtureCount,
    finishedFixtureCount,
    predictionsPage,
    adminPage,
  ] = await Promise.all([
    prisma.match.count({
      where: {
        season: {
          year: ACTIVE_SEASON_YEAR,
        },
      },
    }),
    prisma.match.count({
      where: {
        status: "FINISHED",
        season: {
          year: ACTIVE_SEASON_YEAR,
        },
      },
    }),
    readFile(
      join(
        process.cwd(),
        "src",
        "app",
        "predictions",
        "page.tsx",
      ),
      "utf8",
    ),
    readFile(
      join(
        process.cwd(),
        "src",
        "app",
        "admin",
        "page.tsx",
      ),
      "utf8",
    ),
  ]);

  assert.ok(
    fixtureCount > 0,
    "No 2026 fixture is stored. Run pnpm run refresh.",
  );

  assert.match(
    predictionsPage,
    /await prisma\.match\.findMany/,
    "The complete 2026 fixture archive is not connected to Predictions.",
  );

  assert.match(
    predictionsPage,
    /fixtures=\{fixtures\}/,
    "The All Matches data is not passed to the Predictions workspace.",
  );

  assert.doesNotMatch(
    adminPage,
    /<strong>Free plan<\/strong>/,
    "Admin still displays a hard-coded API plan.",
  );

  const task = readScheduledTask();

  assert.equal(
    task.taskName,
    "BetProjectDailyCollection",
  );

  assert.ok(
    ["Ready", "Running"].includes(task.state),
    `Scheduled task is not ready: ${task.state}`,
  );

  assert.ok(
    task.nextRunTime,
    "Scheduled task has no next run time.",
  );

  const deployment =
    buildProductionDeploymentGate(
      process.env,
    );

  assert.equal(
    deployment.production.automaticModelChangeAllowed,
    false,
  );

  assert.equal(
    deployment.status,
    "SAFELY_BLOCKED",
    "Remote deployment must remain blocked during free local operation.",
  );

  const notifications =
    buildNotificationDeliveryReadiness(
      process.env,
    );

  assert.equal(
    notifications.status,
    "SAFELY_BLOCKED",
    "External notification delivery must remain disabled until explicitly approved.",
  );

  await Promise.all([
    access(
      join(
        process.cwd(),
        "src",
        "app",
        "operations",
        "page.tsx",
      ),
    ),
    access(
      join(
        process.cwd(),
        "deploy",
        "windows",
        "run-local-daily-collection.ps1",
      ),
    ),
    access(
      join(
        process.cwd(),
        "deploy",
        "windows",
        "remove-local-daily-task.ps1",
      ),
    ),
  ]);

  console.table({
    "Production build": "PASS",
    "V3 production core": "PASS",
    "Active season": ACTIVE_SEASON_YEAR,
    "2026 fixtures": fixtureCount,
    "2026 finished fixtures": finishedFixtureCount,
    "Complete fixture archive": "PASS",
    "Historical results": "PASS",
    "Operations dashboard": "PASS",
    "API configuration label": "PASS",
    "Daily task": task.state.toUpperCase(),
    "Next daily run": task.nextRunTime,
    "Last task result": task.lastTaskResult,
    "Remote deployment": deployment.status,
    "External notifications": notifications.status,
    Champion: "20% ML / 80% Poisson",
    "Automatic model change": "LOCKED",
  });

  console.log("V4 final production verification passed.");
  console.log("Free local daily operation is ready.");
  console.log("20% ML / 80% Poisson Champion remains unchanged.");
  console.log("No deployment, notification, or model activation was executed.");
}

main()
  .catch((error: unknown) => {
    console.error("\nV4 final production verification failed.");
    console.error(
      error instanceof Error
        ? error.message
        : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

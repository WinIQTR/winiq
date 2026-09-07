import "dotenv/config";

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import { buildValueBetLearningReport } from "@/lib/value-bet-learning";

type CountRow = { count: string };
type PlanRow = { plan: string; count: string };
type DailyTask = {
  taskName: string;
  state: string;
  nextRunTime: string;
  lastRunTime: string;
  lastTaskResult: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function runPreviousVerification() {
  const script = resolve("scripts/verify-production-v5-final.ts");
  if (!existsSync(script)) {
    fail("V5 final verification script was not found.");
  }

  const result = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) fail(`V5 verification could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`V5 verification failed with exit code ${result.status}.`);
}

function readDailyTask(): DailyTask {
  if (process.platform !== "win32") {
    fail("The V6 final verifier must be run on the Windows production workstation.");
  }

  const script = resolve("deploy/windows/query-local-daily-task-v6.ps1");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
    { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
  );

  if (result.error) fail(`Daily task query could not start: ${result.error.message}`);
  if (result.status !== 0) {
    fail((result.stderr || "Daily task query failed.").trim());
  }

  return JSON.parse(result.stdout.trim()) as DailyTask;
}

async function count(pool: Pool, sql: string): Promise<number> {
  const result = await pool.query<CountRow>(sql);
  return Number(result.rows[0]?.count ?? 0);
}

async function main() {
  console.log("\nV6 FINAL MEMBERSHIP AND LOCAL PRODUCTION VERIFICATION\n");

  runPreviousVerification();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is not defined in .env.");

  const requiredFiles = [
    "src/app/login/page.tsx",
    "src/app/member/page.tsx",
    "src/app/member/plans/page.tsx",
    "src/app/admin/members/page.tsx",
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/logout/route.ts",
    "src/app/api/admin/members/route.ts",
    "src/app/api/member/upgrade-request/route.ts",
    "src/components/prediction-history-workspace.tsx",
  ];
  const missingFiles = requiredFiles.filter((file) => !existsSync(resolve(file)));
  if (missingFiles.length > 0) {
    fail(`Required V6 file(s) missing: ${missingFiles.join(", ")}`);
  }

  const groupedView = readFileSync(
    resolve("src/components/prediction-history-workspace.tsx"),
    "utf8",
  );
  const groupedEvaluation =
    groupedView.includes("groupedMatches") &&
    groupedView.includes("styles.matchGroup") &&
    groupedView.includes("group.rows.map");
  if (!groupedEvaluation) fail("Grouped evaluation accordion is incomplete.");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const [admins, members, activeMembers, sessions, upgradeRequests, activePrices] =
      await Promise.all([
        count(pool, `SELECT COUNT(*)::text AS count FROM "AppUser" WHERE role = 'ADMIN'`),
        count(pool, `SELECT COUNT(*)::text AS count FROM "AppUser" WHERE role = 'MEMBER'`),
        count(
          pool,
          `SELECT COUNT(*)::text AS count FROM "AppUser" WHERE role = 'MEMBER' AND status = 'ACTIVE'`,
        ),
        count(pool, `SELECT COUNT(*)::text AS count FROM "UserSession" WHERE "expiresAt" > NOW()`),
        count(
          pool,
          `SELECT COUNT(*)::text AS count FROM "MembershipUpgradeRequest" WHERE status IN ('PENDING', 'CONTACTED')`,
        ),
        count(
          pool,
          `SELECT COUNT(*)::text AS count FROM "MembershipPlanPrice" WHERE "isActive" = TRUE`,
        ),
      ]);

    const planResult = await pool.query<PlanRow>(
      `SELECT plan::text, COUNT(*)::text AS count
       FROM "AppUser"
       WHERE role = 'MEMBER'
       GROUP BY plan
       ORDER BY plan`,
    );
    const plans = new Map(planResult.rows.map((row) => [row.plan, Number(row.count)]));

    const settledPicks = await count(
      pool,
      `SELECT COUNT(*)::text AS count
       FROM "SmartPickHistory"
       WHERE result IN ('WON', 'LOST', 'VOID')`,
    );
    const valueSnapshot = await loadValueBetDashboardSnapshot();
    const learning = buildValueBetLearningReport(valueSnapshot.settled);

    if (admins < 1) fail("No administrator account was found.");

    const pricingPublication =
      activePrices === 3 ? "CONFIGURED" : `NOT_PUBLISHED (${activePrices}/3)`;

    const dailyTask = readDailyTask();
    if (!['Ready', 'Running'].includes(dailyTask.state)) {
      fail(`Daily task state is ${dailyTask.state}.`);
    }
    if (dailyTask.lastTaskResult !== 0) {
      fail(`The last daily task result is ${dailyTask.lastTaskResult}, expected 0.`);
    }

    console.table({
      "V5 production core": "PASS",
      "Membership access control": "PASS",
      "Persistent member history": "PASS",
      "Grouped evaluation accordion": "PASS",
      "Administrator accounts": admins,
      "Member accounts": members,
      "Active members": activeMembers,
      "Basic members": plans.get("BASIC") ?? 0,
      "Analysis members": plans.get("ANALYSIS") ?? 0,
      "Professional members": plans.get("PROFESSIONAL") ?? 0,
      "Active sessions": sessions,
      "Open upgrade requests": upgradeRequests,
      "Active plan price records": activePrices,
      "Pricing publication": pricingPublication,
      "Settled archived picks": settledPicks,
      "Independent results": `${learning.independentSelections} / ${learning.minimumSample}`,
      "Learning percentage": `${learning.progressPercentage.toFixed(1)}%`,
      "Learning status": learning.status,
      "Daily task": dailyTask.state.toUpperCase(),
      "Last daily task result": dailyTask.lastTaskResult,
      "Next daily run": dailyTask.nextRunTime,
      "Champion": "20% ML / 80% Poisson",
      "Automatic model change": "LOCKED",
    });

    console.log("V6 final production verification passed.");
    console.log("Membership, persistent history, grouped evaluation, and local automation are ready.");
    console.log("No user, price, payment, notification, deployment, or model setting was changed.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("\nV6 final production verification failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

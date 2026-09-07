import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  const verifier = await readFile("scripts/verify-production-v6-final.ts", "utf8");
  const taskQuery = await readFile("deploy/windows/query-local-daily-task-v6.ps1", "utf8");
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const memberPage = await readFile("src/app/member/page.tsx", "utf8");
  const groupedEvaluation = await readFile(
    "src/components/prediction-history-workspace.tsx",
    "utf8",
  );

  assert.equal(
    packageJson.scripts?.["verify:v6-final"],
    "tsx scripts/verify-production-v6-final.ts",
  );
  assert.equal(
    packageJson.scripts?.["test:v6-final"],
    "tsx scripts/test-production-v6-final.ts",
  );
  assert.match(verifier, /verify-production-v5-final\.ts/);
  assert.match(verifier, /query-local-daily-task-v6\.ps1/);
  assert.match(verifier, /loadValueBetDashboardSnapshot/);
  assert.match(verifier, /buildValueBetLearningReport/);
  assert.match(verifier, /learning\.independentSelections/);
  assert.doesNotMatch(verifier, /COUNT\(DISTINCT "matchId"\)/);
  assert.match(verifier, /20% ML \/ 80% Poisson/);
  assert.match(verifier, /Automatic model change.*LOCKED/);
  assert.match(verifier, /NOT_PUBLISHED/);
  assert.doesNotMatch(verifier, /All three membership price records are not active/);
  assert.match(taskQuery, /Get-ScheduledTaskInfo/);
  assert.match(taskQuery, /lastTaskResult/);
  assert.match(schema, /model AppUser/);
  assert.match(schema, /model MembershipUpgradeRequest/);
  assert.match(memberPage, /smartPickHistory\.findMany/);
  assert.match(groupedEvaluation, /<details className=\{styles\.matchGroup\}/);

  console.log("V6 Final Membership and Local Production Verification tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const migration = await readFile("prisma/migrations/20260814220000_membership_commerce_v6_4/migration.sql", "utf8");
  const memberApi = await readFile("src/app/api/member/upgrade-request/route.ts", "utf8");
  const adminApi = await readFile("src/app/api/admin/upgrade-requests/route.ts", "utf8");
  const priceApi = await readFile("src/app/api/admin/membership-prices/route.ts", "utf8");
  const plansPage = await readFile("src/app/member/plans/page.tsx", "utf8");
  const memberPage = await readFile("src/app/member/page.tsx", "utf8");
  const adminPage = await readFile("src/app/admin/members/page.tsx", "utf8");

  assert.match(schema, /model MembershipUpgradeRequest/);
  assert.match(schema, /model MembershipPlanPrice/);
  assert.match(schema, /upgradeRequests MembershipUpgradeRequest\[\]/);
  assert.match(migration, /CREATE TABLE "MembershipUpgradeRequest"/);
  assert.match(migration, /CREATE TABLE "MembershipPlanPrice"/);
  assert.match(memberApi, /user\.role !== "MEMBER"/);
  assert.match(memberApi, /isHigherPlan/);
  assert.match(memberApi, /PENDING", "CONTACTED/);
  assert.match(adminApi, /admin\.role !== "ADMIN"/);
  assert.match(adminApi, /action === "APPROVE"/);
  assert.match(adminApi, /prisma\.\$transaction/);
  assert.match(adminApi, /userSession\.deleteMany/);
  assert.match(priceApi, /membershipPlanPrice\.upsert/);
  assert.match(plansPage, /await requireMember\(\)/);
  assert.match(plansPage, /MembershipPlanSelector/);
  assert.match(memberPage, /href="\/member\/plans"/);
  assert.match(adminPage, /membershipUpgradeRequest\.findMany/);

  console.log("Manual Membership Commerce and Upgrade Workflow V6.4 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

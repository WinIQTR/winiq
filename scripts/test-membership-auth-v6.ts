import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth-password";
import { hasMembershipPermission, isMembershipActive } from "@/lib/membership-access";

async function main() {
  const password = "GüvenliTest2026";
  const encoded = await hashPassword(password);

  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("YanlisTest2026", encoded), false);
  assert.ok(validatePasswordStrength("zayıf").length > 0);

  assert.equal(hasMembershipPermission("BASIC", "DAILY_PICKS"), true);
  assert.equal(hasMembershipPermission("BASIC", "RESULT_HISTORY"), false);
  assert.equal(hasMembershipPermission("ANALYSIS", "RESULT_HISTORY"), true);
  assert.equal(hasMembershipPermission("ANALYSIS", "VALUE_BETS"), false);
  assert.equal(hasMembershipPermission("PROFESSIONAL", "FULL_ANALYTICS"), true);
  assert.equal(isMembershipActive("SUSPENDED", null), false);
  assert.equal(isMembershipActive("ACTIVE", new Date(Date.now() - 1_000)), false);
  assert.equal(isMembershipActive("ACTIVE", new Date(Date.now() + 60_000)), true);

  const sessionSource = await readFile("src/lib/auth-session.ts", "utf8");
  const loginSource = await readFile("src/app/api/auth/login/route.ts", "utf8");
  const memberSource = await readFile("src/app/member/page.tsx", "utf8");
  const pageShellSource = await readFile("src/components/page-shell.tsx", "utf8");
  const schemaSource = await readFile("prisma/schema.prisma", "utf8");
  const protectedRoutes = [
    "src/app/api/admin/import/fixtures/route.ts",
    "src/app/api/admin/import/league/route.ts",
    "src/app/api/admin/import/teams/route.ts",
    "src/app/api/evaluation/route.ts",
    "src/app/api/football/status/route.ts",
  ];

  assert.match(sessionSource, /httpOnly:\s*true/);
  assert.match(sessionSource, /sameSite:\s*"lax"/);
  assert.match(sessionSource, /NODE_ENV === "production"/);
  assert.match(sessionSource, /createHash\("sha256"\)/);
  assert.match(loginSource, /MAXIMUM_FAILED_ATTEMPTS = 5/);
  assert.match(loginSource, /DUMMY_PASSWORD_HASH/);
  assert.match(loginSource, /membershipEndsAt/);
  assert.match(memberSource, /dateKey\(item\.kickoffAt\) === today/);
  assert.match(memberSource, /requireMember/);
  assert.match(pageShellSource, /requireAdmin/);
  assert.match(schemaSource, /model AppUser/);
  assert.match(schemaSource, /model UserSession/);
  assert.doesNotMatch(loginSource, /register|sign.?up/i);

  for (const route of protectedRoutes) {
    assert.match(await readFile(route, "utf8"), /user\?\.role !== "ADMIN"/);
  }

  console.log("Membership, Authentication and Access Control V6.1 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

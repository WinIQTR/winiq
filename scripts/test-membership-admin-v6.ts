import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const api = await readFile("src/app/api/admin/members/route.ts", "utf8");
  const page = await readFile("src/app/admin/members/page.tsx", "utf8");
  const manager = await readFile("src/components/admin-members-manager.tsx", "utf8");
  const memberPage = await readFile("src/app/member/page.tsx", "utf8");
  const sidebar = await readFile("src/components/app-sidebar.tsx", "utf8");

  assert.match(api, /user\?\.role === "ADMIN"/);
  assert.match(api, /role: "MEMBER"/);
  assert.match(api, /REVOKE_SESSIONS/);
  assert.match(api, /RESET_PASSWORD/);
  assert.match(api, /UPDATE_ACCESS/);
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /where: \{ role: "MEMBER" \}/);
  assert.doesNotMatch(page, /passwordHash:\s*true/);
  assert.match(manager, /Açık kayıt yoktur/);
  assert.match(memberPage, /user\.plan !== "BASIC"/);
  assert.match(memberPage, /user\.plan === "PROFESSIONAL"/);
  assert.match(memberPage, /recentHistory/);
  assert.match(sidebar, /\/admin\/members/);
  assert.match(sidebar, /LogoutButton/);

  console.log("Membership Administration and Tiered Member Views V6.2 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

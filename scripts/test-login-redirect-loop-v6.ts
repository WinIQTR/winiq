import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const loginPage = await readFile("src/app/login/page.tsx", "utf8");
  const globalLoading = await readFile("src/app/loading.tsx", "utf8");
  const loginApi = await readFile("src/app/api/auth/login/route.ts", "utf8");

  assert.doesNotMatch(loginPage, /redirect\s*\(/);
  assert.doesNotMatch(loginPage, /getCurrentUser/);
  assert.match(loginPage, /<LoginForm/);
  assert.match(loginApi, /destination:/);
  assert.doesNotMatch(globalLoading, /PageShell/);
  assert.doesNotMatch(globalLoading, /requireAdmin/);

  console.log("Login and Global Loading Redirect Loop Prevention V6.1.3 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

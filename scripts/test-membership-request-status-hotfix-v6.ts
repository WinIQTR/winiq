import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const manager = await readFile("src/components/admin-members-manager.tsx", "utf8");
  const page = await readFile("src/app/admin/members/page.tsx", "utf8");

  assert.match(
    manager,
    /status: "PENDING" \| "CONTACTED" \| "APPROVED" \| "REJECTED"/,
  );
  assert.match(page, /status: \{ in: \["PENDING", "CONTACTED"\] \}/);
  assert.match(page, /upgradeRequests\.map/);

  console.log("Membership Upgrade Request Status V6.4.1 hotfix tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";

import { buildRemoteReadinessReport } from "@/lib/remote-readiness";

const secret = "api-secret-that-must-never-appear";
const password = "database-password-that-must-never-appear";
const ready = buildRemoteReadinessReport({
  NODE_ENV: "production",
  APP_BASE_URL: "https://bets.example.com",
  DATABASE_URL: `postgresql://bet_user:${password}@db.example.com:5432/bet_project?sslmode=require`,
  API_FOOTBALL_KEY: secret,
  PRODUCTION_DATA_ROOT: "D:\\bet-project-production-data",
});

assert.equal(ready.status, "REMOTE_READY");
assert.equal(ready.blocked, 0);
assert.equal(ready.deploymentActivationAllowed, true);
assert.equal(ready.automaticModelChangeAllowed, false);
assert.doesNotMatch(JSON.stringify(ready), new RegExp(secret));
assert.doesNotMatch(JSON.stringify(ready), new RegExp(password));

const blocked = buildRemoteReadinessReport({
  NODE_ENV: "development",
  APP_BASE_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://local:local@localhost:5432/bet_project",
  API_FOOTBALL_KEY: "",
  PRODUCTION_DATA_ROOT: "relative-data",
});

assert.equal(blocked.status, "SAFELY_BLOCKED");
assert.equal(blocked.blocked, 5);
assert.equal(blocked.deploymentActivationAllowed, false);
assert.equal(blocked.automaticModelChangeAllowed, false);

console.log("Remote and Online Readiness V3.4 tests passed.");

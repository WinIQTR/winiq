import assert from "node:assert/strict";

import { buildProductionDeploymentGate } from "../src/lib/production-deployment-gate";

const secret = "football-secret-never-output";
const password = "database-password-never-output";
const approved = buildProductionDeploymentGate({
  NODE_ENV: "production",
  APP_BASE_URL: "https://bets.example.test",
  DATABASE_URL: `postgresql://bet_user:${password}@db.example.test:5432/bet_project?sslmode=require`,
  API_FOOTBALL_KEY: secret,
  PRODUCTION_DATA_ROOT: "/srv/bet-project/data",
  PRODUCTION_DEPLOYMENT_PROVIDER: "SELF_HOSTED",
  PRODUCTION_DEPLOYMENT_APPROVED: "true",
  PRODUCTION_DEPLOYMENT_APPROVAL_ID: "DEPLOY-20260814-ABC123",
  PRODUCTION_RELEASE_ID: "V4.3-PROD001",
  PRODUCTION_ROLLBACK_CONFIRMED: "true",
  PRODUCTION_POST_DEPLOY_HEALTH_CHECK: "true",
});
assert.equal(approved.status, "APPROVED_TO_DEPLOY");
assert.equal(approved.blocked, 0);
assert.equal(approved.deploymentExecutionAllowed, true);
assert.equal(approved.production.automaticModelChangeAllowed, false);
assert.doesNotMatch(JSON.stringify(approved), new RegExp(secret));
assert.doesNotMatch(JSON.stringify(approved), new RegExp(password));

const local = buildProductionDeploymentGate({
  NODE_ENV: "development",
  APP_BASE_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://local:local@localhost:5432/bet_project",
  API_FOOTBALL_KEY: "",
  PRODUCTION_DATA_ROOT: "relative-data",
});
assert.equal(local.status, "SAFELY_BLOCKED");
assert.equal(local.deploymentExecutionAllowed, false);
assert.equal(local.blocked, 8);

const serverless = buildProductionDeploymentGate({
  NODE_ENV: "production",
  APP_BASE_URL: "https://bets.example.test",
  DATABASE_URL: "postgresql://user:pass@db.example.test:5432/bet_project?sslmode=require",
  API_FOOTBALL_KEY: "configured",
  PRODUCTION_DATA_ROOT: "/tmp/data",
  PRODUCTION_DEPLOYMENT_PROVIDER: "VERCEL",
  PRODUCTION_DEPLOYMENT_APPROVED: "true",
  PRODUCTION_DEPLOYMENT_APPROVAL_ID: "DEPLOY-20260814-ABC123",
  PRODUCTION_RELEASE_ID: "V4.3-PROD001",
  PRODUCTION_ROLLBACK_CONFIRMED: "true",
  PRODUCTION_POST_DEPLOY_HEALTH_CHECK: "true",
});
assert.equal(serverless.status, "SAFELY_BLOCKED");
assert.equal(
  serverless.checks.find((item) => item.key === "SUPPORTED_STORAGE")?.status,
  "BLOCKED",
);

console.log("Controlled Production Deployment Gate V4.3 tests passed.");

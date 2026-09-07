import "dotenv/config";

import { buildProductionDeploymentGate } from "../src/lib/production-deployment-gate";

const gate = buildProductionDeploymentGate(process.env);

console.log("\nV4.3 CONTROLLED PRODUCTION DEPLOYMENT GATE\n");
console.table(gate.checks.map((item) => ({
  Check: item.label,
  Status: item.status,
  Detail: item.message,
})));
console.table({
  Status: gate.status,
  Passed: gate.passed,
  Blocked: gate.blocked,
  Provider: gate.provider ?? "NOT_SELECTED",
  "Release ID": gate.releaseId ?? "NOT_SET",
  "Approval ID": gate.approvalId ?? "NOT_SET",
  "Deployment execution": gate.deploymentExecutionAllowed ? "ALLOWED" : "BLOCKED",
  Champion: gate.production.champion,
  "Model auto-change": gate.production.automaticModelChangeAllowed ? "FAIL" : "LOCKED",
});

if (gate.status === "SAFELY_BLOCKED") {
  console.log("No deployment was executed. Production activation remains safely blocked.");
} else {
  console.log("All deployment gates passed. This audit command still performs no deployment.");
}

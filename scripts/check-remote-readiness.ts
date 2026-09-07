import "dotenv/config";

import { buildRemoteReadinessReport } from "@/lib/remote-readiness";

const report = buildRemoteReadinessReport(process.env);

console.log("\nREMOTE / ONLINE READINESS AUDIT\n");
console.table(
  report.checks.map((item) => ({
    Check: item.label,
    Status: item.status,
    Detail: item.message,
  })),
);
console.table({
  Status: report.status,
  Passed: report.passed,
  Blocked: report.blocked,
  "Deployment activation": report.deploymentActivationAllowed ? "ALLOWED" : "BLOCKED",
  Champion: report.champion,
  "Model auto-change": report.automaticModelChangeAllowed ? "FAIL" : "LOCKED",
});

if (report.status === "SAFELY_BLOCKED") {
  console.log("Local development can continue. Remote activation remains safely blocked.");
} else {
  console.log("Remote environment gates passed. Deployment still requires explicit approval.");
}

import {
  buildRemoteReadinessReport,
  type RemoteReadinessReport,
} from "./remote-readiness";

export type DeploymentProvider = "SELF_HOSTED" | "VERCEL" | "CLOUDFLARE";

export type DeploymentGateCheck = {
  key: string;
  label: string;
  status: "PASS" | "BLOCKED";
  message: string;
};

export type ProductionDeploymentGate = {
  status: "APPROVED_TO_DEPLOY" | "SAFELY_BLOCKED";
  provider: DeploymentProvider | null;
  releaseId: string | null;
  approvalId: string | null;
  checks: DeploymentGateCheck[];
  passed: number;
  blocked: number;
  deploymentExecutionAllowed: boolean;
  remoteReadiness: RemoteReadinessReport["status"];
  production: {
    champion: "20% ML / 80% Poisson";
    automaticModelChangeAllowed: false;
    rollbackRequired: true;
    healthCheckRequired: true;
  };
};

type Environment = Readonly<Record<string, string | undefined>>;

function check(
  key: string,
  label: string,
  passed: boolean,
  successMessage: string,
  blockedMessage: string,
): DeploymentGateCheck {
  return {
    key,
    label,
    status: passed ? "PASS" : "BLOCKED",
    message: passed ? successMessage : blockedMessage,
  };
}

function provider(value: string | undefined): DeploymentProvider | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === "SELF_HOSTED" ||
    normalized === "VERCEL" ||
    normalized === "CLOUDFLARE"
    ? normalized
    : null;
}

function validApprovalId(value: string | undefined): boolean {
  return /^DEPLOY-\d{8}-[A-Z0-9]{6,32}$/.test(value?.trim() ?? "");
}

function validReleaseId(value: string | undefined): boolean {
  return /^V4\.[0-9]+-[A-Z0-9][A-Z0-9._-]{5,63}$/.test(
    value?.trim().toUpperCase() ?? "",
  );
}

export function buildProductionDeploymentGate(
  environment: Environment,
): ProductionDeploymentGate {
  const remote = buildRemoteReadinessReport(environment);
  const selectedProvider = provider(environment.PRODUCTION_DEPLOYMENT_PROVIDER);
  const selfHosted = selectedProvider === "SELF_HOSTED";
  const explicitlyApproved =
    environment.PRODUCTION_DEPLOYMENT_APPROVED?.trim().toLowerCase() === "true";
  const approvalId = environment.PRODUCTION_DEPLOYMENT_APPROVAL_ID?.trim() || null;
  const releaseId = environment.PRODUCTION_RELEASE_ID?.trim().toUpperCase() || null;
  const rollbackConfirmed =
    environment.PRODUCTION_ROLLBACK_CONFIRMED?.trim().toLowerCase() === "true";
  const healthCheckConfirmed =
    environment.PRODUCTION_POST_DEPLOY_HEALTH_CHECK?.trim().toLowerCase() === "true";

  const checks: DeploymentGateCheck[] = [
    check(
      "REMOTE_READINESS",
      "Remote environment",
      remote.status === "REMOTE_READY",
      "All remote runtime checks passed.",
      `${remote.blocked} remote runtime check(s) remain blocked.`,
    ),
    check(
      "DEPLOYMENT_PROVIDER",
      "Deployment provider",
      selectedProvider !== null,
      `Deployment provider is ${selectedProvider ?? "configured"}.`,
      "Choose an explicit deployment provider.",
    ),
    check(
      "SUPPORTED_STORAGE",
      "Persistent storage compatibility",
      selfHosted,
      "Self-hosted persistent filesystem is compatible with current operations.",
      selectedProvider === "VERCEL" || selectedProvider === "CLOUDFLARE"
        ? "Current backup/report jobs require persistent filesystem support; serverless activation is blocked."
        : "Select SELF_HOSTED for the current persistent filesystem architecture.",
    ),
    check(
      "EXPLICIT_APPROVAL",
      "Explicit production approval",
      explicitlyApproved,
      "Explicit deployment approval is present.",
      "Production deployment approval is absent.",
    ),
    check(
      "APPROVAL_ID",
      "Approval identifier",
      validApprovalId(approvalId ?? undefined),
      "A valid, traceable approval identifier is present.",
      "Use an approval id such as DEPLOY-20260814-ABC123.",
    ),
    check(
      "RELEASE_ID",
      "Immutable release identifier",
      validReleaseId(releaseId ?? undefined),
      "An immutable V4 release identifier is present.",
      "Use a release id such as V4.3-PROD001.",
    ),
    check(
      "ROLLBACK",
      "Rollback confirmation",
      rollbackConfirmed,
      "A verified rollback path was confirmed.",
      "Verify the backup and explicitly confirm the rollback path.",
    ),
    check(
      "POST_DEPLOY_HEALTH",
      "Post-deploy health verification",
      healthCheckConfirmed,
      "Post-deploy health verification was confirmed.",
      "Require /api/health and V3 final verification after deployment.",
    ),
  ];
  const blocked = checks.filter((item) => item.status === "BLOCKED").length;
  const status = blocked === 0 ? "APPROVED_TO_DEPLOY" : "SAFELY_BLOCKED";

  return {
    status,
    provider: selectedProvider,
    releaseId,
    approvalId,
    checks,
    passed: checks.length - blocked,
    blocked,
    deploymentExecutionAllowed: status === "APPROVED_TO_DEPLOY",
    remoteReadiness: remote.status,
    production: {
      champion: "20% ML / 80% Poisson",
      automaticModelChangeAllowed: false,
      rollbackRequired: true,
      healthCheckRequired: true,
    },
  };
}

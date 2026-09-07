import { isAbsolute, win32 } from "node:path";

export type RemoteReadinessCheck = {
  key: string;
  label: string;
  status: "PASS" | "BLOCKED";
  message: string;
};

export type RemoteReadinessReport = {
  status: "REMOTE_READY" | "SAFELY_BLOCKED";
  checks: RemoteReadinessCheck[];
  passed: number;
  blocked: number;
  deploymentActivationAllowed: boolean;
  automaticModelChangeAllowed: false;
  champion: "20% ML / 80% Poisson";
};

type Environment = Readonly<Record<string, string | undefined>>;

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);

function check(
  key: string,
  label: string,
  passed: boolean,
  successMessage: string,
  blockedMessage: string,
): RemoteReadinessCheck {
  return {
    key,
    label,
    status: passed ? "PASS" : "BLOCKED",
    message: passed ? successMessage : blockedMessage,
  };
}

function validPublicHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function validRemoteDatabase(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    return (
      ["postgresql:", "postgres:"].includes(parsed.protocol) &&
      !LOCAL_HOSTS.has(parsed.hostname.toLowerCase()) &&
      ["require", "verify-ca", "verify-full"].includes(sslMode ?? "")
    );
  } catch {
    return false;
  }
}

function validPersistentRoot(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return isAbsolute(value) || win32.isAbsolute(value);
}

export function buildRemoteReadinessReport(
  environment: Environment,
): RemoteReadinessReport {
  const checks: RemoteReadinessCheck[] = [
    check(
      "NODE_ENV",
      "Production runtime",
      environment.NODE_ENV === "production",
      "NODE_ENV is production.",
      "Set NODE_ENV=production only on the remote production runtime.",
    ),
    check(
      "APP_BASE_URL",
      "Public HTTPS URL",
      validPublicHttpsUrl(environment.APP_BASE_URL?.trim()),
      "A non-local HTTPS application URL is configured.",
      "Configure APP_BASE_URL with the final public https:// address.",
    ),
    check(
      "DATABASE_URL",
      "Remote PostgreSQL TLS",
      validRemoteDatabase(environment.DATABASE_URL?.trim()),
      "A non-local PostgreSQL URL with required TLS is configured.",
      "Use a remote PostgreSQL URL with sslmode=require or stronger.",
    ),
    check(
      "API_FOOTBALL_KEY",
      "Football data credential",
      Boolean(environment.API_FOOTBALL_KEY?.trim()),
      "The API credential is configured and remains redacted.",
      "Configure API_FOOTBALL_KEY in the remote secret store.",
    ),
    check(
      "PRODUCTION_DATA_ROOT",
      "Persistent production storage",
      validPersistentRoot(environment.PRODUCTION_DATA_ROOT?.trim()),
      "An absolute persistent data root is configured.",
      "Configure an absolute persistent PRODUCTION_DATA_ROOT outside temporary storage.",
    ),
  ];
  const blocked = checks.filter((item) => item.status === "BLOCKED").length;
  const status = blocked === 0 ? "REMOTE_READY" : "SAFELY_BLOCKED";

  return {
    status,
    checks,
    passed: checks.length - blocked,
    blocked,
    deploymentActivationAllowed: status === "REMOTE_READY",
    automaticModelChangeAllowed: false,
    champion: "20% ML / 80% Poisson",
  };
}

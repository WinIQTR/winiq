import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const BACKUP_ROOT = join(process.cwd(), "backups", "production");
const DAILY_REPORT_ROOT = join(process.cwd(), "reports", "production", "daily");
const WEEKLY_REPORT_ROOT = join(process.cwd(), "reports", "production", "weekly");
const HEALTH_STATE_PATH = join(
  process.cwd(),
  "data",
  "operations",
  "model-health-state.json",
);
const HEALTH_LOG_PATH = join(
  process.cwd(),
  "logs",
  "production",
  "model-health-events.jsonl",
);
const NOTIFICATION_ROOT = join(process.cwd(), "notifications", "production");

type JsonRecord = Record<string, unknown>;

export type OperationsBackup = {
  available: boolean;
  id: string | null;
  createdAt: string | null;
  fileCount: number;
  totalBytes: number;
  databaseFormat: string | null;
  secretsIncluded: boolean;
};

export type OperationsReport = {
  available: boolean;
  kind: "DAILY" | "WEEKLY";
  key: string | null;
  generatedAt: string | null;
  settled: number;
  roi: number | null;
  modelHealth: string | null;
};

export type OperationsHealthState = {
  available: boolean;
  currentLevel: "HEALTHY" | "WARNING" | "CRITICAL" | null;
  lastObservedAt: string | null;
  lastNotifiedAt: string | null;
  notificationCount: number;
};

export type OperationsHealthEvent = {
  observedAt: string;
  level: string;
  reason: string;
  notificationCreated: boolean;
  independentSelections: number | null;
};

export type OperationsNotification = {
  createdAt: string;
  severity: string;
  reason: string;
  title: string;
  acknowledged: boolean;
  deliveryStatus: string | null;
  deliveryChannel: string | null;
  deliveredAt: string | null;
};

export type ProductionOperationsDashboard = {
  generatedAt: string;
  backup: OperationsBackup;
  dailyReport: OperationsReport;
  weeklyReport: OperationsReport;
  health: OperationsHealthState;
  recentHealthEvents: OperationsHealthEvent[];
  notifications: OperationsNotification[];
  production: {
    champion: "20% ML / 80% Poisson";
    automaticModelChangeAllowed: false;
    readOnly: true;
    remoteActivationAllowed: false;
  };
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function healthLevel(
  value: unknown,
): "HEALTHY" | "WARNING" | "CRITICAL" | null {
  return value === "HEALTHY" || value === "WARNING" || value === "CRITICAL"
    ? value
    : null;
}

export function parseBackupManifest(
  raw: unknown,
  id: string,
): OperationsBackup {
  const source = record(raw);
  const files = Array.isArray(source?.files) ? source.files : [];
  const totalBytes = files.reduce((total, value) => {
    const file = record(value);
    return total + (number(file?.sizeBytes) ?? 0);
  }, 0);

  return {
    available: source?.schemaVersion === 1 && files.length > 0,
    id,
    createdAt: text(source?.createdAt),
    fileCount: files.length,
    totalBytes,
    databaseFormat: text(source?.databaseFormat),
    secretsIncluded: boolean(source?.secretsIncluded) ?? false,
  };
}

export function emptyReport(kind: "DAILY" | "WEEKLY"): OperationsReport {
  return {
    available: false,
    kind,
    key: null,
    generatedAt: null,
    settled: 0,
    roi: null,
    modelHealth: null,
  };
}

export function parseProductionReport(
  raw: unknown,
  kind: "DAILY" | "WEEKLY",
): OperationsReport {
  const source = record(raw);
  const period = record(source?.period);
  const settled = record(source?.settled);
  const modelHealth = record(source?.modelHealth);
  const sourceKind = text(period?.kind);

  return {
    available: source?.schemaVersion === 1 && sourceKind === kind,
    kind,
    key: text(period?.key),
    generatedAt: text(source?.generatedAt),
    settled: number(settled?.settled) ?? 0,
    roi: number(settled?.roi),
    modelHealth: text(modelHealth?.overallLevel),
  };
}

export function parseHealthState(raw: unknown): OperationsHealthState {
  const source = record(raw);
  const level = healthLevel(source?.currentLevel);
  return {
    available: source?.schemaVersion === 1 && level !== null,
    currentLevel: level,
    lastObservedAt: text(source?.lastObservedAt),
    lastNotifiedAt: text(source?.lastNotifiedAt),
    notificationCount: number(source?.notificationCount) ?? 0,
  };
}

export function parseHealthEvent(raw: unknown): OperationsHealthEvent | null {
  const source = record(raw);
  const observedAt = text(source?.observedAt);
  const level = text(source?.level);
  const reason = text(source?.reason);
  const metrics = record(source?.metrics);
  if (!observedAt || !level || !reason) return null;

  return {
    observedAt,
    level,
    reason,
    notificationCreated: boolean(source?.notificationCreated) ?? false,
    independentSelections: number(metrics?.independentSelections),
  };
}

export function parseNotification(raw: unknown): OperationsNotification | null {
  const source = record(raw);
  const delivery = record(source?.delivery);
  const createdAt = text(source?.createdAt);
  const severity = text(source?.severity);
  const reason = text(source?.reason);
  const title = text(source?.title);
  if (!createdAt || !severity || !reason || !title) return null;

  return {
    createdAt,
    severity,
    reason,
    title,
    acknowledged: boolean(source?.acknowledged) ?? false,
    deliveryStatus: text(delivery?.status),
    deliveryChannel: text(delivery?.channel),
    deliveredAt: text(delivery?.deliveredAt),
  };
}

async function names(
  directory: string,
  predicate: (name: string) => boolean,
): Promise<string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && predicate(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch (error: unknown) {
    if (record(error)?.code === "ENOENT") return [];
    throw error;
  }
}

async function directoryNames(
  directory: string,
  predicate: (name: string) => boolean,
): Promise<string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && predicate(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch (error: unknown) {
    if (record(error)?.code === "ENOENT") return [];
    throw error;
  }
}

async function latestBackup(): Promise<OperationsBackup> {
  const candidates = await directoryNames(
    BACKUP_ROOT,
    (name) => /^\d{8}T\d{6}Z$/.test(name),
  );
  for (const id of candidates) {
    try {
      const raw = JSON.parse(
        await readFile(join(BACKUP_ROOT, id, "manifest.json"), "utf8"),
      ) as unknown;
      const parsed = parseBackupManifest(raw, id);
      if (parsed.available) return parsed;
    } catch (error: unknown) {
      if (record(error)?.code !== "ENOENT" && !(error instanceof SyntaxError)) {
        throw error;
      }
    }
  }
  return {
    available: false,
    id: null,
    createdAt: null,
    fileCount: 0,
    totalBytes: 0,
    databaseFormat: null,
    secretsIncluded: false,
  };
}

async function latestReport(
  kind: "DAILY" | "WEEKLY",
): Promise<OperationsReport> {
  const root = kind === "DAILY" ? DAILY_REPORT_ROOT : WEEKLY_REPORT_ROOT;
  const files = await names(root, (name) => name.endsWith(".json"));
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(join(root, file), "utf8")) as unknown;
      const parsed = parseProductionReport(raw, kind);
      if (parsed.available) return parsed;
    } catch (error: unknown) {
      if (record(error)?.code !== "ENOENT" && !(error instanceof SyntaxError)) {
        throw error;
      }
    }
  }
  return emptyReport(kind);
}

async function currentHealth(): Promise<OperationsHealthState> {
  try {
    return parseHealthState(
      JSON.parse(await readFile(HEALTH_STATE_PATH, "utf8")) as unknown,
    );
  } catch (error: unknown) {
    if (record(error)?.code !== "ENOENT" && !(error instanceof SyntaxError)) {
      throw error;
    }
    return parseHealthState(null);
  }
}

async function recentHealthEvents(): Promise<OperationsHealthEvent[]> {
  try {
    const rows = (await readFile(HEALTH_LOG_PATH, "utf8"))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return parseHealthEvent(JSON.parse(line) as unknown);
        } catch {
          return null;
        }
      })
      .filter((value): value is OperationsHealthEvent => value !== null);
    return rows.slice(-10).reverse();
  } catch (error: unknown) {
    if (record(error)?.code === "ENOENT") return [];
    throw error;
  }
}

async function recentNotifications(): Promise<OperationsNotification[]> {
  const files = (await names(NOTIFICATION_ROOT, (name) => name.endsWith(".json")))
    .slice(0, 10);
  const results = await Promise.all(files.map(async (file) => {
    try {
      return parseNotification(
        JSON.parse(await readFile(join(NOTIFICATION_ROOT, file), "utf8")) as unknown,
      );
    } catch (error: unknown) {
      if (record(error)?.code === "ENOENT" || error instanceof SyntaxError) return null;
      throw error;
    }
  }));
  return results.filter((value): value is OperationsNotification => value !== null);
}

export async function loadProductionOperationsDashboard(): Promise<ProductionOperationsDashboard> {
  const [backup, dailyReport, weeklyReport, health, events, notifications] =
    await Promise.all([
      latestBackup(),
      latestReport("DAILY"),
      latestReport("WEEKLY"),
      currentHealth(),
      recentHealthEvents(),
      recentNotifications(),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    backup,
    dailyReport,
    weeklyReport,
    health,
    recentHealthEvents: events,
    notifications,
    production: {
      champion: "20% ML / 80% Poisson",
      automaticModelChangeAllowed: false,
      readOnly: true,
      remoteActivationAllowed: false,
    },
  };
}

import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import {
  buildModelHealthReport,
  type HealthLevel,
  type ModelHealthReport,
} from "@/lib/value-bet-model-health";

const STATE_SCHEMA_VERSION = 1;
const WARNING_REMINDER_HOURS = 24;
const CRITICAL_REMINDER_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;

export type HealthEventReason =
  | "FIRST_OBSERVATION"
  | "DEGRADATION"
  | "IMPROVEMENT"
  | "RECOVERY"
  | "REMINDER"
  | "OBSERVATION";

export type ProductionHealthState = {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  currentLevel: HealthLevel;
  firstSeenAt: string;
  lastObservedAt: string;
  lastNotifiedAt: string | null;
  notificationCount: number;
};

export type HealthNotificationDecision = {
  reason: HealthEventReason;
  shouldNotify: boolean;
};

export type ProductionHealthEvent = {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  observedAt: string;
  level: HealthLevel;
  previousLevel: HealthLevel | null;
  reason: HealthEventReason;
  notificationCreated: boolean;
  metrics: {
    snapshotLevel: HealthLevel;
    snapshotAgeHours: number | null;
    oddsLevel: HealthLevel;
    staleSelections: number;
    driftStatus: ModelHealthReport["drift"]["status"];
    independentSelections: number;
  };
  production: {
    champion: "20% ML / 80% Poisson";
    automaticModelChangeAllowed: false;
  };
};

export type ProductionHealthMonitorResult = {
  health: ModelHealthReport;
  event: ProductionHealthEvent;
  notificationPath: string | null;
  eventLogPath: string;
  statePath: string;
};

function levelRank(level: HealthLevel): number {
  return level === "CRITICAL" ? 2 : level === "WARNING" ? 1 : 0;
}

function validDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function decideHealthNotification(
  previous: ProductionHealthState | null,
  currentLevel: HealthLevel,
  now: Date,
): HealthNotificationDecision {
  if (!previous) {
    return {
      reason: "FIRST_OBSERVATION",
      shouldNotify: currentLevel !== "HEALTHY",
    };
  }

  if (previous.currentLevel !== currentLevel) {
    if (currentLevel === "HEALTHY") {
      return { reason: "RECOVERY", shouldNotify: true };
    }

    return {
      reason:
        levelRank(currentLevel) > levelRank(previous.currentLevel)
          ? "DEGRADATION"
          : "IMPROVEMENT",
      shouldNotify: true,
    };
  }

  if (currentLevel === "HEALTHY") {
    return { reason: "OBSERVATION", shouldNotify: false };
  }

  const lastNotifiedAt = validDate(previous.lastNotifiedAt);
  const reminderHours = currentLevel === "CRITICAL"
    ? CRITICAL_REMINDER_HOURS
    : WARNING_REMINDER_HOURS;
  const reminderDue =
    !lastNotifiedAt ||
    now.getTime() - lastNotifiedAt.getTime() >= reminderHours * HOUR_MS;

  return {
    reason: reminderDue ? "REMINDER" : "OBSERVATION",
    shouldNotify: reminderDue,
  };
}

function statePath(): string {
  const productionDataRoot = process.env.PRODUCTION_DATA_ROOT?.trim();
  return resolve(
    process.env.PRODUCTION_HEALTH_STATE_PATH?.trim() ||
      (productionDataRoot
        ? join(productionDataRoot, "data", "operations", "model-health-state.json")
        : join(process.cwd(), "data", "operations", "model-health-state.json")),
  );
}

function eventLogPath(): string {
  const productionDataRoot = process.env.PRODUCTION_DATA_ROOT?.trim();
  return resolve(
    process.env.PRODUCTION_HEALTH_LOG_PATH?.trim() ||
      (productionDataRoot
        ? join(productionDataRoot, "logs", "production", "model-health-events.jsonl")
        : join(process.cwd(), "logs", "production", "model-health-events.jsonl")),
  );
}

function notificationRoot(): string {
  const productionDataRoot = process.env.PRODUCTION_DATA_ROOT?.trim();
  return resolve(
    process.env.PRODUCTION_NOTIFICATION_DIR?.trim() ||
      (productionDataRoot
        ? join(productionDataRoot, "notifications", "production")
        : join(process.cwd(), "notifications", "production")),
  );
}

async function loadState(path: string): Promise<ProductionHealthState | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as ProductionHealthState;
    if (
      parsed.schemaVersion !== STATE_SCHEMA_VERSION ||
      !["HEALTHY", "WARNING", "CRITICAL"].includes(parsed.currentLevel)
    ) {
      return null;
    }
    return parsed;
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error
      ? error.code
      : null;
    if (code !== "ENOENT") throw error;
    return null;
  }
}

async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, contents, "utf8");
  await rm(path, { force: true });
  await rename(temporaryPath, path);
}

function notificationMessage(event: ProductionHealthEvent): string {
  if (event.reason === "RECOVERY") {
    return "Production model health returned to HEALTHY. No model setting was changed.";
  }
  return [
    `Production model health is ${event.level}.`,
    `Snapshot=${event.metrics.snapshotLevel}.`,
    `Odds=${event.metrics.oddsLevel}.`,
    `Drift=${event.metrics.driftStatus}.`,
    "Automatic model changes remain disabled.",
  ].join(" ");
}

async function createNotification(
  event: ProductionHealthEvent,
): Promise<string> {
  const stamp = event.observedAt.replace(/[-:.]/g, "");
  const path = join(
    notificationRoot(),
    `${stamp}-${event.level.toLowerCase()}.json`,
  );
  const notification = {
    schemaVersion: STATE_SCHEMA_VERSION,
    createdAt: event.observedAt,
    channel: "LOCAL_OUTBOX",
    severity: event.level,
    reason: event.reason,
    title: `Bet Project Production Health: ${event.level}`,
    message: notificationMessage(event),
    acknowledged: false,
    production: event.production,
  };
  await writeAtomic(path, `${JSON.stringify(notification, null, 2)}\n`);
  return path;
}

export async function monitorProductionHealth(
  now = new Date(),
): Promise<ProductionHealthMonitorResult> {
  const snapshot = await loadValueBetDashboardSnapshot();
  const health = buildModelHealthReport({
    generatedAt: snapshot.generatedAt,
    upcoming: snapshot.upcoming,
    settled: snapshot.settled,
    now,
  });
  const currentStatePath = statePath();
  const currentEventLogPath = eventLogPath();
  const previous = await loadState(currentStatePath);
  const decision = decideHealthNotification(previous, health.overallLevel, now);
  const observedAt = now.toISOString();
  const event: ProductionHealthEvent = {
    schemaVersion: STATE_SCHEMA_VERSION,
    observedAt,
    level: health.overallLevel,
    previousLevel: previous?.currentLevel ?? null,
    reason: decision.reason,
    notificationCreated: decision.shouldNotify,
    metrics: {
      snapshotLevel: health.snapshot.level,
      snapshotAgeHours: health.snapshot.ageHours,
      oddsLevel: health.odds.level,
      staleSelections: health.odds.staleSelections,
      driftStatus: health.drift.status,
      independentSelections: health.drift.independentSelections,
    },
    production: {
      champion: "20% ML / 80% Poisson",
      automaticModelChangeAllowed: false,
    },
  };

  await mkdir(dirname(currentEventLogPath), { recursive: true });
  await appendFile(currentEventLogPath, `${JSON.stringify(event)}\n`, "utf8");
  const notificationPath = decision.shouldNotify
    ? await createNotification(event)
    : null;
  const nextState: ProductionHealthState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    currentLevel: health.overallLevel,
    firstSeenAt:
      previous?.currentLevel === health.overallLevel
        ? previous.firstSeenAt
        : observedAt,
    lastObservedAt: observedAt,
    lastNotifiedAt: decision.shouldNotify
      ? observedAt
      : previous?.lastNotifiedAt ?? null,
    notificationCount:
      (previous?.notificationCount ?? 0) + (decision.shouldNotify ? 1 : 0),
  };
  await writeAtomic(currentStatePath, `${JSON.stringify(nextState, null, 2)}\n`);

  return {
    health,
    event,
    notificationPath,
    eventLogPath: currentEventLogPath,
    statePath: currentStatePath,
  };
}

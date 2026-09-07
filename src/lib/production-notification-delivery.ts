import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const DELIVERY_SCHEMA_VERSION = 1;
const DEFAULT_BATCH_SIZE = 20;

type JsonRecord = Record<string, unknown>;

export type NotificationDeliveryReadiness = {
  status: "READY" | "SAFELY_BLOCKED";
  enabled: boolean;
  webhookConfigured: boolean;
  webhookIsSecure: boolean;
  reason: string;
};

export type ProductionNotification = {
  schemaVersion: number;
  createdAt: string;
  channel: string;
  severity: "HEALTHY" | "WARNING" | "CRITICAL";
  reason: string;
  title: string;
  message: string;
  acknowledged: boolean;
  production: {
    champion: "20% ML / 80% Poisson";
    automaticModelChangeAllowed: false;
  };
  delivery?: {
    schemaVersion: typeof DELIVERY_SCHEMA_VERSION;
    channel: "HTTPS_WEBHOOK";
    status: "DELIVERED" | "FAILED";
    attempts: number;
    lastAttemptAt: string;
    deliveredAt: string | null;
    responseStatus: number | null;
  };
};

export type NotificationDeliveryResult = {
  status: "DELIVERED" | "PARTIAL" | "FAILED" | "EMPTY" | "SAFELY_BLOCKED";
  readiness: NotificationDeliveryReadiness;
  discovered: number;
  attempted: number;
  delivered: number;
  failed: number;
  skippedUnsafe: number;
};

type DeliveryOptions = {
  environment?: NodeJS.ProcessEnv;
  now?: Date;
  fetcher?: typeof fetch;
  maximumBatchSize?: number;
  notificationDirectory?: string;
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeWebhook(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function buildNotificationDeliveryReadiness(
  environment: NodeJS.ProcessEnv,
): NotificationDeliveryReadiness {
  const enabled = environment.PRODUCTION_NOTIFICATION_DELIVERY_ENABLED === "true";
  const configured = Boolean(environment.PRODUCTION_NOTIFICATION_WEBHOOK_URL?.trim());
  const secureWebhook = safeWebhook(
    environment.PRODUCTION_NOTIFICATION_WEBHOOK_URL,
  );

  if (!enabled) {
    return {
      status: "SAFELY_BLOCKED",
      enabled: false,
      webhookConfigured: configured,
      webhookIsSecure: secureWebhook !== null,
      reason: "Set PRODUCTION_NOTIFICATION_DELIVERY_ENABLED=true for explicit activation.",
    };
  }
  if (!configured) {
    return {
      status: "SAFELY_BLOCKED",
      enabled: true,
      webhookConfigured: false,
      webhookIsSecure: false,
      reason: "PRODUCTION_NOTIFICATION_WEBHOOK_URL is missing.",
    };
  }
  if (!secureWebhook) {
    return {
      status: "SAFELY_BLOCKED",
      enabled: true,
      webhookConfigured: true,
      webhookIsSecure: false,
      reason: "The notification webhook must use a non-local HTTPS URL.",
    };
  }
  return {
    status: "READY",
    enabled: true,
    webhookConfigured: true,
    webhookIsSecure: true,
    reason: "Explicit HTTPS notification delivery is ready.",
  };
}

export function parseProductionNotification(
  raw: unknown,
): ProductionNotification | null {
  const source = record(raw);
  const production = record(source?.production);
  const severity = text(source?.severity);
  if (
    source?.schemaVersion !== 1 ||
    !text(source.createdAt) ||
    !text(source.reason) ||
    !text(source.title) ||
    !text(source.message) ||
    !["HEALTHY", "WARNING", "CRITICAL"].includes(severity ?? "") ||
    production?.champion !== "20% ML / 80% Poisson" ||
    production?.automaticModelChangeAllowed !== false
  ) {
    return null;
  }

  const delivery = record(source.delivery);
  const deliveryStatus = text(delivery?.status);
  const parsedDelivery: ProductionNotification["delivery"] = delivery &&
    (deliveryStatus === "DELIVERED" || deliveryStatus === "FAILED")
    ? {
        schemaVersion: DELIVERY_SCHEMA_VERSION,
        channel: "HTTPS_WEBHOOK" as const,
        status: deliveryStatus as "DELIVERED" | "FAILED",
        attempts: number(delivery.attempts) ?? 0,
        lastAttemptAt: text(delivery.lastAttemptAt) ?? text(source.createdAt)!,
        deliveredAt: text(delivery.deliveredAt),
        responseStatus: number(delivery.responseStatus),
      }
    : undefined;

  return {
    schemaVersion: 1,
    createdAt: text(source.createdAt)!,
    channel: text(source.channel) ?? "LOCAL_OUTBOX",
    severity: severity as ProductionNotification["severity"],
    reason: text(source.reason)!,
    title: text(source.title)!,
    message: text(source.message)!,
    acknowledged: boolean(source.acknowledged) ?? false,
    production: {
      champion: "20% ML / 80% Poisson",
      automaticModelChangeAllowed: false,
    },
    ...(parsedDelivery ? { delivery: parsedDelivery } : {}),
  };
}

export function buildNotificationWebhookPayload(
  notification: ProductionNotification,
): JsonRecord {
  return {
    schemaVersion: DELIVERY_SCHEMA_VERSION,
    event: "BET_PROJECT_PRODUCTION_HEALTH",
    createdAt: notification.createdAt,
    severity: notification.severity,
    reason: notification.reason,
    title: notification.title,
    message: notification.message,
    production: {
      champion: "20% ML / 80% Poisson",
      automaticModelChangeAllowed: false,
    },
  };
}

async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, contents, "utf8");
  await rm(path, { force: true });
  await rename(temporaryPath, path);
}

function notificationRoot(options: DeliveryOptions): string {
  if (options.notificationDirectory) return resolve(options.notificationDirectory);
  const configured = options.environment?.PRODUCTION_NOTIFICATION_DIR?.trim();
  return resolve(configured || join(process.cwd(), "notifications", "production"));
}

async function notificationFiles(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();
  } catch (error: unknown) {
    if (record(error)?.code === "ENOENT") return [];
    throw error;
  }
}

export async function deliverProductionNotifications(
  options: DeliveryOptions = {},
): Promise<NotificationDeliveryResult> {
  const environment = options.environment ?? process.env;
  const readiness = buildNotificationDeliveryReadiness(environment);
  const root = notificationRoot({ ...options, environment });
  const files = await notificationFiles(root);
  if (readiness.status !== "READY") {
    return {
      status: "SAFELY_BLOCKED",
      readiness,
      discovered: files.length,
      attempted: 0,
      delivered: 0,
      failed: 0,
      skippedUnsafe: 0,
    };
  }

  const webhook = safeWebhook(environment.PRODUCTION_NOTIFICATION_WEBHOOK_URL)!;
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const maximumBatchSize = Math.max(
    1,
    Math.min(options.maximumBatchSize ?? DEFAULT_BATCH_SIZE, 100),
  );
  let attempted = 0;
  let delivered = 0;
  let failed = 0;
  let skippedUnsafe = 0;

  for (const file of files.slice(0, maximumBatchSize)) {
    const path = join(root, file);
    let notification: ProductionNotification | null = null;
    try {
      notification = parseProductionNotification(
        JSON.parse(await readFile(path, "utf8")) as unknown,
      );
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        skippedUnsafe += 1;
        continue;
      }
      throw error;
    }
    if (!notification) {
      skippedUnsafe += 1;
      continue;
    }
    if (notification.acknowledged || notification.delivery?.status === "DELIVERED") {
      continue;
    }

    attempted += 1;
    const attemptedAt = now.toISOString();
    const previousAttempts = notification.delivery?.attempts ?? 0;
    let responseStatus: number | null = null;
    let success = false;
    try {
      const response = await fetcher(webhook, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "bet-project-production-notifier/4.2",
          ...(environment.PRODUCTION_NOTIFICATION_WEBHOOK_TOKEN?.trim()
            ? { authorization: `Bearer ${environment.PRODUCTION_NOTIFICATION_WEBHOOK_TOKEN.trim()}` }
            : {}),
        },
        body: JSON.stringify(buildNotificationWebhookPayload(notification)),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      responseStatus = response.status;
      success = response.ok;
    } catch {
      success = false;
    }

    const updated: ProductionNotification = {
      ...notification,
      acknowledged: success,
      delivery: {
        schemaVersion: DELIVERY_SCHEMA_VERSION,
        channel: "HTTPS_WEBHOOK",
        status: success ? "DELIVERED" : "FAILED",
        attempts: previousAttempts + 1,
        lastAttemptAt: attemptedAt,
        deliveredAt: success ? attemptedAt : null,
        responseStatus,
      },
    };
    await writeAtomic(path, `${JSON.stringify(updated, null, 2)}\n`);
    if (success) delivered += 1;
    else failed += 1;
  }

  return {
    status: attempted === 0
      ? "EMPTY"
      : failed === 0
        ? "DELIVERED"
        : delivered > 0
          ? "PARTIAL"
          : "FAILED",
    readiness,
    discovered: files.length,
    attempted,
    delivered,
    failed,
    skippedUnsafe,
  };
}

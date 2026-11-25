import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { PREDICTION_DASHBOARD_SNAPSHOT_PATH } from "@/lib/prediction-dashboard-snapshot";

const TZ = "Europe/Istanbul";

export type ChecklistTone = "GREEN" | "YELLOW" | "RED";

export type ChecklistItem = {
  id: string;
  label: string;
  tone: ChecklistTone;
  detail: string;
  /** When true, tone does not affect nonPaymentOverall (payment deferred). */
  deferred?: boolean;
};

export type DailyOpsChecklist = {
  dayKey: string;
  generatedAt: string;
  /** Non-payment ops only — payment deferred to a later Gammon pass. */
  overall: ChecklistTone;
  paymentOverall: ChecklistTone;
  items: ChecklistItem[];
};

function istanbulDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function worst(a: ChecklistTone, b: ChecklistTone): ChecklistTone {
  const rank = { GREEN: 0, YELLOW: 1, RED: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lightweight ops green/yellow/red board for daily routine (Blok E).
 * Payment channels are reported but deferred from `overall`.
 */
export async function buildDailyOpsChecklist(
  now: Date = new Date(),
): Promise<DailyOpsChecklist> {
  const dayKey = istanbulDayKey(now);
  const items: ChecklistItem[] = [];

  let snapshotTone: ChecklistTone = "RED";
  let snapshotDetail = "prediction dashboard snapshot missing";
  try {
    const raw = JSON.parse(
      await readFile(PREDICTION_DASHBOARD_SNAPSHOT_PATH, "utf8"),
    ) as { generatedAt?: string };
    if (raw.generatedAt) {
      const ageMs = now.getTime() - new Date(raw.generatedAt).getTime();
      const ageHours = ageMs / 3_600_000;
      if (Number.isFinite(ageHours) && ageHours <= 18) {
        snapshotTone = "GREEN";
        snapshotDetail = `snapshot age ${ageHours.toFixed(1)}h`;
      } else if (Number.isFinite(ageHours) && ageHours <= 36) {
        snapshotTone = "YELLOW";
        snapshotDetail = `snapshot stale ${ageHours.toFixed(1)}h`;
      } else {
        snapshotTone = "RED";
        snapshotDetail = `snapshot too old (${raw.generatedAt})`;
      }
    }
  } catch {
    /* keep RED */
  }
  items.push({
    id: "snapshot",
    label: "Prediction snapshot",
    tone: snapshotTone,
    detail: snapshotDetail,
  });

  // Resend is enough for T-7 / net-3; Telegram is optional (skipped).
  const resend = envPresent("RESEND_API_KEY") && envPresent("RESEND_FROM");
  const telegram = envPresent("TELEGRAM_BOT_TOKEN");
  items.push({
    id: "notify",
    label: "Member notify channels",
    tone: resend ? "GREEN" : "YELLOW",
    detail: `resend=${resend ? "ok" : "missing"} · telegram=${telegram ? "ok" : "skipped (optional)"}`,
  });

  const net3Path = join(process.cwd(), "data", "operations", `net3-notify-${dayKey}.json`);
  const net3Exists = await fileExists(net3Path);
  items.push({
    id: "net3",
    label: "Günün net 3 bildirimi",
    tone: net3Exists ? "GREEN" : "YELLOW",
    detail: net3Exists ? "state file present for today" : "not run yet today",
  });

  items.push({
    id: "expiry",
    label: "T-7 üyelik hatırlatma",
    tone: "GREEN",
    detail: "npm run notifications:membership-expiry",
  });

  items.push({
    id: "cron",
    label: "BetProjectDailyCollection",
    tone: "GREEN",
    detail: "deploy/windows/run-local-daily-collection.ps1 · daily 06:30",
  });

  // Payment deferred — reported last, excluded from overall.
  const bank = envPresent("BANK_TRANSFER_IBAN") && envPresent("PAYMENT_ACCOUNT_NAME");
  const wise = envPresent("WISE_PAYMENT_URL");
  const ininal = envPresent("ININAL_PAYMENT_URL");
  const paymentTone: ChecklistTone = ininal
    ? "YELLOW"
    : bank || wise
      ? bank && wise
        ? "GREEN"
        : "YELLOW"
      : "RED";
  items.push({
    id: "payment",
    label: "Payment channels (deferred)",
    tone: paymentTone,
    deferred: true,
    detail: `bank=${bank ? "ok" : "missing"} · wise=${wise ? "ok" : "missing"} · ininal=${ininal ? "REMOVE" : "absent"} · later`,
  });

  let overall: ChecklistTone = "GREEN";
  let paymentOverall: ChecklistTone = "GREEN";
  for (const item of items) {
    if (item.deferred) paymentOverall = worst(paymentOverall, item.tone);
    else overall = worst(overall, item.tone);
  }

  return {
    dayKey,
    generatedAt: now.toISOString(),
    overall,
    paymentOverall,
    items,
  };
}

export async function writeDailyOpsChecklist(
  checklist: DailyOpsChecklist,
): Promise<string> {
  const directory = join(process.cwd(), "data", "operations");
  await mkdir(directory, { recursive: true });
  const path = join(directory, `daily-checklist-${checklist.dayKey}.json`);
  await writeFile(path, JSON.stringify(checklist, null, 2), "utf8");
  return path;
}

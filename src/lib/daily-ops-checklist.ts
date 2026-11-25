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
};

export type DailyOpsChecklist = {
  dayKey: string;
  generatedAt: string;
  overall: ChecklistTone;
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
 * Does not mutate production models; read-only + writes checklist JSON.
 */
export async function buildDailyOpsChecklist(
  now: Date = new Date(),
): Promise<DailyOpsChecklist> {
  const dayKey = istanbulDayKey(now);
  const items: ChecklistItem[] = [];

  // Snapshot freshness
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

  // Payment channels (presence only)
  const bank = envPresent("BANK_TRANSFER_IBAN") && envPresent("PAYMENT_ACCOUNT_NAME");
  const wise = envPresent("WISE_PAYMENT_URL");
  items.push({
    id: "payment",
    label: "Payment channels",
    tone: bank || wise ? (bank && wise ? "GREEN" : "YELLOW") : "RED",
    detail: `bank=${bank ? "ok" : "missing"} · wise=${wise ? "ok" : "missing"}`,
  });

  // Notify channels
  const resend = envPresent("RESEND_API_KEY") && envPresent("RESEND_FROM");
  const telegram = envPresent("TELEGRAM_BOT_TOKEN");
  items.push({
    id: "notify",
    label: "Member notify channels",
    tone: resend || telegram ? (resend && telegram ? "GREEN" : "YELLOW") : "YELLOW",
    detail: `resend=${resend ? "ok" : "missing"} · telegram=${telegram ? "ok" : "missing"}`,
  });

  // Daily net-3 state for today
  const net3Path = join(process.cwd(), "data", "operations", `net3-notify-${dayKey}.json`);
  const net3Exists = await fileExists(net3Path);
  items.push({
    id: "net3",
    label: "Günün net 3 bildirimi",
    tone: net3Exists ? "GREEN" : "YELLOW",
    detail: net3Exists ? "state file present for today" : "not run yet today",
  });

  // Expiry reminders runnable (lib present; cron is ops)
  items.push({
    id: "expiry",
    label: "T-7 üyelik hatırlatma",
    tone: "GREEN",
    detail: "npm run notifications:membership-expiry",
  });

  // Ininal should be gone
  items.push({
    id: "ininal",
    label: "ININAL removed",
    tone: envPresent("ININAL_PAYMENT_URL") ? "YELLOW" : "GREEN",
    detail: envPresent("ININAL_PAYMENT_URL")
      ? "ININAL_PAYMENT_URL still set — delete from Netlify"
      : "not set",
  });

  let overall: ChecklistTone = "GREEN";
  for (const item of items) overall = worst(overall, item.tone);

  return {
    dayKey,
    generatedAt: now.toISOString(),
    overall,
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

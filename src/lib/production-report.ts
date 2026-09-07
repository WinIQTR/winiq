import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  buildValueBetAccuracyReport,
  type ValueBetAccuracyReport,
} from "@/lib/value-bet-accuracy";
import {
  loadValueBetDashboardSnapshot,
  type ValueBetDashboardRow,
} from "@/lib/value-bet-dashboard-snapshot";
import { buildModelHealthReport } from "@/lib/value-bet-model-health";
import { buildValueBetPortfolio } from "@/lib/value-bet-portfolio";

const ISTANBUL_TIME_ZONE = "Europe/Istanbul";
const REPORT_SCHEMA_VERSION = 1;

export type ProductionReportPeriod = {
  kind: "DAILY" | "WEEKLY";
  key: string;
  startDate: string;
  endDate: string;
};

export type ProductionPerformanceReport = {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  generatedAt: string;
  sourceSnapshotGeneratedAt: string;
  period: ProductionReportPeriod;
  settled: ValueBetAccuracyReport;
  upcomingPortfolio: {
    primarySelections: number;
    watchSelections: number;
    maximumDailyAllocatedRiskPercentage: number;
  };
  modelHealth: {
    overallLevel: "HEALTHY" | "WARNING" | "CRITICAL";
    snapshotLevel: "HEALTHY" | "WARNING" | "CRITICAL";
    oddsLevel: "HEALTHY" | "WARNING" | "CRITICAL";
    driftStatus: "COLLECTING" | "STABLE" | "WARNING" | "CRITICAL";
    independentSelections: number;
  };
  production: {
    champion: "20% ML / 80% Poisson";
    automaticModelChangeAllowed: false;
    reportIsAdvisoryOnly: true;
  };
};

export type ProductionReportBundle = {
  daily: ProductionPerformanceReport;
  weekly: ProductionPerformanceReport;
};

export type SavedProductionReports = ProductionReportBundle & {
  files: {
    dailyJson: string;
    dailyMarkdown: string;
    weeklyJson: string;
    weeklyMarkdown: string;
  };
};

type DashboardSnapshot = {
  generatedAt: Date;
  upcoming: readonly ValueBetDashboardRow[];
  settled: readonly ValueBetDashboardRow[];
};

function toIstanbulDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ISTANBUL_TIME_ZONE,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateKeyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoWeekPeriod(dateKey: string): ProductionReportPeriod {
  const date = dateKeyToUtc(dateKey);
  const day = date.getUTCDay() || 7;
  const monday = addUtcDays(date, 1 - day);
  const sunday = addUtcDays(monday, 6);
  const thursday = addUtcDays(monday, 3);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDay = firstThursday.getUTCDay() || 7;
  const firstMonday = addUtcDays(firstThursday, 1 - firstDay);
  const week = Math.floor((monday.getTime() - firstMonday.getTime()) / 604_800_000) + 1;

  return {
    kind: "WEEKLY",
    key: `${isoYear}-W${String(week).padStart(2, "0")}`,
    startDate: formatDateKey(monday),
    endDate: formatDateKey(sunday),
  };
}

function settledDateKey(row: ValueBetDashboardRow): string | null {
  if (!row.settledAt || Number.isNaN(row.settledAt.getTime())) return null;
  return toIstanbulDateKey(row.settledAt);
}

function rowsForPeriod(
  rows: readonly ValueBetDashboardRow[],
  period: ProductionReportPeriod,
): ValueBetDashboardRow[] {
  return rows.filter((row) => {
    const key = settledDateKey(row);
    return key !== null && key >= period.startDate && key <= period.endDate;
  });
}

function buildReport(options: {
  snapshot: DashboardSnapshot;
  period: ProductionReportPeriod;
  generatedAt: Date;
}): ProductionPerformanceReport {
  const portfolio = buildValueBetPortfolio(options.snapshot.upcoming);
  const health = buildModelHealthReport({
    generatedAt: options.snapshot.generatedAt,
    upcoming: options.snapshot.upcoming,
    settled: options.snapshot.settled,
    now: options.generatedAt,
  });

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: options.generatedAt.toISOString(),
    sourceSnapshotGeneratedAt: options.snapshot.generatedAt.toISOString(),
    period: options.period,
    settled: buildValueBetAccuracyReport(
      rowsForPeriod(options.snapshot.settled, options.period),
    ),
    upcomingPortfolio: {
      primarySelections: portfolio.primarySelections.length,
      watchSelections: portfolio.watchSelections.length,
      maximumDailyAllocatedRiskPercentage:
        portfolio.maximumDailyAllocatedRiskPercentage,
    },
    modelHealth: {
      overallLevel: health.overallLevel,
      snapshotLevel: health.snapshot.level,
      oddsLevel: health.odds.level,
      driftStatus: health.drift.status,
      independentSelections: health.drift.independentSelections,
    },
    production: {
      champion: "20% ML / 80% Poisson",
      automaticModelChangeAllowed: false,
      reportIsAdvisoryOnly: true,
    },
  };
}

export function buildProductionReportBundle(
  snapshot: DashboardSnapshot,
  now = new Date(),
): ProductionReportBundle {
  const dateKey = toIstanbulDateKey(now);
  const dailyPeriod: ProductionReportPeriod = {
    kind: "DAILY",
    key: dateKey,
    startDate: dateKey,
    endDate: dateKey,
  };

  return {
    daily: buildReport({ snapshot, period: dailyPeriod, generatedAt: now }),
    weekly: buildReport({
      snapshot,
      period: isoWeekPeriod(dateKey),
      generatedAt: now,
    }),
  };
}

function display(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value.toFixed(1)}${suffix}`;
}

export function renderProductionReportMarkdown(
  report: ProductionPerformanceReport,
): string {
  const title = report.period.kind === "DAILY" ? "Günlük" : "Haftalık";

  return [
    `# ${title} Üretim Performans Raporu — ${report.period.key}`,
    "",
    `- Dönem: ${report.period.startDate} / ${report.period.endDate}`,
    `- Oluşturulma: ${report.generatedAt}`,
    `- Kaynak snapshot: ${report.sourceSnapshotGeneratedAt}`,
    "",
    "## Sonuçlanan Value Bet Performansı",
    "",
    `- Sonuçlanan: ${report.settled.settled}`,
    `- Kazanılan / Kaybedilen / Geçersiz: ${report.settled.won} / ${report.settled.lost} / ${report.settled.voided}`,
    `- İsabet oranı: ${display(report.settled.winRate, "%")}`,
    `- Kâr birimi: ${report.settled.profitUnits.toFixed(2)}`,
    `- Sabit birim ROI: ${display(report.settled.roi, "%")}`,
    `- Kalibrasyon farkı: ${display(report.settled.calibrationGap, " puan")}`,
    `- Örneklem durumu: ${report.settled.sampleStatus}`,
    "",
    "## Yaklaşan Portföy",
    "",
    `- Birincil seçimler: ${report.upcomingPortfolio.primarySelections}`,
    `- İzleme seçimleri: ${report.upcomingPortfolio.watchSelections}`,
    `- Azami günlük risk: %${report.upcomingPortfolio.maximumDailyAllocatedRiskPercentage.toFixed(2)}`,
    "",
    "## Model Sağlığı",
    "",
    `- Genel: ${report.modelHealth.overallLevel}`,
    `- Snapshot: ${report.modelHealth.snapshotLevel}`,
    `- Oran verisi: ${report.modelHealth.oddsLevel}`,
    `- Drift: ${report.modelHealth.driftStatus}`,
    `- Bağımsız sonuç: ${report.modelHealth.independentSelections}`,
    "",
    "## Üretim Kilidi",
    "",
    `- Champion: ${report.production.champion}`,
    "- Otomatik model değişikliği: KAPALI",
    "- Rapor statüsü: YALNIZCA BİLGİLENDİRME",
    "",
  ].join("\n");
}

async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, contents, "utf8");
  await rm(path, { force: true });
  await rename(temporaryPath, path);
}

export async function generateProductionReports(
  now = new Date(),
): Promise<SavedProductionReports> {
  const snapshot = await loadValueBetDashboardSnapshot();
  if (!snapshot.generatedAt) {
    throw new Error("Value Bet dashboard snapshot is missing. Run pnpm run refresh first.");
  }

  const bundle = buildProductionReportBundle(
    {
      generatedAt: snapshot.generatedAt,
      upcoming: snapshot.upcoming,
      settled: snapshot.settled,
    },
    now,
  );
  const productionDataRoot = process.env.PRODUCTION_DATA_ROOT?.trim();
  const root = resolve(
    process.env.PRODUCTION_REPORT_DIR?.trim() ||
      (productionDataRoot
        ? join(productionDataRoot, "reports", "production")
        : join(process.cwd(), "reports", "production")),
  );
  const files = {
    dailyJson: join(root, "daily", `${bundle.daily.period.key}.json`),
    dailyMarkdown: join(root, "daily", `${bundle.daily.period.key}.md`),
    weeklyJson: join(root, "weekly", `${bundle.weekly.period.key}.json`),
    weeklyMarkdown: join(root, "weekly", `${bundle.weekly.period.key}.md`),
  };

  await Promise.all([
    writeAtomic(files.dailyJson, `${JSON.stringify(bundle.daily, null, 2)}\n`),
    writeAtomic(files.dailyMarkdown, renderProductionReportMarkdown(bundle.daily)),
    writeAtomic(files.weeklyJson, `${JSON.stringify(bundle.weekly, null, 2)}\n`),
    writeAtomic(files.weeklyMarkdown, renderProductionReportMarkdown(bundle.weekly)),
  ]);

  return { ...bundle, files };
}

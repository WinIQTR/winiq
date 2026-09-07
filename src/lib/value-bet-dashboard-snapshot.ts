import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SNAPSHOT_SCHEMA_VERSION = 1;
export const VALUE_BET_DASHBOARD_SNAPSHOT_PATH = join(
  process.cwd(),
  "data",
  "value-bet-dashboard-snapshot.json",
);

export type ValueBetSettlementStatus = "PENDING" | "WON" | "LOST" | "VOID";

export type ValueBetDashboardRow = {
  id: number | null;
  matchId: number;
  leagueApiId: number;
  leagueName: string;
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  marketKey: string;
  market: string;
  selection: string;
  modelProbability: number;
  fairOdds: number | null;
  bestOdds: number;
  medianOdds: number;
  marketProbability: number;
  marketEdge: number;
  expectedValue: number;
  valueScore: number;
  recommendedStakePercentage: number;
  bookmakerName: string;
  bookmakerCount: number;
  valueLevel: string;
  sourceUpdatedAt: Date;
  capturedAt: Date;
  result: ValueBetSettlementStatus;
  profitUnits: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  publishedAt: Date;
  settledAt: Date | null;
};

type SerializedRow = Omit<
  ValueBetDashboardRow,
  "kickoffAt" | "sourceUpdatedAt" | "capturedAt" | "publishedAt" | "settledAt"
> & {
  kickoffAt: string;
  sourceUpdatedAt: string;
  capturedAt: string;
  publishedAt: string;
  settledAt: string | null;
};

type ValueBetDashboardSnapshot = {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  upcoming: SerializedRow[];
  settled: SerializedRow[];
};

export type ValueBetDashboardData = {
  generatedAt: Date | null;
  upcoming: ValueBetDashboardRow[];
  settled: ValueBetDashboardRow[];
};

function serialize(row: ValueBetDashboardRow): SerializedRow {
  return {
    ...row,
    kickoffAt: row.kickoffAt.toISOString(),
    sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
    capturedAt: row.capturedAt.toISOString(),
    publishedAt: row.publishedAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
  };
}

function hydrate(row: SerializedRow): ValueBetDashboardRow | null {
  const hydrated: ValueBetDashboardRow = {
    ...row,
    kickoffAt: new Date(row.kickoffAt),
    sourceUpdatedAt: new Date(row.sourceUpdatedAt),
    capturedAt: new Date(row.capturedAt),
    publishedAt: new Date(row.publishedAt),
    settledAt: row.settledAt ? new Date(row.settledAt) : null,
  };

  return [
    hydrated.kickoffAt,
    hydrated.sourceUpdatedAt,
    hydrated.capturedAt,
    hydrated.publishedAt,
    ...(hydrated.settledAt ? [hydrated.settledAt] : []),
  ].some((value) => Number.isNaN(value.getTime()))
    ? null
    : hydrated;
}

export async function saveValueBetDashboardSnapshot(options: {
  upcoming: readonly ValueBetDashboardRow[];
  settled: readonly ValueBetDashboardRow[];
  generatedAt?: Date;
}): Promise<{ filePath: string; upcoming: number; settled: number; generatedAt: Date }> {
  const generatedAt = options.generatedAt ?? new Date();
  const filePath = VALUE_BET_DASHBOARD_SNAPSHOT_PATH;
  const temporaryPath = `${filePath}.tmp`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    temporaryPath,
    `${JSON.stringify({
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      generatedAt: generatedAt.toISOString(),
      upcoming: options.upcoming.map(serialize),
      settled: options.settled.map(serialize),
    }, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, filePath);

  return {
    filePath,
    upcoming: options.upcoming.length,
    settled: options.settled.length,
    generatedAt,
  };
}

export async function loadValueBetDashboardSnapshot(): Promise<ValueBetDashboardData> {
  try {
    const parsed = JSON.parse(
      await readFile(VALUE_BET_DASHBOARD_SNAPSHOT_PATH, "utf8"),
    ) as ValueBetDashboardSnapshot;

    if (
      parsed.schemaVersion !== SNAPSHOT_SCHEMA_VERSION ||
      !Array.isArray(parsed.upcoming) ||
      !Array.isArray(parsed.settled)
    ) {
      return { generatedAt: null, upcoming: [], settled: [] };
    }

    const generatedAt = new Date(parsed.generatedAt);

    return {
      generatedAt: Number.isNaN(generatedAt.getTime()) ? null : generatedAt,
      upcoming: parsed.upcoming.map(hydrate).filter((row): row is ValueBetDashboardRow => row !== null),
      settled: parsed.settled.map(hydrate).filter((row): row is ValueBetDashboardRow => row !== null),
    };
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code !== "ENOENT") {
      console.error("Value Bet dashboard snapshot could not be read.", error);
    }
    return { generatedAt: null, upcoming: [], settled: [] };
  }
}

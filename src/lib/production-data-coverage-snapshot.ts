import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";

import {
  dirname,
  join,
  resolve,
} from "node:path";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import type {
  ApiQuotaSummary,
  LeagueCoverageSummary,
} from "@/lib/production-data-coverage-shared";

const COVERAGE_SCHEMA_VERSION = 1;

const DEFAULT_COVERAGE_SNAPSHOT_PATH =
  join(
    process.cwd(),
    "data",
    "operations",
    "data-coverage-v5.json",
  );

export type ProductionDataCoverageSnapshot = {
  schemaVersion: typeof COVERAGE_SCHEMA_VERSION;
  generatedAt: string;
  seasonYear: number;
  api: ApiQuotaSummary;
  totals: Omit<
    LeagueCoverageSummary,
    | "leagueApiId"
    | "leagueName"
    | "lastDatabaseUpdateAt"
  > & {
    leagues: number;
    lastDatabaseUpdateAt: string | null;
  };
  leagues: LeagueCoverageSummary[];
  production: {
    champion: "20% ML / 80% Poisson";
    automaticModelChangeAllowed: false;
    secretsStored: false;
  };
};

function snapshotPath(): string {
  const productionRoot =
    process.env.PRODUCTION_DATA_ROOT
      ?.trim();

  return productionRoot
    ? resolve(
        /* turbopackIgnore: true */
        productionRoot,
        "data",
        "operations",
        "data-coverage-v5.json",
      )
    : DEFAULT_COVERAGE_SNAPSHOT_PATH;
}

export async function saveProductionDataCoverageSnapshot(
  snapshot: ProductionDataCoverageSnapshot,
): Promise<void> {
  const filePath =
    snapshotPath();

  const temporaryPath =
    `${filePath}.tmp`;

  await mkdir(
    dirname(filePath),
    {
      recursive: true,
    },
  );

  await writeFile(
    temporaryPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );

  await rename(
    temporaryPath,
    filePath,
  );
}

export async function loadProductionDataCoverageSnapshot(): Promise<
  ProductionDataCoverageSnapshot | null
> {
  try {
    const parsed = JSON.parse(
      await readFile(
        snapshotPath(),
        "utf8",
      ),
    ) as ProductionDataCoverageSnapshot;

    if (
      parsed.schemaVersion !==
        COVERAGE_SCHEMA_VERSION ||
      parsed.seasonYear !==
        ACTIVE_SEASON_YEAR ||
      !Array.isArray(parsed.leagues) ||
      parsed.production?.champion !==
        "20% ML / 80% Poisson" ||
      parsed.production
        ?.automaticModelChangeAllowed !==
        false ||
      parsed.production?.secretsStored !==
        false
    ) {
      return null;
    }

    return parsed;
  } catch (error: unknown) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error
        ? error.code
        : null;

    if (
      code !== "ENOENT" &&
      !(error instanceof SyntaxError)
    ) {
      throw error;
    }

    return null;
  }
}

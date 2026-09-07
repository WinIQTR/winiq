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
  ResultReconciliationSummary,
} from "@/lib/production-result-reconciliation";

const SNAPSHOT_SCHEMA_VERSION = 1;

const DEFAULT_SNAPSHOT_PATH = join(
  /* turbopackIgnore: true */
  process.cwd(),
  "data",
  "operations",
  "result-reconciliation-v5.json",
);

export type ProductionResultReconciliationSnapshot =
  ResultReconciliationSummary & {
    schemaVersion:
      typeof SNAPSHOT_SCHEMA_VERSION;
    generatedAt: string;
    seasonYear: number;
    settlementRun: {
      pendingEvaluated: number;
      won: number;
      lost: number;
      voided: number;
      unsupportedMarkets: number;
      incompleteScores: number;
      rescheduled: number;
    };
    production: {
      champion:
        "20% ML / 80% Poisson";
      automaticModelChangeAllowed:
        false;
      externalNotificationSent:
        false;
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
        "result-reconciliation-v5.json",
      )
    : DEFAULT_SNAPSHOT_PATH;
}

export async function saveProductionResultReconciliationSnapshot(
  snapshot: ProductionResultReconciliationSnapshot,
): Promise<void> {
  const filePath = snapshotPath();
  const temporaryPath = `${filePath}.tmp`;

  await mkdir(dirname(filePath), {
    recursive: true,
  });
  await writeFile(
    temporaryPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, filePath);
}

export async function loadProductionResultReconciliationSnapshot(): Promise<
  ProductionResultReconciliationSnapshot | null
> {
  try {
    const parsed = JSON.parse(
      await readFile(snapshotPath(), "utf8"),
    ) as ProductionResultReconciliationSnapshot;

    if (
      parsed.schemaVersion !==
        SNAPSHOT_SCHEMA_VERSION ||
      parsed.seasonYear !==
        ACTIVE_SEASON_YEAR ||
      !Array.isArray(parsed.issues) ||
      parsed.production?.champion !==
        "20% ML / 80% Poisson" ||
      parsed.production
        ?.automaticModelChangeAllowed !==
        false ||
      parsed.production
        ?.externalNotificationSent !==
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

import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";

import {
  dirname,
  join,
} from "node:path";

import type {
  ProductionDashboardPrediction,
} from "@/lib/prediction-dashboard";

const SNAPSHOT_SCHEMA_VERSION = 2;
const LEGACY_SNAPSHOT_SCHEMA_VERSION = 1;
const MAXIMUM_ARCHIVED_PREDICTIONS = 20_000;

export const PREDICTION_DASHBOARD_SNAPSHOT_PATH = join(
  process.cwd(),
  "data",
  "production-dashboard-snapshot.json",
);

type SerializedPrediction = Omit<
  ProductionDashboardPrediction,
  "kickoffAt"
> & {
  kickoffAt: string;
};

type DashboardPredictionSnapshot = {
  schemaVersion:
    | typeof LEGACY_SNAPSHOT_SCHEMA_VERSION
    | typeof SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  predictions: SerializedPrediction[];
};

export type DashboardSnapshotWriteResult = {
  predictions: number;
  generatedAt: Date;
  filePath: string;
};

export type DashboardSnapshotSaveOptions = {
  /**
   * The default is true. Existing pre-kickoff predictions are retained so a
   * refresh never removes yesterday's records. Set false only after the caller
   * has already merged and settled the full archive.
   */
  mergeExisting?: boolean;
};

function serializePrediction(
  prediction: ProductionDashboardPrediction,
): SerializedPrediction {
  return {
    ...prediction,
    kickoffAt: prediction.kickoffAt.toISOString(),
  };
}

function hydratePrediction(
  prediction: SerializedPrediction,
): ProductionDashboardPrediction | null {
  const kickoffAt = new Date(prediction.kickoffAt);

  if (
    !Number.isInteger(prediction.matchId) ||
    Number.isNaN(kickoffAt.getTime())
  ) {
    return null;
  }

  return {
    ...prediction,
    kickoffAt,
  };
}

function settlementPriority(
  prediction: ProductionDashboardPrediction,
): number {
  switch (prediction.settlementStatus) {
    case "WON":
    case "LOST":
    case "VOID":
      return 2;

    case "PENDING":
      return 1;

    default:
      return 0;
  }
}

function mergeSettlement(
  archived: ProductionDashboardPrediction,
  incoming: ProductionDashboardPrediction,
): ProductionDashboardPrediction {
  if (
    settlementPriority(incoming) <
    settlementPriority(archived)
  ) {
    return archived;
  }

  return {
    ...archived,
    settlementStatus:
      incoming.settlementStatus ??
      archived.settlementStatus,
    finalHomeScore:
      incoming.finalHomeScore ??
      archived.finalHomeScore,
    finalAwayScore:
      incoming.finalAwayScore ??
      archived.finalAwayScore,
  };
}

/**
 * Keeps the first published pre-kickoff model output immutable while allowing
 * its later settlement status and final score to be attached. Match id is the
 * archive identity, therefore repeated daily refreshes cannot create duplicate
 * cards.
 */
export function mergeDashboardPredictionHistory(
  archivedPredictions:
    readonly ProductionDashboardPrediction[],
  incomingPredictions:
    readonly ProductionDashboardPrediction[],
): ProductionDashboardPrediction[] {
  const byMatchId =
    new Map<number, ProductionDashboardPrediction>();

  for (const prediction of archivedPredictions) {
    if (!byMatchId.has(prediction.matchId)) {
      byMatchId.set(prediction.matchId, prediction);
    }
  }

  for (const prediction of incomingPredictions) {
    const archived = byMatchId.get(prediction.matchId);

    byMatchId.set(
      prediction.matchId,
      archived
        ? mergeSettlement(archived, prediction)
        : prediction,
    );
  }

  return [...byMatchId.values()]
    .sort(
      (first, second) =>
        second.kickoffAt.getTime() -
        first.kickoffAt.getTime(),
    )
    .slice(0, MAXIMUM_ARCHIVED_PREDICTIONS);
}

async function readDashboardPredictionSnapshot(
  limit: number,
): Promise<ProductionDashboardPrediction[]> {
  try {
    const content = await readFile(
      PREDICTION_DASHBOARD_SNAPSHOT_PATH,
      "utf8",
    );
    const snapshot = JSON.parse(content) as DashboardPredictionSnapshot;

    if (
      (
        snapshot.schemaVersion !==
          LEGACY_SNAPSHOT_SCHEMA_VERSION &&
        snapshot.schemaVersion !==
          SNAPSHOT_SCHEMA_VERSION
      ) ||
      !Array.isArray(snapshot.predictions)
    ) {
      console.error(
        `Dashboard snapshot has an unsupported format: ${PREDICTION_DASHBOARD_SNAPSHOT_PATH}`,
      );

      return [];
    }

    return snapshot.predictions
      .map(hydratePrediction)
      .filter(
        (
          prediction,
        ): prediction is ProductionDashboardPrediction =>
          prediction !== null,
      )
      .slice(0, limit);
  } catch (error: unknown) {
    const errorCode =
      error &&
      typeof error === "object" &&
      "code" in error
        ? error.code
        : null;

    if (errorCode !== "ENOENT") {
      console.error(
        `Dashboard snapshot could not be read: ${PREDICTION_DASHBOARD_SNAPSHOT_PATH}`,
        error instanceof Error ? error.message : error,
      );
    }

    return [];
  }
}

export async function saveDashboardPredictionSnapshot(
  predictions: readonly ProductionDashboardPrediction[],
  generatedAt = new Date(),
  options: DashboardSnapshotSaveOptions = {},
): Promise<DashboardSnapshotWriteResult> {
  const filePath = PREDICTION_DASHBOARD_SNAPSHOT_PATH;
  const temporaryPath = `${filePath}.tmp`;
  const mergeExisting = options.mergeExisting ?? true;

  const archivedPredictions = mergeExisting
    ? await readDashboardPredictionSnapshot(
        MAXIMUM_ARCHIVED_PREDICTIONS,
      )
    : [];

  const mergedPredictions =
    mergeDashboardPredictionHistory(
      archivedPredictions,
      predictions,
    );

  const snapshot: DashboardPredictionSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    predictions: mergedPredictions.map(serializePrediction),
  };

  await mkdir(dirname(filePath), {
    recursive: true,
  });

  await writeFile(
    temporaryPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );

  await rename(temporaryPath, filePath);

  return {
    predictions: mergedPredictions.length,
    generatedAt,
    filePath,
  };
}

export async function loadDashboardPredictionSnapshot(
  limit = 5_000,
): Promise<ProductionDashboardPrediction[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit must be a positive integer.");
  }

  return readDashboardPredictionSnapshot(limit);
}

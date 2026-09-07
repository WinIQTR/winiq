import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";

import {
  dirname,
} from "node:path";

import type {
  SelectionPolicyCheck,
  SelectionPolicyCheckCode,
} from "@/lib/selection-policy-explanation";

const LEGACY_SNAPSHOT_SCHEMA_VERSION = 1;
const SNAPSHOT_SCHEMA_VERSION = 2;
const MAXIMUM_AUDIT_RECORDS = 20_000;

const DEFAULT_SNAPSHOT_PATH =
  "data/production-selection-audit-v5.json";

export type PredictionSelectionAuditRecord = {
  matchId: number;
  kickoffAt: Date;
  evaluatedAt: Date;
  decision:
    | "PUBLISHED"
    | "FILTERED"
    | "ERROR";
  eligible: boolean;
  predictedOutcome: string | null;
  predictedProbability: number | null;
  homeProbability: number | null;
  drawProbability: number | null;
  awayProbability: number | null;
  expectedHomeGoals: number | null;
  expectedAwayGoals: number | null;
  advisoryMarket: string | null;
  advisorySelection: string | null;
  advisoryProbability: number | null;
  advisoryReliabilityScore: number | null;
  confidenceLevel: string | null;
  confidenceScore: number | null;
  dataQualityScore: number | null;
  productionModelName: string | null;
  summary: string;
  failedCodes: SelectionPolicyCheckCode[];
  checks: SelectionPolicyCheck[];
};

type SerializedAuditRecord = Omit<
  PredictionSelectionAuditRecord,
  "kickoffAt" | "evaluatedAt"
> & {
  kickoffAt: string;
  evaluatedAt: string;
};

type PredictionSelectionAuditSnapshot = {
  schemaVersion:
    | typeof LEGACY_SNAPSHOT_SCHEMA_VERSION
    | typeof SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  selectionPolicyVersion: "selection-policy-v2";
  automaticModelChangeAllowed: false;
  records: SerializedAuditRecord[];
};

function serialize(
  record: PredictionSelectionAuditRecord,
): SerializedAuditRecord {
  return {
    ...record,
    kickoffAt: record.kickoffAt.toISOString(),
    evaluatedAt: record.evaluatedAt.toISOString(),
  };
}

function hydrate(
  record: SerializedAuditRecord,
): PredictionSelectionAuditRecord | null {
  const kickoffAt = new Date(record.kickoffAt);
  const evaluatedAt = new Date(record.evaluatedAt);

  if (
    !Number.isInteger(record.matchId) ||
    Number.isNaN(kickoffAt.getTime()) ||
    Number.isNaN(evaluatedAt.getTime()) ||
    !Array.isArray(record.checks) ||
    !Array.isArray(record.failedCodes)
  ) {
    return null;
  }

  return {
    ...record,
    kickoffAt,
    evaluatedAt,
    homeProbability:
      record.homeProbability ?? null,
    drawProbability:
      record.drawProbability ?? null,
    awayProbability:
      record.awayProbability ?? null,
    expectedHomeGoals:
      record.expectedHomeGoals ?? null,
    expectedAwayGoals:
      record.expectedAwayGoals ?? null,
    advisoryMarket:
      record.advisoryMarket ?? null,
    advisorySelection:
      record.advisorySelection ?? null,
    advisoryProbability:
      record.advisoryProbability ?? null,
    advisoryReliabilityScore:
      record.advisoryReliabilityScore ?? null,
  };
}

export function mergePredictionSelectionAudits(
  archived: readonly PredictionSelectionAuditRecord[],
  incoming: readonly PredictionSelectionAuditRecord[],
): PredictionSelectionAuditRecord[] {
  const byMatchId =
    new Map<number, PredictionSelectionAuditRecord>();

  for (const record of archived) {
    if (!byMatchId.has(record.matchId)) {
      byMatchId.set(record.matchId, record);
    }
  }

  for (const record of incoming) {
    const existing = byMatchId.get(record.matchId);

    if (
      !existing ||
      record.evaluatedAt.getTime() >=
        existing.evaluatedAt.getTime()
    ) {
      byMatchId.set(record.matchId, record);
    }
  }

  return [...byMatchId.values()]
    .sort(
      (first, second) =>
        second.kickoffAt.getTime() -
        first.kickoffAt.getTime(),
    )
    .slice(0, MAXIMUM_AUDIT_RECORDS);
}

export async function loadPredictionSelectionAuditSnapshot(
  limit = MAXIMUM_AUDIT_RECORDS,
): Promise<PredictionSelectionAuditRecord[]> {
  try {
    const content = await readFile(
      DEFAULT_SNAPSHOT_PATH,
      "utf8",
    );
    const snapshot = JSON.parse(
      content,
    ) as PredictionSelectionAuditSnapshot;

    if (
      (
        snapshot.schemaVersion !==
          LEGACY_SNAPSHOT_SCHEMA_VERSION &&
        snapshot.schemaVersion !==
          SNAPSHOT_SCHEMA_VERSION
      ) ||
      !Array.isArray(snapshot.records)
    ) {
      return [];
    }

    return snapshot.records
      .map(hydrate)
      .filter(
        (
          record,
        ): record is PredictionSelectionAuditRecord =>
          record !== null,
      )
      .slice(0, limit);
  } catch (error: unknown) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error
        ? error.code
        : null;

    if (code !== "ENOENT") {
      console.error(
        "Selection audit snapshot could not be read.",
        error instanceof Error
          ? error.message
          : error,
      );
    }

    return [];
  }
}

export async function savePredictionSelectionAuditSnapshot(
  incoming: readonly PredictionSelectionAuditRecord[],
  generatedAt = new Date(),
): Promise<{
  records: number;
  generatedAt: Date;
  filePath: string;
}> {
  const filePath = DEFAULT_SNAPSHOT_PATH;
  const temporaryPath = `${filePath}.tmp`;
  const archived =
    await loadPredictionSelectionAuditSnapshot();
  const records = mergePredictionSelectionAudits(
    archived,
    incoming,
  );

  const snapshot: PredictionSelectionAuditSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    selectionPolicyVersion: "selection-policy-v2",
    automaticModelChangeAllowed: false,
    records: records.map(serialize),
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
    records: records.length,
    generatedAt,
    filePath,
  };
}

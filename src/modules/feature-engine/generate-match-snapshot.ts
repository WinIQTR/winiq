import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchSquadSnapshot,
  type GenerateMatchSquadSnapshotResult,
} from "@/modules/squad-strength-engine";

import {
  generateMatchFeatures,
  type GenerateMatchFeaturesResult,
} from "./generate-match-features";

import {
  saveHeadToHeadFeatures,
  type SaveHeadToHeadFeaturesResult,
} from "@/modules/head-to-head-engine";

export type MatchSnapshotStatus =
  | "COMPLETE"
  | "CORE_ONLY";

export type GenerateMatchSnapshotOptions = {
  matchId: number;

  calculationRunId: string;

  snapshotTime: Date;

  effectiveCalculatedAt: Date;
};

export type GenerateMatchSnapshotResult = {
  match: {
    id: number;
    kickoffAt: Date;
    homeTeam: string;
    awayTeam: string;
  };

  calculationRunId: string;

  status:
    MatchSnapshotStatus;

  core:
    GenerateMatchFeaturesResult;

  squad:
    GenerateMatchSquadSnapshotResult;

h2h:
  SaveHeadToHeadFeaturesResult;

  warnings: string[];
};

function validateDate(
  value: Date,
  name: string,
): void {
  if (
    Number.isNaN(
      value.getTime(),
    )
  ) {
    throw new Error(
      `${name} geçerli bir tarih olmalıdır.`,
    );
  }
}

export async function generateMatchSnapshot(
  options: GenerateMatchSnapshotOptions,
): Promise<GenerateMatchSnapshotResult> {
  const {
    matchId,
    calculationRunId,
    snapshotTime,
    effectiveCalculatedAt,
  } = options;

  if (
    !Number.isInteger(
      matchId,
    ) ||
    matchId <= 0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    calculationRunId.trim()
      .length === 0
  ) {
    throw new Error(
      "calculationRunId boş olamaz.",
    );
  }

  validateDate(
    snapshotTime,
    "snapshotTime",
  );

  validateDate(
    effectiveCalculatedAt,
    "effectiveCalculatedAt",
  );

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          matchId,
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeam: {
          select: {
            name: true,
          },
        },

        awayTeam: {
          select: {
            name: true,
          },
        },
      },
    });

  if (!match) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  if (
    snapshotTime >
    match.kickoffAt
  ) {
    throw new Error(
      "snapshotTime maç başlangıcından sonra olamaz.",
    );
  }

  if (
    effectiveCalculatedAt >
    match.kickoffAt
  ) {
    throw new Error(
      "effectiveCalculatedAt maç başlangıcından sonra olamaz.",
    );
  }

  /*
   * ==================================================
   * 1. CORE FEATURES
   * ==================================================
   *
   * Team Form
   * Venue Form
   * xG
   * Rest Days
   * vb.
   */
  const core =
    await generateMatchFeatures({
      matchId,

      calculationRunId,

      snapshotTime,

      effectiveCalculatedAt,
    });

  /*
   * ==================================================
   * 2. SQUAD SNAPSHOT
   * ==================================================
   *
   * Confirmed lineup varsa:
   *
   * Player Impact
   *       ↓
   * Squad Strength
   *       ↓
   * 9 home + 9 away MatchFeatureValue
   *
   * Lineup yoksa core snapshot yine korunur.
   */
  const squad =
    await generateMatchSquadSnapshot({
      matchId,

      calculationRunId,

      effectiveCalculatedAt,
    });

  const warnings = [
    ...squad.warnings,
  ];

  const status:
    MatchSnapshotStatus =
      squad.status ===
      "CREATED"
        ? "COMPLETE"
        : "CORE_ONLY";
const h2h =
  await saveHeadToHeadFeatures({
    matchId,

    calculationRunId,

    effectiveCalculatedAt,
  });

  return {
    match: {
      id:
        match.id,

      kickoffAt:
        match.kickoffAt,

      homeTeam:
        match.homeTeam.name,

      awayTeam:
        match.awayTeam.name,
    },

    calculationRunId,

    status,

    core,

    squad,

    warnings,

    h2h,
  };
}
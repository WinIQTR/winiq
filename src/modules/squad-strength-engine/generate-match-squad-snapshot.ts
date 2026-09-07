import {
  prisma,
} from "@/lib/prisma";

import {
  saveMatchPlayerImpacts,
} from "@/modules/player-impact-engine";

import {
  checkSquadFeatureReadiness,
} from "./check-squad-feature-readiness";

import {
  saveSquadFeatures,
} from "./save-squad-features";

import type {
  SaveSquadFeaturesResult,
} from "./save-squad-features";

export type MatchSquadSnapshotStatus =
  | "CREATED"
  | "SKIPPED_NO_CONFIRMED_LINEUP"
  | "SKIPPED_NOT_READY";

export type GenerateMatchSquadSnapshotResult = {
  match: {
    id: number;
    kickoffAt: Date;

    homeTeam: string;
    awayTeam: string;
  };

  status:
    MatchSquadSnapshotStatus;

  calculationRunId: string;

  impactGenerationAttempted: boolean;

  readinessBefore: {
    ready: boolean;

    homeImpactCount: number;
    awayImpactCount: number;
  };

  readinessAfter: {
    ready: boolean;

    homeImpactCount: number;
    awayImpactCount: number;
  };

  home:
    SaveSquadFeaturesResult |
    null;

  away:
    SaveSquadFeaturesResult |
    null;

  warnings: string[];
};

export async function generateMatchSquadSnapshot(
  options: {
    matchId: number;

    calculationRunId: string;

    effectiveCalculatedAt: Date;
  },
): Promise<GenerateMatchSquadSnapshotResult> {
  const {
    matchId,
    calculationRunId,
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

  if (
    Number.isNaN(
      effectiveCalculatedAt.getTime(),
    )
  ) {
    throw new Error(
      "effectiveCalculatedAt geçerli bir tarih olmalıdır.",
    );
  }

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          matchId,
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeamId: true,
        awayTeamId: true,

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

  /*
   * Historical snapshot geleceğe
   * yazılamaz.
   */
  if (
    effectiveCalculatedAt >
    match.kickoffAt
  ) {
    throw new Error(
      [
        "effectiveCalculatedAt maç başlangıcından sonra olamaz.",
        `effectiveCalculatedAt=${effectiveCalculatedAt.toISOString()}`,
        `kickoffAt=${match.kickoffAt.toISOString()}`,
      ].join(
        " ",
      ),
    );
  }

  const warnings:
    string[] = [];

  /*
   * Squad v1 historical modeli confirmed
   * lineup kullanıyor.
   *
   * Dolayısıyla bu ilk sürümde snapshot'ın
   * kickoff anına ait olmasını istiyoruz.
   *
   * Gelecekte predicted lineup modeli
   * geldiğinde kickoff öncesi snapshot'lar
   * ayrıca desteklenecek.
   */
  if (
    effectiveCalculatedAt.getTime() !==
    match.kickoffAt.getTime()
  ) {
    warnings.push(
      "Squad v1 historical snapshot confirmed lineup kullandığı için kickoff zamanındaki snapshotlar için tasarlanmıştır.",
    );
  }

  const readinessBefore =
    await checkSquadFeatureReadiness(
      match.id,
    );

  const bothLineupsFound =
    readinessBefore.home
      .lineupFound &&
    readinessBefore.away
      .lineupFound;

  if (
    !bothLineupsFound
  ) {
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

      status:
        "SKIPPED_NO_CONFIRMED_LINEUP",

      calculationRunId,

      impactGenerationAttempted:
        false,

      readinessBefore: {
        ready:
          readinessBefore.ready,

        homeImpactCount:
          readinessBefore.home
            .impactCount,

        awayImpactCount:
          readinessBefore.away
            .impactCount,
      },

      readinessAfter: {
        ready:
          readinessBefore.ready,

        homeImpactCount:
          readinessBefore.home
            .impactCount,

        awayImpactCount:
          readinessBefore.away
            .impactCount,
      },

      home:
        null,

      away:
        null,

      warnings: [
        ...warnings,
        ...readinessBefore.warnings,
      ],
    };
  }

  let impactGenerationAttempted =
    false;

  /*
   * Lineuplar var fakat PlayerImpactScore
   * eksikse otomatik üret.
   */
  if (
    !readinessBefore.ready
  ) {
    impactGenerationAttempted =
      true;

    await saveMatchPlayerImpacts(
      match.id,
    );
  }

  const readinessAfter =
    await checkSquadFeatureReadiness(
      match.id,
    );

  if (
    !readinessAfter.ready
  ) {
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

      status:
        "SKIPPED_NOT_READY",

      calculationRunId,

      impactGenerationAttempted,

      readinessBefore: {
        ready:
          readinessBefore.ready,

        homeImpactCount:
          readinessBefore.home
            .impactCount,

        awayImpactCount:
          readinessBefore.away
            .impactCount,
      },

      readinessAfter: {
        ready:
          readinessAfter.ready,

        homeImpactCount:
          readinessAfter.home
            .impactCount,

        awayImpactCount:
          readinessAfter.away
            .impactCount,
      },

      home:
        null,

      away:
        null,

      warnings: [
        ...warnings,
        ...readinessAfter.warnings,
      ],
    };
  }

  /*
   * Artık iki takımda da:
   *
   * confirmed lineup
   * 11 starter
   * tam PlayerImpactScore kapsamı
   *
   * mevcut.
   */
  const [
    home,
    away,
  ] =
    await Promise.all([
      saveSquadFeatures({
        matchId:
          match.id,

        teamId:
          match.homeTeamId,

        calculationRunId,

        effectiveCalculatedAt,
      }),

      saveSquadFeatures({
        matchId:
          match.id,

        teamId:
          match.awayTeamId,

        calculationRunId,

        effectiveCalculatedAt,
      }),
    ]);

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

    status:
      "CREATED",

    calculationRunId,

    impactGenerationAttempted,

    readinessBefore: {
      ready:
        readinessBefore.ready,

      homeImpactCount:
        readinessBefore.home
          .impactCount,

      awayImpactCount:
        readinessBefore.away
          .impactCount,
    },

    readinessAfter: {
      ready:
        readinessAfter.ready,

      homeImpactCount:
        readinessAfter.home
          .impactCount,

      awayImpactCount:
        readinessAfter.away
          .impactCount,
    },

    home,

    away,

    warnings,
  };
}
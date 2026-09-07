import {
  MatchStatus,
} from "@/generated/prisma/client";

import {
  prisma,
} from "@/lib/prisma";

export type CalculateTeamShotThreatOptions = {
  teamId: number;
  season: number;
  beforeDate: Date;

  limit?: number;
};

export type TeamShotThreatStatistics = {
  teamId: number;

  matches: number;

  shotsPerGame: number | null;

  shotsOnTargetPerGame:
    number | null;

  shotAccuracy:
    number | null;

  possessionAverage:
    number | null;

  cornersPerGame:
    number | null;

  attackingPressureScore:
    number | null;

  last5ShotsPerGame:
    number | null;

  last5ShotsOnTargetPerGame:
    number | null;

  last5AttackingPressureScore:
    number | null;

  dataQualityScore: number;
};

type HistoricalRow = {
  shots: number | null;
  shotsOnTarget: number | null;
  possession: number | null;
  corners: number | null;
};

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}

function average(
  values: number[],
): number | null {
  if (
    values.length === 0
  ) {
    return null;
  }

  return round(
    values.reduce(
      (
        total,
        value,
      ) =>
        total + value,
      0,
    ) /
      values.length,
  );
}

/*
 * Bu bir xG modeli değildir.
 *
 * Takımın hücum baskısını 0-100
 * aralığında özetleyen feature'dır.
 *
 * Normalize edilen bileşenler:
 *
 * Shots             %30
 * Shots on Target   %40
 * Possession        %15
 * Corners           %15
 */
function calculatePressure(
  rows: HistoricalRow[],
): number | null {
  if (
    rows.length === 0
  ) {
    return null;
  }

  const shots =
    average(
      rows
        .map(
          (row) =>
            row.shots,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        ),
    );

  const shotsOnTarget =
    average(
      rows
        .map(
          (row) =>
            row.shotsOnTarget,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        ),
    );

  const possession =
    average(
      rows
        .map(
          (row) =>
            row.possession,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        ),
    );

  const corners =
    average(
      rows
        .map(
          (row) =>
            row.corners,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        ),
    );

  if (
    shots === null &&
    shotsOnTarget === null &&
    possession === null &&
    corners === null
  ) {
    return null;
  }

  /*
   * Normalizasyon üst sınırları
   * yalnızca feature ölçeklendirmesi
   * içindir.
   *
   * Bunlar "xG katsayıları" değildir.
   */
  const shotsScore =
    shots === null
      ? 0
      : clamp(
          shots / 25,
          0,
          1,
        ) * 100;

  const targetScore =
    shotsOnTarget === null
      ? 0
      : clamp(
          shotsOnTarget /
            10,
          0,
          1,
        ) * 100;

  const possessionScore =
    possession === null
      ? 0
      : clamp(
          possession /
            70,
          0,
          1,
        ) * 100;

  const cornerScore =
    corners === null
      ? 0
      : clamp(
          corners / 12,
          0,
          1,
        ) * 100;

  return round(
    shotsScore *
      0.30 +
      targetScore *
        0.40 +
      possessionScore *
        0.15 +
      cornerScore *
        0.15,
  );
}

export async function calculateTeamShotThreat(
  options:
    CalculateTeamShotThreatOptions,
): Promise<TeamShotThreatStatistics> {
  const {
    teamId,
    season,
    beforeDate,
    limit = 10,
  } = options;

  if (
    !Number.isInteger(
      teamId,
    ) ||
    teamId <= 0
  ) {
    throw new Error(
      "teamId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isInteger(
      season,
    ) ||
    season <= 0
  ) {
    throw new Error(
      "season geçerli bir yıl olmalıdır.",
    );
  }

  if (
    Number.isNaN(
      beforeDate.getTime(),
    )
  ) {
    throw new Error(
      "beforeDate geçerli bir tarih olmalıdır.",
    );
  }

  /*
   * DATA LEAKAGE KORUMASI:
   *
   * Yalnızca tahmin edilen maçtan
   * ÖNCE oynanan maçları kullanıyoruz.
   */
  const rows =
    await prisma.matchTeamStatistic.findMany({
      where: {
        teamId,

        match: {
          status:
            MatchStatus.FINISHED,

          kickoffAt: {
            lt:
              beforeDate,
          },

          season: {
            year:
              season,
          },
        },
      },

      select: {
        shots: true,

        shotsOnTarget:
          true,

        possession:
          true,

        corners:
          true,

        match: {
          select: {
            kickoffAt:
              true,
          },
        },
      },

      orderBy: {
        match: {
          kickoffAt:
            "desc",
        },
      },

      take:
        limit,
    });

  const historicalRows:
    HistoricalRow[] =
      rows.map(
        (row) => ({
          shots:
            row.shots,

          shotsOnTarget:
            row.shotsOnTarget,

          possession:
            row.possession,

          corners:
            row.corners,
        }),
      );

  const last5 =
    historicalRows.slice(
      0,
      5,
    );

  const shotsValues =
    historicalRows
      .map(
        (row) =>
          row.shots,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  const targetValues =
    historicalRows
      .map(
        (row) =>
          row.shotsOnTarget,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  const possessionValues =
    historicalRows
      .map(
        (row) =>
          row.possession,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  const cornerValues =
    historicalRows
      .map(
        (row) =>
          row.corners,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  const shotsPerGame =
    average(
      shotsValues,
    );

  const shotsOnTargetPerGame =
    average(
      targetValues,
    );

  const shotAccuracy =
    shotsPerGame !== null &&
    shotsPerGame > 0 &&
    shotsOnTargetPerGame !==
      null
      ? round(
          (
            shotsOnTargetPerGame /
            shotsPerGame
          ) *
            100,
        )
      : null;

  const possessionAverage =
    average(
      possessionValues,
    );

  const cornersPerGame =
    average(
      cornerValues,
    );

  const last5ShotsPerGame =
    average(
      last5
        .map(
          (row) =>
            row.shots,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        ),
    );

  const last5ShotsOnTargetPerGame =
    average(
      last5
        .map(
          (row) =>
            row.shotsOnTarget,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        ),
    );

  const attackingPressureScore =
    calculatePressure(
      historicalRows,
    );

  const last5AttackingPressureScore =
    calculatePressure(
      last5,
    );

  /*
   * 10 geçmiş maç = 100 kalite.
   *
   * İlk haftalarda doğal olarak
   * daha düşük olacak.
   */
  const sampleQuality =
    clamp(
      (
        rows.length /
        10
      ) *
        100,
      0,
      100,
    );

  /*
   * Alan doluluk oranı.
   */
  const totalPossibleFields =
    rows.length * 4;

  const availableFields =
    rows.reduce(
      (
        total,
        row,
      ) => {
        return (
          total +
          [
            row.shots,
            row.shotsOnTarget,
            row.possession,
            row.corners,
          ].filter(
            (value) =>
              value !== null,
          ).length
        );
      },
      0,
    );

  const completeness =
    totalPossibleFields >
    0
      ? (
          availableFields /
          totalPossibleFields
        ) *
        100
      : 0;

  const dataQualityScore =
    round(
      sampleQuality *
        0.7 +
      completeness *
        0.3,
    );

  return {
    teamId,

    matches:
      rows.length,

    shotsPerGame,

    shotsOnTargetPerGame,

    shotAccuracy,

    possessionAverage,

    cornersPerGame,

    attackingPressureScore,

    last5ShotsPerGame,

    last5ShotsOnTargetPerGame,

    last5AttackingPressureScore,

    dataQualityScore,
  };
}
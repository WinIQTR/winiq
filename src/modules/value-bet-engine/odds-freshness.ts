export type OddsFreshnessResult = {
  minutesUntilKickoff: number;

  sourceOddsAgeMinutes: number;

  captureAgeMinutes: number;

  allowedSourceOddsAgeMinutes:
    number;

  sourceIsFresh: boolean;

  captureIsFresh: boolean;
};

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}

function calculateAgeMinutes(
  earlier:
    Date,

  later:
    Date,
): number {
  return round(
    Math.max(
      0,
      (
        later.getTime() -
        earlier.getTime()
      ) /
        (
          1000 *
          60
        ),
    ),
    2,
  );
}

function calculateMinutesUntilKickoff(
  kickoffAt:
    Date,

  now:
    Date,
): number {
  return round(
    Math.max(
      0,
      (
        kickoffAt.getTime() -
        now.getTime()
      ) /
        (
          1000 *
          60
        ),
    ),
    2,
  );
}

/*
 * Maça kalan süre uzunsa bookmaker'ın
 * oranı saatlerce değiştirmemiş olması
 * normaldir.
 *
 * Maç yaklaştıkça daha güncel bir source
 * update zamanı beklenir.
 */
export function resolveAllowedSourceOddsAgeMinutes(
  minutesUntilKickoff:
    number,
): number {
  /*
   * Maça iki saatten az kaldı.
   */
  if (
    minutesUntilKickoff <=
    120
  ) {
    return 60;
  }

  /*
   * Maça altı saatten az kaldı.
   */
  if (
    minutesUntilKickoff <=
    360
  ) {
    return 120;
  }

  /*
   * Maça bir günden az kaldı.
   */
  if (
    minutesUntilKickoff <=
    1440
  ) {
    return 360;
  }

  /*
   * Maça üç günden az kaldı.
   */
  if (
    minutesUntilKickoff <=
    4320
  ) {
    return 1440;
  }

  /*
   * Maç üç günden daha uzaktaysa
   * 48 saate kadar değişmeyen piyasa
   * oranı kabul edilebilir.
   */
  return 2880;
}

export function evaluateOddsFreshness(
  options: {
    now: Date;

    kickoffAt: Date;

    sourceUpdatedAt:
      Date;

    capturedAt:
      Date;

    maximumCaptureAgeMinutes:
      number;
  },
): OddsFreshnessResult {
  const minutesUntilKickoff =
    calculateMinutesUntilKickoff(
      options.kickoffAt,
      options.now,
    );

  const sourceOddsAgeMinutes =
    calculateAgeMinutes(
      options.sourceUpdatedAt,
      options.now,
    );

  const captureAgeMinutes =
    calculateAgeMinutes(
      options.capturedAt,
      options.now,
    );

  const allowedSourceOddsAgeMinutes =
    resolveAllowedSourceOddsAgeMinutes(
      minutesUntilKickoff,
    );

  return {
    minutesUntilKickoff,

    sourceOddsAgeMinutes,

    captureAgeMinutes,

    allowedSourceOddsAgeMinutes,

    sourceIsFresh:
      sourceOddsAgeMinutes <=
      allowedSourceOddsAgeMinutes,

    captureIsFresh:
      captureAgeMinutes <=
      options
        .maximumCaptureAgeMinutes,
  };
}
const DEFAULT_ACTIVE_SEASON =
  2026;

const MINIMUM_SEASON_YEAR =
  2000;

const MAXIMUM_SEASON_YEAR =
  2100;

function resolveSeasonYear(
  rawValue:
    string | undefined,
  fallback:
    number,
): number {
  const normalizedValue =
    rawValue?.trim();

  if (
    !normalizedValue
  ) {
    return fallback;
  }

  const parsedValue =
    Number.parseInt(
      normalizedValue,
      10,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue <
      MINIMUM_SEASON_YEAR ||
    parsedValue >
      MAXIMUM_SEASON_YEAR
  ) {
    throw new Error(
      [
        "API_FOOTBALL_SEASON geçerli değil.",
        `Beklenen aralık: ${MINIMUM_SEASON_YEAR}-${MAXIMUM_SEASON_YEAR}.`,
        `Gelen değer: ${normalizedValue}`,
      ].join(
        " ",
      ),
    );
  }

  return parsedValue;
}

/*
 * Güncel veri importu ve canlı tahminler
 * için kullanılan aktif sezon.
 *
 * PowerShell:
 * $env:API_FOOTBALL_SEASON="2026"
 */
export const ACTIVE_SEASON_YEAR =
  resolveSeasonYear(
    process.env
      .API_FOOTBALL_SEASON,
    DEFAULT_ACTIVE_SEASON,
  );

/*
 * Historical eğitim, backtest ve
 * holdout validasyonu için sabit sezon.
 *
 * Bu değer aktif sezondan bağımsızdır.
 */
export const HISTORICAL_MODEL_SEASON_YEAR =
  2024;

export const ACTIVE_SEASON_LABEL =
  `${ACTIVE_SEASON_YEAR}/${String(ACTIVE_SEASON_YEAR + 1).slice(-2)}`;

export const HISTORICAL_MODEL_SEASON_LABEL =
  `${HISTORICAL_MODEL_SEASON_YEAR}/${String(HISTORICAL_MODEL_SEASON_YEAR + 1).slice(-2)}`;

export function getSeasonDateRange(
  seasonYear: number,
): {
  start: Date;
  end: Date;
} {
  return {
    start: new Date(
      Date.UTC(seasonYear, 6, 1),
    ),
    end: new Date(
      Date.UTC(seasonYear + 1, 6, 1),
    ),
  };
}

export function isDateInSeason(
  value: Date,
  seasonYear = ACTIVE_SEASON_YEAR,
): boolean {
  const range = getSeasonDateRange(seasonYear);

  return (
    value.getTime() >= range.start.getTime() &&
    value.getTime() < range.end.getTime()
  );
}

export function getActiveSeasonYear():
  number {
  return ACTIVE_SEASON_YEAR;
}

export function getHistoricalModelSeasonYear():
  number {
  return HISTORICAL_MODEL_SEASON_YEAR;
}

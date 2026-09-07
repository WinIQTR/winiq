const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

type RankedPrediction = {
  kickoffAt: Date;
  productionScore: number;
};

function toIstanbulDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ISTANBUL_TIME_ZONE,
  }).formatToParts(value);

  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${readPart("year")}-${readPart("month")}-${readPart("day")}`;
}

/**
 * Selects the strongest eligible fixtures for the current Istanbul calendar
 * day, then presents that shortlist in chronological kickoff order.
 */
export function selectTodaysStrongestPredictions<
  TPrediction extends RankedPrediction,
>(
  predictions: readonly TPrediction[],
  now: Date = new Date(),
  limit = 6,
): TPrediction[] {
  if (limit <= 0) {
    return [];
  }

  const todayKey = toIstanbulDateKey(now);

  return predictions
    .filter(
      (prediction) =>
        toIstanbulDateKey(prediction.kickoffAt) === todayKey,
    )
    .sort(
      (first, second) =>
        second.productionScore - first.productionScore ||
        first.kickoffAt.getTime() - second.kickoffAt.getTime(),
    )
    .slice(0, limit)
    .sort(
      (first, second) =>
        first.kickoffAt.getTime() - second.kickoffAt.getTime() ||
        second.productionScore - first.productionScore,
    );
}

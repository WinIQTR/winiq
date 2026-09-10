const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

type RankedPrediction = {
  kickoffAt: Date;
  productionScore: number;
};

export type StrongestPredictionSelectionMode =
  | "STRICT_TODAY"
  | "BEST_TODAY"
  | "UPCOMING"
  | "AVAILABLE";

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

/**
 * Keeps the dashboard populated without weakening the production model itself.
 * Strict HOME candidates remain first choice; broader candidates are only a
 * clearly labelled display fallback when the strict daily shortlist is empty.
 */
export function selectStrongestDashboardPredictions<
  TPrediction extends RankedPrediction,
>(
  strictPredictions: readonly TPrediction[],
  allPredictions: readonly TPrediction[],
  now: Date = new Date(),
  limit = 6,
): {
  predictions: TPrediction[];
  mode: StrongestPredictionSelectionMode;
} {
  if (limit <= 0 || allPredictions.length === 0) {
    return { predictions: [], mode: "AVAILABLE" };
  }

  const strictToday = selectTodaysStrongestPredictions(
    strictPredictions,
    now,
    limit,
  );

  if (strictToday.length > 0) {
    return { predictions: strictToday, mode: "STRICT_TODAY" };
  }

  const bestToday = selectTodaysStrongestPredictions(
    allPredictions,
    now,
    limit,
  );

  if (bestToday.length > 0) {
    return { predictions: bestToday, mode: "BEST_TODAY" };
  }

  const upcoming = allPredictions
    .filter((prediction) => prediction.kickoffAt.getTime() >= now.getTime())
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

  if (upcoming.length > 0) {
    return { predictions: upcoming, mode: "UPCOMING" };
  }

  const available = [...allPredictions]
    .sort(
      (first, second) =>
        second.productionScore - first.productionScore ||
        second.kickoffAt.getTime() - first.kickoffAt.getTime(),
    )
    .slice(0, limit)
    .sort(
      (first, second) =>
        second.kickoffAt.getTime() - first.kickoffAt.getTime() ||
        second.productionScore - first.productionScore,
    );

  return { predictions: available, mode: "AVAILABLE" };
}

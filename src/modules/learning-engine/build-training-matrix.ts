import type {
  MatchOutcome,
  MissingValueStrategy,
  TrainingMatrix,
  TrainingMatrixBuildOptions,
  TrainingMatchRow,
} from "./types";

function round(
  value: number,
  decimals = 6,
): number {
  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}

function outcomeToClass(
  outcome: MatchOutcome,
): number {
  switch (outcome) {
    case "HOME":
      return 0;

    case "DRAW":
      return 1;

    case "AWAY":
      return 2;
  }
}

function outcomeToOneHot(
  outcome: MatchOutcome,
): number[] {
  switch (outcome) {
    case "HOME":
      return [1, 0, 0];

    case "DRAW":
      return [0, 1, 0];

    case "AWAY":
      return [0, 0, 1];
  }
}

function shouldIncludeFeature(options: {
  featureName: string;

  includeSideFeatures: boolean;
  includeDifferenceFeatures: boolean;
}): boolean {
  const isHomeFeature =
    options.featureName.startsWith(
      "home_",
    );

  const isAwayFeature =
    options.featureName.startsWith(
      "away_",
    );

  const isSideFeature =
    isHomeFeature ||
    isAwayFeature;

  const isDifferenceFeature =
    options.featureName.startsWith(
      "diff_",
    );

  if (
    isSideFeature
  ) {
    return (
      options.includeSideFeatures
    );
  }

  if (
    isDifferenceFeature
  ) {
    return (
      options
        .includeDifferenceFeatures
    );
  }

  /*
   * Prediction Feature Vector'daki TEAM scope
   * olmayan feature'lar burada kalır.
   *
   * Ör:
   *
   * h2h_home_win_rate
   * h2h_draw_rate
   * h2h_total_goals_per_game
   *
   * Bunları matrise her zaman dahil ediyoruz.
   */
  return true;
}

function collectFeatureNames(options: {
  rows: TrainingMatchRow[];

  includeSideFeatures: boolean;
  includeDifferenceFeatures: boolean;
}): string[] {
  const names = new Set<string>();

  for (const row of options.rows) {
    for (
      const featureName
      of Object.keys(row.features)
    ) {
      if (
        shouldIncludeFeature({
          featureName,

          includeSideFeatures:
            options.includeSideFeatures,

          includeDifferenceFeatures:
            options
              .includeDifferenceFeatures,
        })
      ) {
        names.add(featureName);
      }
    }
  }

  return [...names].sort(
    (left, right) =>
      left.localeCompare(right),
  );
}

function calculateColumnMeans(options: {
  rows: TrainingMatchRow[];
  featureNames: string[];
}): Record<string, number> {
  const means: Record<
    string,
    number
  > = {};

  for (
    const featureName
    of options.featureNames
  ) {
    const values: number[] = [];

    for (const row of options.rows) {
      const value =
        row.features[featureName];

      if (
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        values.push(value);
      }
    }

    means[featureName] =
      values.length > 0
        ? round(
            values.reduce(
              (total, value) =>
                total + value,
              0,
            ) / values.length,
          )
        : 0;
  }

  return means;
}

function resolveMissingValue(options: {
  featureName: string;
  strategy: MissingValueStrategy;
  columnMeans: Record<string, number>;
}): number {
  if (options.strategy === "ZERO") {
    return 0;
  }

  return (
    options.columnMeans[
      options.featureName
    ] ?? 0
  );
}

export function buildTrainingMatrix(
  rows: TrainingMatchRow[],
  options?: TrainingMatrixBuildOptions,
): TrainingMatrix {
  const includeSideFeatures =
    options?.includeSideFeatures ??
    true;

  const includeDifferenceFeatures =
    options
      ?.includeDifferenceFeatures ??
    true;

  const missingValueStrategy =
    options?.missingValueStrategy ??
    "COLUMN_MEAN";

  const maximumMissingRatio =
    options?.maximumMissingRatio ??
    0.5;

  if (
    maximumMissingRatio < 0 ||
    maximumMissingRatio > 1
  ) {
    throw new Error(
      "maximumMissingRatio 0 ile 1 arasında olmalıdır.",
    );
  }

  if (rows.length === 0) {
    throw new Error(
      "Training matrix oluşturmak için en az bir maç satırı gereklidir.",
    );
  }

  const featureNames =
    collectFeatureNames({
      rows,

      includeSideFeatures,
      includeDifferenceFeatures,
    });

  if (featureNames.length === 0) {
    throw new Error(
      "Training matrix için kullanılabilir sayısal feature bulunamadı.",
    );
  }

  const columnMeans =
    calculateColumnMeans({
      rows,
      featureNames,
    });

  const X: number[][] = [];
  const y: number[] = [];
  const yOneHot: number[][] = [];

  const metadata:
    TrainingMatrix["metadata"] = [];

  let skippedRowCount = 0;
  let imputedValueCount = 0;

  for (const row of rows) {
    let missingCount = 0;

    for (
      const featureName
      of featureNames
    ) {
      const value =
        row.features[featureName];

      if (
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        missingCount += 1;
      }
    }

    const missingRatio =
      missingCount /
      featureNames.length;

    if (
      missingRatio >
      maximumMissingRatio
    ) {
      skippedRowCount += 1;
      continue;
    }

    const matrixRow =
      featureNames.map(
        (featureName) => {
          const value =
            row.features[featureName];

          if (
            typeof value === "number" &&
            Number.isFinite(value)
          ) {
            return round(value);
          }

          imputedValueCount += 1;

          return round(
            resolveMissingValue({
              featureName,

              strategy:
                missingValueStrategy,

              columnMeans,
            }),
          );
        },
      );

    X.push(matrixRow);

    y.push(
      outcomeToClass(
        row.actualOutcome,
      ),
    );

    yOneHot.push(
      outcomeToOneHot(
        row.actualOutcome,
      ),
    );

    metadata.push({
      matchId:
        row.matchId,

      matchApiId:
        row.matchApiId,

      kickoffAt:
        row.kickoffAt,

      leagueApiId:
        row.leagueApiId,

      seasonYear:
        row.seasonYear,

      homeTeamId:
        row.homeTeamId,

      homeTeamName:
        row.homeTeamName,

      awayTeamId:
        row.awayTeamId,

      awayTeamName:
        row.awayTeamName,

      homeScore:
        row.homeScore,

      awayScore:
        row.awayScore,

      actualOutcome:
        row.actualOutcome,

      containsPostMatchCalculatedFeatures:
        row
          .containsPostMatchCalculatedFeatures,
    });
  }

  if (X.length === 0) {
    throw new Error(
      "Eksik veri filtrelerinden sonra eğitim matrisinde maç kalmadı.",
    );
  }

  const warnings: string[] = [];

  const leakageRowCount =
    metadata.filter(
      (row) =>
        row
          .containsPostMatchCalculatedFeatures,
    ).length;

  if (leakageRowCount > 0) {
    warnings.push(
      [
        leakageRowCount,
        "matris satırında maç başlangıcından sonra hesaplanan feature riski bulunuyor.",
        "Bu matris EXPERIMENTAL amaçla kullanılmalıdır.",
      ].join(" "),
    );
  }

  if (X.length < 200) {
    warnings.push(
      [
        "Eğitim matrisi yalnızca",
        X.length,
        "maç içeriyor.",
        "Güvenilir öğrenme için daha fazla maç önerilir.",
      ].join(" "),
    );
  }

  if (imputedValueCount > 0) {
    warnings.push(
      [
        imputedValueCount,
        "eksik feature değeri",
        missingValueStrategy,
        "yöntemiyle dolduruldu.",
      ].join(" "),
    );
  }

  return {
    featureNames,

    X,
    y,
    yOneHot,

    metadata,

    rowCount:
      X.length,

    columnCount:
      featureNames.length,

    skippedRowCount,
    imputedValueCount,

    missingValueStrategy,

    columnMeans,

    warnings,
  };
}
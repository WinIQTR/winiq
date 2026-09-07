import type {
  ChronologicalSplitOptions,
  ChronologicalTrainingSplit,
  TrainingMatrix,
  TrainingMatrixPartition,
} from "./types";

type OrderedMatrixRow = {
  X: number[];
  yClass: number;
  yOneHot: number[];

  metadata:
    TrainingMatrix["metadata"][number];
};

function buildPartition(options: {
  rows: OrderedMatrixRow[];
  featureNames: string[];
}): TrainingMatrixPartition {
  if (options.rows.length === 0) {
    throw new Error(
      "Boş satır listesinden training partition oluşturulamaz.",
    );
  }

  return {
    featureNames:
      [...options.featureNames],

    X:
      options.rows.map(
        (row) => [...row.X],
      ),

    y:
      options.rows.map(
        (row) => [...row.yOneHot],
      ),

    yClass:
      options.rows.map(
        (row) => row.yClass,
      ),

    metadata:
      options.rows.map(
        (row) => row.metadata,
      ),

    rowCount:
      options.rows.length,

    startedAt:
      options.rows[0].metadata.kickoffAt,

    endedAt:
      options.rows[
        options.rows.length - 1
      ].metadata.kickoffAt,
  };
}

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}

export function splitTrainingValidationChronologically(
  matrix: TrainingMatrix,
  options?: ChronologicalSplitOptions,
): ChronologicalTrainingSplit {
  const trainingPercentage =
    options?.trainingPercentage ?? 70;

  const minimumTrainingRows =
    options?.minimumTrainingRows ?? 100;

  const minimumValidationRows =
    options?.minimumValidationRows ?? 50;

  if (
    trainingPercentage <= 0 ||
    trainingPercentage >= 100
  ) {
    throw new Error(
      "trainingPercentage 0 ile 100 arasında olmalıdır.",
    );
  }

  if (
    matrix.rowCount !== matrix.X.length ||
    matrix.rowCount !== matrix.y.length ||
    matrix.rowCount !==
      matrix.yOneHot.length ||
    matrix.rowCount !==
      matrix.metadata.length
  ) {
    throw new Error(
      "Training matrix satır uzunlukları birbiriyle uyumlu değil.",
    );
  }

  if (matrix.rowCount < 2) {
    throw new Error(
      "Train / validation ayrımı için en az 2 satır gereklidir.",
    );
  }

  const orderedRows: OrderedMatrixRow[] =
    matrix.metadata
      .map((metadata, index) => ({
        X:
          matrix.X[index],

        yClass:
          matrix.y[index],

        yOneHot:
          matrix.yOneHot[index],

        metadata,
      }))
      .sort(
        (left, right) =>
          left.metadata.kickoffAt.getTime() -
          right.metadata.kickoffAt.getTime(),
      );

  let splitIndex =
    Math.floor(
      orderedRows.length *
        (trainingPercentage / 100),
    );

  splitIndex =
    Math.max(splitIndex, 1);

  splitIndex =
    Math.min(
      splitIndex,
      orderedRows.length - 1,
    );

  const trainingRows =
    orderedRows.slice(
      0,
      splitIndex,
    );

  const validationRows =
    orderedRows.slice(
      splitIndex,
    );

  const training =
    buildPartition({
      rows: trainingRows,
      featureNames:
        matrix.featureNames,
    });

  const validation =
    buildPartition({
      rows: validationRows,
      featureNames:
        matrix.featureNames,
    });

  const warnings: string[] = [];

  if (
    training.rowCount <
    minimumTrainingRows
  ) {
    warnings.push(
      [
        "Training satır sayısı düşük:",
        training.rowCount,
        `Önerilen minimum: ${minimumTrainingRows}.`,
      ].join(" "),
    );
  }

  if (
    validation.rowCount <
    minimumValidationRows
  ) {
    warnings.push(
      [
        "Validation satır sayısı düşük:",
        validation.rowCount,
        `Önerilen minimum: ${minimumValidationRows}.`,
      ].join(" "),
    );
  }

  const validationLeakageCount =
    validation.metadata.filter(
      (row) =>
        row
          .containsPostMatchCalculatedFeatures,
    ).length;

  if (
    validationLeakageCount > 0
  ) {
    warnings.push(
      [
        validationLeakageCount,
        "validation satırında maç sonrası hesaplanan feature riski var.",
        "Validation sonucu yalnızca EXPERIMENTAL kabul edilmelidir.",
      ].join(" "),
    );
  }

  return {
    training,
    validation,

    trainingPercentage:
      round(
        (training.rowCount /
          orderedRows.length) *
          100,
      ),

    validationPercentage:
      round(
        (validation.rowCount /
          orderedRows.length) *
          100,
      ),

    splitIndex,

    splitDate:
      validation.startedAt,

    totalRowCount:
      orderedRows.length,

    warnings,
  };
}
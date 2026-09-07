import {
  evaluatePredictions,
  type EvaluatedPrediction,
} from "@/lib/prediction-evaluation";

function percentage(
  correct: number,
  total: number,
): number {
  if (total === 0) {
    return 0;
  }

  return Math.round(
    (correct / total) * 10000,
  ) / 100;
}

function printProbabilityBuckets(
  predictions: EvaluatedPrediction[],
): void {
  const buckets = [
    {
      label: "0-39.9%",
      min: 0,
      max: 40,
    },
    {
      label: "40-44.9%",
      min: 40,
      max: 45,
    },
    {
      label: "45-49.9%",
      min: 45,
      max: 50,
    },
    {
      label: "50-54.9%",
      min: 50,
      max: 55,
    },
    {
      label: "55-59.9%",
      min: 55,
      max: 60,
    },
    {
      label: "60-64.9%",
      min: 60,
      max: 65,
    },
    {
      label: "65%+",
      min: 65,
      max: Number.POSITIVE_INFINITY,
    },
  ];

  console.log(
    "\n================================",
  );

  console.log(
    "OLASILIK ARALIĞINA GÖRE BAŞARI",
  );

  console.log(
    "================================\n",
  );

  console.table(
    buckets.map((bucket) => {
      const matches =
        predictions.filter(
          (prediction) =>
            prediction.predictedProbability >=
              bucket.min &&
            prediction.predictedProbability <
              bucket.max,
        );

      const correct =
        matches.filter(
          (prediction) =>
            prediction.isCorrect,
        ).length;

      const averageProbability =
        matches.length > 0
          ? matches.reduce(
              (
                total,
                prediction,
              ) =>
                total +
                prediction.predictedProbability,
              0,
            ) / matches.length
          : 0;

      return {
        aralık: bucket.label,

        maç:
          matches.length,

        doğru:
          correct,

        yanlış:
          matches.length -
          correct,

        "ortalama tahmin %":
          averageProbability.toFixed(
            2,
          ),

        "gerçek başarı %":
          percentage(
            correct,
            matches.length,
          ).toFixed(2),
      };
    }),
  );
}

function printConfidenceBuckets(
  predictions: EvaluatedPrediction[],
): void {
  const buckets = [
    {
      label: "0-49",
      min: 0,
      max: 50,
    },
    {
      label: "50-59",
      min: 50,
      max: 60,
    },
    {
      label: "60-69",
      min: 60,
      max: 70,
    },
    {
      label: "70-79",
      min: 70,
      max: 80,
    },
    {
      label: "80-89",
      min: 80,
      max: 90,
    },
    {
      label: "90-100",
      min: 90,
      max: 101,
    },
  ];

  console.log(
    "\n================================",
  );

  console.log(
    "GÜVEN PUANINA GÖRE BAŞARI",
  );

  console.log(
    "================================\n",
  );

  console.table(
    buckets.map((bucket) => {
      const matches =
        predictions.filter(
          (prediction) =>
            prediction.confidenceScore >=
              bucket.min &&
            prediction.confidenceScore <
              bucket.max,
        );

      const correct =
        matches.filter(
          (prediction) =>
            prediction.isCorrect,
        ).length;

      return {
        güven: bucket.label,

        maç:
          matches.length,

        doğru:
          correct,

        yanlış:
          matches.length -
          correct,

        "başarı %":
          percentage(
            correct,
            matches.length,
          ).toFixed(2),
      };
    }),
  );
}

function printOutcomePerformance(
  predictions: EvaluatedPrediction[],
): void {
  const outcomes = [
    "HOME",
    "DRAW",
    "AWAY",
  ] as const;

  console.log(
    "\n================================",
  );

  console.log(
    "TAHMİN TİPİNE GÖRE BAŞARI",
  );

  console.log(
    "================================\n",
  );

  console.table(
    outcomes.map((outcome) => {
      const matches =
        predictions.filter(
          (prediction) =>
            prediction.predictedOutcome ===
            outcome,
        );

      const correct =
        matches.filter(
          (prediction) =>
            prediction.isCorrect,
        ).length;

      return {
        tahmin: outcome,

        maç:
          matches.length,

        doğru:
          correct,

        yanlış:
          matches.length -
          correct,

        "başarı %":
          percentage(
            correct,
            matches.length,
          ).toFixed(2),
      };
    }),
  );
}

async function main(): Promise<void> {
  console.log(
    "\n================================",
  );

  console.log(
    "PREDICTION EVALUATION",
  );

  console.log(
    "================================\n",
  );

  const result =
    await evaluatePredictions(
      200,
    );

  const {
    summary,
    predictions,
  } = result;

  console.log(
    "GENEL SONUÇ",
  );

  console.table({
    "Toplam tahmin":
      summary.totalPredictions,

    "Doğru":
      summary.correctPredictions,

    "Yanlış":
      summary.incorrectPredictions,

    "Doğruluk %":
      summary.accuracy,

    "Ort. tahmin %":
      summary.averageWinningProbability,
  });

  printOutcomePerformance(
    predictions,
  );

  printProbabilityBuckets(
    predictions,
  );

  printConfidenceBuckets(
    predictions,
  );

  console.log(
    "\n================================",
  );

  console.log(
    "MAÇ DETAYLARI",
  );

  console.log(
    "================================\n",
  );

  console.table(
    predictions.map(
      (prediction) => ({
        maç:
          `${prediction.homeTeam} - ${prediction.awayTeam}`,

        tahmin:
          prediction.predictedOutcome,

        olasılık:
          prediction.predictedProbability,

        güven:
          prediction.confidenceScore,

        skor:
          `${prediction.actualHomeScore}-${prediction.actualAwayScore}`,

        gerçek:
          prediction.actualOutcome,

        sonuç:
          prediction.isCorrect
            ? "DOĞRU"
            : "YANLIŞ",
      }),
    ),
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode = 1;
  },
);
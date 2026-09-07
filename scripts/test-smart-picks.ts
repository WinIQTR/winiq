import {
  buildSmartPickReport,
} from "@/lib/smart-pick";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "SMART PICK TRAIN / VALIDATION TEST",
  );
  console.log(
    "========================================",
  );
  console.log("");

  const report =
    await buildSmartPickReport(
      200,
    );

  console.log(
    "VERI AYRIMI",
  );

  console.table({
    "Toplam maç":
      report.totalEvaluatedPredictions,

    "Training maç":
      report.trainingPredictionCount,

    "Validation maç":
      report.validationPredictionCount,

    "Training genel başarı %":
      report.trainingBaselineAccuracy,

    "Validation genel başarı %":
      report.validationBaselineAccuracy,
  });

  if (!report.rule) {
    console.log("");
    console.log(
      "Training verisinde yeterli örnekleme sahip Smart Pick kuralı bulunamadı.",
    );

    return;
  }

  console.log("");
  console.log(
    "TRAINING VERISINDE SECILEN KURAL",
  );

  console.table({
    "Minimum olasılık":
      `%${report.rule.minimumProbability}`,

    "Minimum güven":
      report.rule.minimumConfidence,

    "Training Smart Pick":
      report.rule.sampleSize,

    "Training doğru":
      report.rule.correctPredictions,

    "Training başarı %":
      report.rule.accuracy,

    "Training kapsama %":
      report.rule.coveragePercentage,

    "Kural puanı":
      report.rule.score,
  });

  console.log("");
  console.log(
    "EN IYI TRAINING KURALLARI",
  );

  console.table(
    report.testedRules
      .slice(0, 10)
      .map(
        (rule) => ({
          "min olasılık":
            `%${rule.minimumProbability}`,

          "min güven":
            rule.minimumConfidence,

          maç:
            rule.sampleSize,

          doğru:
            rule.correctPredictions,

          "başarı %":
            rule.accuracy,

          "kapsama %":
            rule.coveragePercentage,

          puan:
            rule.score,
        }),
      ),
  );

  if (!report.validation) {
    console.log("");
    console.log(
      "Validation sonucu oluşturulamadı.",
    );

    return;
  }

  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "GERCEK VALIDATION SONUCU",
  );
  console.log(
    "========================================",
  );

  console.table({
    "Validation toplam maç":
      report.validationPredictionCount,

    "Smart Pick maç":
      report.validation.sampleSize,

    "Smart Pick doğru":
      report.validation
        .correctPredictions,

    "Smart Pick yanlış":
      report.validation
        .incorrectPredictions,

    "Smart Pick başarı %":
      report.validation.accuracy,

    "Validation genel başarı %":
      report.validation
        .baselineAccuracy,

    "İyileşme":
      `${
        report.validation
          .improvementVsBaseline >= 0
          ? "+"
          : ""
      }${
        report.validation
          .improvementVsBaseline
      }%`,

    "Smart Pick kapsama %":
      report.validation
        .coveragePercentage,
  });

  console.log("");
  console.log(
    "VALIDATION SMART PICKS",
  );

  console.table(
    report.validationPicks.map(
      (prediction) => ({
        tarih:
          prediction.kickoffAt
            .toISOString()
            .slice(
              0,
              10,
            ),

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
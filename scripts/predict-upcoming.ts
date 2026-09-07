import { prisma } from "@/lib/prisma";

import {
  generateMatchPrediction,
} from "@/modules/prediction-engine";

type RankedPrediction = {
  matchId: number;
  kickoffAt: Date;

  homeTeam: string;
  awayTeam: string;

  homeProbability: number;
  drawProbability: number;
  awayProbability: number;

  predictedOutcome:
    | "HOME"
    | "DRAW"
    | "AWAY";

  predictedProbability: number;

  confidenceScore: number;
  confidenceLevel: string;

  warnings: string[];
};

const DEFAULT_DAYS_AHEAD = 7;

function getDaysAhead(): number {
  const rawValue =
    process.env.PREDICTION_DAYS;

  if (!rawValue) {
    return DEFAULT_DAYS_AHEAD;
  }

  const parsedValue =
    Number.parseInt(rawValue, 10);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0 ||
    parsedValue > 30
  ) {
    return DEFAULT_DAYS_AHEAD;
  }

  return parsedValue;
}

function getOutcomeLabel(
  outcome: "HOME" | "DRAW" | "AWAY",
  homeTeam: string,
  awayTeam: string,
): string {
  if (outcome === "HOME") {
    return `${homeTeam} kazanır`;
  }

  if (outcome === "AWAY") {
    return `${awayTeam} kazanır`;
  }

  return "Beraberlik";
}

function getConfidenceLabel(
  probability: number,
  confidenceScore: number,
): string {
  /*
   * Burada yalnızca model confidence değerine
   * güvenmiyoruz. En yüksek sonuç olasılığını da
   * dikkate alıyoruz.
   */

  if (
    probability >= 65 &&
    confidenceScore >= 70
  ) {
    return "YÜKSEK";
  }

  if (
    probability >= 57 &&
    confidenceScore >= 50
  ) {
    return "ORTA";
  }

  return "DÜŞÜK";
}

function formatPercentage(
  value: number,
): string {
  return `%${value.toFixed(2)}`;
}

function formatDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    },
  ).format(value);
}

async function main(): Promise<void> {
  const daysAhead =
    getDaysAhead();

 const configuredFrom =
  process.env.PREDICTION_FROM?.trim();

const configuredTo =
  process.env.PREDICTION_TO?.trim();

const now =
  configuredFrom
    ? new Date(`${configuredFrom}T00:00:00.000Z`)
    : new Date();

const endDate =
  configuredTo
    ? new Date(`${configuredTo}T23:59:59.999Z`)
    : new Date(now);

if (!configuredTo) {
  endDate.setDate(
    endDate.getDate() + daysAhead,
  );
}

if (
  Number.isNaN(now.getTime()) ||
  Number.isNaN(endDate.getTime())
) {
  throw new Error(
    "PREDICTION_FROM veya PREDICTION_TO tarihi geçersizdir.",
  );
}

if (now > endDate) {
  throw new Error(
    "PREDICTION_FROM tarihi PREDICTION_TO tarihinden sonra olamaz.",
  );
}

  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "       YAKLAŞAN MAÇ TAHMİNLERİ",
  );
  console.log(
    "==============================================",
  );
  console.log(
    `Tarih aralığı: ${formatDate(now)} - ${formatDate(endDate)}`,
  );
  console.log("");

  const upcomingMatches =
    await prisma.match.findMany({
      where: {
        status: "SCHEDULED",

        kickoffAt: {
          gte: now,
          lt: endDate,
        },
      },

      select: {
        id: true,
        kickoffAt: true,

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

      orderBy: {
        kickoffAt: "asc",
      },
    });

  if (upcomingMatches.length === 0) {
    console.log(
      `Önümüzdeki ${daysAhead} gün içinde veritabanında planlanmış maç bulunamadı.`,
    );

    console.log("");
    console.log(
      "Önce güncel fixture verilerinin veritabanına aktarılması gerekir.",
    );

    return;
  }

  console.log(
    `Bulunan maç sayısı: ${upcomingMatches.length}`,
  );
  console.log("");

  const predictions:
    RankedPrediction[] = [];

  const failedMatches: Array<{
    matchId: number;
    match: string;
    error: string;
  }> = [];

  for (
    let index = 0;
    index < upcomingMatches.length;
    index += 1
  ) {
    const match =
      upcomingMatches[index];

    const matchName =
      `${match.homeTeam.name} - ${match.awayTeam.name}`;

    process.stdout.write(
      `[${index + 1}/${upcomingMatches.length}] ${matchName} analiz ediliyor... `,
    );

    try {
      const prediction =
        await generateMatchPrediction({
          matchId: match.id,
        });

      if (
        prediction.predictedOutcome === null ||
        prediction.predictedProbability === null
      ) {
        throw new Error(
          "Yeterli rating veya feature verisi bulunamadı.",
        );
      }

      predictions.push({
        matchId: match.id,
        kickoffAt: match.kickoffAt,

        homeTeam:
          match.homeTeam.name,

        awayTeam:
          match.awayTeam.name,

        homeProbability:
          prediction
            .calibratedProbabilities
            .home,

        drawProbability:
          prediction
            .calibratedProbabilities
            .draw,

        awayProbability:
          prediction
            .calibratedProbabilities
            .away,

        predictedOutcome:
          prediction.predictedOutcome,

        predictedProbability:
          prediction.predictedProbability,

        confidenceScore:
          prediction.combinedConfidenceScore,

        confidenceLevel:
          prediction.combinedConfidenceLevel,

        warnings:
          prediction.warnings,
      });

      console.log("TAMAM");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      failedMatches.push({
        matchId: match.id,
        match: matchName,
        error: errorMessage,
      });

      console.log("BAŞARISIZ");
    }
  }

  /*
   * En yüksek tahmin olasılığı üstte olacak.
   *
   * Olasılıklar eşitse confidence değeri
   * yüksek olan maç önce gösterilir.
   */
  predictions.sort(
    (first, second) => {
      const probabilityDifference =
        second.predictedProbability -
        first.predictedProbability;

      if (
        Math.abs(
          probabilityDifference,
        ) > 0.001
      ) {
        return probabilityDifference;
      }

      return (
        second.confidenceScore -
        first.confidenceScore
      );
    },
  );

  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "          EN İYİ TAHMİNLER",
  );
  console.log(
    "==============================================",
  );
  console.log("");

  if (predictions.length === 0) {
    console.log(
      "Tahmin üretilebilen maç bulunamadı.",
    );
  }

  predictions.forEach(
    (prediction, index) => {
      const confidenceLabel =
        getConfidenceLabel(
          prediction.predictedProbability,
          prediction.confidenceScore,
        );

      const outcomeLabel =
        getOutcomeLabel(
          prediction.predictedOutcome,
          prediction.homeTeam,
          prediction.awayTeam,
        );

      console.log(
        `${index + 1}. ${prediction.homeTeam} - ${prediction.awayTeam}`,
      );

      console.log(
        `   Tarih: ${formatDate(prediction.kickoffAt)}`,
      );

      console.log(
        `   Ev sahibi: ${formatPercentage(prediction.homeProbability)}`,
      );

      console.log(
        `   Beraberlik: ${formatPercentage(prediction.drawProbability)}`,
      );

      console.log(
        `   Deplasman: ${formatPercentage(prediction.awayProbability)}`,
      );

      console.log(
        `   En iyi tahmin: ${outcomeLabel}`,
      );

      console.log(
        `   Tahmin olasılığı: ${formatPercentage(prediction.predictedProbability)}`,
      );

      console.log(
        `   Güven: ${confidenceLabel} (${prediction.confidenceScore.toFixed(2)}/100)`,
      );

      if (
        prediction.warnings.length > 0
      ) {
        console.log(
          `   Uyarı: ${prediction.warnings[0]}`,
        );
      }

      console.log("");
    },
  );

  const highConfidence =
    predictions.filter(
      (prediction) =>
        getConfidenceLabel(
          prediction.predictedProbability,
          prediction.confidenceScore,
        ) === "YÜKSEK",
    ).length;

  const mediumConfidence =
    predictions.filter(
      (prediction) =>
        getConfidenceLabel(
          prediction.predictedProbability,
          prediction.confidenceScore,
        ) === "ORTA",
    ).length;

  const lowConfidence =
    predictions.length -
    highConfidence -
    mediumConfidence;

  console.log(
    "==============================================",
  );
  console.log(
    "                 ÖZET",
  );
  console.log(
    "==============================================",
  );

  console.log(
    `Toplam yaklaşan maç: ${upcomingMatches.length}`,
  );

  console.log(
    `Tahmin üretildi: ${predictions.length}`,
  );

  console.log(
    `Yüksek güven: ${highConfidence}`,
  );

  console.log(
    `Orta güven: ${mediumConfidence}`,
  );

  console.log(
    `Düşük güven: ${lowConfidence}`,
  );

  console.log(
    `Başarısız: ${failedMatches.length}`,
  );

  if (failedMatches.length > 0) {
    console.log("");
    console.log(
      "Tahmin üretilemeyen maçlar:",
    );

    for (
      const failedMatch
      of failedMatches
    ) {
      console.log(
        `- ${failedMatch.match}: ${failedMatch.error}`,
      );
    }
  }

  console.log("");
  console.log(
    `Güncelleme zamanı: ${formatDate(new Date())}`,
  );
  console.log(
    "==============================================",
  );
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error(
      "Yaklaşan maç tahmini başarısız oldu.",
    );

    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
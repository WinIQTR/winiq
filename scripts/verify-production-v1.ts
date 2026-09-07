import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

import {
  loadDashboardPredictions,
} from "@/lib/prediction-dashboard";

type VerificationStatus =
  | "PASS"
  | "WARNING"
  | "FAIL";

type VerificationResult = {
  test: string;
  status: VerificationStatus;
  detail: string;
};

const LOOKAHEAD_DAYS =
  30;

const PREDICTION_TEST_LIMIT =
  10;

function addDays(
  value: Date,
  days: number,
): Date {
  const result =
    new Date(
      value,
    );

  result.setUTCDate(
    result.getUTCDate() +
      days,
  );

  return result;
}

function printSection(
  title: string,
): void {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    title,
  );

  console.log(
    "==============================================",
  );
}

function addResult(
  results: VerificationResult[],
  test: string,
  status: VerificationStatus,
  detail: string,
): void {
  results.push({
    test,
    status,
    detail,
  });
}

async function main(): Promise<void> {
  const results:
    VerificationResult[] =
      [];

  const now =
    new Date();

  const until =
    addDays(
      now,
      LOOKAHEAD_DAYS,
    );

  printSection(
    "BET PROJECT — V1 PRODUCTION VERIFICATION",
  );

  console.table({
    "Aktif sezon":
      ACTIVE_SEASON_YEAR,

    "Aktif organizasyon":
      ACTIVE_COMPETITIONS.length,

    "Kontrol başlangıcı":
      now.toISOString(),

    "Kontrol bitişi":
      until.toISOString(),

    "Tahmin test limiti":
      PREDICTION_TEST_LIMIT,
  });

  /*
   * 1. Aktif sezon kontrolü
   */
  if (
    ACTIVE_SEASON_YEAR ===
    2026
  ) {
    addResult(
      results,
      "Aktif sezon",
      "PASS",
      "Aktif sezon 2026.",
    );
  } else {
    addResult(
      results,
      "Aktif sezon",
      "FAIL",
      `Beklenen 2026, bulunan ${ACTIVE_SEASON_YEAR}.`,
    );
  }

  /*
   * 2. Organizasyon konfigürasyonu
   */
  if (
    ACTIVE_COMPETITIONS.length ===
    9
  ) {
    addResult(
      results,
      "Organizasyon konfigürasyonu",
      "PASS",
      "9 aktif organizasyon tanımlı.",
    );
  } else {
    addResult(
      results,
      "Organizasyon konfigürasyonu",
      "WARNING",
      `${ACTIVE_COMPETITIONS.length} aktif organizasyon tanımlı.`,
    );
  }

  /*
   * 3. Sezon kayıtları
   */
  const seasonRecords =
    await prisma.season.findMany({
      where: {
        year:
          ACTIVE_SEASON_YEAR,

        league: {
          apiId: {
            in:
              ACTIVE_COMPETITIONS.map(
                (
                  competition,
                ) =>
                  competition.apiId,
              ),
          },
        },
      },

      select: {
        id:
          true,

        league: {
          select: {
            apiId:
              true,

            name:
              true,
          },
        },
      },
    });

  if (
    seasonRecords.length ===
    ACTIVE_COMPETITIONS.length
  ) {
    addResult(
      results,
      "Season kayıtları",
      "PASS",
      `${seasonRecords.length}/${ACTIVE_COMPETITIONS.length} organizasyon için sezon kaydı mevcut.`,
    );
  } else {
    addResult(
      results,
      "Season kayıtları",
      "FAIL",
      `${seasonRecords.length}/${ACTIVE_COMPETITIONS.length} organizasyon için sezon kaydı bulundu.`,
    );
  }

  /*
   * 4. Yaklaşan fikstür kontrolü
   */
  const upcomingMatches =
    await prisma.match.findMany({
      where: {
        status:
          "SCHEDULED",

        kickoffAt: {
          gte:
            now,

          lt:
            until,
        },

        season: {
          year:
            ACTIVE_SEASON_YEAR,

          league: {
            apiId: {
              in:
                ACTIVE_COMPETITIONS.map(
                  (
                    competition,
                  ) =>
                    competition.apiId,
                ),
            },
          },
        },
      },

      select: {
        id:
          true,

        kickoffAt:
          true,

        season: {
          select: {
            league: {
              select: {
                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },

        homeTeam: {
          select: {
            name:
              true,
          },
        },

        awayTeam: {
          select: {
            name:
              true,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },
    });

  if (
    upcomingMatches.length >
    0
  ) {
    addResult(
      results,
      "Yaklaşan fikstür",
      "PASS",
      `${upcomingMatches.length} yaklaşan maç bulundu.`,
    );
  } else {
    addResult(
      results,
      "Yaklaşan fikstür",
      "FAIL",
      "Önümüzdeki 30 gün için maç bulunamadı.",
    );
  }

  /*
   * 5. Organizasyon bazında maç dağılımı
   */
  const matchesByCompetition =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) => {
        const matchCount =
          upcomingMatches.filter(
            (
              match,
            ) =>
              match
                .season
                .league
                .apiId ===
              competition.apiId,
          ).length;

        return {
          apiId:
            competition.apiId,

          organizasyon:
            competition.name,

          tür:
            competition.kind,

          maç:
            matchCount,

          durum:
            matchCount >
            0
              ? "OK"
              : "BOŞ",
        };
      },
    );

  printSection(
    "UPCOMING MATCH COVERAGE",
  );

  console.table(
    matchesByCompetition,
  );

  const competitionsWithMatches =
    matchesByCompetition.filter(
      (
        item,
      ) =>
        item.maç >
        0,
    ).length;

  if (
    competitionsWithMatches ===
    ACTIVE_COMPETITIONS.length
  ) {
    addResult(
      results,
      "Organizasyon fikstür kapsamı",
      "PASS",
      "Tüm organizasyonlarda yaklaşan maç mevcut.",
    );
  } else if (
    competitionsWithMatches >
    0
  ) {
    addResult(
      results,
      "Organizasyon fikstür kapsamı",
      "WARNING",
      `${competitionsWithMatches}/${ACTIVE_COMPETITIONS.length} organizasyonda yaklaşan maç mevcut.`,
    );
  } else {
    addResult(
      results,
      "Organizasyon fikstür kapsamı",
      "FAIL",
      "Hiçbir organizasyonda yaklaşan maç bulunamadı.",
    );
  }

  /*
   * 6. Takım bağlantıları
   */
  const invalidTeamMatches =
    upcomingMatches.filter(
      (
        match,
      ) =>
        !match.homeTeam.name ||
        !match.awayTeam.name,
    );

  if (
    invalidTeamMatches.length ===
    0
  ) {
    addResult(
      results,
      "Takım bağlantıları",
      "PASS",
      "Yaklaşan maçların ev ve deplasman takımları mevcut.",
    );
  } else {
    addResult(
      results,
      "Takım bağlantıları",
      "FAIL",
      `${invalidTeamMatches.length} maçta takım bağlantısı eksik.`,
    );
  }

  /*
   * 7. Gerçek tahmin motoru testi
   */
  printSection(
    "LIVE PREDICTION PIPELINE TEST",
  );

  let predictions:
    Awaited<
      ReturnType<
        typeof loadDashboardPredictions
      >
    > =
      [];

  try {
    predictions =
      await loadDashboardPredictions(
        PREDICTION_TEST_LIMIT,
      );

    if (
      predictions.length >
      0
    ) {
      addResult(
        results,
        "Prediction Engine",
        "PASS",
        `${predictions.length} gerçek yaklaşan maç tahmini üretildi.`,
      );
    } else {
      addResult(
        results,
        "Prediction Engine",
        "FAIL",
        "Tahmin motoru sonuç üretmedi.",
      );
    }
  } catch (
    error: unknown
  ) {
    addResult(
      results,
      "Prediction Engine",
      "FAIL",
      error instanceof Error
        ? error.message
        : String(
            error,
          ),
    );
  }

  /*
   * 8. Tahmin içerik doğrulaması
   */
  const predictionRows =
    predictions.map(
      (
        prediction,
      ) => {
        const probabilityTotal =
          prediction.homeProbability +
          prediction.drawProbability +
          prediction.awayProbability;

        return {
          maç:
            `${prediction.homeTeam} - ${prediction.awayTeam}`,

          lig:
            prediction.leagueName,

          tarih:
            prediction.kickoffAt.toISOString(),

          home:
            prediction.homeProbability.toFixed(
              2,
            ),

          draw:
            prediction.drawProbability.toFixed(
              2,
            ),

          away:
            prediction.awayProbability.toFixed(
              2,
            ),

          toplam:
            probabilityTotal.toFixed(
              2,
            ),

          xG:
            `${prediction.expectedHomeGoals.toFixed(2)} - ${prediction.expectedAwayGoals.toFixed(2)}`,

          picks:
            prediction.topPicks.length,

          güven:
            prediction.confidenceLevel,

          mode:
            prediction.dataMode,
        };
      },
    );

  if (
    predictionRows.length >
    0
  ) {
    console.table(
      predictionRows,
    );
  }

  const predictionsWithoutTopPicks =
    predictions.filter(
      (
        prediction,
      ) =>
        prediction.topPicks.length ===
        0,
    );

  if (
    predictions.length ===
    0
  ) {
    addResult(
      results,
      "Top Picks",
      "FAIL",
      "Kontrol edilecek tahmin bulunamadı.",
    );
  } else if (
    predictionsWithoutTopPicks.length ===
    0
  ) {
    addResult(
      results,
      "Top Picks",
      "PASS",
      "Tüm test tahminlerinde Top Picks üretildi.",
    );
  } else {
    addResult(
      results,
      "Top Picks",
      "WARNING",
      `${predictionsWithoutTopPicks.length} tahminde Top Picks bulunmuyor.`,
    );
  }

  const invalidProbabilityPredictions =
    predictions.filter(
      (
        prediction,
      ) => {
        const total =
          prediction.homeProbability +
          prediction.drawProbability +
          prediction.awayProbability;

        return (
          !Number.isFinite(
            total,
          ) ||
          Math.abs(
            total -
              100,
          ) >
            1
        );
      },
    );

  if (
    predictions.length >
      0 &&
    invalidProbabilityPredictions.length ===
      0
  ) {
    addResult(
      results,
      "1X2 olasılık toplamı",
      "PASS",
      "Test edilen tahminlerde 1X2 toplamı yaklaşık %100.",
    );
  } else if (
    invalidProbabilityPredictions.length >
    0
  ) {
    addResult(
      results,
      "1X2 olasılık toplamı",
      "FAIL",
      `${invalidProbabilityPredictions.length} tahminde olasılık toplamı hatalı.`,
    );
  }

  const invalidExpectedGoals =
    predictions.filter(
      (
        prediction,
      ) =>
        !Number.isFinite(
          prediction.expectedHomeGoals,
        ) ||
        !Number.isFinite(
          prediction.expectedAwayGoals,
        ) ||
        prediction.expectedHomeGoals <
          0 ||
        prediction.expectedAwayGoals <
          0,
    );

  if (
    predictions.length >
      0 &&
    invalidExpectedGoals.length ===
      0
  ) {
    addResult(
      results,
      "Expected Goals",
      "PASS",
      "Test edilen tahminlerin xG değerleri geçerli.",
    );
  } else if (
    invalidExpectedGoals.length >
    0
  ) {
    addResult(
      results,
      "Expected Goals",
      "FAIL",
      `${invalidExpectedGoals.length} tahminde geçersiz xG bulundu.`,
    );
  }

  const nonLivePredictions =
    predictions.filter(
      (
        prediction,
      ) =>
        prediction.dataMode !==
        "LIVE",
    );

  if (
    predictions.length >
      0 &&
    nonLivePredictions.length ===
      0
  ) {
    addResult(
      results,
      "Tahmin veri modu",
      "PASS",
      "Tüm tahminler LIVE veri modunda.",
    );
  } else if (
    nonLivePredictions.length >
    0
  ) {
    addResult(
      results,
      "Tahmin veri modu",
      "FAIL",
      `${nonLivePredictions.length} tahmin LIVE modunda değil.`,
    );
  }

  /*
   * Sonuç
   */
  printSection(
    "V1 VERIFICATION RESULT",
  );

  console.table(
    results,
  );

  const failedTests =
    results.filter(
      (
        result,
      ) =>
        result.status ===
        "FAIL",
    );

  const warningTests =
    results.filter(
      (
        result,
      ) =>
        result.status ===
        "WARNING",
    );

  console.log("");

  console.table({
    "Toplam test":
      results.length,

    Başarılı:
      results.length -
      failedTests.length -
      warningTests.length,

    Uyarı:
      warningTests.length,

    Hatalı:
      failedTests.length,
  });

  if (
    failedTests.length >
    0
  ) {
    console.log("");
    console.error(
      "V1 doğrulaması başarısız. Kritik test hataları mevcut.",
    );

    process.exitCode =
      1;

    return;
  }

  if (
    warningTests.length >
    0
  ) {
    console.log("");
    console.log(
      "V1 temel olarak çalışıyor; kritik olmayan uyarılar mevcut.",
    );

    process.exitCode =
      0;

    return;
  }

  console.log("");
  console.log(
    "V1 PRODUCTION VERIFICATION BAŞARILI.",
  );

  console.log(
    "Fikstür, veritabanı, tahmin motoru, xG ve Top Picks sistemi çalışıyor.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "V1 production verification çalıştırılamadı.",
      );

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
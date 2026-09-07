import "dotenv/config";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchPrediction,
} from "@/modules/prediction-engine";

import type {
  MatchPredictionResult,
} from "@/modules/prediction-engine";

type ConfidenceLevel =
  | "VERY_HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "VERY_LOW";

type MatchOutcome =
  | "HOME"
  | "DRAW"
  | "AWAY";

type PredictionRow = {
  matchId: number;
  fixtureApiId: number;
  kickoffAt: Date;
  seasonYear: number;
  leagueApiId: number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  predictedOutcome: MatchOutcome;
  predictedProbability: number;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  dataQualityScore: number;
  probabilityGap: number;
  leagueMatches: number;
  homeVenueMatches: number;
  awayVenueMatches: number;
  drawAuditWouldApply: boolean;
  drawGap: number;
  fairOdds: number;
  warningCount: number;
  mlFallback: boolean;
  productionModelName: string;
  productionScore: number;
};

type LeagueSummary = {
  leagueApiId: number;
  leagueName: string;
  matches: number;
  successfulEnsemble: number;
  mlFallbacks: number;
  veryHigh: number;
  high: number;
  medium: number;
  low: number;
  veryLow: number;
  homePredictions: number;
  drawPredictions: number;
  awayPredictions: number;
  drawAuditSignals: number;
  averageProbability: number;
  averageConfidence: number;
  averageDataQuality: number;
  averageHomeVenueMatches: number;
  averageAwayVenueMatches: number;
};

const DEFAULT_BATCH_LIMIT = 300;
const MAXIMUM_BATCH_LIMIT = 500;
const DEFAULT_DAYS_AHEAD = 60;
const SELECTION_POLICY_VERSION = "selection-policy-v2";
const MINIMUM_PUBLISHABLE_PROBABILITY = 60;
const MINIMUM_PUBLISHABLE_DATA_QUALITY = 65;
const LOW_DATA_QUALITY_THRESHOLD = 50;

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function readPositiveInteger(
  rawValue: string | undefined,
  fallback: number,
  maximum: number,
): number {
  if (!rawValue?.trim()) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue.trim(), 10);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0 ||
    parsedValue > maximum
  ) {
    return fallback;
  }

  return parsedValue;
}

function getBatchLimit(): number {
  return readPositiveInteger(
    process.env.PREDICTION_BATCH_LIMIT,
    DEFAULT_BATCH_LIMIT,
    MAXIMUM_BATCH_LIMIT,
  );
}

function getDaysAhead(): number {
  return readPositiveInteger(
    process.env.PREDICTION_BATCH_DAYS,
    DEFAULT_DAYS_AHEAD,
    180,
  );
}

function addDays(
  date: Date,
  days: number,
): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function confidenceRank(
  level: ConfidenceLevel,
): number {
  switch (level) {
    case "VERY_HIGH":
      return 5;
    case "HIGH":
      return 4;
    case "MEDIUM":
      return 3;
    case "LOW":
      return 2;
    case "VERY_LOW":
      return 1;
  }
}

function getFairOdds(
  prediction: MatchPredictionResult,
): number {
  switch (prediction.predictedOutcome) {
    case "HOME":
      return prediction.finalFairOdds.home;
    case "DRAW":
      return prediction.finalFairOdds.draw;
    case "AWAY":
      return prediction.finalFairOdds.away;
  }
}

function calculateProductionScore(options: {
  probability: number;
  confidence: number;
  dataQuality: number;
  probabilityGap: number;
}): number {
  /*
   * Bu puan yeni bir tahmin modeli değildir.
   * Yalnızca batch sonuçlarını sıralar; olasılıkları değiştirmez.
   */
  const probabilityComponent = options.probability * 0.35;
  const confidenceComponent = options.confidence * 0.35;
  const dataQualityComponent = options.dataQuality * 0.2;
  const normalizedGap = Math.min(
    (options.probabilityGap / 30) * 100,
    100,
  );
  const gapComponent = normalizedGap * 0.1;

  return round(
    probabilityComponent +
      confidenceComponent +
      dataQualityComponent +
      gapComponent,
  );
}

function isMlFallback(
  productionModelName: string,
): boolean {
  return productionModelName
    .toLocaleLowerCase("en-US")
    .includes("fallback");
}

function createPredictionRow(options: {
  matchId: number;
  fixtureApiId: number;
  kickoffAt: Date;
  seasonYear: number;
  leagueApiId: number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  prediction: MatchPredictionResult;
}): PredictionRow {
  const confidence = options.prediction.poissonConfidence;
  const productionModelName =
    options.prediction.model.productionModelName;

  return {
    matchId: options.matchId,
    fixtureApiId: options.fixtureApiId,
    kickoffAt: options.kickoffAt,
    seasonYear: options.seasonYear,
    leagueApiId: options.leagueApiId,
    leagueName: options.leagueName,
    homeTeam: options.homeTeam,
    awayTeam: options.awayTeam,
    predictedOutcome: options.prediction.predictedOutcome,
    predictedProbability: options.prediction.predictedProbability,
    homeProbability: options.prediction.finalProbabilities.home,
    drawProbability: options.prediction.finalProbabilities.draw,
    awayProbability: options.prediction.finalProbabilities.away,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    dataQualityScore: confidence.dataQualityScore,
    probabilityGap: confidence.probabilityGap,
    leagueMatches: confidence.dataQuality.leagueMatches,
    homeVenueMatches: confidence.dataQuality.homeVenueMatches,
    awayVenueMatches: confidence.dataQuality.awayVenueMatches,
    drawAuditWouldApply: options.prediction.drawDecision.applied,
    drawGap: options.prediction.drawDecision.drawGap,
    fairOdds: getFairOdds(options.prediction),
    warningCount: options.prediction.warnings.length,
    mlFallback: isMlFallback(productionModelName),
    productionModelName,
    productionScore: calculateProductionScore({
      probability: options.prediction.predictedProbability,
      confidence: confidence.score,
      dataQuality: confidence.dataQualityScore,
      probabilityGap: confidence.probabilityGap,
    }),
  };
}

function countByConfidence(
  rows: PredictionRow[],
  level: ConfidenceLevel,
): number {
  return rows.filter((row) => row.confidenceLevel === level).length;
}

function countByOutcome(
  rows: PredictionRow[],
  outcome: MatchOutcome,
): number {
  return rows.filter((row) => row.predictedOutcome === outcome).length;
}

function average(
  rows: PredictionRow[],
  selector: (row: PredictionRow) => number,
): number {
  if (rows.length === 0) {
    return 0;
  }

  return round(
    rows.reduce((total, row) => total + selector(row), 0) /
      rows.length,
  );
}

function buildLeagueSummaries(
  rows: PredictionRow[],
): LeagueSummary[] {
  const leagueGroups = new Map<number, PredictionRow[]>();

  for (const row of rows) {
    const existing = leagueGroups.get(row.leagueApiId);

    if (existing) {
      existing.push(row);
    } else {
      leagueGroups.set(row.leagueApiId, [row]);
    }
  }

  const summaries: LeagueSummary[] = [];

  for (const [leagueApiId, leagueRows] of leagueGroups.entries()) {
    const first = leagueRows[0];

    summaries.push({
      leagueApiId,
      leagueName: first.leagueName,
      matches: leagueRows.length,
      successfulEnsemble: leagueRows.filter((row) => !row.mlFallback).length,
      mlFallbacks: leagueRows.filter((row) => row.mlFallback).length,
      veryHigh: countByConfidence(leagueRows, "VERY_HIGH"),
      high: countByConfidence(leagueRows, "HIGH"),
      medium: countByConfidence(leagueRows, "MEDIUM"),
      low: countByConfidence(leagueRows, "LOW"),
      veryLow: countByConfidence(leagueRows, "VERY_LOW"),
      homePredictions: countByOutcome(leagueRows, "HOME"),
      drawPredictions: countByOutcome(leagueRows, "DRAW"),
      awayPredictions: countByOutcome(leagueRows, "AWAY"),
      drawAuditSignals: leagueRows.filter(
        (row) => row.drawAuditWouldApply,
      ).length,
      averageProbability: average(
        leagueRows,
        (row) => row.predictedProbability,
      ),
      averageConfidence: average(
        leagueRows,
        (row) => row.confidenceScore,
      ),
      averageDataQuality: average(
        leagueRows,
        (row) => row.dataQualityScore,
      ),
      averageHomeVenueMatches: average(
        leagueRows,
        (row) => row.homeVenueMatches,
      ),
      averageAwayVenueMatches: average(
        leagueRows,
        (row) => row.awayVenueMatches,
      ),
    });
  }

  return summaries.sort(
    (first, second) =>
      second.averageConfidence - first.averageConfidence,
  );
}

function formatRatio(
  count: number,
  total: number,
): string {
  return total > 0
    ? `${round((count / total) * 100)}%`
    : "0%";
}

function toDisplayRow(
  row: PredictionRow,
  rank?: number,
): Record<string, unknown> {
  return {
    ...(rank === undefined ? {} : { rank }),
    matchId: row.matchId,
    date: row.kickoffAt.toISOString().slice(0, 16),
    season: row.seasonYear,
    league: row.leagueName,
    match: `${row.homeTeam} - ${row.awayTeam}`,
    prediction: row.predictedOutcome,
    probability: `${round(row.predictedProbability, 3)}%`,
    confidence: row.confidenceScore,
    level: row.confidenceLevel,
    dataQuality: row.dataQualityScore,
    gap: row.probabilityGap,
    fairOdds: row.fairOdds,
    homeVenue: row.homeVenueMatches,
    awayVenue: row.awayVenueMatches,
    mlFallback: row.mlFallback ? "YES" : "NO",
    drawAudit: row.drawAuditWouldApply ? "YES" : "NO",
    score: row.productionScore,
  };
}

async function main(): Promise<void> {
  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION PREDICTION BATCH V2");
  console.log("==============================================");

  const batchLimit = getBatchLimit();
  const daysAhead = getDaysAhead();
  const now = new Date();
  const endDate = addDays(now, daysAhead);

  /*
   * Sezon yılı bilinçli olarak filtrelenmez.
   * Tarih aralığındaki aktif organizasyon kayıtları kendi sezonlarıyla gelir.
   * Böylece eski ACTIVE_SEASON_YEAR değeri gelecek maçları gizleyemez.
   */
  const matches = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      kickoffAt: {
        gte: now,
        lte: endDate,
      },
      season: {
        league: {
          apiId: {
            in: [...ACTIVE_COMPETITION_API_IDS],
          },
        },
      },
    },
    orderBy: [
      { kickoffAt: "asc" },
      { id: "asc" },
    ],
    take: batchLimit,
    select: {
      id: true,
      apiId: true,
      kickoffAt: true,
      status: true,
      homeTeam: {
        select: { name: true },
      },
      awayTeam: {
        select: { name: true },
      },
      season: {
        select: {
          year: true,
          league: {
            select: {
              apiId: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const seasonYears = [
    ...new Set(matches.map((match) => match.season.year)),
  ].sort((first, second) => first - second);

  console.table({
    "Seçim politikası": SELECTION_POLICY_VERSION,
    "Minimum olasılık": `%${MINIMUM_PUBLISHABLE_PROBABILITY}`,
    "Minimum confidence": "HIGH",
    "Minimum veri kalitesi": MINIMUM_PUBLISHABLE_DATA_QUALITY,
    "Minimum venue maçı": "YOK — V2 holdout sonucuna göre",
    "Sezon filtresi": "YOK — tarihe göre otomatik",
    "Bulunan sezonlar": seasonYears.length > 0
      ? seasonYears.join(", ")
      : "—",
    "Gün aralığı": daysAhead,
    "Batch limit": batchLimit,
    "Bulunan maç": matches.length,
    Başlangıç: now.toISOString(),
    Bitiş: endDate.toISOString(),
  });

  if (matches.length === 0) {
    const futureDiagnostic = await prisma.match.findFirst({
      where: {
        status: "SCHEDULED",
        kickoffAt: { gte: now },
        season: {
          league: {
            apiId: {
              in: [...ACTIVE_COMPETITION_API_IDS],
            },
          },
        },
      },
      orderBy: { kickoffAt: "asc" },
      select: {
        kickoffAt: true,
        season: {
          select: { year: true },
        },
      },
    });

    console.log("");
    console.log("Seçilen tarih aralığında yaklaşan SCHEDULED maç bulunamadı.");

    if (futureDiagnostic) {
      console.table({
        "İlk sonraki maç": futureDiagnostic.kickoffAt.toISOString(),
        Sezon: futureDiagnostic.season.year,
        Öneri: "PREDICTION_BATCH_DAYS değerini artırın.",
      });
    }

    process.exitCode = 1;
    return;
  }

  const resultRows: PredictionRow[] = [];
  const failedRows: Array<Record<string, unknown>> = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];

    console.log("");
    console.log(
      [
        `[${index + 1}/${matches.length}]`,
        `[${match.season.league.name}]`,
        `${match.homeTeam.name} - ${match.awayTeam.name}`,
      ].join(" "),
    );

    try {
      const prediction = await generateMatchPrediction({
        matchId: match.id,
      });

      const row = createPredictionRow({
        matchId: match.id,
        fixtureApiId: match.apiId,
        kickoffAt: match.kickoffAt,
        seasonYear: match.season.year,
        leagueApiId: match.season.league.apiId,
        leagueName: match.season.league.name,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        prediction,
      });

      resultRows.push(row);

      console.log(
        [
          `Tahmin=${row.predictedOutcome}`,
          `%${round(row.predictedProbability, 3)}`,
          `Confidence=${row.confidenceScore}`,
          row.confidenceLevel,
          `Data=${row.dataQualityScore}`,
          row.mlFallback ? "ML_FALLBACK" : "ENSEMBLE_20_80",
          row.drawAuditWouldApply ? "DRAW_AUDIT=YES" : "DRAW_AUDIT=NO",
        ].join(" • "),
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);

      failedRows.push({
        matchId: match.id,
        fixtureApiId: match.apiId,
        league: match.season.league.name,
        match: `${match.homeTeam.name} - ${match.awayTeam.name}`,
        kickoff: match.kickoffAt.toISOString(),
        error: errorMessage,
      });

      console.error(`FAILED: ${errorMessage}`);
    }
  }

  const veryHigh = countByConfidence(resultRows, "VERY_HIGH");
  const high = countByConfidence(resultRows, "HIGH");
  const medium = countByConfidence(resultRows, "MEDIUM");
  const low = countByConfidence(resultRows, "LOW");
  const veryLow = countByConfidence(resultRows, "VERY_LOW");
  const homePredictions = countByOutcome(resultRows, "HOME");
  const drawPredictions = countByOutcome(resultRows, "DRAW");
  const awayPredictions = countByOutcome(resultRows, "AWAY");
  const mlFallbacks = resultRows.filter((row) => row.mlFallback).length;
  const drawAuditSignals = resultRows.filter(
    (row) => row.drawAuditWouldApply,
  ).length;
  const aboveProbabilityThreshold = resultRows.filter(
    (row) => row.predictedProbability >= MINIMUM_PUBLISHABLE_PROBABILITY,
  ).length;
  const lowDataQuality = resultRows.filter(
    (row) => row.dataQualityScore < LOW_DATA_QUALITY_THRESHOLD,
  );

  console.log("");
  console.log("==============================================");
  console.log("BATCH SUMMARY");
  console.log("==============================================");
  console.table({
    "Bulunan maç": matches.length,
    İşlenen: resultRows.length,
    Başarısız: failedRows.length,
    "20/80 ensemble": resultRows.length - mlFallbacks,
    "ML fallback": mlFallbacks,
    VERY_HIGH: veryHigh,
    HIGH: high,
    MEDIUM: medium,
    LOW: low,
    VERY_LOW: veryLow,
    HOME: homePredictions,
    DRAW: drawPredictions,
    AWAY: awayPredictions,
    "DRAW audit sinyali": drawAuditSignals,
    [`En az %${MINIMUM_PUBLISHABLE_PROBABILITY}`]:
      aboveProbabilityThreshold,
    [`Veri kalitesi < ${LOW_DATA_QUALITY_THRESHOLD}`]:
      lowDataQuality.length,
  });

  console.log("");
  console.log("==============================================");
  console.log("CONFIDENCE DISTRIBUTION");
  console.log("==============================================");
  console.table(
    ([
      "VERY_HIGH",
      "HIGH",
      "MEDIUM",
      "LOW",
      "VERY_LOW",
    ] as ConfidenceLevel[]).map((level) => {
      const count = countByConfidence(resultRows, level);
      return {
        level,
        matches: count,
        ratio: formatRatio(count, resultRows.length),
      };
    }),
  );

  const leagueSummaries = buildLeagueSummaries(resultRows);

  console.log("");
  console.log("==============================================");
  console.log("LEAGUE QUALITY SUMMARY");
  console.log("==============================================");
  console.table(
    leagueSummaries.map((league) => ({
      apiId: league.leagueApiId,
      league: league.leagueName,
      matches: league.matches,
      ensemble: league.successfulEnsemble,
      fallback: league.mlFallbacks,
      veryHigh: league.veryHigh,
      high: league.high,
      medium: league.medium,
      low: league.low,
      veryLow: league.veryLow,
      home: league.homePredictions,
      draw: league.drawPredictions,
      away: league.awayPredictions,
      avgProbability: league.averageProbability,
      avgConfidence: league.averageConfidence,
      avgDataQuality: league.averageDataQuality,
      avgHomeVenue: league.averageHomeVenueMatches,
      avgAwayVenue: league.averageAwayVenueMatches,
      drawAudit: league.drawAuditSignals,
    })),
  );

  const strongest = [...resultRows].sort((first, second) => {
    const confidenceDifference =
      confidenceRank(second.confidenceLevel) -
      confidenceRank(first.confidenceLevel);

    if (confidenceDifference !== 0) {
      return confidenceDifference;
    }

    return second.productionScore - first.productionScore;
  });

  console.log("");
  console.log("==============================================");
  console.log("TOP 30 REVIEW LIST — OTOMATİK YAYIN DEĞİL");
  console.log("==============================================");
  console.table(
    strongest
      .slice(0, 30)
      .map((row, index) => toDisplayRow(row, index + 1)),
  );

  /*
   * Selection Policy V2, 2025'in ilk kronolojik bölümünde seçildi ve
   * son %40'lık dokunulmamış holdout bölümünde doğrulandı:
   * 157 maç / 107 doğru / %68,15 doğruluk.
   *
   * DRAW production override değildir ve seçilen listede yer almaz.
   * Fallback sonuçları da doğrulanmış %20/%80 ensemble olmadığı için elenir.
   * Venue>=8 şartı eklenmez; final holdout'ta anlamlı ek fayda sağlamadı.
   */
  const policyEligible = strongest.filter(
    (row) =>
      !row.mlFallback &&
      row.predictedOutcome !== "DRAW" &&
      (
        row.confidenceLevel === "HIGH" ||
        row.confidenceLevel === "VERY_HIGH"
      ) &&
      row.dataQualityScore >= MINIMUM_PUBLISHABLE_DATA_QUALITY &&
      row.predictedProbability >= MINIMUM_PUBLISHABLE_PROBABILITY,
  );

  /*
   * Final holdout ayrımı:
   * HOME: 132 maç / 91 doğru / %68,94 — ana production adayı.
   * AWAY: 25 maç / 16 doğru / %64,00 — örneklem sınırlı, inceleme adayı.
   */
  const primaryHomeCandidates = policyEligible.filter(
    (row) => row.predictedOutcome === "HOME",
  );
  const limitedAwayCandidates = policyEligible.filter(
    (row) => row.predictedOutcome === "AWAY",
  );

  console.log("");
  console.log("==============================================");
  console.log("SELECTION POLICY V2 — PRIMARY HOME CANDIDATES");
  console.log("==============================================");

  if (primaryHomeCandidates.length === 0) {
    console.log(
      "Selection Policy V2'yi geçen ana HOME production adayı bulunamadı.",
    );
  } else {
    console.table(
      primaryHomeCandidates.map(
        (row, index) => toDisplayRow(row, index + 1),
      ),
    );
  }

  console.log("");
  console.log("==============================================");
  console.log("AWAY CANDIDATES — LIMITED HOLDOUT SAMPLE");
  console.log("==============================================");

  if (limitedAwayCandidates.length === 0) {
    console.log("Aynı V2 filtresini geçen AWAY inceleme adayı bulunamadı.");
  } else {
    console.table(
      limitedAwayCandidates.map(
        (row, index) => toDisplayRow(row, index + 1),
      ),
    );
    console.log(
      "Not: AWAY final holdout örneklemi 25 maçtır; site üzerinde ana öneriyle aynı güven etiketi kullanılmamalıdır.",
    );
  }

  const drawAuditRows = resultRows
    .filter((row) => row.drawAuditWouldApply)
    .sort(
      (first, second) =>
        second.drawProbability - first.drawProbability,
    );

  console.log("");
  console.log("==============================================");
  console.log("EXPERIMENTAL DRAW AUDIT — PRODUCTION DEĞİL");
  console.log("==============================================");

  if (drawAuditRows.length === 0) {
    console.log("Yaklaşan maçlarda DRAW audit sinyali bulunamadı.");
  } else {
    console.table(
      drawAuditRows.map((row, index) => ({
        rank: index + 1,
        matchId: row.matchId,
        league: row.leagueName,
        match: `${row.homeTeam} - ${row.awayTeam}`,
        productionPrediction: row.predictedOutcome,
        drawProbability: row.drawProbability,
        strongestProbability: row.predictedProbability,
        drawGap: row.drawGap,
        confidence: row.confidenceScore,
        level: row.confidenceLevel,
        dataQuality: row.dataQualityScore,
        note: "AUDIT ONLY",
      })),
    );
  }

  console.log("");
  console.log("==============================================");
  console.log("LOW DATA QUALITY MATCHES");
  console.log("==============================================");
  console.log(
    `Toplam düşük veri kaliteli maç: ${lowDataQuality.length}`,
  );

  if (lowDataQuality.length > 0) {
    console.table(
      [...lowDataQuality]
        .sort(
          (first, second) =>
            first.dataQualityScore - second.dataQualityScore,
        )
        .slice(0, 30)
        .map((row) => ({
          matchId: row.matchId,
          league: row.leagueName,
          match: `${row.homeTeam} - ${row.awayTeam}`,
          prediction: row.predictedOutcome,
          probability: row.predictedProbability,
          confidence: row.confidenceScore,
          dataQuality: row.dataQualityScore,
          leagueMatches: row.leagueMatches,
          homeVenue: row.homeVenueMatches,
          awayVenue: row.awayVenueMatches,
          mlFallback: row.mlFallback ? "YES" : "NO",
        })),
    );
  }

  const fallbackRows = resultRows.filter((row) => row.mlFallback);

  if (fallbackRows.length > 0) {
    console.log("");
    console.log("==============================================");
    console.log("ML FALLBACK MATCHES — PUBLISHABLE DEĞİL");
    console.log("==============================================");
    console.table(
      fallbackRows.map((row) => ({
        matchId: row.matchId,
        league: row.leagueName,
        match: `${row.homeTeam} - ${row.awayTeam}`,
        prediction: row.predictedOutcome,
        probability: row.predictedProbability,
        confidence: row.confidenceScore,
        model: row.productionModelName,
      })),
    );
  }

  if (failedRows.length > 0) {
    console.log("");
    console.log("==============================================");
    console.log("FAILED MATCHES");
    console.log("==============================================");
    console.table(failedRows);
  }

  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION PREDICTION BATCH V2 TAMAMLANDI.");
  console.log("==============================================");
  console.table({
    "Production modeli": "%20 ML / %80 Poisson",
    "Seçim politikası": SELECTION_POLICY_VERSION,
    "Seçim kuralı": "HOME/AWAY • P>=60 • HIGH+ • Data>=65 • Venue>=0",
    "Holdout doğrulaması": "157 maç • 107 doğru • %68,15",
    "Başarılı ensemble": resultRows.length - mlFallbacks,
    "Poisson fallback": mlFallbacks,
    "Ana HOME adayı": primaryHomeCandidates.length,
    "Sınırlı AWAY adayı": limitedAwayCandidates.length,
    "DRAW audit": `${drawAuditSignals} — production sonucunu değiştirmez`,
  });

  if (failedRows.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error("Production Prediction Batch V2 başarısız.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  applyCalibration,
  type CalibrationProfile,
  type CalibrationResult,
} from "@/modules/calibration-engine";
import { generateMatchFeatures } from "@/modules/feature-engine";
import { calculateGoalProbabilities } from "@/modules/goal-probability-engine";
import {
  calculate1x2Probabilities,
  type FairOdds,
  type MatchOutcome,
  type OutcomeProbabilities,
} from "@/modules/probability-engine";
import { calculateMatchRating } from "@/modules/rating-engine";
import { resolveProductionBlendWeights } from "@/modules/match-context-engine";
import { applyDrawDecisionLayer } from "./draw-decision-layer";
import { generateLearnedMatchPrediction } from "./generate-learned-match-prediction";
import { calculatePoissonConfidence } from "./poisson-confidence";
import { applyRatingProbabilityAdjustment } from "./rating-probability-adjustment";
import type { MatchPredictionResult } from "./types";

const PRODUCTION_MODEL_VERSION = "v1.0-20-80";

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalize(probabilities: OutcomeProbabilities): OutcomeProbabilities {
  const total = probabilities.home + probabilities.draw + probabilities.away;
  if (!Number.isFinite(total) || total <= 0) {
    return { home: 33.33, draw: 33.34, away: 33.33 };
  }
  return {
    home: probabilities.home / total * 100,
    draw: probabilities.draw / total * 100,
    away: probabilities.away / total * 100,
  };
}

function blendProbabilities(
  ml: OutcomeProbabilities | null,
  poisson: OutcomeProbabilities,
  options?: { marketAvailable?: boolean; eloAvailable?: boolean },
): OutcomeProbabilities {
  const weights = resolveProductionBlendWeights({
    mlAvailable: ml !== null,
    marketAvailable: options?.marketAvailable ?? false,
    eloAvailable: options?.eloAvailable ?? false,
  });
  if (!ml || weights.ml <= 0) {
    return normalize(poisson);
  }
  return normalize({
    home: ml.home * weights.ml + poisson.home * weights.poisson,
    draw: ml.draw * weights.ml + poisson.draw * weights.poisson,
    away: ml.away * weights.ml + poisson.away * weights.poisson,
  });
}

function probabilityToFairOdds(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0) return 999;
  return round(100 / probability);
}

function createFairOdds(probabilities: OutcomeProbabilities): FairOdds {
  return {
    home: probabilityToFairOdds(probabilities.home),
    draw: probabilityToFairOdds(probabilities.draw),
    away: probabilityToFairOdds(probabilities.away),
  };
}

function getOutcomeProbability(
  probabilities: OutcomeProbabilities,
  outcome: MatchOutcome,
): number {
  if (outcome === "HOME") return probabilities.home;
  if (outcome === "DRAW") return probabilities.draw;
  return probabilities.away;
}

function getTopPrediction(
  probabilities: OutcomeProbabilities,
): { outcome: MatchOutcome; probability: number } {
  const candidates: Array<{ outcome: MatchOutcome; probability: number }> = [
    { outcome: "HOME", probability: probabilities.home },
    { outcome: "DRAW", probability: probabilities.draw },
    { outcome: "AWAY", probability: probabilities.away },
  ];
  candidates.sort((first, second) => second.probability - first.probability);
  return candidates[0];
}

async function loadCalibrationProfile(
  profilePath?: string,
): Promise<CalibrationProfile | null> {
  const resolvedPath = profilePath
    ? path.resolve(profilePath)
    : path.resolve("reports", "premier-league-2024-calibration-profile.json");

  try {
    const content = await readFile(resolvedPath, "utf8");
    return JSON.parse(content) as CalibrationProfile;
  } catch {
    console.warn(
      `[calibration] Profil bulunamadı; ham model olasılıkları kullanılacak: ${resolvedPath}`,
    );
    return null;
  }
}

export async function generateMatchPrediction(options: {
  matchId: number;
  calibrationProfilePath?: string;
}): Promise<MatchPredictionResult> {
  const { matchId, calibrationProfilePath } = options;
  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new Error("matchId pozitif bir tam sayÄ± olmalÄ±dÄ±r.");
  }

  await generateMatchFeatures(matchId);

  const learnedAttemptPromise = generateLearnedMatchPrediction({ matchId })
    .then((result) => ({ result, error: null as string | null }))
    .catch((error: unknown) => ({
      result: null,
      error: error instanceof Error ? error.message : "Bilinmeyen ML hatasÄ±",
    }));

  const [rawResult, calibrationProfile, rating, goalModel, learnedAttempt] =
    await Promise.all([
      calculate1x2Probabilities(matchId),
      loadCalibrationProfile(calibrationProfilePath),
      calculateMatchRating(matchId),
      calculateGoalProbabilities(matchId),
      learnedAttemptPromise,
    ]);

  const calibration = calibrationProfile
    ? applyCalibration({
        probabilities: rawResult.probabilities,
        profile: calibrationProfile,
      })
    : {
        rawProbabilities: rawResult.probabilities,
        calibratedProbabilities: normalize(rawResult.probabilities),
        details: {} as CalibrationResult["details"],
        overallReliabilityScore: 0,
        profileVersion: "fallback-no-profile",
        warnings: [
          "Kalibrasyon profili bulunamadı; ham model olasılıkları kullanıldı.",
        ],
      };
  const calibratedPrediction = getTopPrediction(
    calibration.calibratedProbabilities,
  );
  const ratingAdjustment = applyRatingProbabilityAdjustment({
    probabilities: calibration.calibratedProbabilities,
    rating,
  });
  const ratingAdjustedProbabilities = ratingAdjustment.adjustedProbabilities;
  const ratingAdjustedPrediction = getTopPrediction(
    ratingAdjustedProbabilities,
  );

  const poissonProbabilities = normalize({
    home: goalModel.outcomeProbabilities.home,
    draw: goalModel.outcomeProbabilities.draw,
    away: goalModel.outcomeProbabilities.away,
  });
  const poissonPrediction = getTopPrediction(poissonProbabilities);

  const mlProbabilities: OutcomeProbabilities | null = learnedAttempt.result
    ? normalize({
        home: learnedAttempt.result.probabilities.home,
        draw: learnedAttempt.result.probabilities.draw,
        away: learnedAttempt.result.probabilities.away,
      })
    : null;

  // ML yoksa market/elo kapalıysa ağırlıklar yeniden dağıtılır (saf Poisson).
  const finalProbabilities = blendProbabilities(
    mlProbabilities,
    poissonProbabilities,
    { marketAvailable: false, eloAvailable: false },
  );
  const finalPrediction = getTopPrediction(finalProbabilities);

  // DRAW katmanÄ± yalnÄ±z audit sinyalidir; production sonucunu deÄŸiÅŸtirmez.
  const drawDecision = applyDrawDecisionLayer({
    probabilities: finalProbabilities,
  });
  const productionDrawDecision = {
    ...drawDecision,
    applied: false,
    selectedOutcome: finalPrediction.outcome,
  };

  const poissonConfidence = calculatePoissonConfidence({
    goalModel,
    probabilities: finalProbabilities,
    finalOutcome: finalPrediction.outcome,
    drawDecision: productionDrawDecision,
  });

  const warnings = [
    ...rawResult.warnings,
    ...calibration.warnings,
    ...goalModel.warnings,
  ];

  if (learnedAttempt.result) {
    warnings.push(...learnedAttempt.result.warnings);
    const blend = resolveProductionBlendWeights({
      mlAvailable: true,
      marketAvailable: false,
      eloAvailable: false,
    });
    warnings.push(
      `Production 1X2: %${Math.round(blend.ml * 100)} ML + %${Math.round(blend.poisson * 100)} Poisson (ensemble redistribute).`,
    );
  } else {
    warnings.push(
      `ML üretilemedi; ensemble weight redistribute → saf Poisson: ${learnedAttempt.error}`,
    );
  }
  warnings.push(
    "DRAW Decision Layer production override yapmaz; yalnÄ±z audit sinyalidir.",
  );
  warnings.push(
    [
      "Experimental DRAW audit:",
      `minimum DRAW %${drawDecision.configuration.minimumDrawProbability},`,
      `maximum gap ${drawDecision.configuration.maximumDrawGap},`,
      `wouldApply=${drawDecision.applied ? "YES" : "NO"}.`,
    ].join(" "),
  );
  warnings.push(
    `Production confidence: ${poissonConfidence.score}/100, ${poissonConfidence.level}.`,
  );
  warnings.push(
    "Kalibrasyon ve rating hattÄ± legacy/audit amacÄ±yla korunur; final olasÄ±lÄ±ÄŸÄ± deÄŸiÅŸtirmez.",
  );

  if (ratingAdjustment.status !== "APPLIED") {
    warnings.push(`Rating dÃ¼zeltmesi uygulanmadÄ±: ${ratingAdjustment.message}`);
  }
  if (rating.home.xg === null || rating.away.xg === null) {
    warnings.push("TakÄ±mlardan en az biri iÃ§in Rating Engine xG kategorisi eksik.");
  }
  if (rating.home.shotThreat === null || rating.away.shotThreat === null) {
    warnings.push("TakÄ±mlardan en az biri iÃ§in Rating Engine ÅŸut tehdidi kategorisi eksik.");
  }
  for (const reason of poissonConfidence.reasons) {
    warnings.push(`Confidence: ${reason}`);
  }

  return {
    match: rawResult.match,
    model: {
      probabilityModelName: rawResult.model.name,
      probabilityModelVersion: rawResult.model.version,
      calibrationProfileVersion: calibration.profileVersion,
      ratingModelVersion: rating.home.modelVersion,
      goalProbabilityModelName: goalModel.model.name,
      goalProbabilityModelVersion: goalModel.model.version,
      drawDecisionModelVersion: drawDecision.modelVersion,
      poissonConfidenceModelVersion: poissonConfidence.modelVersion,
      productionModelName: mlProbabilities
        ? PRODUCTION_MODEL_VERSION
        : `${PRODUCTION_MODEL_VERSION}-poisson-fallback`,
      status: "PRODUCTION",
    },
    rawProbabilities: rawResult.probabilities,
    calibratedProbabilities: calibration.calibratedProbabilities,
    ratingAdjustedProbabilities,
    poissonProbabilities,
    finalProbabilities,
    rawFairOdds: rawResult.fairOdds,
    calibratedFairOdds: createFairOdds(calibration.calibratedProbabilities),
    ratingAdjustedFairOdds: createFairOdds(ratingAdjustedProbabilities),
    poissonFairOdds: createFairOdds(poissonProbabilities),
    finalFairOdds: createFairOdds(finalProbabilities),
    rawPredictedOutcome: rawResult.predictedOutcome,
    rawPredictedProbability: rawResult.predictedProbability,
    calibratedPredictedOutcome: calibratedPrediction.outcome,
    calibratedPredictedProbability: calibratedPrediction.probability,
    ratingAdjustedPredictedOutcome: ratingAdjustedPrediction.outcome,
    ratingAdjustedPredictedProbability: ratingAdjustedPrediction.probability,
    poissonPredictedOutcome: poissonPrediction.outcome,
    poissonPredictedProbability: poissonPrediction.probability,
    predictedOutcome: finalPrediction.outcome,
    predictedProbability: getOutcomeProbability(
      finalProbabilities,
      finalPrediction.outcome,
    ),
    drawDecision,
    poissonConfidence,
    probabilityConfidenceScore: rawResult.confidenceScore,
    probabilityConfidenceLevel: rawResult.confidenceLevel,
    calibrationReliabilityScore: calibration.overallReliabilityScore,
    ratingConfidenceScore: rating.combinedConfidenceScore,
    combinedConfidenceScore: poissonConfidence.score,
    combinedConfidenceLevel: poissonConfidence.level,
    rating: {
      modelVersion: rating.home.modelVersion,
      homeOverall: rating.home.overall,
      awayOverall: rating.away.overall,
      ratingDifference: rating.ratingDifference,
      confidenceScore: rating.combinedConfidenceScore,
      edge: rating.edge,
    },
    ratingAdjustment,
    calibration,
    warnings: [...new Set(warnings)],
  };
}

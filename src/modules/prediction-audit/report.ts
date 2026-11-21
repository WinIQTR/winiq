import { computeNaiveBaselines } from "@/modules/prediction-audit/baselines";
import { buildFavouriteStrengthBrier } from "@/modules/prediction-audit/favourite-brier";
import { buildLeagueRollupSummary } from "@/modules/prediction-audit/league-rollup";
import { buildPickProbabilityCalibration } from "@/modules/prediction-audit/pick-calibration";
import { filterValidProbabilityRows } from "@/modules/prediction-audit/probability-sum";
import { serializeSettledExportCsv } from "@/modules/prediction-audit/settled-export";
import type { SettledOneXTwoRow } from "@/modules/prediction-audit/types";

export type PredictionAuditReport = {
  baselines: ReturnType<typeof computeNaiveBaselines>;
  pickCalibration: ReturnType<typeof buildPickProbabilityCalibration>;
  leagueRollup: ReturnType<typeof buildLeagueRollupSummary>;
  favouriteBrier: ReturnType<typeof buildFavouriteStrengthBrier>;
  rejectedProbabilityRows: number;
  settledExportCsvPreviewLines: number;
  settledExportCsv: string;
};

export function buildPredictionAuditReport(
  rows: readonly SettledOneXTwoRow[],
): PredictionAuditReport {
  const { valid, rejected } = filterValidProbabilityRows(rows);
  const settledExportCsv = serializeSettledExportCsv(valid);
  return {
    baselines: computeNaiveBaselines(valid),
    pickCalibration: buildPickProbabilityCalibration(valid),
    leagueRollup: buildLeagueRollupSummary(valid),
    favouriteBrier: buildFavouriteStrengthBrier(valid),
    rejectedProbabilityRows: rejected.length,
    settledExportCsvPreviewLines: Math.min(
      6,
      settledExportCsv.split("\n").filter(Boolean).length,
    ),
    settledExportCsv,
  };
}

export const SELECTION_POLICY_V2_THRESHOLDS = {
  minimumProbability: 45,
  minimumDataQuality: 45,
  publishableConfidenceLevels: [
    "HIGH",
    "VERY_HIGH",
  ],
} as const;

export type SelectionPolicyCheckCode =
  | "MODEL"
  | "OUTCOME"
  | "CONFIDENCE"
  | "DATA_QUALITY"
  | "PROBABILITY";

export type SelectionPolicyCheck = {
  code: SelectionPolicyCheckCode;
  passed: boolean;
  label: string;
  detail: string;
};

export type SelectionPolicyEvaluationInput = {
  predictedOutcome: string;
  predictedProbability: number;
  confidenceLevel: string;
  confidenceScore: number;
  dataQualityScore: number;
  productionModelName: string;
  mlFallback: boolean;
};

export type SelectionPolicyEvaluation = {
  decision: "PUBLISHED" | "FILTERED";
  eligible: boolean;
  summary: string;
  checks: SelectionPolicyCheck[];
  failedCodes: SelectionPolicyCheckCode[];
};

function formatNumber(value: number): string {
  return Number.isFinite(value)
    ? value.toFixed(1)
    : "unavailable";
}

export function evaluateSelectionPolicyV2(
  input: SelectionPolicyEvaluationInput,
): SelectionPolicyEvaluation {
  const thresholds =
    SELECTION_POLICY_V2_THRESHOLDS;

  const confidencePassed =
    thresholds.publishableConfidenceLevels.includes(
      input.confidenceLevel as
        | "HIGH"
        | "VERY_HIGH",
    );

  const checks: SelectionPolicyCheck[] = [
    {
      code: "MODEL",
      passed: !input.mlFallback,
      label: "Production model",
      detail: input.mlFallback
        ? `Failed: ${input.productionModelName} is a fallback model.`
        : `Passed: ${input.productionModelName} is the locked production model.`,
    },
    {
      code: "OUTCOME",
      passed: input.predictedOutcome !== "DRAW",
      label: "Outcome policy",
      detail:
        input.predictedOutcome === "DRAW"
          ? "Failed: DRAW predictions are retained for audit only."
          : `Passed: ${input.predictedOutcome} is publishable by the outcome policy.`,
    },
    {
      code: "CONFIDENCE",
      passed: confidencePassed,
      label: "Reliability",
      detail: confidencePassed
        ? `Passed: ${input.confidenceLevel} (${formatNumber(input.confidenceScore)}/100).`
        : `Failed: ${input.confidenceLevel} (${formatNumber(input.confidenceScore)}/100); HIGH or VERY_HIGH is required.`,
    },
    {
      code: "DATA_QUALITY",
      passed:
        Number.isFinite(input.dataQualityScore) &&
        input.dataQualityScore >=
          thresholds.minimumDataQuality,
      label: "Data quality",
      detail:
        input.dataQualityScore >=
        thresholds.minimumDataQuality
          ? `Passed: ${formatNumber(input.dataQualityScore)}/100 (minimum ${thresholds.minimumDataQuality}).`
          : `Failed: ${formatNumber(input.dataQualityScore)}/100 (minimum ${thresholds.minimumDataQuality}).`,
    },
    {
      code: "PROBABILITY",
      passed:
        Number.isFinite(input.predictedProbability) &&
        input.predictedProbability >=
          thresholds.minimumProbability,
      label: "Model probability",
      detail:
        input.predictedProbability >=
        thresholds.minimumProbability
          ? `Passed: ${formatNumber(input.predictedProbability)}% (minimum ${thresholds.minimumProbability}%).`
          : `Failed: ${formatNumber(input.predictedProbability)}% (minimum ${thresholds.minimumProbability}%).`,
    },
  ];

  const failedCodes = checks
    .filter((check) => !check.passed)
    .map((check) => check.code);

  const eligible = failedCodes.length === 0;

  return {
    decision: eligible
      ? "PUBLISHED"
      : "FILTERED",
    eligible,
    summary: eligible
      ? "All Selection Policy V2 publication checks passed."
      : `${failedCodes.length} Selection Policy V2 check(s) failed.`,
    checks,
    failedCodes,
  };
}

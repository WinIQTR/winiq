export const CONTROLLED_LEARNING_MINIMUM_SAMPLE = 300;

export type ControlledLearningGateStatus =
  | "COLLECTING"
  | "CANDIDATE_REJECTED"
  | "AWAITING_MANUAL_APPROVAL"
  | "READY_FOR_MANUAL_RELEASE_REVIEW";

export type ControlledLearningGateCheck = {
  key: string;
  label: string;
  status: "PASS" | "BLOCKED";
  message: string;
};

export type ControlledLearningGateInput = {
  independentSelections: number;
  learningStatus: string;
  learningTrainSelections: number;
  learningValidationSelections: number;
  auditStatus: string;
  auditProfileSelections: number;
  auditSelectionSelections: number;
  auditFinalUnseenSelections: number;
  modelHealthLevel: string;
  driftStatus: string;
  candidateSha256?: string;
  manualApproval?: boolean;
  manualApprovalId?: string;
};

export type ControlledLearningGate = {
  status: ControlledLearningGateStatus;
  independentSelections: number;
  minimumSample: typeof CONTROLLED_LEARNING_MINIMUM_SAMPLE;
  remainingSelections: number;
  progressPercentage: number;
  checks: ControlledLearningGateCheck[];
  passed: number;
  blocked: number;
  manualReviewPackageAllowed: boolean;
  productionChangeAllowed: false;
  automaticActivationAllowed: false;
  production: {
    champion: "20% ML / 80% Poisson";
    candidateNeverAutoActivated: true;
  };
};

function check(
  key: string,
  label: string,
  passed: boolean,
  successMessage: string,
  blockedMessage: string,
): ControlledLearningGateCheck {
  return {
    key,
    label,
    status: passed ? "PASS" : "BLOCKED",
    message: passed ? successMessage : blockedMessage,
  };
}

function validApprovalId(value: string | undefined): boolean {
  return /^LEARNING-\d{8}-[A-Z0-9]{6,32}$/.test(
    value?.trim().toUpperCase() ?? "",
  );
}

function validSha256(value: string | undefined): boolean {
  return /^[a-f0-9]{64}$/i.test(value?.trim() ?? "");
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function buildControlledLearningGate(
  input: ControlledLearningGateInput,
): ControlledLearningGate {
  const independentSelections = Math.max(0, Math.floor(input.independentSelections));
  const sampleReady = independentSelections >= CONTROLLED_LEARNING_MINIMUM_SAMPLE;
  const chronologicalSplitsReady =
    input.learningTrainSelections > 0 &&
    input.learningValidationSelections > 0 &&
    input.auditProfileSelections > 0 &&
    input.auditSelectionSelections > 0 &&
    input.auditFinalUnseenSelections > 0;
  const learningCandidateReady = input.learningStatus === "CANDIDATE_READY";
  const challengerPassed = input.auditStatus === "CHALLENGER_PASSED";
  const healthSafe =
    input.modelHealthLevel !== "CRITICAL" && input.driftStatus === "STABLE";
  const checksumReady = validSha256(input.candidateSha256);
  const approvalReady =
    input.manualApproval === true && validApprovalId(input.manualApprovalId);

  const checks: ControlledLearningGateCheck[] = [
    check(
      "MINIMUM_SAMPLE",
      "Independent sample",
      sampleReady,
      "At least 300 independent results are available.",
      `${Math.max(0, CONTROLLED_LEARNING_MINIMUM_SAMPLE - independentSelections)} additional independent result(s) are required.`,
    ),
    check(
      "CHRONOLOGICAL_SPLITS",
      "Chronological validation periods",
      chronologicalSplitsReady,
      "Training, selection and final unseen periods are non-empty.",
      "Chronological periods remain locked until the minimum sample is reached.",
    ),
    check(
      "LEARNING_CANDIDATE",
      "Learning candidate",
      learningCandidateReady,
      "The candidate passed ROI, Brier and drawdown gates.",
      `Learning status is ${input.learningStatus}.`,
    ),
    check(
      "CHAMPION_CHALLENGER",
      "Final unseen Champion–Challenger audit",
      challengerPassed,
      "The Challenger passed every final unseen audit gate.",
      `Champion–Challenger status is ${input.auditStatus}.`,
    ),
    check(
      "MODEL_HEALTH",
      "Model health and drift",
      healthSafe,
      "Model health is not critical and drift is stable.",
      `Model health is ${input.modelHealthLevel}; drift is ${input.driftStatus}.`,
    ),
    check(
      "CANDIDATE_CHECKSUM",
      "Immutable candidate checksum",
      checksumReady,
      "A valid SHA-256 candidate checksum is present.",
      "A reviewed candidate artifact SHA-256 is required.",
    ),
    check(
      "MANUAL_APPROVAL",
      "Explicit human approval",
      approvalReady,
      "A traceable manual approval is present.",
      "Manual approval is absent or its identifier is invalid.",
    ),
  ];
  const blocked = checks.filter((item) => item.status === "BLOCKED").length;
  const candidateQualityReady =
    sampleReady &&
    chronologicalSplitsReady &&
    learningCandidateReady &&
    challengerPassed &&
    healthSafe;
  const manualReviewPackageAllowed = blocked === 0;
  const status: ControlledLearningGateStatus = !sampleReady
    ? "COLLECTING"
    : !candidateQualityReady
      ? "CANDIDATE_REJECTED"
      : !manualReviewPackageAllowed
        ? "AWAITING_MANUAL_APPROVAL"
        : "READY_FOR_MANUAL_RELEASE_REVIEW";

  return {
    status,
    independentSelections,
    minimumSample: CONTROLLED_LEARNING_MINIMUM_SAMPLE,
    remainingSelections: Math.max(
      0,
      CONTROLLED_LEARNING_MINIMUM_SAMPLE - independentSelections,
    ),
    progressPercentage: Math.min(
      100,
      round((independentSelections / CONTROLLED_LEARNING_MINIMUM_SAMPLE) * 100, 1),
    ),
    checks,
    passed: checks.length - blocked,
    blocked,
    manualReviewPackageAllowed,
    productionChangeAllowed: false,
    automaticActivationAllowed: false,
    production: {
      champion: "20% ML / 80% Poisson",
      candidateNeverAutoActivated: true,
    },
  };
}

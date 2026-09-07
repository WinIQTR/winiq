import assert from "node:assert/strict";

import { buildControlledLearningGate } from "../src/lib/controlled-learning-gate";

const collecting = buildControlledLearningGate({
  independentSelections: 9,
  learningStatus: "COLLECTING",
  learningTrainSelections: 0,
  learningValidationSelections: 0,
  auditStatus: "COLLECTING",
  auditProfileSelections: 0,
  auditSelectionSelections: 0,
  auditFinalUnseenSelections: 0,
  modelHealthLevel: "WARNING",
  driftStatus: "COLLECTING",
});
assert.equal(collecting.status, "COLLECTING");
assert.equal(collecting.progressPercentage, 3);
assert.equal(collecting.remainingSelections, 291);
assert.equal(collecting.productionChangeAllowed, false);
assert.equal(collecting.automaticActivationAllowed, false);

const rejected = buildControlledLearningGate({
  independentSelections: 300,
  learningStatus: "CANDIDATE_REJECTED",
  learningTrainSelections: 210,
  learningValidationSelections: 90,
  auditStatus: "CHALLENGER_REJECTED",
  auditProfileSelections: 180,
  auditSelectionSelections: 60,
  auditFinalUnseenSelections: 60,
  modelHealthLevel: "HEALTHY",
  driftStatus: "STABLE",
});
assert.equal(rejected.status, "CANDIDATE_REJECTED");
assert.equal(rejected.manualReviewPackageAllowed, false);

const candidateSha256 = "a".repeat(64);
const ready = buildControlledLearningGate({
  independentSelections: 300,
  learningStatus: "CANDIDATE_READY",
  learningTrainSelections: 210,
  learningValidationSelections: 90,
  auditStatus: "CHALLENGER_PASSED",
  auditProfileSelections: 180,
  auditSelectionSelections: 60,
  auditFinalUnseenSelections: 60,
  modelHealthLevel: "HEALTHY",
  driftStatus: "STABLE",
  candidateSha256,
  manualApproval: true,
  manualApprovalId: "LEARNING-20260814-ABC123",
});
assert.equal(ready.status, "READY_FOR_MANUAL_RELEASE_REVIEW");
assert.equal(ready.blocked, 0);
assert.equal(ready.manualReviewPackageAllowed, true);
assert.equal(ready.productionChangeAllowed, false);
assert.equal(ready.automaticActivationAllowed, false);
assert.doesNotMatch(JSON.stringify(ready), new RegExp(candidateSha256));

console.log("Controlled Learning Safety Gate V4.4 tests passed.");

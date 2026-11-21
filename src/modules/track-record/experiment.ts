/**
 * Pre-registered forward experiment protocol + autopsy template (TIPS-EXP style).
 */

export type ExperimentSpec = {
  id: string;
  title: string;
  registeredAt: Date;
  hypothesis: string;
  universe: string;
  selection: string;
  stake: string;
  prices: string;
  primaryMetric: string;
  secondaryMetric?: string;
  duration: string;
  successCriteria: string;
  failureCriteria: string;
  caveats: string[];
};

export type ExperimentAutopsy = {
  experimentId: string;
  concludedAt: Date;
  outcome: "success" | "failure" | "inconclusive";
  primaryMetricResult: string;
  whatWorked: string[];
  whatFailed: string[];
  nextSteps: string[];
};

export function formatExperimentMarkdown(spec: ExperimentSpec): string {
  return [
    `# ${spec.id} — ${spec.title}`,
    "",
    `Registered ${spec.registeredAt.toISOString().slice(0, 10)}. This file is frozen.`,
    "",
    "## Hypothesis",
    "",
    spec.hypothesis,
    "",
    "## Rules — fixed in advance",
    "",
    `1. UNIVERSE: ${spec.universe}`,
    `2. SELECTION: ${spec.selection}`,
    `3. STAKE: ${spec.stake}`,
    `4. PRICES: ${spec.prices}`,
    `5. PRIMARY METRIC: ${spec.primaryMetric}`,
    spec.secondaryMetric ? `   SECONDARY: ${spec.secondaryMetric}` : null,
    `6. DURATION: ${spec.duration}`,
    `7. SUCCESS: ${spec.successCriteria}`,
    `8. FAILURE: ${spec.failureCriteria}`,
    "9. TRANSPARENCY: every selection logged before kick-off; nothing edited after.",
    "",
    "## Honest caveats",
    "",
    ...spec.caveats.map((caveat) => `- ${caveat}`),
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function formatAutopsyMarkdown(autopsy: ExperimentAutopsy): string {
  return [
    `# ${autopsy.experimentId} — AUTOPSY`,
    "",
    `Concluded ${autopsy.concludedAt.toISOString().slice(0, 10)} · outcome: **${autopsy.outcome}**`,
    "",
    "## Primary metric",
    "",
    autopsy.primaryMetricResult,
    "",
    "## What worked",
    "",
    ...autopsy.whatWorked.map((item) => `- ${item}`),
    "",
    "## What failed",
    "",
    ...autopsy.whatFailed.map((item) => `- ${item}`),
    "",
    "## Next steps",
    "",
    ...autopsy.nextSteps.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

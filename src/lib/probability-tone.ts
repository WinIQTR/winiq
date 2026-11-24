/**
 * Model olasılığı rengi — favori / orta / düşük.
 * Catalog STRONG/MEDIUM/WEAK (70 / 55) ile aynı eşikler.
 */
export type ProbabilityTone = "high" | "medium" | "low";

export const PROBABILITY_TONE_HIGH = 70;
export const PROBABILITY_TONE_MEDIUM = 55;

export function probabilityTone(probability: number): ProbabilityTone {
  if (!Number.isFinite(probability)) return "low";
  if (probability >= PROBABILITY_TONE_HIGH) return "high";
  if (probability >= PROBABILITY_TONE_MEDIUM) return "medium";
  return "low";
}

export function probabilityToneLabel(
  tone: ProbabilityTone,
  locale: "tr" | "en" = "tr",
): string {
  if (tone === "high") return locale === "tr" ? "Favori" : "Favourite";
  if (tone === "medium") return locale === "tr" ? "Orta" : "Medium";
  return locale === "tr" ? "Düşük" : "Low";
}

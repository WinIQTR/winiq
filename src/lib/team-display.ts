const HOT_SUPPORTERS = new Set([
  "galatasaray", "fenerbahce", "fenerbahçe", "besiktas", "beşiktaş", "trabzonspor",
  "liverpool", "newcastle", "manchester united", "borussia dortmund", "schalke 04",
  "marseille", "napoli", "roma", "lazio", "inter", "ac milan", "celtic", "rangers",
  "athletic club", "sevilla", "real betis", "ajax", "feyenoord",
]);

export function hasHotSupport(name: string): boolean {
  return HOT_SUPPORTERS.has(name.toLocaleLowerCase("tr-TR"));
}

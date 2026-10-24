/** Day/night for kickoff in Europe/Istanbul (football heuristic). */
export type MatchDayPart = "day" | "night";

export function getMatchDayPart(kickoffAt: Date): MatchDayPart {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      hour12: false,
    }).format(kickoffAt),
  );
  // Local football heuristic: 07:00–17:59 day, otherwise night floodlights.
  return hour >= 7 && hour < 18 ? "day" : "night";
}

export function dayPartLabel(part: MatchDayPart, locale: "tr" | "en" = "tr"): string {
  if (locale === "en") return part === "day" ? "Day match" : "Night match";
  return part === "day" ? "Gündüz maçı" : "Gece maçı";
}

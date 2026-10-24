import { getMatchDayPart, type MatchDayPart } from "@/lib/match-daypart";

export type DayPartFilter = "ALL" | MatchDayPart;

export function parseDayPartFilter(value: string | null | undefined): DayPartFilter {
  if (value === "day" || value === "night") return value;
  return "ALL";
}

export function matchesDayPartFilter(
  kickoffAt: Date | string,
  filter: DayPartFilter,
): boolean {
  if (filter === "ALL") return true;
  const date = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  if (Number.isNaN(date.getTime())) return false;
  return getMatchDayPart(date) === filter;
}

export function dayPartFilterLabel(
  filter: DayPartFilter,
  locale: "tr" | "en",
): string {
  if (filter === "ALL") return locale === "tr" ? "Tümü" : "All";
  if (filter === "day") return locale === "tr" ? "Gündüz" : "Day";
  return locale === "tr" ? "Gece" : "Night";
}

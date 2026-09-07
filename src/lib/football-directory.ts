import { ACTIVE_COMPETITIONS, getCompetitionByApiId } from "@/config/competitions";

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveDirectoryCompetition(value: string | string[] | undefined) {
  const fallback = ACTIVE_COMPETITIONS[0];
  if (!fallback) throw new Error("Aktif organizasyon bulunamadı.");
  const parsed = Number.parseInt(firstParam(value) ?? "", 10);
  return getCompetitionByApiId(parsed) ?? fallback;
}

export function trDate(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Istanbul",
  }).format(value);
}

export function trTime(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Istanbul",
  }).format(value);
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

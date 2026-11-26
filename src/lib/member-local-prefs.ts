const FAVORITES_KEY = "winiq.member.favoriteMatchIds";
const PREFERRED_LEAGUE_KEY = "winiq.member.preferredLeagueApiId";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readFavoriteMatchIds(): number[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

export function writeFavoriteMatchIds(ids: number[]) {
  if (!canUseStorage()) return;
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(unique));
}

export function toggleFavoriteMatchId(matchId: number): number[] {
  const current = readFavoriteMatchIds();
  const next = current.includes(matchId)
    ? current.filter((id) => id !== matchId)
    : [...current, matchId];
  writeFavoriteMatchIds(next);
  return next;
}

export function readPreferredLeagueApiId(): string | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(PREFERRED_LEAGUE_KEY);
    return raw && raw !== "ALL" ? raw : null;
  } catch {
    return null;
  }
}

export function writePreferredLeagueApiId(leagueApiId: string | null) {
  if (!canUseStorage()) return;
  if (!leagueApiId || leagueApiId === "ALL") {
    window.localStorage.removeItem(PREFERRED_LEAGUE_KEY);
    return;
  }
  window.localStorage.setItem(PREFERRED_LEAGUE_KEY, leagueApiId);
}

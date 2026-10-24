import type { AppLocale } from "@/i18n/dictionaries";
import type { DashboardPrediction } from "@/lib/prediction-dashboard-shared";

type Translate = (source: string) => string;
type FormResult = "W" | "D" | "L";

const GENERIC_REASON =
  /model probability is high|calibration is strong|large historical sample|reliability/i;

function streakFrom(results: FormResult[] | undefined): { result: FormResult; count: number } | null {
  if (!results?.length) return null;
  const first = results[0]!;
  let count = 0;
  for (const result of results) {
    if (result !== first) break;
    count += 1;
  }
  return count > 0 ? { result: first, count } : null;
}

function countsIn(results: FormResult[] | undefined) {
  const list = results ?? [];
  return {
    n: list.length,
    wins: list.filter((r) => r === "W").length,
    draws: list.filter((r) => r === "D").length,
    losses: list.filter((r) => r === "L").length,
  };
}

function injuryNote(warnings: string[] | undefined, t: Translate): string | null {
  if (!warnings?.length) return null;
  const hit = warnings.find((w) => /injur|sakat|unavailable player|eksik oyuncu/i.test(w));
  if (!hit) return null;
  // Prefer a short localized wrapper; keep concrete names from the warning when short.
  const trimmed = hit.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 110) return trimmed;
  return t("Key squad availability notes apply for this fixture.");
}

function formLine(
  team: string,
  results: FormResult[] | undefined,
  side: "home" | "away",
  t: Translate,
): string | null {
  const streak = streakFrom(results);
  const stats = countsIn(results);
  if (streak && streak.count >= 3) {
    if (streak.result === "W") {
      return t("{team} won their last {n} matches.")
        .replace("{team}", team)
        .replace("{n}", String(streak.count));
    }
    if (streak.result === "L") {
      return t("{team} lost their last {n} matches.")
        .replace("{team}", team)
        .replace("{n}", String(streak.count));
    }
    return t("{team} drew their last {n} matches.")
      .replace("{team}", team)
      .replace("{n}", String(streak.count));
  }

  if (streak && streak.count === 2 && streak.result === "W") {
    return t("{team} won their last {n} matches.")
      .replace("{team}", team)
      .replace("{n}", "2");
  }

  if (stats.n >= 4) {
    const unbeaten = stats.losses === 0;
    if (unbeaten && stats.wins >= 2) {
      return t("{team} are unbeaten in their last {n} matches.")
        .replace("{team}", team)
        .replace("{n}", String(stats.n));
    }
    if (side === "away" && stats.losses >= 3) {
      return t("{team} lost {losses} of their last {n} away-period matches.")
        .replace("{team}", team)
        .replace("{losses}", String(stats.losses))
        .replace("{n}", String(stats.n));
    }
    if (stats.wins >= 3) {
      return t("{team} won {wins} of their last {n} matches.")
        .replace("{team}", team)
        .replace("{wins}", String(stats.wins))
        .replace("{n}", String(stats.n));
    }
    if (stats.losses >= 3) {
      return t("{team} lost {losses} of their last {n} matches.")
        .replace("{team}", team)
        .replace("{losses}", String(stats.losses))
        .replace("{n}", String(stats.n));
    }
  }

  return null;
}

function goalsLine(prediction: DashboardPrediction, t: Translate): string | null {
  const home = prediction.expectedHomeGoals;
  const away = prediction.expectedAwayGoals;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  const total = home + away;
  const market = prediction.topPicks[0]?.market ?? "";
  const selection = prediction.topPicks[0]?.selection ?? "";
  const goalsMarket = /goal|gol|over|under|üst|alt/i.test(`${market} ${selection}`);
  if (!goalsMarket && total < 2.6) return null;
  return t("Model expects about {home}–{away} goals ({total} total).")
    .replace("{home}", home.toFixed(1))
    .replace("{away}", away.toFixed(1))
    .replace("{total}", total.toFixed(1));
}

/**
 * One-line match insight for member cards.
 * Priority: form streaks → goals expectation → injury warning → non-generic reason → fallback.
 * Uses only fields already present on DashboardPrediction (API-Football derived snapshot).
 */
export function buildMatchCardInsight(
  prediction: DashboardPrediction,
  t: Translate,
  _locale: AppLocale,
): string {
  const homeForm = formLine(prediction.homeTeam, prediction.homeRecentResults, "home", t);
  const awayForm = formLine(prediction.awayTeam, prediction.awayRecentResults, "away", t);

  if (homeForm && awayForm) {
    // Keep one short combined line when both sides have a clear signal.
    const combined = `${homeForm} ${awayForm}`;
    if (combined.length <= 140) return combined;
    return homeForm;
  }
  if (homeForm) return homeForm;
  if (awayForm) return awayForm;

  const goals = goalsLine(prediction, t);
  if (goals) return goals;

  const injury = injuryNote(prediction.warnings, t);
  if (injury) return injury;

  const reason = prediction.topPicks[0]?.reasons?.find((item) => item && !GENERIC_REASON.test(item));
  if (reason) return reason;

  return t("Form and market signals are limited for this fixture; open the analysis for detail.");
}

/** Locale-aware market/selection text — do not force Turkish when EN is active. */
export function localizePickText(value: string, locale: AppLocale, t: Translate): string {
  if (locale === "en") {
    return value
      .replace(/Ev sahibi takım golü/gi, "Home Team Goals")
      .replace(/Deplasman takım golü/gi, "Away Team Goals")
      .replace(/Toplam gol/gi, "Total Goals")
      .replace(/Karşılıklı gol/gi, "Both Teams To Score")
      .replace(/\bAlt\b/gi, "Under")
      .replace(/\bÜst\b/gi, "Over")
      .replace(/Ev sahibi/gi, "Home")
      .replace(/Deplasman/gi, "Away")
      .replace(/Beraberlik/gi, "Draw");
  }

  return value
    .replace(/Home Team Goals/gi, t("Home Team Goals"))
    .replace(/Away Team Goals/gi, t("Away Team Goals"))
    .replace(/Total Goals/gi, t("Total Goals"))
    .replace(/Both Teams To Score/gi, t("Both Teams To Score"))
    .replace(/\bUnder\b/gi, t("Under"))
    .replace(/\bOver\b/gi, t("Over"))
    .replace(/\bHome\b/gi, t("Home"))
    .replace(/\bAway\b/gi, t("Away"))
    .replace(/\bDraw\b/gi, t("Draw"));
}

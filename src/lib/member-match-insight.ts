import type { AppLocale } from "@/i18n/dictionaries";
import type { DashboardPrediction } from "@/lib/prediction-dashboard-shared";

export type Translate = (source: string) => string;
export type FormResult = "W" | "D" | "L";

const GENERIC_REASON =
  /model probability is high|calibration is strong|large historical sample|reliability/i;

export type MatchFormTipInput = {
  homeTeam: string;
  awayTeam: string;
  /** Overall recent results, oldest → newest (or newest-first — streak reads from start). */
  homeRecentResults?: FormResult[] | null;
  awayRecentResults?: FormResult[] | null;
  /** Home-only period (for the home team). */
  homeVenueResults?: FormResult[] | null;
  /** Away-only period (for the away team). */
  awayVenueResults?: FormResult[] | null;
};

/**
 * Streak helper: prefers the most recent run.
 * Accepts either oldest→newest or newest→first; we always evaluate from the end.
 */
function streakFrom(results: FormResult[] | undefined | null): { result: FormResult; count: number } | null {
  if (!results?.length) return null;
  const chronological = [...results];
  // Evaluate from most recent
  const last = chronological[chronological.length - 1]!;
  let count = 0;
  for (let i = chronological.length - 1; i >= 0; i -= 1) {
    if (chronological[i] !== last) break;
    count += 1;
  }
  return count > 0 ? { result: last, count } : null;
}

function countsIn(results: FormResult[] | undefined | null) {
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
  const trimmed = hit.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 110) return trimmed;
  return t("Key squad availability notes apply for this fixture.");
}

type FormSide = "overall" | "home" | "away";

function formLine(
  team: string,
  results: FormResult[] | undefined | null,
  side: FormSide,
  t: Translate,
): string | null {
  if (!results?.length) return null;

  const streak = streakFrom(results);
  const stats = countsIn(results);

  const wonLast =
    side === "home"
      ? "{team} won their last {n} home matches."
      : side === "away"
        ? "{team} won their last {n} away matches."
        : "{team} won their last {n} matches.";
  const lostLast =
    side === "home"
      ? "{team} lost their last {n} home matches."
      : side === "away"
        ? "{team} lost their last {n} away matches."
        : "{team} lost their last {n} matches.";
  const drewLast =
    side === "home"
      ? "{team} drew their last {n} home matches."
      : side === "away"
        ? "{team} drew their last {n} away matches."
        : "{team} drew their last {n} matches.";

  if (streak && streak.count >= 3) {
    if (streak.result === "W") {
      return t(wonLast).replace("{team}", team).replace("{n}", String(streak.count));
    }
    if (streak.result === "L") {
      return t(lostLast).replace("{team}", team).replace("{n}", String(streak.count));
    }
    return t(drewLast).replace("{team}", team).replace("{n}", String(streak.count));
  }

  if (streak && streak.count === 2 && streak.result === "W") {
    return t(wonLast).replace("{team}", team).replace("{n}", "2");
  }

  if (stats.n >= 4) {
    const unbeaten = stats.losses === 0;
    if (unbeaten && stats.wins >= 2) {
      const key =
        side === "home"
          ? "{team} are unbeaten in their last {n} home matches."
          : side === "away"
            ? "{team} are unbeaten in their last {n} away matches."
            : "{team} are unbeaten in their last {n} matches.";
      return t(key).replace("{team}", team).replace("{n}", String(stats.n));
    }
    if (side === "away" && stats.losses >= 3) {
      return t("{team} lost {losses} of their last {n} away-period matches.")
        .replace("{team}", team)
        .replace("{losses}", String(stats.losses))
        .replace("{n}", String(stats.n));
    }
    if (side === "home" && stats.wins >= 3) {
      return t("{team} won {wins} of their last {n} home-period matches.")
        .replace("{team}", team)
        .replace("{wins}", String(stats.wins))
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
 * Form/streak tip only. Returns null when there is no honest signal.
 * Prefers venue-period tips when they are stronger than overall streaks.
 */
export function buildMatchFormTip(input: MatchFormTipInput, t: Translate): string | null {
  const homeVenue = formLine(input.homeTeam, input.homeVenueResults, "home", t);
  const awayVenue = formLine(input.awayTeam, input.awayVenueResults, "away", t);
  const homeOverall = formLine(input.homeTeam, input.homeRecentResults, "overall", t);
  const awayOverall = formLine(input.awayTeam, input.awayRecentResults, "overall", t);

  const home = homeVenue ?? homeOverall;
  const away = awayVenue ?? awayOverall;

  if (home && away) {
    const combined = `${home} ${away}`;
    if (combined.length <= 150) return combined;
    // Prefer the longer / more specific venue tip when combining would clutter.
    if (homeVenue && !awayVenue) return home;
    if (awayVenue && !homeVenue) return away;
    return home.length >= away.length ? home : away;
  }
  return home ?? away;
}

/**
 * One-line match insight for member cards.
 * Priority: form streaks → goals expectation → injury warning → non-generic reason → fallback.
 */
export function buildMatchCardInsight(
  prediction: DashboardPrediction,
  t: Translate,
  _locale: AppLocale,
  options?: { omitWhenEmpty?: boolean },
): string | null {
  const form = buildMatchFormTip(
    {
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      homeRecentResults: prediction.homeRecentResults,
      awayRecentResults: prediction.awayRecentResults,
      homeVenueResults: prediction.homeVenueResults,
      awayVenueResults: prediction.awayVenueResults,
    },
    t,
  );
  if (form) return form;

  const goals = goalsLine(prediction, t);
  if (goals) return goals;

  const injury = injuryNote(prediction.warnings, t);
  if (injury) return injury;

  const reason = prediction.topPicks[0]?.reasons?.find((item) => item && !GENERIC_REASON.test(item));
  if (reason) return reason;

  if (options?.omitWhenEmpty) return null;
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
      .replace(/Çifte Şans/gi, "Double Chance")
      .replace(/Beraberlikte İade/gi, "Draw No Bet")
      .replace(/Asya Handikap/gi, "Asian Handicap")
      .replace(/Handikaplı Maç Sonucu/gi, "Asian Handicap")
      .replace(/Gol Yemeden Kazanır/gi, "Win To Nil")
      .replace(/Kesin Skor/gi, "Correct Score")
      .replace(/İlk Yarı Sonucu/gi, "Half-Time Result")
      .replace(/Devre\/Maç/gi, "Half-Time / Full-Time")
      .replace(/İlk Golü Atan Takım/gi, "First Goal Team")
      .replace(/Oyuncu Golü \(Kim Gol Atar\)/gi, "Player Goals")
      .replace(/Toplam Korner/gi, "Total Corners")
      .replace(/Toplam Kart/gi, "Total Cards")
      .replace(/Toplam Ofsayt/gi, "Total Offsides")
      .replace(/Toplam İsabetli Şut/gi, "Total Shots on Target")
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
    .replace(/Double Chance/gi, t("Double Chance"))
    .replace(/Draw No Bet/gi, t("Draw No Bet"))
    .replace(/Asian Handicap/gi, t("Asian Handicap"))
    .replace(/Home Win To Nil/gi, t("Win To Nil"))
    .replace(/Away Win To Nil/gi, t("Win To Nil"))
    .replace(/Win To Nil/gi, t("Win To Nil"))
    .replace(/Correct Score/gi, t("Correct Score"))
    .replace(/Match Result/gi, t("Match Result"))
    .replace(/Half-Time Result/gi, "İlk Yarı Sonucu")
    .replace(/Half-Time \/ Full-Time/gi, "Devre/Maç")
    .replace(/\bUnder\b/gi, t("Under"))
    .replace(/\bOver\b/gi, t("Over"))
    .replace(/\bHome\b/gi, t("Home"))
    .replace(/\bAway\b/gi, t("Away"))
    .replace(/\bDraw\b/gi, t("Draw"));
}

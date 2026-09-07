import type { PopularMarketRow } from "@/modules/market-engine/build-popular-markets-summary";

export type BetMarketTier = "STRONG" | "MEDIUM" | "WEAK";

export type BetMarketSettlement = "WON" | "LOST" | "VOID" | "DATA_MISSING";

export type BetMarketOption = {
  key: string;
  selection: string;
  probability: number;
  fairOdds: number;
  score: number;
  tier: BetMarketTier;
  estimated: boolean;
};

export type BetMarketGroup = {
  number: number;
  title: string;
  available: boolean;
  reason: string | null;
  options: BetMarketOption[];
};

export type BetMarketCatalogInput = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeProbability: number | null;
  drawProbability: number | null;
  awayProbability: number | null;
  expectedHomeGoals: number | null;
  expectedAwayGoals: number | null;
  confidenceScore: number | null;
  dataQualityScore?: number | null;
  knownMarkets?: PopularMarketRow[];
  locale: "en" | "tr";
};

type ScoreCell = {
  home: number;
  away: number;
  probability: number;
};

type RawOption = {
  key: string;
  selection: string;
  probability: number;
  estimated?: boolean;
};

function settled(value: boolean): BetMarketSettlement {
  return value ? "WON" : "LOST";
}

/**
 * Settles score-based market options without inventing event data. Markets that
 * require half-time, corner, card, player or goal-timing events explicitly
 * remain DATA_MISSING until those facts are available in the archive.
 */
export function settleBetMarketOption(
  optionKey: string,
  finalHomeScore: number | null,
  finalAwayScore: number | null,
): BetMarketSettlement {
  if (finalHomeScore === null || finalAwayScore === null) return "DATA_MISSING";

  const home = finalHomeScore;
  const away = finalAwayScore;
  const total = home + away;
  const normalized = optionKey.toLocaleLowerCase("tr-TR");
  const homeWon = home > away;
  const draw = home === away;
  const awayWon = away > home;
  const bothScored = home > 0 && away > 0;

  if (normalized === "ms-1") return settled(homeWon);
  if (normalized === "ms-0") return settled(draw);
  if (normalized === "ms-2") return settled(awayWon);
  if (normalized === "dc-10") return settled(homeWon || draw);
  if (normalized === "dc-12") return settled(homeWon || awayWon);
  if (normalized === "dc-02") return settled(draw || awayWon);

  if (
    normalized.startsWith("iy-") ||
    normalized.startsWith("2y-") ||
    normalized.startsWith("more-") ||
    normalized.startsWith("both-halves-") ||
    normalized.startsWith("first-") ||
    normalized.startsWith("last-") ||
    normalized.startsWith("known:")
  ) return "DATA_MISSING";

  const totalMatch = normalized.match(/^tg-([0-9.]+)-(alt|ust)$/);
  if (totalMatch) {
    const line = Number(totalMatch[1]);
    return settled(totalMatch[2] === "alt" ? total < line : total > line);
  }

  const teamTotalMatch = normalized.match(/^(ev|dep)-([0-9.]+)-(alt|ust)$/);
  if (teamTotalMatch) {
    const goals = teamTotalMatch[1] === "ev" ? home : away;
    const line = Number(teamTotalMatch[2]);
    return settled(teamTotalMatch[3] === "alt" ? goals < line : goals > line);
  }

  if (normalized === "ms-var") return settled(bothScored);
  if (normalized === "ms-yok") return settled(!bothScored);

  const resultAndTotal = normalized.match(/^ms ([102])-25-(alt|ust)$/);
  if (resultAndTotal) {
    const resultWon = resultAndTotal[1] === "1"
      ? homeWon
      : resultAndTotal[1] === "0"
        ? draw
        : awayWon;
    const goalsWon = resultAndTotal[2] === "alt" ? total < 2.5 : total > 2.5;
    return settled(resultWon && goalsWon);
  }

  const totalAndBtts = normalized.match(/^25-(alt|üst)-(var|yok)$/);
  if (totalAndBtts) {
    const goalsWon = totalAndBtts[1] === "alt" ? total < 2.5 : total > 2.5;
    const bttsWon = totalAndBtts[2] === "var" ? bothScored : !bothScored;
    return settled(goalsWon && bttsWon);
  }

  if (normalized === "ga-01") return settled(total <= 1);
  if (normalized === "ga-23") return settled(total >= 2 && total <= 3);
  if (normalized === "ga-45") return settled(total >= 4 && total <= 5);
  if (normalized === "ga-6") return settled(total >= 6);

  const exactScore = normalized.match(/^score-(\d+)-(\d+)$/);
  if (exactScore) {
    return settled(home === Number(exactScore[1]) && away === Number(exactScore[2]));
  }

  const handicap = normalized.match(/^hcp-(-?[0-9.]+)-(home|away)$/);
  if (handicap) {
    const homeCovers = home + Number(handicap[1]) > away;
    return settled(handicap[2] === "home" ? homeCovers : !homeCovers);
  }

  if (normalized === "dnb-home") return draw ? "VOID" : settled(homeWon);
  if (normalized === "dnb-away") return draw ? "VOID" : settled(awayWon);
  if (normalized === "scores-home-only") return settled(home > 0 && away === 0);
  if (normalized === "scores-away-only") return settled(home === 0 && away > 0);
  if (normalized === "scores-both") return settled(bothScored);
  if (normalized === "scores-none" || normalized === "no-goal") return settled(total === 0);
  if (normalized === "home-win-nil") return settled(homeWon && away === 0);
  if (normalized === "away-win-nil") return settled(awayWon && home === 0);
  if (normalized === "builder-1x-o15") return settled(home >= away && total > 1.5);
  if (normalized === "builder-x2-o15") return settled(away >= home && total > 1.5);
  if (normalized === "builder-btts-o25") return settled(bothScored && total > 2.5);

  return "DATA_MISSING";
}

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(Math.max(value, minimum), maximum);

function factorial(value: number): number {
  let result = 1;
  for (let current = 2; current <= value; current += 1) result *= current;
  return result;
}

function poisson(goals: number, lambda: number): number {
  return Math.exp(-lambda) * lambda ** goals / factorial(goals);
}

function buildScoreMatrix(homeLambda: number, awayLambda: number): ScoreCell[] {
  const cells: ScoreCell[] = [];
  let mass = 0;

  for (let home = 0; home <= 9; home += 1) {
    for (let away = 0; away <= 9; away += 1) {
      const probability = poisson(home, homeLambda) * poisson(away, awayLambda);
      cells.push({ home, away, probability });
      mass += probability;
    }
  }

  return mass > 0
    ? cells.map((cell) => ({ ...cell, probability: cell.probability / mass }))
    : [];
}

function sum(cells: ScoreCell[], predicate: (cell: ScoreCell) => boolean): number {
  return cells.reduce(
    (total, cell) => total + (predicate(cell) ? cell.probability : 0),
    0,
  );
}

function toOption(raw: RawOption, confidence: number): BetMarketOption | null {
  const probability = clamp(raw.probability);
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 100) {
    return null;
  }

  const estimated = raw.estimated ?? false;
  const score = clamp(
    probability * 0.82 + confidence * 0.18 - (estimated ? 5 : 0),
  );
  const roundedScore = Math.round(score * 10) / 10;

  return {
    key: raw.key,
    selection: raw.selection,
    probability: Math.round(probability * 10) / 10,
    fairOdds: Math.round((100 / probability) * 100) / 100,
    score: roundedScore,
    tier: roundedScore >= 70 ? "STRONG" : roundedScore >= 55 ? "MEDIUM" : "WEAK",
    estimated,
  };
}

function group(
  number: number,
  title: string,
  rawOptions: RawOption[],
  confidence: number,
  reason: string | null = null,
): BetMarketGroup {
  const options = rawOptions
    .map((option) => toOption(option, confidence))
    .filter((option): option is BetMarketOption => option !== null)
    .sort((first, second) => second.score - first.score);

  return {
    number,
    title,
    available: options.length > 0,
    reason: options.length > 0 ? null : reason,
    options,
  };
}

function unavailable(number: number, title: string, reason: string): BetMarketGroup {
  return { number, title, available: false, reason, options: [] };
}

function bestKnown(
  rows: PopularMarketRow[] | undefined,
  fragments: string[],
): RawOption[] {
  const row = rows?.find(
    (candidate) =>
      candidate.supported &&
      fragments.some((fragment) =>
        `${candidate.label} ${candidate.market ?? ""}`
          .toLocaleLowerCase("tr-TR")
          .includes(fragment.toLocaleLowerCase("tr-TR")),
      ),
  );

  if (!row || row.probability === undefined || !row.selection) return [];

  return [{
    key: `known:${row.label}`,
    selection: `${row.market ?? row.label} • ${row.selection}`,
    probability: row.probability,
  }];
}

function outcomeOptions(input: BetMarketCatalogInput): RawOption[] {
  if (
    input.homeProbability === null ||
    input.drawProbability === null ||
    input.awayProbability === null
  ) return [];

  return [
    { key: "ms-1", selection: `MS 1 • ${input.homeTeam}`, probability: input.homeProbability },
    { key: "ms-0", selection: "MS 0 • Beraberlik", probability: input.drawProbability },
    { key: "ms-2", selection: `MS 2 • ${input.awayTeam}`, probability: input.awayProbability },
  ];
}

export function buildBetMarketCatalog(input: BetMarketCatalogInput): BetMarketGroup[] {
  const tr = input.locale === "tr";
  const noModelData = tr
    ? "Bu maç için gerekli model verisi henüz oluşmadı."
    : "Required model data is not available for this match yet.";
  const noEventData = tr
    ? "Bu pazar için maç olayı ve geçmiş takım verisi gerekli."
    : "This market requires event and historical team data.";
  const noPlayerData = tr
    ? "Bu pazar için güncel kadro ve oyuncu performans verisi gerekli."
    : "This market requires current lineup and player-performance data.";

  const confidenceValues = [input.confidenceScore, input.dataQualityScore]
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const confidence = confidenceValues.length > 0
    ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
    : 50;

  const outcomes = outcomeOptions(input);
  const home = input.homeProbability;
  const draw = input.drawProbability;
  const away = input.awayProbability;
  const hasOutcome = home !== null && draw !== null && away !== null;
  const hasGoals =
    input.expectedHomeGoals !== null &&
    input.expectedAwayGoals !== null &&
    input.expectedHomeGoals >= 0 &&
    input.expectedAwayGoals >= 0;

  const full = hasGoals
    ? buildScoreMatrix(input.expectedHomeGoals!, input.expectedAwayGoals!)
    : [];
  const firstHalf = hasGoals
    ? buildScoreMatrix(input.expectedHomeGoals! * 0.45, input.expectedAwayGoals! * 0.45)
    : [];
  const secondHalf = hasGoals
    ? buildScoreMatrix(input.expectedHomeGoals! * 0.55, input.expectedAwayGoals! * 0.55)
    : [];

  const doubleChance: RawOption[] = hasOutcome ? [
    { key: "dc-10", selection: "1–0", probability: home! + draw! },
    { key: "dc-12", selection: "1–2", probability: home! + away! },
    { key: "dc-02", selection: "0–2", probability: draw! + away! },
  ] : [];

  const halfResult = firstHalf.length ? [
    { key: "iy-1", selection: "İY 1", probability: sum(firstHalf, (cell) => cell.home > cell.away) * 100, estimated: true },
    { key: "iy-0", selection: "İY 0", probability: sum(firstHalf, (cell) => cell.home === cell.away) * 100, estimated: true },
    { key: "iy-2", selection: "İY 2", probability: sum(firstHalf, (cell) => cell.home < cell.away) * 100, estimated: true },
  ] : [];

  const halfOutcomeProbabilities = halfResult.map((option) => option.probability / 100);
  const fullOutcomeProbabilities = hasOutcome ? [home! / 100, draw! / 100, away! / 100] : [];
  const outcomeLabels = ["1", "0", "2"];
  const halfFull: RawOption[] = [];
  if (halfOutcomeProbabilities.length && fullOutcomeProbabilities.length) {
    for (let first = 0; first < 3; first += 1) {
      for (let final = 0; final < 3; final += 1) {
        halfFull.push({
          key: `iy-ms-${first}-${final}`,
          selection: `${outcomeLabels[first]}/${outcomeLabels[final]}`,
          probability: halfOutcomeProbabilities[first]! * fullOutcomeProbabilities[final]! * 100,
          estimated: true,
        });
      }
    }
  }

  const totalGoals: RawOption[] = [];
  for (const line of [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]) {
    if (!full.length) break;
    const under = sum(full, (cell) => cell.home + cell.away < line) * 100;
    totalGoals.push(
      { key: `tg-${line}-alt`, selection: `${line} ALT`, probability: under },
      { key: `tg-${line}-ust`, selection: `${line} ÜST`, probability: 100 - under },
    );
  }

  const halfTotals: RawOption[] = [];
  for (const line of [0.5, 1.5, 2.5]) {
    if (!firstHalf.length) break;
    const under = sum(firstHalf, (cell) => cell.home + cell.away < line) * 100;
    halfTotals.push(
      { key: `iy-tg-${line}-alt`, selection: `İY ${line} ALT`, probability: under, estimated: true },
      { key: `iy-tg-${line}-ust`, selection: `İY ${line} ÜST`, probability: 100 - under, estimated: true },
    );
  }

  const teamGoals: RawOption[] = [];
  for (const [side, team, goalKey] of [
    ["EV", input.homeTeam, "home"],
    ["DEP", input.awayTeam, "away"],
  ] as const) {
    for (const line of [0.5, 1.5, 2.5]) {
      if (!full.length) break;
      const under = sum(full, (cell) => cell[goalKey] < line) * 100;
      teamGoals.push(
        { key: `${side}-${line}-alt`, selection: `${team} ${line} ALT`, probability: under },
        { key: `${side}-${line}-ust`, selection: `${team} ${line} ÜST`, probability: 100 - under },
      );
    }
  }

  const bttsOptions = (matrix: ScoreCell[], prefix: string, estimated = false): RawOption[] => {
    if (!matrix.length) return [];
    const yes = sum(matrix, (cell) => cell.home > 0 && cell.away > 0) * 100;
    return [
      { key: `${prefix}-var`, selection: `${prefix} KG VAR`, probability: yes, estimated },
      { key: `${prefix}-yok`, selection: `${prefix} KG YOK`, probability: 100 - yes, estimated },
    ];
  };

  const resultAndTotal: RawOption[] = [];
  if (full.length) {
    for (const [result, predicate] of [
      ["MS 1", (cell: ScoreCell) => cell.home > cell.away],
      ["MS 0", (cell: ScoreCell) => cell.home === cell.away],
      ["MS 2", (cell: ScoreCell) => cell.home < cell.away],
    ] as const) {
      resultAndTotal.push(
        { key: `${result}-25-alt`, selection: `${result} ve 2.5 ALT`, probability: sum(full, (cell) => predicate(cell) && cell.home + cell.away < 2.5) * 100 },
        { key: `${result}-25-ust`, selection: `${result} ve 2.5 ÜST`, probability: sum(full, (cell) => predicate(cell) && cell.home + cell.away > 2.5) * 100 },
      );
    }
  }

  const overAndBtts: RawOption[] = [];
  if (full.length) {
    for (const totalSide of ["ALT", "ÜST"] as const) {
      for (const bttsSide of ["VAR", "YOK"] as const) {
        overAndBtts.push({
          key: `25-${totalSide}-${bttsSide}`,
          selection: `2.5 ${totalSide} ve KG ${bttsSide}`,
          probability: sum(full, (cell) =>
            (totalSide === "ÜST" ? cell.home + cell.away > 2.5 : cell.home + cell.away < 2.5) &&
            (bttsSide === "VAR" ? cell.home > 0 && cell.away > 0 : cell.home === 0 || cell.away === 0),
          ) * 100,
        });
      }
    }
  }

  const goalBands: RawOption[] = full.length ? [
    { key: "ga-01", selection: "0–1 Gol", probability: sum(full, (cell) => cell.home + cell.away <= 1) * 100 },
    { key: "ga-23", selection: "2–3 Gol", probability: sum(full, (cell) => cell.home + cell.away >= 2 && cell.home + cell.away <= 3) * 100 },
    { key: "ga-45", selection: "4–5 Gol", probability: sum(full, (cell) => cell.home + cell.away >= 4 && cell.home + cell.away <= 5) * 100 },
    { key: "ga-6", selection: "6+ Gol", probability: sum(full, (cell) => cell.home + cell.away >= 6) * 100 },
  ] : [];

  const correctScores: RawOption[] = [...full]
    .sort((first, second) => second.probability - first.probability)
    .slice(0, 6)
    .map((cell) => ({
      key: `score-${cell.home}-${cell.away}`,
      selection: `${cell.home}-${cell.away}`,
      probability: cell.probability * 100,
    }));

  const handicap: RawOption[] = [];
  for (const line of [-1.5, -0.5, 0.5, 1.5]) {
    if (!full.length) break;
    const homeCover = sum(full, (cell) => cell.home + line > cell.away) * 100;
    handicap.push(
      { key: `hcp-${line}-home`, selection: `Ev ${line > 0 ? "+" : ""}${line}`, probability: homeCover },
      { key: `hcp-${line}-away`, selection: `Dep ${line > 0 ? "+" : ""}${line}`, probability: 100 - homeCover },
    );
  }

  const dnb = hasOutcome && home! + away! > 0 ? [
    { key: "dnb-home", selection: `${input.homeTeam} • Beraberlikte İade`, probability: home! / (home! + away!) * 100 },
    { key: "dnb-away", selection: `${input.awayTeam} • Beraberlikte İade`, probability: away! / (home! + away!) * 100 },
  ] : [];

  const whoScores = full.length ? [
    { key: "scores-home-only", selection: "Yalnız Ev Sahibi", probability: sum(full, (cell) => cell.home > 0 && cell.away === 0) * 100 },
    { key: "scores-away-only", selection: "Yalnız Deplasman", probability: sum(full, (cell) => cell.home === 0 && cell.away > 0) * 100 },
    { key: "scores-both", selection: "İki Takım da", probability: sum(full, (cell) => cell.home > 0 && cell.away > 0) * 100 },
    { key: "scores-none", selection: "Hiçbiri", probability: sum(full, (cell) => cell.home === 0 && cell.away === 0) * 100 },
  ] : [];

  const firstLastGoal = hasGoals ? (() => {
    const totalXg = input.expectedHomeGoals! + input.expectedAwayGoals!;
    const noGoal = Math.exp(-totalXg) * 100;
    const anyGoal = 100 - noGoal;
    const homeShare = totalXg > 0 ? input.expectedHomeGoals! / totalXg : 0;
    const awayShare = totalXg > 0 ? input.expectedAwayGoals! / totalXg : 0;
    return [
      { key: "first-home", selection: `İlk Gol • ${input.homeTeam}`, probability: anyGoal * homeShare, estimated: true },
      { key: "first-away", selection: `İlk Gol • ${input.awayTeam}`, probability: anyGoal * awayShare, estimated: true },
      { key: "last-home", selection: `Son Gol • ${input.homeTeam}`, probability: anyGoal * homeShare, estimated: true },
      { key: "no-goal", selection: "Gol Olmaz", probability: noGoal, estimated: true },
    ];
  })() : [];

  const halfComparisonProbability = (
    predicate: (firstGoals: number, secondGoals: number) => boolean,
  ) => firstHalf.reduce(
    (total, first) => total + secondHalf.reduce(
      (inner, second) => inner + (
        predicate(first.home + first.away, second.home + second.away)
          ? first.probability * second.probability
          : 0
      ),
      0,
    ),
    0,
  ) * 100;

  const halfMoreGoals = firstHalf.length && secondHalf.length ? [
    { key: "more-first", selection: "İlk Yarı", probability: halfComparisonProbability((first, second) => first > second), estimated: true },
    { key: "more-second", selection: "İkinci Yarı", probability: halfComparisonProbability((first, second) => second > first), estimated: true },
    { key: "more-equal", selection: "Eşit", probability: halfComparisonProbability((first, second) => first === second), estimated: true },
  ] : [];

  const bothHalves = hasGoals ? [
    { key: "both-halves-total", selection: "Her İki Yarıda Gol Olur", probability: (1 - Math.exp(-(input.expectedHomeGoals! + input.expectedAwayGoals!) * 0.45)) * (1 - Math.exp(-(input.expectedHomeGoals! + input.expectedAwayGoals!) * 0.55)) * 100, estimated: true },
    { key: "both-halves-home", selection: `${input.homeTeam} İki Yarıda da Gol Atar`, probability: (1 - Math.exp(-input.expectedHomeGoals! * 0.45)) * (1 - Math.exp(-input.expectedHomeGoals! * 0.55)) * 100, estimated: true },
    { key: "both-halves-away", selection: `${input.awayTeam} İki Yarıda da Gol Atar`, probability: (1 - Math.exp(-input.expectedAwayGoals! * 0.45)) * (1 - Math.exp(-input.expectedAwayGoals! * 0.55)) * 100, estimated: true },
  ] : [];

  const winToNil = full.length ? [
    { key: "home-win-nil", selection: `${input.homeTeam} Kazanır ve Gol Yemez`, probability: sum(full, (cell) => cell.home > cell.away && cell.away === 0) * 100 },
    { key: "away-win-nil", selection: `${input.awayTeam} Kazanır ve Gol Yemez`, probability: sum(full, (cell) => cell.away > cell.home && cell.home === 0) * 100 },
  ] : [];

  const builder = full.length ? [
    { key: "builder-1x-o15", selection: "1–0 + 1.5 ÜST", probability: sum(full, (cell) => cell.home >= cell.away && cell.home + cell.away > 1.5) * 100 },
    { key: "builder-x2-o15", selection: "0–2 + 1.5 ÜST", probability: sum(full, (cell) => cell.away >= cell.home && cell.home + cell.away > 1.5) * 100 },
    { key: "builder-btts-o25", selection: "KG VAR + 2.5 ÜST", probability: sum(full, (cell) => cell.home > 0 && cell.away > 0 && cell.home + cell.away > 2.5) * 100 },
  ] : [];

  const corners = bestKnown(input.knownMarkets, ["korner", "corner"]);
  const cards = bestKnown(input.knownMarkets, ["kart", "card"]);
  const offsides = bestKnown(input.knownMarkets, ["ofsayt", "offside"]);
  const shots = bestKnown(input.knownMarkets, ["şut", "shot"]);
  const playerGoals = bestKnown(input.knownMarkets, ["oyuncu gol", "player goal"]);

  return [
    group(1, tr ? "Maç Sonucu" : "Match Result", outcomes, confidence, noModelData),
    group(2, tr ? "Çifte Şans" : "Double Chance", doubleChance, confidence, noModelData),
    group(3, tr ? "İlk Yarı Sonucu" : "Half-Time Result", halfResult, confidence, noModelData),
    group(4, tr ? "İlk Yarı / Maç Sonucu" : "Half-Time / Full-Time", halfFull, confidence, noModelData),
    group(5, tr ? "Toplam Gol Alt / Üst" : "Total Goals Over / Under", totalGoals, confidence, noModelData),
    group(6, tr ? "İlk Yarı Toplam Gol" : "First-Half Total Goals", halfTotals, confidence, noModelData),
    group(7, tr ? "Takım Golü Alt / Üst" : "Team Goals Over / Under", teamGoals, confidence, noModelData),
    group(8, tr ? "Karşılıklı Gol" : "Both Teams to Score", [
      ...bttsOptions(full, "MS"),
      ...bttsOptions(firstHalf, "İY", true),
      ...bttsOptions(secondHalf, "2Y", true),
    ], confidence, noModelData),
    group(9, tr ? "Maç Sonucu ve Alt / Üst" : "Result and Goals", resultAndTotal, confidence, noModelData),
    group(10, tr ? "Alt / Üst ve Karşılıklı Gol" : "Goals and BTTS", overAndBtts, confidence, noModelData),
    group(11, tr ? "Gol Aralığı" : "Goal Range", goalBands, confidence, noModelData),
    group(12, tr ? "Kesin Skor" : "Correct Score", correctScores, confidence, noModelData),
    group(13, tr ? "Handikaplı Maç Sonucu" : "Handicap Result", handicap, confidence, noModelData),
    group(14, tr ? "Beraberlikte Bahis Yok" : "Draw No Bet", dnb, confidence, noModelData),
    group(15, tr ? "Hangi Takım Gol Atar?" : "Which Team Scores?", whoScores, confidence, noModelData),
    group(16, tr ? "Golü Hangi Takım Atar?" : "First / Last Goal Team", firstLastGoal, confidence, noModelData),
    unavailable(17, tr ? "İlk Golün Zamanı" : "First Goal Time", noEventData),
    group(18, tr ? "Hangi Yarıda Daha Çok Gol?" : "Highest Scoring Half", halfMoreGoals, confidence, noModelData),
    group(19, tr ? "Her İki Yarıda Gol" : "Goal in Both Halves", bothHalves, confidence, noModelData),
    group(20, tr ? "Kazanırken Gol Yemez" : "Win to Nil", winToNil, confidence, noModelData),
    corners.length ? group(21, tr ? "Korner Bahisleri" : "Corner Markets", corners, confidence) : unavailable(21, tr ? "Korner Bahisleri" : "Corner Markets", noEventData),
    cards.length ? group(22, tr ? "Kart Bahisleri" : "Card Markets", cards, confidence) : unavailable(22, tr ? "Kart Bahisleri" : "Card Markets", noEventData),
    offsides.length ? group(23, tr ? "Ofsayt Bahisleri" : "Offside Markets", offsides, confidence) : unavailable(23, tr ? "Ofsayt Bahisleri" : "Offside Markets", noEventData),
    shots.length ? group(24, tr ? "Şut Bahisleri" : "Shot Markets", shots, confidence) : unavailable(24, tr ? "Şut Bahisleri" : "Shot Markets", noEventData),
    playerGoals.length ? group(25, tr ? "Oyuncu Gol Bahisleri" : "Player Goals", playerGoals, confidence) : unavailable(25, tr ? "Oyuncu Gol Bahisleri" : "Player Goals", noPlayerData),
    unavailable(26, tr ? "Diğer Oyuncu Bahisleri" : "Other Player Markets", noPlayerData),
    group(27, tr ? "Bahis Oluşturucu" : "Bet Builder", builder, confidence, noModelData),
  ];
}

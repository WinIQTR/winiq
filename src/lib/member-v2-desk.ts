import type { MarketLineMove } from "@/lib/market-line-move-shared";
import { marketLineMoveKey } from "@/lib/market-line-move-shared";
import {
  MEMBER_ODDS_BAND_DEFS,
  mapPublishedOddsToBandKey,
} from "@/lib/member-odds-bands";
import {
  getPredictionLabel,
  type DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";

function confidenceOf(prediction: DashboardPrediction): number {
  const top = prediction.topPicks?.[0];
  const raw =
    top?.pickScore ??
    top?.probability ??
    prediction.confidenceScore ??
    prediction.predictedProbability ??
    0;
  return Math.max(0, Math.min(100, Number(raw) || 0));
}

export type MemberV2TopPick = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  kickoffIso: string;
  market: string;
  selection: string;
  confidence: number;
  fairOdds: number | null;
  oddsBand: string;
  reason: string;
  href: string;
  lineMove: MarketLineMove | null;
  marketJoined: boolean;
};

export type MemberV2SkipPick = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  reason: string;
  href: string;
};

export type MemberV2DeskBundle = {
  topPicks: MemberV2TopPick[];
  skipToday: MemberV2SkipPick[];
  trust: {
    loggedBeforeKickoffPct: number | null;
    recentStreakLabel: string;
    recentHitRate: number | null;
    baselineBeat: boolean | null;
  };
};

function fairOddsOf(prediction: DashboardPrediction): number | null {
  const top = prediction.topPicks?.[0];
  if (top?.fairOdds && top.fairOdds > 1) return top.fairOdds;
  if (prediction.predictedProbability > 0) {
    return Math.round((100 / prediction.predictedProbability) * 100) / 100;
  }
  return null;
}

export function mapOddsToBandLabel(odds: number | null): string {
  if (odds == null || !(odds >= 1.1)) return "—";
  const key = mapPublishedOddsToBandKey(odds);
  if (!key) return "—";
  return MEMBER_ODDS_BAND_DEFS.find((band) => band.key === key)?.label ?? "—";
}

function primaryReason(prediction: DashboardPrediction): string {
  const raw =
    prediction.topPicks?.[0]?.reasons?.find(
      (item) => typeof item === "string" && item.trim().length > 8,
    ) ?? null;
  if (raw) return raw.trim().slice(0, 120);
  const conf = confidenceOf(prediction);
  if (conf >= 85) return "High model confidence with a clear top selection.";
  if (conf >= 75) return "Solid confidence — check line move before staking.";
  return "Borderline confidence — prefer smaller units or skip.";
}

function isUpcoming(prediction: DashboardPrediction, now: Date) {
  const kick = prediction.kickoffAt instanceof Date
    ? prediction.kickoffAt
    : new Date(prediction.kickoffAt);
  const settled =
    prediction.settlementStatus === "WON" ||
    prediction.settlementStatus === "LOST" ||
    prediction.settlementStatus === "VOID";
  return kick.getTime() >= now.getTime() && !settled;
}

export function buildMemberV2Desk(options: {
  predictions: DashboardPrediction[];
  lineMoves?: Record<string, MarketLineMove>;
  matchPathPrefix?: string;
  recentResults?: Array<"WON" | "LOST" | "VOID">;
  loggedBeforeKickoffPct?: number | null;
  homeBaselineHitRate?: number | null;
  now?: Date;
}): MemberV2DeskBundle {
  const now = options.now ?? new Date();
  const prefix = options.matchPathPrefix ?? "/member/matches";
  const lineMoves = options.lineMoves ?? {};

  const upcoming = options.predictions
    .filter((row) => isUpcoming(row, now))
    .slice()
    .sort((a, b) => confidenceOf(b) - confidenceOf(a));

  const topPicks: MemberV2TopPick[] = upcoming.slice(0, 3).map((prediction) => {
    const top = prediction.topPicks?.[0];
    const pickKey = top?.key;
    const move = pickKey
      ? lineMoves[marketLineMoveKey(prediction.matchId, pickKey)] ?? null
      : null;
    const odds = fairOddsOf(prediction);
    const confidence = confidenceOf(prediction);
    const marketJoined =
      move != null && move.direction === "down" && confidence >= 75;
    return {
      matchId: prediction.matchId,
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      leagueName: prediction.leagueName,
      kickoffIso:
        prediction.kickoffAt instanceof Date
          ? prediction.kickoffAt.toISOString()
          : String(prediction.kickoffAt),
      market: top?.market ?? "Match result",
      selection: top?.selection ?? getPredictionLabel(prediction),
      confidence,
      fairOdds: odds,
      oddsBand: mapOddsToBandLabel(odds),
      reason: primaryReason(prediction),
      href: `${prefix}/${prediction.matchId}`,
      lineMove: move,
      marketJoined,
    };
  });

  const skipToday: MemberV2SkipPick[] = upcoming
    .filter((row) => confidenceOf(row) < 65)
    .slice(0, 6)
    .map((prediction) => ({
      matchId: prediction.matchId,
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      leagueName: prediction.leagueName,
      reason: "Low confidence — no-bet is the honest call today.",
      href: `${prefix}/${prediction.matchId}`,
    }));

  const recent = (options.recentResults ?? []).filter(
    (item) => item === "WON" || item === "LOST",
  );
  let streak = 0;
  let streakKind: "WON" | "LOST" | null = null;
  for (const item of recent) {
    if (!streakKind) {
      streakKind = item;
      streak = 1;
      continue;
    }
    if (item === streakKind) streak += 1;
    else break;
  }
  const recentHitRate =
    recent.length > 0
      ? (recent.filter((item) => item === "WON").length / recent.length) * 100
      : null;
  const baseline = options.homeBaselineHitRate ?? null;
  const baselineBeat =
    recentHitRate != null && baseline != null
      ? recentHitRate >= baseline
      : null;

  return {
    topPicks,
    skipToday,
    trust: {
      loggedBeforeKickoffPct: options.loggedBeforeKickoffPct ?? null,
      recentStreakLabel:
        streakKind && streak > 0
          ? `${streak} ${streakKind === "WON" ? "win" : "loss"} streak`
          : "No streak yet",
      recentHitRate,
      baselineBeat,
    },
  };
}

export function suggestUnitSize(options: {
  conservativeEv: number | null;
  uncertaintyBuffer: number | null;
  expectedValuePct: number | null;
}): { units: number; action: "play" | "watch" | "skip"; note: string } {
  const buffer = options.uncertaintyBuffer ?? 0;
  const cev = options.conservativeEv;
  const evPct = options.expectedValuePct ?? 0;
  if (cev != null && cev < 0) {
    return { units: 0, action: "skip", note: "Conservative EV negative — skip." };
  }
  if (buffer >= 0.08 || (cev != null && cev < 0.03)) {
    return {
      units: 0.5,
      action: "watch",
      note: "EV+ but buffer high — half unit or wait for a better price.",
    };
  }
  if (evPct >= 8 || (cev != null && cev >= 0.06)) {
    return { units: 1, action: "play", note: "Clear edge — standard 1 unit." };
  }
  return { units: 0.5, action: "play", note: "Modest edge — prefer 0.5 unit." };
}

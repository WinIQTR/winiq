import { summarizeLabeledClv } from "@/modules/track-record/clv-labeled";
import { trackRowsWithClv } from "@/modules/track-record/from-archive";
import { loggedBeforeKickoffRate } from "@/modules/track-record/logged-before-kickoff";
import type { TrackRecordRow } from "@/modules/track-record/types";
import { filterScoreableRows } from "@/modules/track-record/void-reason";

export type TrackRecordReport = {
  rows: number;
  scoreable: number;
  voided: number;
  loggedBeforeKickoffRate: number | null;
  hitRate: number | null;
  clv: ReturnType<typeof summarizeLabeledClv>;
  liveValueFlags: number;
  replayValueFlags: number;
  teamsReversed: number;
};

export function buildTrackRecordReport(
  rows: readonly TrackRecordRow[],
): TrackRecordReport {
  const scoreable = filterScoreableRows(rows);
  const won = scoreable.filter((row) => row.predictionWon === true).length;
  const withClv = trackRowsWithClv(scoreable).map((item) => item.clv);
  const liveValueFlags = rows.filter((row) => row.value?.origin === "live").length;
  const replayValueFlags = rows.filter(
    (row) => row.value?.origin === "replay",
  ).length;

  return {
    rows: rows.length,
    scoreable: scoreable.length,
    voided: rows.length - scoreable.length,
    loggedBeforeKickoffRate: loggedBeforeKickoffRate(rows),
    hitRate: scoreable.length > 0 ? won / scoreable.length : null,
    clv: summarizeLabeledClv(withClv),
    liveValueFlags,
    replayValueFlags,
    teamsReversed: rows.filter((row) => row.teamsReversedAfterLogging).length,
  };
}

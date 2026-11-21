export type {
  BookmakerKind,
  TrackPick,
  TrackRecordRow,
  ValueFlag,
  ValueOrigin,
  VoidReason,
} from "@/modules/track-record/types";

export {
  isLoggedBeforeKickoff,
  loggedBeforeKickoffRate,
} from "@/modules/track-record/logged-before-kickoff";

export {
  VOID_REASONS,
  filterScoreableRows,
  isVoidRow,
  voidReasonFromMatchStatus,
} from "@/modules/track-record/void-reason";

export {
  buildRecordHashPayload,
  computeRecordHash,
  type RecordHashFields,
} from "@/modules/track-record/record-hash";

export {
  computeLabeledClv,
  summarizeLabeledClv,
  type LabeledClv,
} from "@/modules/track-record/clv-labeled";

export {
  buildValuePreimage,
  commitValuePreimage,
  normalizeSelection,
  pickRealizableOdds,
  sealValueFlag,
  verifyValueCommitment,
  type ValuePreimageParts,
} from "@/modules/track-record/value-seal";

export {
  DEFAULT_MANIFEST_PATH,
  DEFAULT_TRACK_DIR,
  appendManifestRow,
  formatTrackFileName,
  parseManifestCsv,
  serializeTrackSnapshot,
  sha256OfText,
  verifyManifestEntry,
  writeImmutableTrackSnapshot,
  type ManifestRow,
  type TrackSnapshotMeta,
} from "@/modules/track-record/snapshot-manifest";

export {
  buildMarginIndex,
  oneXTwoMargin,
  type BookmakerMarginRow,
  type MarginIndex,
  type MarginSample,
} from "@/modules/track-record/margin-index";

export {
  combineDoubleChanceOdds,
  doubleChanceLegs,
  doubleChanceWins,
  oddsForPick,
} from "@/modules/track-record/double-chance";

export {
  detectTeamsReversed,
  type TeamsReversedCheck,
} from "@/modules/track-record/teams-reversed";

export {
  appendCorrection,
  formatCorrectionsMarkdown,
  type CorrectionEntry,
} from "@/modules/track-record/corrections";

export {
  formatAutopsyMarkdown,
  formatExperimentMarkdown,
  type ExperimentAutopsy,
  type ExperimentSpec,
} from "@/modules/track-record/experiment";

export {
  archiveRowToTrackRecord,
  trackRowsWithClv,
  type ArchiveLikeRow,
} from "@/modules/track-record/from-archive";

export {
  buildTrackRecordReport,
  type TrackRecordReport,
} from "@/modules/track-record/report";

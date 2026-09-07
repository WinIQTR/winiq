export type MembershipPlanName = "BASIC" | "ANALYSIS" | "PROFESSIONAL";

export type MembershipPermission =
  | "DAILY_PICKS"
  | "ADVISORY_PICKS"
  | "PICK_DETAILS"
  | "RESULT_HISTORY"
  | "VALUE_BETS"
  | "SMART_PICKS"
  | "FULL_ANALYTICS"
  | "DAILY_COUPONS"
  | "WEEKLY_COUPONS"
  | "BALANCED_COUPONS"
  | "SURPRISE_COUPONS"
  | "COUPON_ANALYTICS"
  | "COUPON_HISTORY";

export const MEMBERSHIP_PERMISSIONS: Record<
  MembershipPlanName,
  readonly MembershipPermission[]
> = {
  BASIC: ["DAILY_PICKS", "DAILY_COUPONS", "COUPON_HISTORY"],
  ANALYSIS: [
    "DAILY_PICKS",
    "ADVISORY_PICKS",
    "PICK_DETAILS",
    "RESULT_HISTORY",
    "DAILY_COUPONS",
    "WEEKLY_COUPONS",
    "BALANCED_COUPONS",
    "COUPON_HISTORY",
  ],
  PROFESSIONAL: [
    "DAILY_PICKS",
    "ADVISORY_PICKS",
    "PICK_DETAILS",
    "RESULT_HISTORY",
    "VALUE_BETS",
    "SMART_PICKS",
    "FULL_ANALYTICS",
    "DAILY_COUPONS",
    "WEEKLY_COUPONS",
    "BALANCED_COUPONS",
    "SURPRISE_COUPONS",
    "COUPON_ANALYTICS",
    "COUPON_HISTORY",
  ],
};

export function hasMembershipPermission(
  plan: MembershipPlanName,
  permission: MembershipPermission,
): boolean {
  return MEMBERSHIP_PERMISSIONS[plan].includes(permission);
}

export function isMembershipActive(
  status: "ACTIVE" | "SUSPENDED",
  membershipEndsAt: Date | null,
  now = new Date(),
): boolean {
  return status === "ACTIVE" &&
    (membershipEndsAt === null || membershipEndsAt.getTime() > now.getTime());
}

export const MEMBERSHIP_PLAN_LABELS: Record<MembershipPlanName, string> = {
  BASIC: "Temel",
  ANALYSIS: "Analiz",
  PROFESSIONAL: "Profesyonel",
};

export const MEMBERSHIP_PLAN_MARKET_LIMITS: Record<MembershipPlanName, number> = {
  BASIC: 6,
  ANALYSIS: 19,
  PROFESSIONAL: 27,
};

const BASIC_MARKET_NUMBERS = new Set([1, 2, 5, 7, 8, 14]);
const ANALYSIS_MARKET_NUMBERS = new Set([
  ...BASIC_MARKET_NUMBERS,
  3, 4, 6, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19,
]);

export function canAccessBetMarket(
  plan: MembershipPlanName,
  marketNumber: number,
): boolean {
  if (plan === "PROFESSIONAL") return marketNumber >= 1 && marketNumber <= 27;
  if (plan === "ANALYSIS") return ANALYSIS_MARKET_NUMBERS.has(marketNumber);
  return BASIC_MARKET_NUMBERS.has(marketNumber);
}

export function requiredPlanForBetMarket(marketNumber: number): MembershipPlanName {
  if (BASIC_MARKET_NUMBERS.has(marketNumber)) return "BASIC";
  if (ANALYSIS_MARKET_NUMBERS.has(marketNumber)) return "ANALYSIS";
  return "PROFESSIONAL";
}

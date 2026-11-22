/**
 * Single fixed membership (WinIQ V2).
 *
 * DB enum still has BASIC | ANALYSIS | PROFESSIONAL for compatibility.
 * Product surface is one plan: every active member sees the full member desk.
 * Canonical stored plan = PROFESSIONAL.
 */

export type MembershipPlanName = "BASIC" | "ANALYSIS" | "PROFESSIONAL";

/** Only plan sold / assigned going forward. */
export const SINGLE_MEMBERSHIP_PLAN: MembershipPlanName = "PROFESSIONAL";

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

export const ALL_MEMBERSHIP_PERMISSIONS: readonly MembershipPermission[] = [
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
] as const;

/** @deprecated Tier matrix removed — kept as full access for every enum value. */
export const MEMBERSHIP_PERMISSIONS: Record<
  MembershipPlanName,
  readonly MembershipPermission[]
> = {
  BASIC: ALL_MEMBERSHIP_PERMISSIONS,
  ANALYSIS: ALL_MEMBERSHIP_PERMISSIONS,
  PROFESSIONAL: ALL_MEMBERSHIP_PERMISSIONS,
};

export function hasMembershipPermission(
  _plan: MembershipPlanName,
  _permission: MembershipPermission,
): boolean {
  return true;
}

export function isMembershipActive(
  status: "ACTIVE" | "SUSPENDED",
  membershipEndsAt: Date | null,
  now = new Date(),
): boolean {
  return (
    status === "ACTIVE" &&
    (membershipEndsAt === null || membershipEndsAt.getTime() > now.getTime())
  );
}

export const MEMBERSHIP_PLAN_LABELS: Record<MembershipPlanName, string> = {
  BASIC: "Üyelik",
  ANALYSIS: "Üyelik",
  PROFESSIONAL: "Üyelik",
};

export const MEMBERSHIP_PLAN_MARKET_LIMITS: Record<MembershipPlanName, number> = {
  BASIC: 30,
  ANALYSIS: 30,
  PROFESSIONAL: 30,
};

export const BET_MARKET_ACCESS_MAX = 30;

export function canAccessBetMarket(
  _plan: MembershipPlanName,
  marketNumber: number,
): boolean {
  return marketNumber >= 1 && marketNumber <= BET_MARKET_ACCESS_MAX;
}

export function requiredPlanForBetMarket(_marketNumber: number): MembershipPlanName {
  return SINGLE_MEMBERSHIP_PLAN;
}

export function normalizeMembershipPlan(
  plan: MembershipPlanName | string | null | undefined,
): MembershipPlanName {
  if (plan === "BASIC" || plan === "ANALYSIS" || plan === "PROFESSIONAL") {
    return SINGLE_MEMBERSHIP_PLAN;
  }
  return SINGLE_MEMBERSHIP_PLAN;
}

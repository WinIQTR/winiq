import {
  SINGLE_MEMBERSHIP_PLAN,
  type MembershipPlanName,
} from "@/lib/membership-access";

export type MembershipDuration = "MONTHLY" | "QUARTERLY" | "YEARLY";

/** List price — single fixed membership (TRY 899 / EUR 14.99). */
export const SINGLE_MEMBERSHIP_PRICE = {
  priceTryCents: 89_900,
  priceEurCents: 1_499,
} as const;

export const MEMBERSHIP_DURATION_PRICES: Record<
  MembershipDuration,
  { priceTryCents: number; priceEurCents: number; months: number; labelTr: string; labelEn: string }
> = {
  MONTHLY: {
    priceTryCents: 89_900,
    priceEurCents: 1_499,
    months: 1,
    labelTr: "1 aylık",
    labelEn: "1 month",
  },
  QUARTERLY: {
    priceTryCents: 229_900,
    priceEurCents: 3_799,
    months: 3,
    labelTr: "3 aylık",
    labelEn: "3 months",
  },
  YEARLY: {
    priceTryCents: 599_900,
    priceEurCents: 9_900,
    months: 12,
    labelTr: "12 aylık",
    labelEn: "12 months",
  },
};

export const SINGLE_MEMBERSHIP_FEATURES = [
  "30 bahis pazarının tamamı",
  "Günün net tahminleri, value ve kupon merkezi",
  "Sonuç ÖZET · oran bantları · track-record",
  "Maç analizi, Elo, gol çizgileri ve market ailesi",
  "Özel liste / profesyonel veri merkezi",
  "TR / EN arayüz",
] as const;

/**
 * DB still stores one row per enum value. Only PROFESSIONAL is sold;
 * legacy BASIC/ANALYSIS rows are normalized to the same list price.
 */
export const DEFAULT_MEMBERSHIP_PRICES: Record<
  MembershipPlanName,
  { priceTryCents: number; priceEurCents: number }
> = {
  BASIC: { ...SINGLE_MEMBERSHIP_PRICE },
  ANALYSIS: { ...SINGLE_MEMBERSHIP_PRICE },
  PROFESSIONAL: { ...SINGLE_MEMBERSHIP_PRICE },
};

export const MEMBERSHIP_PLAN_FEATURES: Record<MembershipPlanName, readonly string[]> = {
  BASIC: SINGLE_MEMBERSHIP_FEATURES,
  ANALYSIS: SINGLE_MEMBERSHIP_FEATURES,
  PROFESSIONAL: SINGLE_MEMBERSHIP_FEATURES,
};

export const MEMBERSHIP_PLAN_ORDER: Record<MembershipPlanName, number> = {
  BASIC: 1,
  ANALYSIS: 1,
  PROFESSIONAL: 1,
};

/** Tier upgrades removed — renewals always target the single plan. */
export function isHigherPlan(
  _current: MembershipPlanName,
  _requested: MembershipPlanName,
): boolean {
  return false;
}

export function isRenewalRequestAllowed(
  _current: MembershipPlanName,
  requested: MembershipPlanName,
): boolean {
  return requested === SINGLE_MEMBERSHIP_PLAN;
}

export function formatPrice(cents: number, currency: "TRY" | "EUR"): string {
  if (cents <= 0) return "Fiyat yönetici tarafından belirlenecek";
  return new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "de-DE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function getDurationPrice(duration: MembershipDuration) {
  return MEMBERSHIP_DURATION_PRICES[duration];
}

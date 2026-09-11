import type { MembershipPlanName } from "@/lib/membership-access";

export const MEMBERSHIP_PLAN_ORDER: Record<MembershipPlanName, number> = {
  BASIC: 1,
  ANALYSIS: 2,
  PROFESSIONAL: 3,
};

export const DEFAULT_MEMBERSHIP_PRICES: Record<
  MembershipPlanName,
  { priceTryCents: number; priceEurCents: number }
> = {
  BASIC: { priceTryCents: 19_900, priceEurCents: 399 },
  ANALYSIS: { priceTryCents: 49_900, priceEurCents: 799 },
  PROFESSIONAL: { priceTryCents: 99_900, priceEurCents: 1_599 },
};

export const MEMBERSHIP_PLAN_FEATURES: Record<MembershipPlanName, readonly string[]> = {
  BASIC: [
    "6 temel bahis pazarı",
    "Günün yayımlanmış tahminleri",
    "1X2, gol ve karşılıklı gol olasılıkları",
    "Takım formu ve temel karşılaştırma",
    "Tahmin seviyesi ve sonuç başarı özeti",
  ],
  ANALYSIS: [
    "Temel paketteki her şey",
    "19 bahis pazarı ve bütün seçenekler",
    "Oyuncu, kadro, sakatlık ve hakem analizi",
    "xG, risk gerekçesi ve alternatif seçimler",
    "Geçmiş performans, adil oran ve ayrıntılı karşılaştırma",
  ],
  PROFESSIONAL: [
    "Analiz paketindeki her şey",
    "27 bahis pazarının tamamı",
    "Toplam gol aralığı, ilk gol ve kesin skor",
    "Korner aralıkları, kart, ofsayt, şut ve oyuncu golü",
    "Adil oran, veri kalitesi, piyasa farkı ve EV",
    "Fikstür, oyuncular, gol krallığı ve tam analiz",
  ],
};

export function isHigherPlan(current: MembershipPlanName, requested: MembershipPlanName): boolean {
  return MEMBERSHIP_PLAN_ORDER[requested] > MEMBERSHIP_PLAN_ORDER[current];
}

export function formatPrice(cents: number, currency: "TRY" | "EUR"): string {
  if (cents <= 0) return "Fiyat yönetici tarafından belirlenecek";
  return new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "de-DE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

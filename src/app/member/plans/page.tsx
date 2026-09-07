import Link from "next/link";

import { MembershipPlanSelector } from "@/components/membership-plan-selector";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireMember } from "@/lib/auth-session";
import {
  DEFAULT_MEMBERSHIP_PRICES,
  formatPrice,
  isHigherPlan,
  MEMBERSHIP_PLAN_FEATURES,
} from "@/lib/membership-commerce";
import { MEMBERSHIP_PLAN_LABELS, type MembershipPlanName } from "@/lib/membership-access";
import { MEMBERSHIP_PLAN_MARKET_LIMITS } from "@/lib/membership-access";
import { prisma } from "@/lib/prisma";
import { daysRemainingUntil } from "@/lib/time";

const PLANS: MembershipPlanName[] = ["BASIC", "ANALYSIS", "PROFESSIONAL"];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MembershipPlansPage() {
  const user = await requireMember();
  const storedPrices = await prisma.membershipPlanPrice.findMany({ where: { isActive: true } });
  const priceMap = new Map(storedPrices.map((price) => [price.plan, price]));
  const remainingDays = user.membershipEndsAt
    ? daysRemainingUntil(user.membershipEndsAt)
    : null;

  return (
    <main className="member-shell member-plans-shell">
      <header className="member-header">
        <div>
          <p className="member-eyebrow">ÜYELİK PAKETLERİ</p>
          <h1>Paketinizi karşılaştırın</h1>
          <p>Mevcut paketiniz: {MEMBERSHIP_PLAN_LABELS[user.plan]}</p>
        </div>
        <div className="member-actions"><LanguageSwitcher /><Link className="member-back-link" href="/member">Tahminlere dön</Link></div>
      </header>

      <section className={`membership-expiry ${remainingDays !== null && remainingDays <= 7 ? "membership-expiry-warning" : ""}`}>
        {remainingDays === null
          ? "Üyeliğiniz için bir bitiş tarihi tanımlanmamış."
          : remainingDays === 0
            ? "Üyeliğiniz bugün sona eriyor."
            : `Üyeliğinizin bitmesine ${remainingDays} gün kaldı.`}
      </section>

      <section className="member-plan-grid">
        {PLANS.map((plan) => {
          const stored = priceMap.get(plan);
          const defaults = DEFAULT_MEMBERSHIP_PRICES[plan];
          const price = stored && (stored.priceTryCents > 0 || stored.priceEurCents > 0)
            ? stored
            : defaults;
          const current = plan === user.plan;
          const upgrade = isHigherPlan(user.plan, plan);
          return (
            <article className={`member-plan-card member-plan-card-${plan.toLowerCase()} ${current ? "member-plan-current" : ""}`} key={plan}>
              {plan === "ANALYSIS" ? <b className="member-popular-label">EN POPÜLER</b> : null}
              <div><p className="member-eyebrow">{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]} PAZAR</p><h2>{MEMBERSHIP_PLAN_LABELS[plan]}</h2></div>
              <div className="member-plan-prices">
                <strong>{formatPrice(price.priceTryCents, "TRY")} <small>/ ay</small></strong>
                <span>{formatPrice(price.priceEurCents, "EUR")} / ay</span>
              </div>
              <ul>{MEMBERSHIP_PLAN_FEATURES[plan].map((feature) => <li key={feature}>{feature}</li>)}</ul>
              {current ? <b className="member-current-label">Mevcut paketiniz</b> : null}
              {upgrade ? <MembershipPlanSelector requestedPlan={plan} /> : null}
            </article>
          );
        })}
      </section>

      <section className="member-notice">
        Talep gönderildiğinde yönetici sizinle iletişime geçer. Ödeme alınmadan paket otomatik etkinleştirilmez.
      </section>
    </main>
  );
}

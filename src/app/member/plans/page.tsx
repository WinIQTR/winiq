import { MembershipPlanSelector } from "@/components/membership-plan-selector";
import { MemberNotificationSettings } from "@/components/member-notification-settings";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
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
import { getMembershipPaymentSettings } from "@/lib/membership-payment-settings";

const PLANS: MembershipPlanName[] = ["BASIC", "ANALYSIS", "PROFESSIONAL"];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MembershipPlansPage() {
  const user = await requireMember();
  const [storedPrices, notifyRow] = await Promise.all([
    prisma.membershipPlanPrice.findMany({ where: { isActive: true } }),
    prisma.appUser
      .findUnique({
        where: { id: user.id },
        select: {
          notifyEmailEnabled: true,
          notifyTelegramEnabled: true,
          telegramHandle: true,
          email: true,
        },
      })
      .catch(() => null),
  ]);
  const priceMap = new Map(storedPrices.map((price) => [price.plan, price]));
  const remainingDays = user.membershipEndsAt
    ? daysRemainingUntil(user.membershipEndsAt)
    : null;
  const payment = getMembershipPaymentSettings();
  const notifySettings = {
    notifyEmailEnabled: notifyRow?.notifyEmailEnabled ?? false,
    notifyTelegramEnabled: notifyRow?.notifyTelegramEnabled ?? false,
    telegramHandle: notifyRow?.telegramHandle ?? "",
    email: notifyRow?.email ?? user.email,
  };

  return (
    <main className={`${member.shell} member-plans-shell`}>
      <MemberPortalHeader plan={user.plan} active="plans"/>
      <div className={member.page}>
      <header className="member-header">
        <div>
          <p className="member-eyebrow">MEMBERSHIP PLANS</p>
          <h1>Compare your plan</h1>
          <p>Your current plan: {MEMBERSHIP_PLAN_LABELS[user.plan]}</p>
        </div>
      </header>

      <section className={`membership-expiry ${remainingDays !== null && remainingDays <= 7 ? "membership-expiry-warning" : ""}`}>
        {remainingDays === null
          ? "No membership end date is set for your account."
          : remainingDays === 0
            ? "Your membership ends today."
            : `${remainingDays} days left on your membership.`}
      </section>

      <section className={member.scope}>
        <div>
          <small>EXAMPLE SCENARIO</small>
          <h2>What do you see on a match today?</h2>
          <p>
            Basic: recommended pick · Analysis: 1/X/2 + model odds · Professional: xG, rationale, and all {MEMBERSHIP_PLAN_MARKET_LIMITS.PROFESSIONAL} markets.
          </p>
        </div>
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
              {plan === "ANALYSIS" ? <b className="member-popular-label">MOST POPULAR</b> : null}
              <div><p className="member-eyebrow">{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]} MARKETS</p><h2>{MEMBERSHIP_PLAN_LABELS[plan]}</h2></div>
              <div className="member-plan-prices">
                <strong>{formatPrice(price.priceTryCents, "TRY")} <small>/ ay</small></strong>
                <span>{formatPrice(price.priceEurCents, "EUR")} / ay</span>
              </div>
              <ul>{MEMBERSHIP_PLAN_FEATURES[plan].map((feature) => <li key={feature}>{feature}</li>)}</ul>
              {current ? <b className="member-current-label">Your current plan</b> : null}
              {upgrade ? <MembershipPlanSelector requestedPlan={plan} priceTry={formatPrice(price.priceTryCents, "TRY")} priceEur={formatPrice(price.priceEurCents, "EUR")} payment={payment} memberReference={user.id.slice(-8).toUpperCase()} /> : null}
            </article>
          );
        })}
      </section>

      <section className="member-notice">
        After you submit a request, an administrator will contact you. Plans are not activated automatically without payment.
      </section>

      <MemberNotificationSettings initial={notifySettings} />
      </div>
    </main>
  );
}

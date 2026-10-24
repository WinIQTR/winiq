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
          <p className="member-eyebrow">ÜYELİK PAKETLERİ</p>
          <h1>Paketinizi karşılaştırın</h1>
          <p>Mevcut paketiniz: {MEMBERSHIP_PLAN_LABELS[user.plan]}</p>
        </div>
      </header>

      <section className={`membership-expiry ${remainingDays !== null && remainingDays <= 7 ? "membership-expiry-warning" : ""}`}>
        {remainingDays === null
          ? "Üyeliğiniz için bir bitiş tarihi tanımlanmamış."
          : remainingDays === 0
            ? "Üyeliğiniz bugün sona eriyor."
            : `Üyeliğinizin bitmesine ${remainingDays} gün kaldı.`}
      </section>

      <section className={member.scope}>
        <div>
          <small>ÖRNEK SENARYO</small>
          <h2>Bugünkü bir maçta ne görürsünüz?</h2>
          <p>
            Temel: önerilen seçim · Analiz: 1/X/2 + model oranı · Profesyonel: xG, gerekçe ve {MEMBERSHIP_PLAN_MARKET_LIMITS.PROFESSIONAL} pazarın tamamı.
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
              {plan === "ANALYSIS" ? <b className="member-popular-label">EN POPÜLER</b> : null}
              <div><p className="member-eyebrow">{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]} PAZAR</p><h2>{MEMBERSHIP_PLAN_LABELS[plan]}</h2></div>
              <div className="member-plan-prices">
                <strong>{formatPrice(price.priceTryCents, "TRY")} <small>/ ay</small></strong>
                <span>{formatPrice(price.priceEurCents, "EUR")} / ay</span>
              </div>
              <ul>{MEMBERSHIP_PLAN_FEATURES[plan].map((feature) => <li key={feature}>{feature}</li>)}</ul>
              {current ? <b className="member-current-label">Mevcut paketiniz</b> : null}
              {upgrade ? <MembershipPlanSelector requestedPlan={plan} priceTry={formatPrice(price.priceTryCents, "TRY")} priceEur={formatPrice(price.priceEurCents, "EUR")} payment={payment} memberReference={user.id.slice(-8).toUpperCase()} /> : null}
            </article>
          );
        })}
      </section>

      <section className="member-notice">
        Talep gönderildiğinde yönetici sizinle iletişime geçer. Ödeme alınmadan paket otomatik etkinleştirilmez.
      </section>

      <MemberNotificationSettings initial={notifySettings} />
      </div>
    </main>
  );
}

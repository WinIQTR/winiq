import { MembershipPlanSelector } from "@/components/membership-plan-selector";
import { MemberNotificationSettings } from "@/components/member-notification-settings";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { requireMember } from "@/lib/auth-session";
import {
  DEFAULT_MEMBERSHIP_PRICES,
  formatPrice,
  getDurationPrice,
  MEMBERSHIP_DURATION_PRICES,
  SINGLE_MEMBERSHIP_FEATURES,
  SINGLE_MEMBERSHIP_PRICE,
  type MembershipDuration,
} from "@/lib/membership-commerce";
import {
  MEMBERSHIP_PLAN_LABELS,
  SINGLE_MEMBERSHIP_PLAN,
} from "@/lib/membership-access";
import { prisma } from "@/lib/prisma";
import { daysRemainingUntil } from "@/lib/time";
import { getMembershipPaymentSettings } from "@/lib/membership-payment-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DURATIONS = Object.keys(MEMBERSHIP_DURATION_PRICES) as MembershipDuration[];

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
  const stored = storedPrices.find((row) => row.plan === SINGLE_MEMBERSHIP_PLAN);
  const defaults = DEFAULT_MEMBERSHIP_PRICES[SINGLE_MEMBERSHIP_PLAN];
  const listPrice =
    stored && (stored.priceTryCents > 0 || stored.priceEurCents > 0)
      ? stored
      : defaults;
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
      <MemberPortalHeader plan={user.plan} active="plans" />
      <div className={member.page}>
        <header className="member-header">
          <div>
            <p className="member-eyebrow" data-no-translate>
              WINIQ · MEMBERSHIP
            </p>
            <h1>Tek üyelik</h1>
            <p>
              Aktif paket: {MEMBERSHIP_PLAN_LABELS[user.plan]} · tüm üye içeriği açık
            </p>
          </div>
        </header>

        <section
          className={`membership-expiry ${
            remainingDays !== null && remainingDays <= 7 ? "membership-expiry-warning" : ""
          }`}
        >
          {remainingDays === null
            ? "Üyelik bitiş tarihi tanımlı değil — yöneticiye yazın."
            : remainingDays === 0
              ? "Üyeliğiniz bugün bitiyor."
              : `Üyeliğinizin bitmesine ${remainingDays} gün kaldı.`}
        </section>

        <section className={member.scope}>
          <div>
            <small>TEK PLAN</small>
            <h2>Ne görürsünüz?</h2>
            <p>
              Tahminler, value, kupon, sonuç ÖZET, 30 pazar, özel liste ve maç analizi —
              her aktif üyede aynı.
            </p>
          </div>
        </section>

        <section className="member-plan-grid member-plan-grid-single">
          <article className="member-plan-card member-plan-card-professional member-plan-current">
            <b className="member-popular-label">TEK ÜYELİK</b>
            <div>
              <p className="member-eyebrow">30 MARKET · FULL ACCESS</p>
              <h2>{MEMBERSHIP_PLAN_LABELS[SINGLE_MEMBERSHIP_PLAN]}</h2>
            </div>
            <div className="member-plan-prices">
              <strong>
                {formatPrice(listPrice.priceTryCents || SINGLE_MEMBERSHIP_PRICE.priceTryCents, "TRY")}{" "}
                <small>/ ay</small>
              </strong>
              <span>
                {formatPrice(listPrice.priceEurCents || SINGLE_MEMBERSHIP_PRICE.priceEurCents, "EUR")}{" "}
                / ay
              </span>
            </div>
            <ul>
              {SINGLE_MEMBERSHIP_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <div className="member-duration-row" style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <small style={{ opacity: 0.75 }}>Süre seçenekleri (ödeme açıklamasına yazın)</small>
              {DURATIONS.map((duration) => {
                const row = getDurationPrice(duration);
                return (
                  <div
                    key={duration}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      fontSize: 14,
                    }}
                  >
                    <span>{row.labelTr}</span>
                    <strong>
                      {formatPrice(row.priceTryCents, "TRY")}
                      <span style={{ fontWeight: 500, opacity: 0.7 }}>
                        {" "}
                        · {formatPrice(row.priceEurCents, "EUR")}
                      </span>
                    </strong>
                  </div>
                );
              })}
            </div>
            <b className="member-current-label">Aktif üyelik — yenileme / uzatma</b>
            <MembershipPlanSelector
              requestedPlan={SINGLE_MEMBERSHIP_PLAN}
              priceTry={formatPrice(
                listPrice.priceTryCents || SINGLE_MEMBERSHIP_PRICE.priceTryCents,
                "TRY",
              )}
              priceEur={formatPrice(
                listPrice.priceEurCents || SINGLE_MEMBERSHIP_PRICE.priceEurCents,
                "EUR",
              )}
              payment={payment}
              memberReference={user.id.slice(-8).toUpperCase()}
              mode="renew"
            />
          </article>
        </section>

        <section className="member-notice">
          Ödeme sonrası yönetici süreyi uzatır. Otomatik kart çekimi yoktur; süre bitince erişim
          kapanır.
        </section>

        <MemberNotificationSettings initial={notifySettings} />
      </div>
    </main>
  );
}

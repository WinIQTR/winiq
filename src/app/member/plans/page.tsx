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
  MEMBERSHIP_LAUNCH_ACTIVE,
  MEMBERSHIP_LIST_PRICE,
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
import { SUPPORT_POLICY_TR } from "@/lib/legal-disclaimer";

import styles from "./membership-desk.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DURATIONS = Object.keys(MEMBERSHIP_DURATION_PRICES) as MembershipDuration[];

function durationHeading(duration: MembershipDuration) {
  if (duration === "MONTHLY") return "1 Aylık";
  if (duration === "QUARTERLY") return "3 Aylık";
  return "12 Aylık";
}

function advantageLabel(duration: MembershipDuration): string | null {
  const monthly = MEMBERSHIP_DURATION_PRICES.MONTHLY.priceTryCents;
  const row = MEMBERSHIP_DURATION_PRICES[duration];
  if (duration === "MONTHLY") return null;
  if (duration === "YEARLY" && MEMBERSHIP_LAUNCH_ACTIVE) {
    const listYearly = 599_900;
    const save = Math.round(((listYearly - row.priceTryCents) / listYearly) * 100);
    return save > 0 ? `~%${save} tasarruf` : null;
  }
  const full = monthly * row.months;
  const save = Math.round(((full - row.priceTryCents) / full) * 100);
  return save > 0 ? `~%${save} tasarruf` : null;
}

function IconCrown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16l2.5-8 5.5 4 5.5-4L20 16H4Zm0 0h16v3H4v-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function IconStack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 16l8 4 8-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.2 4.2L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconDot() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function IconSync() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M20 5v5h-5M4 19v-5h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 16h12l-1.2-1.2a2 2 0 0 1-.6-1.4V10a4.2 4.2 0 1 0-8.4 0v3.4a2 2 0 0 1-.6 1.4L6 16Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 10.5V16M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function Sparkline() {
  return (
    <svg className={styles.spark} viewBox="0 0 120 42" fill="none" aria-hidden>
      <path
        d="M2 30 C18 28 22 12 38 14 C54 16 58 32 74 28 C90 24 96 8 118 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M2 30 C18 28 22 12 38 14 C54 16 58 32 74 28 C90 24 96 8 118 6V42H2Z"
        fill="url(#membershipSpark)"
        opacity="0.35"
      />
      <defs>
        <linearGradient id="membershipSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#35d98a" />
          <stop offset="100%" stopColor="#35d98a" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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

  const monthlyTry = formatPrice(
    MEMBERSHIP_LAUNCH_ACTIVE
      ? SINGLE_MEMBERSHIP_PRICE.priceTryCents
      : listPrice.priceTryCents || SINGLE_MEMBERSHIP_PRICE.priceTryCents,
    "TRY",
  );
  const listMonthlyTry = formatPrice(MEMBERSHIP_LIST_PRICE.priceTryCents, "TRY");
  const durationOptions = DURATIONS.map((duration) => {
    const row = getDurationPrice(duration);
    return {
      value: duration,
      label: `${row.labelTr.replace(" · lansman", "")} – ${formatPrice(row.priceTryCents, "TRY")} (${formatPrice(row.priceEurCents, "EUR")})`,
    };
  });

  return (
    <main className={`${member.shell} member-plans-shell`}>
      <MemberPortalHeader plan={user.plan} active="plans" />
      <div className={`${member.page} ${styles.desk}`}>
        <header className={styles.hero}>
          <p className={styles.eyebrow} data-no-translate>
            WINIQ · MEMBERSHIP
          </p>
          <h1>Tek membership</h1>
          <p>
            Aktif paket: {MEMBERSHIP_PLAN_LABELS[user.plan]} – tüm üye içeriği açık
          </p>
        </header>

        <section
          className={styles.statusBar}
          aria-label="Üyelik durumu"
          data-warn={remainingDays !== null && remainingDays <= 7 ? "true" : undefined}
        >
          <div className={styles.statusItem} data-tone="green">
            <span className={styles.statusIcon}>
              <IconCrown />
            </span>
            <span>Aktif Plan</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusIcon}>
              <IconCal />
            </span>
            <span>
              Kalan süre:{" "}
              {remainingDays === null ? (
                "—"
              ) : remainingDays === 0 ? (
                <b>bugün bitiyor</b>
              ) : (
                <b>{remainingDays} gün</b>
              )}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusIcon}>
              <IconStack />
            </span>
            <span>Paket: {MEMBERSHIP_PLAN_LABELS[user.plan]}</span>
          </div>
        </section>

        <section className={styles.banner} aria-label="Tek plan">
          <div className={styles.bannerLeft}>
            <small>TEK PLAN</small>
            <strong>Ne görürsünüz?</strong>
          </div>
          <p className={styles.bannerMid}>
            Predictions, value, kupon, sonuç ÖZET, 30 markets count, özel liste ve maç
            analizi — her aktif üyede aynı.
          </p>
          <Sparkline />
        </section>

        <div className={styles.layout}>
          <article className={styles.planCard}>
            <div className={styles.planTop}>
              <div>
                <small>30 MARKET · FULL ACCESS</small>
                <h2>Membership</h2>
              </div>
              {MEMBERSHIP_LAUNCH_ACTIVE ? (
                <span className={styles.launchBadge}>LANSMAN</span>
              ) : (
                <span className={styles.launchBadge}>TEK ÜYELİK</span>
              )}
            </div>

            <div className={styles.priceRow}>
              {MEMBERSHIP_LAUNCH_ACTIVE ? (
                <>
                  <span className={styles.listPrice}>{listMonthlyTry} / ay</span>
                  <span className={styles.priceSep} aria-hidden />
                </>
              ) : null}
              <strong className={styles.salePrice}>
                {monthlyTry} <small>/ ay</small>
              </strong>
            </div>

            <h3 className={styles.featuresTitle}>Planın içerikleri</h3>
            <ul className={styles.features}>
              {SINGLE_MEMBERSHIP_FEATURES.map((feature) => (
                <li key={feature}>
                  <span className={styles.featureIcon}>
                    <IconDot />
                  </span>
                  <span>{feature}</span>
                  <span className={styles.check}>
                    <IconCheck />
                  </span>
                </li>
              ))}
            </ul>

            <h3 className={styles.durationsTitle}>Süre seçenekleri</h3>
            <div className={styles.durationTable} role="table" aria-label="Süre seçenekleri">
              <div className={styles.durationLabelCol} role="rowgroup">
                <span>Süre</span>
                <span>Fiyat</span>
                <span>Karşılığı</span>
                <span>Avantaj</span>
              </div>
              {DURATIONS.map((duration, index) => {
                const row = getDurationPrice(duration);
                const advantage = advantageLabel(duration);
                return (
                  <div
                    className={styles.durationCol}
                    key={duration}
                    data-active={index === 0 ? "true" : undefined}
                    role="columnheader"
                  >
                    <strong>{durationHeading(duration)}</strong>
                    <em>{formatPrice(row.priceTryCents, "TRY")}</em>
                    <em>{formatPrice(row.priceEurCents, "EUR")}</em>
                    <span>
                      {advantage ? (
                        <b className={styles.advantage}>{advantage}</b>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className={styles.side}>
            <section className={styles.sideCard}>
              <div className={styles.sideHead}>
                <IconSync />
                Üyeliği yenile / uzat
              </div>
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
                durationOptions={durationOptions}
                hidePaymentBox
              />
            </section>

            <section className={styles.sideCard}>
              <div className={styles.sideHead}>
                <IconCard />
                Ödeme yöntemleri
              </div>
              <p>
                Talebinizden sonra yönetici Wise veya havale bağlantısını iletir. Kartlı
                otomatik çekim yoktur.
              </p>
              <div className={styles.payNote}>
                <IconInfo />
                <span>Otomatik kart çekimi yoktur. Süre bitince erişim kapanır.</span>
              </div>
            </section>

            <section className={styles.sideCard}>
              <div className={styles.sideHead}>
                <IconBell />
                Bildirim tercihleri
              </div>
              <MemberNotificationSettings
                initial={notifySettings}
                variant="desk"
                className={styles.notifyForm}
              />
            </section>

            <section className={styles.sideCard} id="destek-iptal">
              <div className={styles.sideHead}>
                <IconInfo />
                {SUPPORT_POLICY_TR.title}
              </div>
              <p>{SUPPORT_POLICY_TR.sla}</p>
              <ul className={styles.policyList}>
                {SUPPORT_POLICY_TR.cancel.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

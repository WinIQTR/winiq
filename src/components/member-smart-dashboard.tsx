"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { FormResultBadge } from "@/components/form-result-badge";
import cards from "@/components/member-match-cards.module.css";
import shell from "@/components/member-shell.module.css";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLanguage } from "@/components/language-provider";
import { MemberMobileNav } from "@/components/member-mobile-nav";
import { MemberPredictionsBoard } from "@/components/member-predictions-board";
import { MemberV2Desk } from "@/components/member-v2-desk";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import {
  hasMembershipPermission,
  MEMBERSHIP_PLAN_LABELS,
  type MembershipPlanName,
} from "@/lib/membership-access";
import { LOCK_HINT } from "@/lib/membership-lock-copy";
import type { MarketLineMove } from "@/lib/market-line-move-shared";
import { localizePickText } from "@/lib/member-match-insight";
import { getPredictionLabel, type DashboardPrediction } from "@/lib/prediction-dashboard-shared";

import styles from "./member-smart-dashboard.module.css";

export { LOCK_HINT };

const TURKEY_TIME_ZONE = "Europe/Istanbul";
const formatKickTime = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const fairOdds = (prediction: DashboardPrediction) =>
  prediction.predictedProbability > 0 ? 100 / prediction.predictedProbability : 0;
const guvenScore = (prediction: DashboardPrediction) => prediction.confidenceScore / 20;
const pickBadge = (prediction: DashboardPrediction) => {
  const score = guvenScore(prediction);
  if (score >= 3) return { label: "BANKO", kind: "banko" as const };
  if (score >= 2) return { label: "İyi", kind: "good" as const };
  return { label: "Normal", kind: "ok" as const };
};
const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ÜY";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
};
function TeamLogo({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    return <Image src={src} alt="" width={size} height={size} />;
  }
  return (
    <span
      style={{
        display: "grid",
        width: size,
        height: size,
        placeItems: "center",
        borderRadius: "50%",
        background: "#122033",
        color: "#9bb3d4",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.6l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 17.4l.9-5L4.8 8.9l5-.7L12 3.6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 6H4.5A2.5 2.5 0 0 0 7 10.5M17 6h2.5A2.5 2.5 0 0 1 17 10.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.8-3 3-4.5 5.5-4.5S13.7 16 14.5 19M14 14.6c1.4-.4 2.9 0 4 1.2.7.8 1.1 1.8 1.3 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconTicket() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9V6.8A1.8 1.8 0 0 1 5.8 5h12.4A1.8 1.8 0 0 1 20 6.8V9a2 2 0 0 0 0 4v2.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 15.2V13a2 2 0 0 0 0-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 16.5V10a6 6 0 1 1 12 0v6.5l1.5 2H4.5L6 16.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export type MemberPerformanceBand = {
  rate: number | null;
  samples: number;
  wins: number;
  losses: number;
  voids: number;
  unavailable: number;
  total: number;
};
export type MemberPerformance = {
  strong: MemberPerformanceBand;
  medium: MemberPerformanceBand;
  weak: MemberPerformanceBand;
};

export type MemberNavActive =
  | "home"
  | "predictions"
  | "coupons"
  | "results"
  | "messages"
  | "value"
  | "special"
  | "fixtures"
  | "players"
  | "scorers"
  | "standings"
  | "plans"
  | "alerts";

function navActive(
  active: MemberNavActive,
):
  | "home"
  | "shortlists"
  | "analyses"
  | "coupons"
  | "results"
  | "messages"
  | "plans" {
  if (active === "home") return "home";
  if (active === "value" || active === "special") return "shortlists";
  if (active === "coupons" || active === "predictions") return "coupons";
  if (active === "results") return "results";
  if (active === "messages") return "messages";
  if (active === "plans" || active === "alerts") return "plans";
  return "analyses";
}

export function MemberPortalHeader({
  plan,
  preview = false,
  active = "home",
  memberName,
}: {
  plan: MembershipPlanName;
  preview?: boolean;
  active?: MemberNavActive;
  memberName?: string;
}) {
  const { t } = useLanguage();
  const homeHref = preview ? `/admin/members/preview?plan=${plan}` : "/member";
  const planLink = preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans";
  const canCoupons = hasMembershipPermission(plan, "DAILY_COUPONS");
  const isPro = true;
  const analysesHref = preview ? homeHref : "/member/professional";
  const shortlistsHref = preview ? homeHref : "/member/professional/special";
  const couponsHref = preview ? homeHref : canCoupons ? "/member/coupons" : "/member/plans";
  const resultsHref = preview ? homeHref : "/member/results";
  const messagesHref = preview ? homeHref : "/member/messages";
  const current = navActive(active);

  const primaryNav: Array<{
    href: string;
    label: string;
    active: boolean;
    icon: ReactNode;
    locked?: boolean;
  }> = [
    { href: homeHref, label: "Home page", active: current === "home", icon: <IconHome /> },
    ...(isPro || preview
      ? [
          {
            href: shortlistsHref,
            label: "Shortlists",
            active: current === "shortlists",
            icon: <IconStar />,
          },
          {
            href: analysesHref,
            label: "Analyses",
            active: current === "analyses",
            icon: <IconTrophy />,
          },
        ]
      : []),
    {
      href: couponsHref,
      label: "Coupons",
      active: current === "coupons",
      icon: <IconTicket />,
      locked: !canCoupons && !preview,
    },
    { href: resultsHref, label: "Results", active: current === "results", icon: <IconUsers /> },
  ];

  const drawerItems = [
    ...primaryNav.map(({ href, label, active: isActive }) => ({ href, label, active: isActive })),
    { href: messagesHref, label: "Messages", active: current === "messages" },
    { href: planLink, label: "Settings", active: current === "plans" },
  ];

  return (
    <div className={shell.chrome}>
      {preview ? (
        <div className={shell.preview}>
          <span>{t("Administrator preview")}</span>
          <strong>
            {MEMBERSHIP_PLAN_LABELS[plan]} {t("member preview")}
          </strong>
          <Link href="/admin/members">{t("Exit preview")}</Link>
        </div>
      ) : null}
      <header className={shell.topbar}>
        <div className={shell.brandBlock}>
          <MemberMobileNav items={drawerItems} />
          <Link href={homeHref} className={shell.brand} aria-label="WINIQ V2" data-no-translate>
            WIN<span>IQ</span>
            <em className={shell.brandVersion}>V2</em>
          </Link>
          <div className={shell.brandMeta}>
            <small>
              {t("AI Football Predictions")} • {ACTIVE_SEASON_YEAR} • V2
            </small>
          </div>
        </div>

        <nav className={shell.centerNav} aria-label="Member menu">
          {primaryNav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={shell.navLink}
              data-active={item.active}
              data-locked={"locked" in item && item.locked ? "true" : undefined}
              aria-current={item.active ? "page" : undefined}
              title={
                "locked" in item && item.locked
                  ? t("Upgrade plan →")
                  : undefined
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={shell.topActions}>
          <ThemeToggle labeled />
          <LanguageSwitcher hideLabel />
          <Link
            className={shell.iconBtn}
            href={preview ? homeHref : "/member/plans#alerts"}
            aria-label="Notifications"
          >
            <IconBell />
          </Link>
          <Link className={shell.planChip} href={planLink}>
            {MEMBERSHIP_PLAN_LABELS[plan]}
          </Link>
          {memberName ? (
            <span className={shell.avatar} title={memberName} aria-label={memberName}>
              {initialsOf(memberName)}
            </span>
          ) : (
            <span className={shell.avatar} aria-hidden>
              ÜY
            </span>
          )}
          {!preview ? <LogoutButton /> : null}
        </div>
      </header>
    </div>
  );
}

export function LockHint({ children, href }: { children: string; href: string }) {
  const { t } = useLanguage();
  return (
    <div className={styles.lockCard}>
      <span>{children}</span>
      <Link href={href}>{t("Upgrade plan →")}</Link>
    </div>
  );
}

export function MemberPredictionRow({
  prediction,
  plan,
  href,
  recommended = false,
  plansHref = "/member/plans",
}: {
  prediction: DashboardPrediction;
  plan: MembershipPlanName;
  href: string;
  recommended?: boolean;
  plansHref?: string;
}) {
  const { t, locale } = useLanguage();
  const reasons = prediction.topPicks[0]?.reasons.slice(0, 2) ?? [];
  const formIcons = (results?: ("W" | "D" | "L")[]) => (
    <FormResultBadge results={results} locale={locale === "en" ? "en" : "tr"} max={5} />
  );

  return (
    <article className={`${cards.matchCard} ${recommended ? styles.recommendedMatch : ""}`}>
      <div className={cards.matchMain}>
        <div className={cards.matchMeta}>
          <strong>{prediction.leagueName}</strong>
          <span>{formatKickTime(prediction.kickoffAt)}</span>
        </div>
        <div className={cards.teams}>
          <div>
            <TeamLogo src={prediction.homeTeamLogo} name={prediction.homeTeam} size={42} />
            <strong>{prediction.homeTeam}</strong>
            {formIcons(prediction.homeRecentResults)}
          </div>
          <b>–</b>
          <div>
            <TeamLogo src={prediction.awayTeamLogo} name={prediction.awayTeam} size={42} />
            <strong>{prediction.awayTeam}</strong>
            {formIcons(prediction.awayRecentResults)}
          </div>
        </div>
        <div className={cards.probabilities}>
          <span>
            1 <b>%{prediction.homeProbability.toFixed(0)}</b>
            <i style={{ width: `${prediction.homeProbability}%` }} />
          </span>
          <span>
            X <b>%{prediction.drawProbability.toFixed(0)}</b>
            <i style={{ width: `${prediction.drawProbability}%` }} />
          </span>
          <span>
            2 <b>%{prediction.awayProbability.toFixed(0)}</b>
            <i style={{ width: `${prediction.awayProbability}%` }} />
          </span>
        </div>
        <div className={cards.choice}>
          <span className={cards.strongBadge}>{pickBadge(prediction).label}</span>
          <small>En iyi seçim</small>
          <strong>{localizePickText(getPredictionLabel(prediction), locale, t)}</strong>
        </div>
        <div className={cards.confidence}>
          <span>Güven</span>
          <strong>{guvenScore(prediction).toFixed(1)}</strong>
        </div>
        <div className={cards.odds}>
          <span>Oran</span>
          <strong>{fairOdds(prediction).toFixed(2)}</strong>
        </div>
      </div>
      <div className={cards.reasonBar}>
        <strong>Neden bu tahmin?</strong>
        {reasons.length ? (
          reasons.map((reason) => <span key={reason}>{reason}</span>)
        ) : (
          <span>Bu maç için kısa gerekçe henüz yok.</span>
        )}
        <Link href={href}>Analizi gör →</Link>
      </div>
    </article>
  );
}

export function MemberSmartDashboard({
  name,
  plan,
  predictions,
  preview = false,
  selectedDate,
  performance,
  updatedAtIso,
  lineMoves = {},
  v2Desk = null,
}: {
  name: string;
  plan: MembershipPlanName;
  predictions: DashboardPrediction[];
  preview?: boolean;
  selectedDate?: string;
  performance?: MemberPerformance;
  updatedAtIso?: string;
  lineMoves?: Record<string, MarketLineMove>;
  v2Desk?: import("@/lib/member-v2-desk").MemberV2DeskBundle | null;
}) {
  const matchPathPrefix = preview
    ? "/admin/members/preview/matches"
    : "/member/matches";
  const matchQuery = preview ? `?plan=${plan}` : "";
  const plansHref = preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans";
  const couponsHref = preview ? plansHref : "/member/coupons";

  return (
    <main className={`${styles.shell} member-plan-${plan.toLowerCase()}`}>
      <MemberPortalHeader plan={plan} preview={preview} memberName={name} active="home" />
      <div className={styles.page}>
        {v2Desk ? <MemberV2Desk desk={v2Desk} /> : null}
        <MemberPredictionsBoard
          predictions={predictions}
          plan={plan}
          matchPathPrefix={matchPathPrefix}
          matchQuery={matchQuery}
          plansHref={plansHref}
          couponsHref={couponsHref}
          selectedDate={selectedDate}
          updatedAtIso={updatedAtIso}
          performance={performance}
          lineMoves={lineMoves}
        />
      </div>
    </main>
  );
}

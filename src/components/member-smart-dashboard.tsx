import Image from "next/image";
import Link from "next/link";

import cards from "@/components/member-match-cards.module.css";
import shell from "@/components/member-shell.module.css";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MemberPredictionsBoard } from "@/components/member-predictions-board";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import {
  hasMembershipPermission,
  MEMBERSHIP_PLAN_LABELS,
  type MembershipPlanName,
} from "@/lib/membership-access";
import { LOCK_HINT } from "@/lib/membership-lock-copy";
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
const translate = (value: string) =>
  value
    .replace(/Home Team Goals/gi, "Ev sahibi takım golü")
    .replace(/Away Team Goals/gi, "Deplasman takım golü")
    .replace(/Total Goals/gi, "Toplam gol")
    .replace(/Both Teams To Score/gi, "Karşılıklı gol")
    .replace(/Under/gi, "Alt")
    .replace(/Over/gi, "Üst")
    .replace(/Home/gi, "Ev sahibi")
    .replace(/Away/gi, "Deplasman")
    .replace(/Draw/gi, "Beraberlik");

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
function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V9M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 7.2l1.9 1.1M17.3 15.7l1.9 1.1M4.8 16.8l1.9-1.1M17.3 8.3l1.9-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function railActive(
  active: MemberNavActive,
): "home" | "analyses" | "results" | "predictions" | "messages" | "plans" {
  if (active === "home") return "home";
  if (active === "predictions" || active === "coupons") return "predictions";
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
  const homeHref = preview ? `/admin/members/preview?plan=${plan}` : "/member";
  const planLink = preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans";
  const analysesHref = preview
    ? homeHref
    : hasMembershipPermission(plan, "VALUE_BETS") || hasMembershipPermission(plan, "SMART_PICKS")
      ? "/member/value"
      : plan === "PROFESSIONAL"
        ? "/member/professional"
        : "/member/predictions";
  const statsHref = preview ? homeHref : "/member/results";
  const predictionsHref = preview ? homeHref : "/member/predictions";
  const messagesHref = preview ? homeHref : "/member/messages";
  const current = railActive(active);

  return (
    <div className={shell.chrome}>
      {preview ? (
        <div className={shell.preview}>
          <span>YÖNETİCİ ÖNİZLEMESİ</span>
          <strong>{MEMBERSHIP_PLAN_LABELS[plan]} üye görünümü</strong>
          <Link href="/admin/members">Önizlemeden çık</Link>
        </div>
      ) : null}
      <aside className={shell.rail} aria-label="Üye menü">
        <Link className={shell.railLink} href={homeHref} data-active={current === "home"} title="Ana Sayfa" aria-label="Ana Sayfa">
          <IconHome />
        </Link>
        <Link className={shell.railLink} href={analysesHref} data-active={current === "analyses"} title="Analizler" aria-label="Analizler">
          <IconChart />
        </Link>
        <Link className={shell.railLink} href={statsHref} data-active={current === "results"} title="İstatistikler" aria-label="İstatistikler">
          <IconTrophy />
        </Link>
        <Link className={shell.railLink} href={predictionsHref} data-active={current === "predictions"} title="Tahminler" aria-label="Tahminler">
          <IconCalendar />
        </Link>
        <Link className={shell.railLink} href={messagesHref} data-active={current === "messages"} title="Mesajlar" aria-label="Mesajlar">
          <IconUsers />
        </Link>
        <span className={shell.railSpacer} />
        <Link className={shell.railLink} href={planLink} data-active={current === "plans"} title="Üyelik" aria-label="Üyelik">
          <IconGear />
        </Link>
      </aside>
      <header className={shell.topbar}>
        <Link href={homeHref} className={shell.brand} aria-label="WINIQ" data-no-translate>
          WIN<span>IQ</span>
        </Link>
        <div className={shell.brandMeta}>
          <small>AI Football Predictions • {ACTIVE_SEASON_YEAR}</small>
        </div>
        <div className={shell.topActions}>
          <LanguageSwitcher />
          <Link className={shell.iconBtn} href={predictionsHref} aria-label="Ara / tahminler">
            <IconSearch />
          </Link>
          <Link className={shell.iconBtn} href={preview ? homeHref : "/member/plans#alerts"} aria-label="Bildirimler">
            <IconBell />
          </Link>
          {memberName ? (
            <span className={shell.avatar} title={memberName} aria-label={memberName}>
              {initialsOf(memberName)}
            </span>
          ) : (
            <span className={shell.planChip}>{MEMBERSHIP_PLAN_LABELS[plan]}</span>
          )}
          {!preview ? <LogoutButton /> : null}
        </div>
      </header>
    </div>
  );
}

export function LockHint({ children, href }: { children: string; href: string }) {
  return (
    <div className={styles.lockCard}>
      <span>{children}</span>
      <Link href={href}>Paketi yükselt →</Link>
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
  const reasons = prediction.topPicks[0]?.reasons.slice(0, 2) ?? [];
  const formIcons = (results?: ("W" | "D" | "L")[]) => (
    <span className="form-result-badge">
      {(results ?? []).slice(0, 5).map((result, index) => (
        <i className="form-result-dot" data-result={result} key={index}>
          {result === "W" ? "G" : result === "D" ? "B" : "M"}
        </i>
      ))}
    </span>
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
        {plan !== "BASIC" ? (
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
        ) : (
          <LockHint href={plansHref}>{LOCK_HINT.probabilities}</LockHint>
        )}
        <div className={cards.choice}>
          <span className={cards.strongBadge}>{pickBadge(prediction).label}</span>
          <small>En iyi seçim</small>
          <strong>{translate(getPredictionLabel(prediction))}</strong>
        </div>
        <div className={cards.confidence}>
          <span>Güven</span>
          <strong>{guvenScore(prediction).toFixed(1)}</strong>
        </div>
        {plan !== "BASIC" ? (
          <div className={cards.odds}>
            <span>Oran</span>
            <strong>{fairOdds(prediction).toFixed(2)}</strong>
          </div>
        ) : (
          <LockHint href={plansHref}>{LOCK_HINT.modelOdds}</LockHint>
        )}
      </div>
      <div className={cards.reasonBar}>
        <strong>Neden bu tahmin?</strong>
        {plan === "PROFESSIONAL" && reasons.length ? (
          reasons.map((reason) => <span key={reason}>{reason}</span>)
        ) : (
          <span>Ayrıntılı gerekçeler Profesyonel üyelikte açılır.</span>
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
}: {
  name: string;
  plan: MembershipPlanName;
  predictions: DashboardPrediction[];
  preview?: boolean;
  selectedDate?: string;
  performance?: MemberPerformance;
}) {
  const matchPathPrefix = preview
    ? "/admin/members/preview/matches"
    : "/member/matches";
  const matchQuery = preview ? `?plan=${plan}` : "";
  const plansHref = preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans";

  return (
    <main className={`${styles.shell} member-plan-${plan.toLowerCase()}`}>
      <MemberPortalHeader plan={plan} preview={preview} memberName={name} active="home" />
      <div className={styles.page}>
        <MemberPredictionsBoard
          predictions={predictions}
          plan={plan}
          matchPathPrefix={matchPathPrefix}
          matchQuery={matchQuery}
          plansHref={plansHref}
        />
      </div>
    </main>
  );
}

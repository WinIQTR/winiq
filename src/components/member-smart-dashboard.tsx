import Image from "next/image";
import Link from "next/link";

import cards from "@/components/member-match-cards.module.css";
import home from "@/components/member-home.module.css";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MemberDateDayPicker } from "@/components/member-date-day-picker";
import { BET_MARKET_COUNT } from "@/lib/bet-market-catalog";
import {
  hasMembershipPermission,
  MEMBERSHIP_PLAN_LABELS,
  MEMBERSHIP_PLAN_MARKET_LIMITS,
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
const formatLongDate = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
const dateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TURKEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
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
const outcomeShort = (prediction: DashboardPrediction) =>
  prediction.predictedOutcome === "HOME"
    ? `${prediction.homeTeam} kazanır`
    : prediction.predictedOutcome === "AWAY"
      ? `${prediction.awayTeam} kazanır`
      : "Beraberlik";
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
  return <span className={home.logoFall}>{name.slice(0, 2).toUpperCase()}</span>;
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

  const navActive =
    active === "home"
      ? "home"
      : active === "predictions" || active === "coupons"
        ? "predictions"
        : active === "value" || active === "special" || active === "fixtures" || active === "players" || active === "scorers" || active === "standings"
          ? "analyses"
          : active === "results"
            ? "stats"
            : active === "plans" || active === "messages"
              ? "membership"
              : "home";

  return (
    <header className={styles.topbar}>
      <Link href={homeHref} className={styles.brand} aria-label="WINIQ" data-no-translate>
        WIN<span>IQ</span>
      </Link>
      <nav>
        <Link data-active={navActive === "home"} href={homeHref}>
          Ana Sayfa
        </Link>
        <Link data-active={navActive === "predictions"} href={predictionsHref}>
          Tahminler
        </Link>
        <Link data-active={navActive === "analyses"} href={analysesHref}>
          Analizler
        </Link>
        <Link data-active={navActive === "stats"} href={statsHref}>
          İstatistikler
        </Link>
        <Link data-active={navActive === "membership"} href={planLink}>
          Üyelik
        </Link>
      </nav>
      <div className={styles.actions}>
        <LanguageSwitcher />
        {memberName ? (
          <span className={styles.avatar} title={memberName} aria-label={memberName}>
            {initialsOf(memberName)}
          </span>
        ) : (
          <span className={styles.plan}>{MEMBERSHIP_PLAN_LABELS[plan]}</span>
        )}
        {!preview ? <LogoutButton /> : null}
      </div>
    </header>
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
          <span>
            {formatKickTime(prediction.kickoffAt)}
          </span>
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
  selectedDate,
}: {
  name: string;
  plan: MembershipPlanName;
  predictions: DashboardPrediction[];
  preview?: boolean;
  selectedDate?: string;
  performance?: MemberPerformance;
}) {
  const todayDate = new Date();
  todayDate.setHours(12, 0, 0, 0);
  const dayKeys = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(todayDate);
    day.setDate(todayDate.getDate() + index);
    return dateKey(day);
  });
  const activeDate = selectedDate && dayKeys.includes(selectedDate) ? selectedDate : dateKey(todayDate);
  const activeDay = new Date(`${activeDate}T12:00:00`);
  const visiblePredictions = predictions.filter((item) => dateKey(item.kickoffAt) === activeDate);
  const sorted = [...visiblePredictions].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const strongest = sorted[0];
  const couponLegs = sorted.filter((item) => guvenScore(item) >= 2).slice(0, 3);
  const couponOdds =
    plan !== "BASIC" && couponLegs.length
      ? couponLegs.reduce((acc, item) => acc * Math.max(fairOdds(item), 1), 1)
      : null;

  const strongToday = visiblePredictions.filter((item) => guvenScore(item) >= 3);
  const mediumToday = visiblePredictions.filter((item) => {
    const score = guvenScore(item);
    return score >= 2 && score < 3;
  });
  const weakToday = visiblePredictions.filter((item) => guvenScore(item) < 2);
  const totalToday = Math.max(visiblePredictions.length, 1);
  const avgOdds =
    plan !== "BASIC" && visiblePredictions.length
      ? visiblePredictions.reduce((sum, item) => sum + fairOdds(item), 0) / visiblePredictions.length
      : null;
  const confidenceEligible = visiblePredictions.filter((item) => fairOdds(item) >= 1.7).length;

  const matchHref = (id: number) =>
    preview ? `/admin/members/preview/matches/${id}?plan=${plan}` : `/member/matches/${id}`;
  const plansHref = preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans";
  const homeDateHref = (key: string) =>
    preview ? `/admin/members/preview?plan=${plan}&date=${key}` : `/member?date=${key}`;
  const couponsHref = preview ? homeDateHref(activeDate) : "/member/coupons";
  const dayIndex = dayKeys.indexOf(activeDate);

  return (
    <main className={`${styles.shell} member-plan-${plan.toLowerCase()}`}>
      {preview ? (
        <div className={styles.preview}>
          <span>YÖNETİCİ ÖNİZLEMESİ</span>
          <strong>{MEMBERSHIP_PLAN_LABELS[plan]} üye görünümü</strong>
          <Link href="/admin/members">Önizlemeden çık</Link>
        </div>
      ) : null}
      <MemberPortalHeader plan={plan} preview={preview} memberName={name} />
      <div className={styles.page}>
        <div className={home.home}>
          <section className={home.heroRow}>
            <div>
              <p className={home.eyebrow} data-no-translate>
                WINIQ · FUTBOL TAHMİNLERİ
              </p>
              <h1>Bugünün tahminleri</h1>
              <p>
                Merhaba {name}. Model destekli analizlerle hazırlanan, günün en iyi maç tahminleri.
              </p>
            </div>
            <div className={home.dateWrap}>
              <MemberDateDayPicker
                activeDate={activeDate}
                options={dayKeys.map((key) => ({
                  key,
                  href: homeDateHref(key),
                  label:
                    key === dateKey(new Date())
                      ? `Bugün · ${formatLongDate(new Date(`${key}T12:00:00`))}`
                      : formatLongDate(new Date(`${key}T12:00:00`)),
                }))}
                prevHref={dayIndex > 0 ? homeDateHref(dayKeys[dayIndex - 1]!) : null}
                nextHref={
                  dayIndex < dayKeys.length - 1 ? homeDateHref(dayKeys[dayIndex + 1]!) : null
                }
              />
            </div>
          </section>

          <section className={home.stats}>
            <article className={home.statCard}>
              <span className={home.statIcon} aria-hidden>
                ⚽
              </span>
              <div>
                <small>Bugünkü maç sayısı</small>
                <strong>{visiblePredictions.length} Maç</strong>
              </div>
            </article>
            <article className={home.statCard}>
              <span className={home.statIcon} aria-hidden>
                ◎
              </span>
              <div>
                <small>Güven aralığı</small>
                <strong>
                  {confidenceEligible} Tahmin <span style={{ color: "#8b949e", fontSize: 14 }}>(≥1.70)</span>
                </strong>
              </div>
            </article>
            <article className={home.statCard}>
              <span className={home.statIcon} aria-hidden>
                ▦
              </span>
              <div>
                <small>Ortalama oran</small>
                <strong>{avgOdds === null ? "—" : avgOdds.toFixed(2)}</strong>
              </div>
            </article>
          </section>

          <div className={home.board}>
            <section className={home.panel}>
              <div className={home.panelHead}>
                <h2>Maç tahminleri</h2>
                <span>{formatLongDate(activeDay)}</span>
              </div>
              <div className={home.matchList}>
                {visiblePredictions.length ? (
                  sorted.map((item) => {
                    const badge = pickBadge(item);
                    return (
                      <Link
                        className={home.matchRow}
                        href={matchHref(item.matchId)}
                        key={item.matchId}
                      >
                        <div className={home.meta}>
                          <time>{formatKickTime(item.kickoffAt)}</time>
                          <small>{item.leagueName}</small>
                        </div>
                        <div className={home.teams}>
                          <div className={home.logos}>
                            <TeamLogo src={item.homeTeamLogo} name={item.homeTeam} />
                            <TeamLogo src={item.awayTeamLogo} name={item.awayTeam} />
                          </div>
                          <div className={home.teamNames}>
                            <strong>{item.homeTeam}</strong>
                            <strong>{item.awayTeam}</strong>
                          </div>
                        </div>
                        {plan !== "BASIC" ? (
                          <div className={home.probs}>
                            {(
                              [
                                ["1", item.homeProbability],
                                ["X", item.drawProbability],
                                ["2", item.awayProbability],
                              ] as const
                            ).map(([label, value]) => (
                              <div className={home.prob} key={label}>
                                <span>
                                  {label}
                                  <b>%{value.toFixed(0)}</b>
                                </span>
                                <div className={home.bar}>
                                  <i style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={home.lockMini}>Analiz paketinde 1/X/2</div>
                        )}
                        <div className={home.guven}>
                          <small>Güven</small>
                          <strong>{guvenScore(item).toFixed(1)}</strong>
                        </div>
                        <div className={home.pick}>
                          <span
                            className={`${home.badge} ${
                              badge.kind === "banko"
                                ? home.badgeBanko
                                : badge.kind === "good"
                                  ? home.badgeGood
                                  : home.badgeOk
                            }`}
                          >
                            {badge.label}
                          </span>
                          <strong>{outcomeShort(item)}</strong>
                        </div>
                        {plan !== "BASIC" ? (
                          <div className={home.odds}>{fairOdds(item).toFixed(2)}</div>
                        ) : (
                          <div className={home.lockMini}>—</div>
                        )}
                        <span className={home.chev} aria-hidden>
                          ›
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <div className={home.empty}>Bu gün için maç bulunamadı.</div>
                )}
              </div>
            </section>

            <aside className={home.side}>
              <section className={home.sideCard}>
                <header>
                  <span aria-hidden>✦</span>
                  <div>
                    <h3>Öne çıkan tahmin</h3>
                    <p>En yüksek güvenli seçim</p>
                  </div>
                </header>
                {strongest ? (
                  <>
                    <div className={home.featuredMatch}>
                      <strong>
                        {strongest.homeTeam} – {strongest.awayTeam}
                      </strong>
                      <small>{strongest.leagueName}</small>
                    </div>
                    <div className={home.featuredMeta}>
                      <span
                        className={`${home.badge} ${
                          pickBadge(strongest).kind === "banko"
                            ? home.badgeBanko
                            : pickBadge(strongest).kind === "good"
                              ? home.badgeGood
                              : home.badgeOk
                        }`}
                      >
                        {pickBadge(strongest).label}
                      </span>
                      <em>
                        Güven <b>{guvenScore(strongest).toFixed(1)}</b>
                      </em>
                      <em>
                        Oran <b>{plan !== "BASIC" ? fairOdds(strongest).toFixed(2) : "—"}</b>
                      </em>
                    </div>
                    <p style={{ margin: "0 0 12px", color: "#8b949e", fontSize: 13 }}>
                      {outcomeShort(strongest)}
                    </p>
                    <Link className={home.cta} href={matchHref(strongest.matchId)}>
                      Analizi gör
                    </Link>
                  </>
                ) : (
                  <div className={home.empty}>Veri bekleniyor</div>
                )}
              </section>

              <section className={home.sideCard}>
                <header>
                  <span aria-hidden>▣</span>
                  <div>
                    <h3>Günün kuponu</h3>
                    <p>Yüksek güvenli bacaklar</p>
                  </div>
                </header>
                {couponLegs.length ? (
                  <>
                    <ul className={home.couponList}>
                      {couponLegs.map((item) => (
                        <li key={item.matchId}>
                          <div>
                            <strong>
                              {item.homeTeam} – {item.awayTeam}
                            </strong>
                            <small>{outcomeShort(item)}</small>
                          </div>
                          <b>{plan !== "BASIC" ? fairOdds(item).toFixed(2) : "—"}</b>
                        </li>
                      ))}
                    </ul>
                    <div className={home.couponTotal}>
                      <span>Toplam oran</span>
                      <strong>{couponOdds ? couponOdds.toFixed(2) : "—"}</strong>
                    </div>
                    <Link className={home.cta} href={couponsHref}>
                      Kuponu incele
                    </Link>
                  </>
                ) : (
                  <div className={home.empty}>Bugün için kupon bacağı yok.</div>
                )}
              </section>

              {plan !== "PROFESSIONAL" ? (
                <section className={home.promo}>
                  <span aria-hidden>♛</span>
                  <strong>Profesyonel üyeliğe geçin</strong>
                  <p>
                    {BET_MARKET_COUNT} pazar, özel liste ve derin maç analizi Profesyonel pakette.
                  </p>
                  <Link className={home.cta} href={plansHref}>
                    Paketleri gör
                  </Link>
                </section>
              ) : (
                <section className={home.promo}>
                  <span aria-hidden>♛</span>
                  <strong>Profesyonel aktif</strong>
                  <p>Özel liste, fikstür ve tam pazar kataloğu açık.</p>
                  <Link className={home.ctaGhost} href={preview ? plansHref : "/member/professional/special"}>
                    Özel listeye git
                  </Link>
                </section>
              )}

              <section className={home.sideCard}>
                <div className={home.memberStatus}>
                  <div>
                    <strong>{MEMBERSHIP_PLAN_LABELS[plan]} üyelik</strong>
                    <small>
                      {MEMBERSHIP_PLAN_MARKET_LIMITS[plan]}/{BET_MARKET_COUNT} pazar
                    </small>
                  </div>
                  <span className={home.activePill}>AKTİF</span>
                </div>
                <Link className={home.ctaGhost} href={plansHref}>
                  Üyeliği yönet
                </Link>
              </section>
            </aside>
          </div>

          <section className={home.tiers}>
            <article className={home.tierCard} data-level="strong">
              <header>
                <h3>Güçlü tahminler</h3>
                <small>Güven ≥ 3.0</small>
              </header>
              <strong>{strongToday.length} maç</strong>
              <div className={home.tierBar}>
                <i style={{ width: `${(strongToday.length / totalToday) * 100}%` }} />
              </div>
            </article>
            <article className={home.tierCard} data-level="medium">
              <header>
                <h3>Orta tahminler</h3>
                <small>Güven 2.0 – 2.9</small>
              </header>
              <strong>{mediumToday.length} maç</strong>
              <div className={home.tierBar}>
                <i style={{ width: `${(mediumToday.length / totalToday) * 100}%` }} />
              </div>
            </article>
            <article className={home.tierCard} data-level="weak">
              <header>
                <h3>Zayıf tahminler</h3>
                <small>Güven &lt; 2.0</small>
              </header>
              <strong>{weakToday.length} maç</strong>
              <div className={home.tierBar}>
                <i style={{ width: `${(weakToday.length / totalToday) * 100}%` }} />
              </div>
            </article>
          </section>

          <footer className={home.footer}>
            <b data-no-translate>WINIQ</b>
            <span>Veriyi görün, kararınızı kendiniz verin.</span>
            <small>Tahminler bilgi amaçlıdır; kazanç garantisi sunulmaz.</small>
          </footer>
        </div>
      </div>
    </main>
  );
}

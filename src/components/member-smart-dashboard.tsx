import Image from "next/image";
import Link from "next/link";

import cards from "@/components/member-match-cards.module.css";
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
const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
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
const outcomeLabel = (prediction: DashboardPrediction) =>
  prediction.predictedOutcome === "HOME"
    ? "1 (Ev sahibi)"
    : prediction.predictedOutcome === "AWAY"
      ? "2 (Deplasman)"
      : "X (Beraberlik)";
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

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <Image src={src} alt={`${name} logosu`} width={42} height={42} />
  ) : (
    <span className={cards.logoFallback}>{name.slice(0, 2).toUpperCase()}</span>
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

export function MemberPortalHeader({
  plan,
  preview = false,
  active = "home",
}: {
  plan: MembershipPlanName;
  preview?: boolean;
  active?: MemberNavActive;
}) {
  const home = preview ? `/admin/members/preview?plan=${plan}` : "/member";
  const planLink = preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans";
  const showCoupons = hasMembershipPermission(plan, "DAILY_COUPONS");
  const showValue = hasMembershipPermission(plan, "VALUE_BETS");
  const showSmart = hasMembershipPermission(plan, "SMART_PICKS");
  const showResults = hasMembershipPermission(plan, "RESULT_HISTORY") || plan !== "BASIC";

  return (
    <header className={styles.topbar}>
      <Link href={home} className={styles.brand} aria-label="WINIQ" data-no-translate>
        WIN<span>IQ</span>
      </Link>
      <nav>
        <Link data-active={active === "home"} href={home}>
          Ana Sayfa
        </Link>
        <Link data-active={active === "predictions"} href={preview ? home : "/member/predictions"}>
          Tahminler
        </Link>
        {showCoupons ? (
          <Link data-active={active === "coupons"} href={preview ? home : "/member/coupons"}>
            Kuponlar
          </Link>
        ) : null}
        {showResults ? (
          <Link data-active={active === "results"} href={preview ? home : "/member/results"}>
            Sonuçlarım
          </Link>
        ) : null}
        {showValue || showSmart ? (
          <Link data-active={active === "value"} href={preview ? home : "/member/value"}>
            Değer seçimleri
          </Link>
        ) : null}
        {plan === "PROFESSIONAL" ? (
          <>
            <Link data-active={active === "special"} href={preview ? home : "/member/professional/special"}>
              Özel liste
            </Link>
            <Link data-active={active === "fixtures"} href={preview ? home : "/member/professional?view=fixtures"}>
              Fikstür
            </Link>
            <Link data-active={active === "players"} href={preview ? home : "/member/professional?view=players"}>
              Oyuncular
            </Link>
            <Link data-active={active === "scorers"} href={preview ? home : "/member/professional?view=scorers"}>
              Gol krallığı
            </Link>
            <Link data-active={active === "standings"} href={preview ? home : "/member/professional?view=standings"}>
              Puan durumu
            </Link>
          </>
        ) : null}
        {!preview ? (
          <Link data-active={active === "messages"} href="/member/messages">
            Mesajlar
          </Link>
        ) : null}
        <Link data-active={active === "plans"} href={planLink}>
          Paketler
        </Link>
      </nav>
      <div className={styles.actions}>
        <LanguageSwitcher />
        <span className={styles.plan}>
          {MEMBERSHIP_PLAN_LABELS[plan]}
        </span>
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
          <span>{formatTime(prediction.kickoffAt)}</span>
        </div>
        <div className={cards.teams}>
          <div>
            <TeamLogo src={prediction.homeTeamLogo} name={prediction.homeTeam} />
            <strong>{prediction.homeTeam}</strong>
            {formIcons(prediction.homeRecentResults)}
          </div>
          <b>–</b>
          <div>
            <TeamLogo src={prediction.awayTeamLogo} name={prediction.awayTeam} />
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
        {plan === "PROFESSIONAL" ? (
          <div className={cards.xg}>
            <span>Beklenen gol</span>
            <strong>{(prediction.expectedHomeGoals + prediction.expectedAwayGoals).toFixed(1)}</strong>
          </div>
        ) : null}
        <div className={cards.choice}>
          <span className={cards.strongBadge}>ÖNERİ</span>
          <small>En iyi seçim</small>
          <strong>{translate(getPredictionLabel(prediction))}</strong>
        </div>
        <div className={cards.confidence}>
          <span>Güven</span>
          <strong>%{prediction.confidenceScore.toFixed(0)}</strong>
        </div>
        {plan !== "BASIC" ? (
          <div className={cards.odds}>
            <span>Model oranı</span>
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

function planMessage(plan: MembershipPlanName) {
  if (plan === "BASIC") return "Bugünün sade tahminleri — 6 temel pazar.";
  if (plan === "ANALYSIS") return "19 pazarda olasılık ve karşılaştırmalı analiz.";
  return `${BET_MARKET_COUNT} pazar, gelişmiş göstergeler ve değer seçimleri.`;
}

export function MemberSmartDashboard({
  name,
  plan,
  predictions,
  preview = false,
  selectedDate,
  performance,
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
  const visiblePredictions = predictions.filter((item) => dateKey(item.kickoffAt) === activeDate);
  const sorted = [...visiblePredictions].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const strongest = sorted[0];
  const featured = sorted.slice(0, 3);
  const strong = visiblePredictions.filter((item) => item.confidenceScore >= 70);
  const strong150 = strong
    .filter((item) => fairOdds(item) >= 1.5)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 5);
  const matchHref = (id: number) =>
    preview ? `/admin/members/preview/matches/${id}?plan=${plan}` : `/member/matches/${id}`;
  const plansHref = preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans";
  const homeDateHref = (key: string) =>
    preview ? `/admin/members/preview?plan=${plan}&date=${key}` : `/member?date=${key}`;

  return (
    <main className={`${styles.shell} member-plan-${plan.toLowerCase()}`}>
      {preview ? (
        <div className={styles.preview}>
          <span>YÖNETİCİ ÖNİZLEMESİ</span>
          <strong>{MEMBERSHIP_PLAN_LABELS[plan]} üye görünümü</strong>
          <Link href="/admin/members">Önizlemeden çık</Link>
        </div>
      ) : null}
      <MemberPortalHeader plan={plan} preview={preview} />
      <div className={styles.page}>
        <section className={styles.welcome}>
          <div>
            <p data-no-translate>WINIQ · ÜYE MERKEZİ</p>
            <h1>Bugünün tahminleri</h1>
            <span>
              Merhaba {name}. {planMessage(plan)}
            </span>
          </div>
          <div className={styles.quick}>
            <Link href={preview ? plansHref : "/member/predictions"}>Tüm tahminler</Link>
            {!preview ? <Link href="/member/messages">Mesajlar</Link> : null}
            <Link href={plansHref}>Paketim</Link>
          </div>
        </section>

        <section className={styles.metricsCompact}>
          <article>
            <small>Bugün / seçili gün</small>
            <strong>{visiblePredictions.length}</strong>
            <span>maç</span>
          </article>
          <article>
            <small>Güçlü seçim</small>
            <strong>{strong.length}</strong>
            <span>güven ≥ %70</span>
          </article>
        </section>

        <section className={styles.dateNavigator}>
          <header>
            <div>
              <small>GÜN SEÇİMİ</small>
              <strong>{dateLabel(new Date(`${activeDate}T12:00:00`))}</strong>
            </div>
            <span>{visiblePredictions.length} maç</span>
          </header>
          <MemberDateDayPicker
            dayKeys={dayKeys}
            activeDate={activeDate}
            hrefFor={homeDateHref}
            labelFor={(key) => dateLabel(new Date(`${key}T12:00:00`))}
            isToday={(key) => key === dateKey(new Date())}
          />
        </section>

        <div className={cards.layout}>
          <section className={cards.predictionPanel}>
            <header>
              <div>
                <h2>Günün maçları</h2>
                <p>Önerilen seçimler altın çerçeveyle vurgulanır</p>
              </div>
              <Link href={preview ? plansHref : "/member/predictions"}>Tüm tahminler →</Link>
            </header>
            <div className={cards.matchList}>
              {visiblePredictions.length ? (
                visiblePredictions.map((item) => (
                  <MemberPredictionRow
                    prediction={item}
                    recommended={featured.some((feature) => feature.matchId === item.matchId)}
                    plan={plan}
                    href={matchHref(item.matchId)}
                    plansHref={plansHref}
                    key={item.matchId}
                  />
                ))
              ) : (
                <div className={cards.empty}>Bu gün için maç bulunamadı.</div>
              )}
            </div>
          </section>

          <aside className={cards.side}>
            <section className={cards.featured}>
              <header>
                <span>★</span>
                <div>
                  <h2>Öne çıkan</h2>
                  <p>En güçlü yaklaşan tahmin</p>
                </div>
              </header>
              {strongest ? (
                <>
                  <div className={cards.featuredTeam}>
                    <TeamLogo
                      src={
                        strongest.predictedOutcome === "AWAY"
                          ? strongest.awayTeamLogo
                          : strongest.homeTeamLogo
                      }
                      name={
                        strongest.predictedOutcome === "AWAY"
                          ? strongest.awayTeam
                          : strongest.homeTeam
                      }
                    />
                    <div>
                      <strong>
                        {strongest.predictedOutcome === "AWAY"
                          ? strongest.awayTeam
                          : strongest.homeTeam}
                      </strong>
                      <span>{outcomeLabel(strongest)}</span>
                    </div>
                    <b>GÜÇLÜ</b>
                  </div>
                  <div className={cards.featuredStats}>
                    <span>
                      Güven <b>%{strongest.confidenceScore.toFixed(0)}</b>
                    </span>
                    <span>
                      Oran <b>{plan !== "BASIC" ? fairOdds(strongest).toFixed(2) : "—"}</b>
                    </span>
                    <span>
                      xG{" "}
                      <b>
                        {plan === "PROFESSIONAL"
                          ? (strongest.expectedHomeGoals + strongest.expectedAwayGoals).toFixed(1)
                          : "—"}
                      </b>
                    </span>
                  </div>
                  <Link href={matchHref(strongest.matchId)}>Analizi gör →</Link>
                </>
              ) : (
                <div className={cards.empty}>Veri bekleniyor</div>
              )}
            </section>

            <section className={cards.strongOdds}>
              <header>
                <span>♢</span>
                <div>
                  <h2>Güçlü 1.50+ seçimler</h2>
                  <p>Yüksek oranlı, yüksek güven</p>
                </div>
              </header>
              {plan !== "BASIC" ? (
                <ol>
                  {strong150.length ? (
                    strong150.map((item, index) => (
                      <li key={item.matchId}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>
                            {item.homeTeam} – {item.awayTeam}
                          </strong>
                          <small>{outcomeLabel(item)}</small>
                        </div>
                        <b>{fairOdds(item).toFixed(2)}</b>
                        <em>%{item.confidenceScore.toFixed(0)}</em>
                      </li>
                    ))
                  ) : (
                    <li className={cards.noOdds}>1.50 üzeri güçlü seçim bulunamadı.</li>
                  )}
                </ol>
              ) : (
                <div className={styles.upgrade}>
                  Bu liste Analiz ve Profesyonel üyelikte açılır.
                  <Link href={plansHref}>Paketi yükselt →</Link>
                </div>
              )}
            </section>

            <section className={styles.planChip}>
              <small>PAKET</small>
              <strong>
                {MEMBERSHIP_PLAN_LABELS[plan]} · {MEMBERSHIP_PLAN_MARKET_LIMITS[plan]}/{BET_MARKET_COUNT} pazar
              </strong>
              <Link href={plansHref}>Ayrıntılar</Link>
            </section>
          </aside>
        </div>

        {performance ? (
          <section className={styles.performance}>
            <header>
              <div>
                <small>SONUÇ ÖZETİ</small>
                <h2>Güçlü / orta / zayıf tutma oranları</h2>
              </div>
              {!preview ? <Link href="/member/results">Tüm sonuçlarım →</Link> : null}
            </header>
            <div>
              {(
                [
                  ["Güçlü", performance.strong],
                  ["Orta", performance.medium],
                  ["Zayıf", performance.weak],
                ] as const
              ).map(([label, item]) => (
                <article data-level={label} key={label}>
                  <span>{label}</span>
                  <strong>{item.rate === null ? "—" : `%${item.rate.toFixed(1)}`}</strong>
                  <i>
                    <b style={{ width: `${item.rate ?? 0}%` }} />
                  </i>
                  <div className={styles.performanceStats}>
                    <span>
                      <b>{item.wins}</b>Kazandı
                    </span>
                    <span>
                      <b>{item.losses}</b>Kaybetti
                    </span>
                    <span>
                      <b>{item.samples}</b>Değerlendirildi
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.scope} id="paket">
          <div>
            <small>PAKETİNİZ</small>
            <h2>{MEMBERSHIP_PLAN_LABELS[plan]} üyelik kapsamı</h2>
            <p>
              {MEMBERSHIP_PLAN_MARKET_LIMITS[plan]} / {BET_MARKET_COUNT} pazar erişimi aktif.
            </p>
          </div>
          <Link href={plansHref}>{plan === "PROFESSIONAL" ? "Paket ayrıntıları" : "Paketleri karşılaştır"}</Link>
        </section>

        <footer className={cards.footer}>
          <b data-no-translate>WINIQ</b>
          <span>Veriyi görün, kararınızı kendiniz verin.</span>
          <small>Tahminler bilgi amaçlıdır; kupon veya kazanç garantisi sunulmaz.</small>
        </footer>
      </div>
    </main>
  );
}

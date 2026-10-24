import Link from "next/link";
import { redirect } from "next/navigation";

import { MatchFormTip } from "@/components/match-form-tip";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { translateUiText } from "@/i18n/dictionaries";
import { requireMember } from "@/lib/auth-session";
import { buildMatchFormTip } from "@/lib/member-match-insight";
import {
  buildSpecialCandidates,
  buildSpecialMarketMap,
  confidenceTier,
  filterSpecialMatches,
  loadSpecialListPredictions,
  sortSpecialCandidates,
} from "@/lib/special-list";

import styles from "./special-member.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const date = (value: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(value);

export default async function ProfessionalSpecialPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; market?: string }>;
}) {
  const user = await requireMember();
  const localReviewBypass = process.env.NODE_ENV !== "production";
  if (user.plan !== "PROFESSIONAL" && !localReviewBypass) redirect("/member/plans");

  const q = await searchParams;
  const range = q?.range === "week" ? "week" : "day";
  const market = q?.market ?? "ALL";

  const { predictions, source } = await loadSpecialListPredictions();
  const matches = filterSpecialMatches(predictions, range);
  const marketMap = buildSpecialMarketMap(matches);
  marketMap.set("ALL", "Tüm bahisler · en yüksek olasılık");

  const rows = sortSpecialCandidates(
    buildSpecialCandidates(matches, market),
    { sortProb: true },
  );

  const tipTranslate = (sourceText: string) => translateUiText(sourceText, "tr");

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="special" />
      <div className={member.page}>
        <section className={member.welcome}>
          <div>
            <p>
              <i /> WINIQ · SPECIAL LIST
            </p>
            <h1>Special List</h1>
            <span>
              Admin Special List ile aynı bahis türü ve olasılık sıralaması
              {source === "SNAPSHOT" ? " · snapshot veri" : " · canlı önbellek"}.
            </span>
          </div>
        </section>

        <nav className={styles.actions}>
          <Link href="/member/professional">← Analizler</Link>
          <strong>{rows.length} seçim</strong>
        </nav>

        <form className={styles.filters} method="get" action="/member/professional/special">
          <div>
            <label>Program</label>
            <select name="range" defaultValue={range}>
              <option value="day">Bugünün maçları</option>
              <option value="week">Haftanın maçları</option>
            </select>
          </div>
          <div>
            <label>Bahis türü</label>
            <select name="market" defaultValue={market}>
              {[...marketMap].map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">
            Listele <b>→</b>
          </button>
        </form>

        <section className={styles.panel}>
          <header>
            <div>
              <h2>{marketMap.get(market) || market}</h2>
              <small>
                {market === "ALL"
                  ? "Her satırda bahis türü ayrıca belirtilir."
                  : "Seçilen marketin en güçlü seçimleri"}
              </small>
            </div>
            <span>{range === "week" ? "7 günlük program" : "Bugünün maçları"}</span>
          </header>
          <div className={styles.list}>
            {rows.length ? (
              rows.map((item, index) => {
                const tip = buildMatchFormTip(
                  {
                    homeTeam: item.prediction.homeTeam,
                    awayTeam: item.prediction.awayTeam,
                    homeRecentResults: item.prediction.homeRecentResults,
                    awayRecentResults: item.prediction.awayRecentResults,
                    homeVenueResults: item.prediction.homeVenueResults,
                    awayVenueResults: item.prediction.awayVenueResults,
                  },
                  tipTranslate,
                );
                const tier = confidenceTier(item.prediction.confidenceScore);
                return (
                  <article key={`${item.prediction.matchId}-${item.marketKey}-${item.selection}`}>
                    <b>{index + 1}</b>
                    <small>
                      {item.prediction.leagueName} · {date(item.prediction.kickoffAt)}
                    </small>
                    <div className={styles.teams}>
                      {item.prediction.homeTeam} <i>VS</i> {item.prediction.awayTeam}
                    </div>
                    <em data-tier={tier}>{tier}</em>
                    <strong>%{item.probability.toFixed(1)}</strong>
                    <div className={styles.pick}>
                      <span>Bahis türü · Önerilen seçim</span>
                      <b>{item.marketLabel}</b>
                      <strong>{item.selection}</strong>
                    </div>
                    <div className={styles.odds}>
                      <span>Adil oran</span>
                      <b>{item.fairOdds.toFixed(2)}</b>
                      <small>Model olasılığına göre</small>
                    </div>
                    <MatchFormTip tip={tip} />
                    <Link href={`/member/matches/${item.prediction.matchId}`}>
                      Maç analizi →
                    </Link>
                  </article>
                );
              })
            ) : (
              <p className={styles.empty}>Bu dönem ve bahis türü için seçim bulunamadı.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

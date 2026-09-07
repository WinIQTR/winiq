import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ACTIVE_SEASON_LABEL, HISTORICAL_MODEL_SEASON_LABEL } from "@/config/season";
import { requireAdmin } from "@/lib/auth-session";
import { loadSmartPicksPerformance } from "@/lib/smart-picks-performance";
import styles from "./smart-picks-page.module.css";

function percent(value: number): string { return `%${value.toFixed(2)}`; }
function tierLabel(tier: string): string {
  return ({ VERY_HIGH: "Çok yüksek", HIGH: "Yüksek", MEDIUM: "Orta", LOW: "Düşük" } as Record<string, string>)[tier] ?? tier;
}
function resultLabel(result: string): string {
  if (result === "WIN" || result === "WON") return "Kazandı";
  if (result === "LOSS" || result === "LOST") return "Kaybetti";
  return "Geçersiz";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SmartPicksPage() {
  await requireAdmin();
  const { summary, tiers, probabilityBuckets, leagues, markets, history } = await loadSmartPicksPerformance();
  const historyGroups = Array.from(history.slice(0, 80).reduce((groups, row) => {
    const existing = groups.get(row.matchId) ?? [];
    existing.push(row);
    groups.set(row.matchId, existing);
    return groups;
  }, new Map<number, typeof history>())).map(([, rows]) => ({
    match: rows[0]!, rows,
    wins: rows.filter((row) => row.result === "WIN" || row.result === "WON").length,
    losses: rows.filter((row) => row.result === "LOSS" || row.result === "LOST").length,
    voids: rows.filter((row) => !["WIN", "WON", "LOSS", "LOST"].includes(row.result)).length,
  }));

  return <PageShell><main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.heroBadges}><span>TARİHSEL TEST · {HISTORICAL_MODEL_SEASON_LABEL}</span><span className={styles.notLive}>CANLI VERİ DEĞİL</span></div>
        <h1>Tarihsel Model Doğrulaması</h1>
        <p>Modelin daha önce görmediği {summary.matches} maç üzerindeki sonuçları. Bu ekran model kalitesini denetler; {ACTIVE_SEASON_LABEL} canlı sezon performansı değildir.</p>
      </div>
      <div className={styles.heroAction}><small>Güncel sonuçları mı arıyorsunuz?</small><Link href="/match-result-performance">Canlı pazar performansını aç →</Link></div>
    </header>

    <section className={styles.kpis} aria-label="Tarihsel doğrulama özeti">
      <article><span>Genel başarı</span><strong className={styles.good}>{percent(summary.hitRate)}</strong><small>{summary.settledPicks} sonuçlanan seçim</small></article>
      <article><span>Doğrulanan seçim</span><strong>{summary.totalPicks.toLocaleString("tr-TR")}</strong><small>{summary.matches} maç · {summary.leagues} lig</small></article>
      <article><span>Çok yüksek güven</span><strong>{percent(summary.veryHighHitRate)}</strong><small>{summary.veryHighPicks.toLocaleString("tr-TR")} seçim</small></article>
      <article><span>%90+ model grubu</span><strong>{percent(summary.probability90HitRate)}</strong><small>{summary.probability90Picks.toLocaleString("tr-TR")} seçim</small></article>
    </section>

    <section className={styles.analysisGrid}>
      <article className={styles.panel}>
        <div className={styles.panelHeading}><div><span>KALİBRASYON</span><h2>Model yüzdesi gerçeğe ne kadar yakın?</h2></div><small>Gerçek − Beklenen</small></div>
        <div className={styles.calibrationHead}><span>Aralık</span><span>Seçim</span><span>Beklenen</span><span>Gerçek</span><span>Fark</span></div>
        {probabilityBuckets.map((bucket) => <div className={styles.calibrationRow} key={bucket.key}>
          <strong>{bucket.label}</strong><span>{bucket.picks.toLocaleString("tr-TR")}</span><span>%{bucket.averageProbability.toFixed(1)}</span><b>{percent(bucket.hitRate)}</b>
          <em className={Math.abs(bucket.calibrationGap) <= 3 ? styles.good : styles.warn}>{bucket.calibrationGap > 0 ? "+" : ""}{bucket.calibrationGap.toFixed(1)} puan</em>
        </div>)}
      </article>
      <article className={styles.panel}>
        <div className={styles.panelHeading}><div><span>GÜVEN SEVİYELERİ</span><h2>Seçim kalitesine göre başarı</h2></div></div>
        <div className={styles.tierList}>{tiers.map((tier) => <div key={tier.tier}>
          <div><strong>{tierLabel(tier.tier)}</strong><small>{tier.picks.toLocaleString("tr-TR")} seçim</small></div><div className={styles.progress}><i style={{ width: `${Math.min(tier.hitRate, 100)}%` }} /></div><b>{percent(tier.hitRate)}</b>
        </div>)}</div>
        <div className={styles.settlement}><span><b className={styles.good}>{summary.wins.toLocaleString("tr-TR")}</b>Kazandı</span><span><b className={styles.bad}>{summary.losses.toLocaleString("tr-TR")}</b>Kaybetti</span><span><b>{summary.voids.toLocaleString("tr-TR")}</b>Geçersiz</span></div>
      </article>
    </section>

    <section className={styles.tablesGrid}>
      <details className={styles.panel} open><summary><span><small>LİG ANALİZİ</small><strong>Liglere göre doğrulama</strong></span><i>⌄</i></summary>
        <div className={styles.tableHead}><span>Lig</span><span>Seçim</span><span>Güven</span><span>Başarı</span></div>
        {leagues.map((league) => <div className={styles.tableRow} key={league.apiId}><strong>{league.league}</strong><span>{league.picks}</span><span>%{league.averageReliability.toFixed(1)}</span><b>{percent(league.hitRate)}</b></div>)}
      </details>
      <details className={styles.panel} open><summary><span><small>PAZAR ANALİZİ</small><strong>En başarılı bahis türleri</strong></span><i>⌄</i></summary>
        <div className={styles.tableHead}><span>Pazar</span><span>Seçim</span><span>Güven</span><span>Başarı</span></div>
        {markets.slice(0, 10).map((market) => <div className={styles.tableRow} key={market.key}><div><strong>{market.market}</strong><small>{market.selection}</small></div><span>{market.picks}</span><span>%{market.averageReliability.toFixed(1)}</span><b>{percent(market.hitRate)}</b></div>)}
      </details>
    </section>

    <details className={`${styles.panel} ${styles.history}`}>
      <summary><span><small>DENETİM KAYITLARI</small><strong>Doğrulanan maçları incele</strong></span><span className={styles.historyCount}>{historyGroups.length} maç gösteriliyor</span><i>⌄</i></summary>
      <div className={styles.historyList}>{historyGroups.map((group) => <details className={styles.match} key={group.match.matchId}>
        <summary><span><strong>{group.match.homeTeam} – {group.match.awayTeam}</strong><small>{group.match.leagueName}</small></span><b>{group.match.actualHomeScore}–{group.match.actualAwayScore}</b><span className={styles.resultSummary}><i className={styles.good}>{group.wins} K</i><i className={styles.bad}>{group.losses} M</i>{group.voids ? <i>{group.voids} G</i> : null}</span><i>⌄</i></summary>
        <div className={styles.pickRows}>{group.rows.map((row) => <div key={row.id}><span><strong>{row.market}</strong><small>{row.selection}</small></span><span>Model %{row.probability.toFixed(1)}</span><span>Güven {row.reliabilityScore.toFixed(1)}</span><b className={row.result === "WIN" || row.result === "WON" ? styles.good : row.result === "LOSS" || row.result === "LOST" ? styles.bad : ""}>{resultLabel(row.result)}</b></div>)}</div>
      </details>)}</div>
    </details>
  </main></PageShell>;
}

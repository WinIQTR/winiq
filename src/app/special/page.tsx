import Image from "next/image";
import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth-session";
import {
  buildSpecialCandidates,
  buildSpecialMarketMap,
  confidenceTier,
  filterSpecialMatches,
  loadSpecialListPredictions,
  sortSpecialCandidates,
} from "@/lib/special-list";

import styles from "./special.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dt = (d: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(d);

function Logo({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <Image src={src} alt="" width={38} height={38} />
  ) : (
    <span className={styles.logo}>{name.slice(0, 2).toUpperCase()}</span>
  );
}

function qs(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export default async function SpecialPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: string;
    market?: string;
    sortDate?: string;
    sortProb?: string;
    sortOdds?: string;
    minProb?: string;
    maxProb?: string;
  }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const range = q?.range === "week" ? "week" : "day";
  const market = q?.market || "ALL";
  const sortDate = q?.sortDate === "1";
  const sortProb = q?.sortProb === "1";
  const sortOdds = q?.sortOdds === "1";
  const minProb = q?.minProb ? Number(q.minProb) : null;
  const maxProb = q?.maxProb ? Number(q.maxProb) : null;

  const { predictions, source: dataSource } = await loadSpecialListPredictions();
  const matches = filterSpecialMatches(predictions, range);
  const marketMap = buildSpecialMarketMap(matches);
  const candidates = sortSpecialCandidates(
    buildSpecialCandidates(matches, market, { minProb, maxProb }),
    { sortDate, sortProb, sortOdds },
  );

  const linkBase = {
    market,
    sortDate: sortDate ? "1" : null,
    sortProb: sortProb ? "1" : null,
    sortOdds: sortOdds ? "1" : null,
    minProb: minProb != null ? String(minProb) : null,
    maxProb: maxProb != null ? String(maxProb) : null,
  };

  const selectedTitle =
    market === "ALL"
      ? "Tüm bahisler · sıralama seçimlerinize göre"
      : marketMap.get(market) || market;

  return (
    <PageShell>
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p>WINIQ · SPECIAL LIST</p>
            <h1>Special List</h1>
            <span>Seçilen bahis türünde en yüksek olasılıklı maçlar.</span>
          </div>
          <strong>{candidates.length} seçim</strong>
        </header>

        <section className={styles.controls}>
          <div className={styles.controlHeading}>
            <div>
              <span className={styles.eyebrow}>FİLTRELE VE KEŞFET</span>
              <h2>Maç aralığını seçin</h2>
            </div>
            <span className={styles.liveDot} data-source={dataSource}>
              <i /> {dataSource === "LIVE" ? "Canlı veri" : "Snapshot (yedek veri)"}
            </span>
          </div>

          <nav className={styles.range}>
            <Link
              data-active={range === "day"}
              href={`/special${qs({ ...linkBase, range: "day" })}`}
            >
              <span className={styles.tabIcon}>◷</span>
              <span>Bugünün maçları</span>
              <small>Bugün</small>
            </Link>
            <Link
              data-active={range === "week"}
              href={`/special${qs({ ...linkBase, range: "week" })}`}
            >
              <span className={styles.tabIcon}>▦</span>
              <span>Haftanın maçları</span>
              <small>7 günlük görünüm</small>
            </Link>
          </nav>

          <form className={styles.marketSelect} method="get" action="/special">
            <label>
              <span className={styles.labelTop}>
                <span className={styles.targetIcon}>◎</span>
                <span>Bahis türü</span>
              </span>
              <span className={styles.selectWrap}>
                <select name="market" defaultValue={market}>
                  <option value="ALL">Tüm bahisler · en yüksek olasılık</option>
                  <option value="DRAW">Beraberlik (X)</option>
                  {[...marketMap]
                    .filter(([key]) => key !== "DRAW")
                    .map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                </select>
                <span>⌄</span>
              </span>
            </label>
            <input type="hidden" name="range" value={range} />
            <label className={styles.rangeField}>
              <span>Min. olasılık %</span>
              <input
                type="number"
                name="minProb"
                min={0}
                max={100}
                step={1}
                defaultValue={minProb ?? ""}
                placeholder="0"
              />
            </label>
            <label className={styles.rangeField}>
              <span>Maks. olasılık %</span>
              <input
                type="number"
                name="maxProb"
                min={0}
                max={100}
                step={1}
                defaultValue={maxProb ?? ""}
                placeholder="100"
              />
            </label>
            <button type="submit">
              <span>Listele</span>
              <b>→</b>
            </button>
            <fieldset className={styles.sortFieldset}>
              <legend>Sıralama (birden fazla seçilebilir)</legend>
              <label>
                <input type="checkbox" name="sortDate" value="1" defaultChecked={sortDate} />
                <span>Tarihe göre</span>
              </label>
              <label>
                <input type="checkbox" name="sortProb" value="1" defaultChecked={sortProb} />
                <span>Olasılığa göre</span>
              </label>
              <label>
                <input type="checkbox" name="sortOdds" value="1" defaultChecked={sortOdds} />
                <span>Adil orana göre</span>
              </label>
            </fieldset>
          </form>
          <p className={styles.helper}>
            Hiçbir sıralama seçilmezse sonuçlar en yüksek olasılıktan düşüğe sıralanır. Birden fazla
            sıralama seçilirse sırasıyla tarih → olasılık → oran önceliğiyle uygulanır.
          </p>
        </section>

        <section className={styles.panel}>
          <header>
            <div>
              <h2>{selectedTitle}</h2>
              <p>Seçim, olasılık ve oran bilgileri</p>
            </div>
            <span>
              {sortDate || sortProb || sortOdds
                ? [sortDate && "Tarih", sortProb && "Olasılık", sortOdds && "Oran"]
                    .filter(Boolean)
                    .join(" → ")
                : "Olasılık sıralaması"}
            </span>
          </header>
          <div className={styles.list}>
            {candidates.length ? (
              candidates.map((item, index) => {
                const tier = confidenceTier(item.prediction.confidenceScore);
                return (
                  <article
                    className={styles.row}
                    key={`${item.prediction.matchId}-${item.marketLabel}-${item.selection}`}
                  >
                    <b className={styles.rank}>{index + 1}</b>
                    <div className={styles.meta}>
                      <small>{item.prediction.leagueName}</small>
                      <time>{dt(item.prediction.kickoffAt)}</time>
                    </div>
                    <div className={styles.teams}>
                      <span>
                        <Logo
                          src={item.prediction.homeTeamLogo}
                          name={item.prediction.homeTeam}
                        />
                        <strong>{item.prediction.homeTeam}</strong>
                      </span>
                      <i>VS</i>
                      <span>
                        <Logo
                          src={item.prediction.awayTeamLogo}
                          name={item.prediction.awayTeam}
                        />
                        <strong>{item.prediction.awayTeam}</strong>
                      </span>
                    </div>
                    <div className={styles.tier} data-tier={tier}>
                      {tier}
                    </div>
                    <div className={styles.prob}>
                      <small>Olasılık</small>
                      <strong>%{item.probability.toFixed(1)}</strong>
                      <i>
                        <b style={{ width: `${item.probability}%` }} />
                      </i>
                    </div>
                    <div className={styles.odds}>
                      <small>{item.marketLabel}</small>
                      <strong>{item.fairOdds.toFixed(2)}</strong>
                      <small>{item.selection}</small>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className={styles.empty}>
                Bu bahis türünde seçilen dönem için sonuç bulunamadı.
              </div>
            )}
          </div>
        </section>
        <footer>WINIQ · Sadece listeleme ekranı</footer>
      </main>
    </PageShell>
  );
}

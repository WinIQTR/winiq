"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  getPredictionLabel,
  getUiConfidence,
  type DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";
import { type MembershipPlanName } from "@/lib/membership-access";
import { LOCK_HINT } from "@/lib/membership-lock-copy";

import styles from "./member-predictions-board.module.css";

const TZ = "Europe/Istanbul";
const PAGE_SIZE = 5;

type Tab = "recommended" | "all" | "finished";

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function dateKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate(value));
}

function formatKick(value: Date | string) {
  const d = asDate(value);
  const day = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${day} · ${time}`;
}

function formatDateOption(key: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00`));
}

function fairOdds(prediction: DashboardPrediction) {
  const fromPick = prediction.topPicks[0]?.fairOdds;
  if (fromPick && fromPick > 0) return fromPick;
  return prediction.predictedProbability > 0 ? 100 / prediction.predictedProbability : 0;
}

function pickProbability(prediction: DashboardPrediction) {
  return prediction.topPicks[0]?.probability ?? prediction.predictedProbability;
}

function translatePick(value: string) {
  return value
    .replace(/Home Team Goals/gi, "Ev sahibi takım golü")
    .replace(/Away Team Goals/gi, "Deplasman takım golü")
    .replace(/Total Goals/gi, "Toplam gol")
    .replace(/Both Teams To Score/gi, "Karşılıklı gol")
    .replace(/Under/gi, "Alt")
    .replace(/Over/gi, "Üst")
    .replace(/Home/gi, "Ev sahibi")
    .replace(/Away/gi, "Deplasman")
    .replace(/Draw/gi, "Beraberlik");
}

function confidenceShort(score: number) {
  const level = getUiConfidence(score);
  if (level === "Very High" || level === "High") return { label: "YÜKSEK", kind: "high" as const };
  if (level === "Medium") return { label: "ORTA", kind: "med" as const };
  return { label: "DÜŞÜK", kind: "low" as const };
}

function isFinished(prediction: DashboardPrediction) {
  return (
    prediction.settlementStatus === "WON" ||
    prediction.settlementStatus === "LOST" ||
    prediction.settlementStatus === "VOID" ||
    (prediction.finalHomeScore != null && prediction.finalAwayScore != null)
  );
}

function isUpcoming(prediction: DashboardPrediction, now: Date) {
  return asDate(prediction.kickoffAt).getTime() >= now.getTime() && !isFinished(prediction);
}

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (src) return <Image className={styles.logo} src={src} alt="" width={40} height={40} />;
  return <span className={styles.logoFall}>{name.slice(0, 2).toUpperCase()}</span>;
}

function FormRow({ results }: { results?: ("W" | "D" | "L")[] }) {
  if (!results?.length) return null;
  return (
    <span className={styles.form}>
      {results.slice(0, 5).map((result, index) => (
        <i data-result={result} key={`${result}-${index}`}>
          {result === "W" ? "G" : result === "D" ? "B" : "M"}
        </i>
      ))}
    </span>
  );
}

export function MemberPredictionsBoard({
  predictions,
  plan,
  matchPathPrefix = "/member/matches",
  matchQuery = "",
  plansHref = "/member/plans",
}: {
  predictions: DashboardPrediction[];
  plan: MembershipPlanName;
  /** Serializable path prefix — never pass a function across the RSC boundary. */
  matchPathPrefix?: string;
  matchQuery?: string;
  plansHref?: string;
}) {
  const matchHref = (matchId: number) => `${matchPathPrefix}/${matchId}${matchQuery}`;
  const now = useMemo(() => new Date(), []);
  const showOdds = plan !== "BASIC";

  const [tab, setTab] = useState<Tab>("recommended");
  const [teamSearch, setTeamSearch] = useState("");
  const [league, setLeague] = useState<string>("ALL");
  const [date, setDate] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const leagues = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of predictions) map.set(item.leagueApiId, item.leagueName);
    return [...map.entries()]
      .map(([apiId, name]) => ({ apiId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [predictions]);

  const dateOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const item of predictions) {
      if (isUpcoming(item, now) || tab === "finished") keys.add(dateKey(item.kickoffAt));
    }
    return [...keys].sort();
  }, [predictions, now, tab]);

  const recommended = useMemo(
    () =>
      predictions
        .filter((item) => isUpcoming(item, now) && item.confidenceScore >= 60)
        .sort((a, b) => b.confidenceScore - a.confidenceScore || asDate(a.kickoffAt).getTime() - asDate(b.kickoffAt).getTime()),
    [predictions, now],
  );

  const allUpcoming = useMemo(
    () =>
      predictions
        .filter((item) => isUpcoming(item, now))
        .sort((a, b) => asDate(a.kickoffAt).getTime() - asDate(b.kickoffAt).getTime()),
    [predictions, now],
  );

  const finished = useMemo(
    () =>
      predictions
        .filter((item) => isFinished(item))
        .sort((a, b) => asDate(b.kickoffAt).getTime() - asDate(a.kickoffAt).getTime()),
    [predictions],
  );

  const baseList = tab === "recommended" ? recommended : tab === "all" ? allUpcoming : finished;

  const filtered = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return baseList.filter((item) => {
      if (league !== "ALL" && String(item.leagueApiId) !== league) return false;
      if (date !== "ALL" && dateKey(item.kickoffAt) !== date) return false;
      if (!q) return true;
      return (
        item.homeTeam.toLowerCase().includes(q) ||
        item.awayTeam.toLowerCase().includes(q) ||
        item.leagueName.toLowerCase().includes(q)
      );
    });
  }, [baseList, teamSearch, league, date]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = teamSearch.trim() !== "" || league !== "ALL" || date !== "ALL";

  const clearFilters = () => {
    setTeamSearch("");
    setLeague("ALL");
    setDate("ALL");
    setPage(1);
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        <h1>Tahminler</h1>
        <p>
          Yayımlanmış model tahminleri, yaklaşan fikstür ve sonuçlanan maçlar tek çalışma alanında.
          Filtrelerle takım, lig ve tarih seçin.
        </p>
      </header>

      <section className={styles.filters}>
        <label className={styles.field}>
          <span>Takım ara</span>
          <input
            type="search"
            value={teamSearch}
            placeholder="Takım veya lig…"
            onChange={(event) => {
              setTeamSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className={styles.field}>
          <span>Lig</span>
          <select
            value={league}
            onChange={(event) => {
              setLeague(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tüm ligler</option>
            {leagues.map((item) => (
              <option key={item.apiId} value={String(item.apiId)}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Tarih</span>
          <select
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tüm tarihler</option>
            {dateOptions.map((key) => (
              <option key={key} value={key}>
                {formatDateOption(key)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.clearBtn} disabled={!hasFilters} onClick={clearFilters}>
          Filtreleri temizle
        </button>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Tahmin sekmeleri">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "recommended"}
          className={tab === "recommended" ? styles.tabActive : styles.tab}
          onClick={() => switchTab("recommended")}
        >
          Önerilen <b>{recommended.length}</b>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={tab === "all" ? styles.tabActive : styles.tab}
          onClick={() => switchTab("all")}
        >
          Tüm maçlar <b>{allUpcoming.length}</b>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "finished"}
          className={tab === "finished" ? styles.tabActive : styles.tab}
          onClick={() => switchTab("finished")}
        >
          Biten <b>{finished.length}</b>
        </button>
      </div>

      <div className={styles.list}>
        {pageItems.length ? (
          pageItems.map((item) => {
            const conf = confidenceShort(item.confidenceScore);
            const odds = fairOdds(item);
            const probability = pickProbability(item);
            return (
              <Link className={styles.card} href={matchHref(item.matchId)} key={item.matchId}>
                <div>
                  <div className={styles.meta}>
                    <strong>{item.leagueName}</strong>
                    <span>{formatKick(item.kickoffAt)}</span>
                  </div>
                  <div className={styles.matchup}>
                    <div className={styles.team}>
                      <TeamLogo src={item.homeTeamLogo} name={item.homeTeam} />
                      <div>
                        <strong>{item.homeTeam}</strong>
                        <FormRow results={item.homeRecentResults} />
                      </div>
                    </div>
                    <span className={styles.versus}>VS</span>
                    <div className={styles.team}>
                      <TeamLogo src={item.awayTeamLogo} name={item.awayTeam} />
                      <div>
                        <strong>{item.awayTeam}</strong>
                        <FormRow results={item.awayRecentResults} />
                      </div>
                    </div>
                  </div>
                </div>

                <section className={styles.best}>
                  <div className={styles.bestHead}>★ EN İYİ ÖNERİ</div>
                  <div className={styles.bestPick}>{translatePick(getPredictionLabel(item))}</div>
                  <div className={styles.bestMatch}>
                    {item.homeTeam} – {item.awayTeam}
                  </div>
                  <div className={styles.metrics}>
                    <div className={styles.metric}>
                      <span>ORAN</span>
                      {showOdds ? (
                        <strong>{odds > 0 ? odds.toFixed(2) : "—"}</strong>
                      ) : (
                        <span className={styles.lock}>
                          <Link href={plansHref}>{LOCK_HINT.modelOdds}</Link>
                        </span>
                      )}
                    </div>
                    <div className={styles.metric}>
                      <span>OLASILIK</span>
                      {showOdds ? (
                        <strong>%{probability.toFixed(0)}</strong>
                      ) : (
                        <strong>—</strong>
                      )}
                    </div>
                    <div className={styles.metric}>
                      <span>GÜVEN</span>
                      <span
                        className={`${styles.conf} ${
                          conf.kind === "high"
                            ? styles.confHigh
                            : conf.kind === "med"
                              ? styles.confMed
                              : styles.confLow
                        }`}
                      >
                        {conf.label}
                      </span>
                    </div>
                  </div>
                </section>
              </Link>
            );
          })
        ) : (
          <div className={styles.empty}>Bu filtrelerle maç bulunamadı.</div>
        )}
      </div>

      <footer className={styles.footer}>
        <span>
          {filtered.length
            ? `${Math.min(PAGE_SIZE, filtered.length - (safePage - 1) * PAGE_SIZE)} / ${filtered.length} maç gösteriliyor.`
            : "Sonuç yok."}{" "}
          Daha fazla maç için yukarıdaki filtreleri kullanın.
        </span>
        {totalPages > 1 ? (
          <div className={styles.pages}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={safePage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Önceki sayfa"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter((value) => value === 1 || value === totalPages || Math.abs(value - safePage) <= 1)
              .reduce<number[]>((acc, value, index, arr) => {
                if (index > 0 && value - arr[index - 1]! > 1) acc.push(-value);
                acc.push(value);
                return acc;
              }, [])
              .map((value) =>
                value < 0 ? (
                  <span key={`gap-${value}`}>…</span>
                ) : (
                  <button
                    type="button"
                    key={value}
                    className={value === safePage ? styles.pageActive : styles.pageBtn}
                    onClick={() => setPage(value)}
                  >
                    {value}
                  </button>
                ),
              )}
            <button
              type="button"
              className={styles.pageBtn}
              disabled={safePage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              aria-label="Sonraki sayfa"
            >
              ›
            </button>
          </div>
        ) : null}
      </footer>
    </div>
  );
}

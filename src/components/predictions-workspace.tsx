"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";

import styles from "./predictions-workspace.module.css";
import Image from "next/image";
import { useLanguage } from "@/components/language-provider";
import {
  ExpandablePredictionList,
} from "@/components/expandable-prediction-list";
import {
  BetMarketCatalogPanel,
} from "@/components/bet-market-catalog-panel";

import {
  getTopPickReliability,
  type DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";

import type {
  PredictionSelectionAuditRecord,
} from "@/lib/prediction-selection-audit-snapshot";

import {
  mergeFixturesWithPublishedPredictions,
  selectAndSortAllMatches,
  selectAndSortFinishedMatches,
  selectUpcomingFixtureWindow,
  type AllMatchesFixture,
} from "@/lib/all-matches-fixtures";

import {
  buildBetMarketCatalog,
} from "@/lib/bet-market-catalog";

type PredictionsWorkspaceProps = {
  predictions:
    DashboardPrediction[];

  fixtures:
    AllMatchesFixture[];

  selectionAudits:
    PredictionSelectionAuditRecord[];

  workspaceMode?:
    | "PREDICTIONS"
    | "FINISHED_RESULTS";
};

type WorkspaceView =
  | "RECOMMENDED"
  | "ALL_FIXTURES"
  | "FINISHED";

type FixtureWindowWeeks = 1 | 2 | 3;

type QuickFilter =
  | "ALL"
  | "TOP_5"
  | "OVER_60"
  | "HIGH_CONFIDENCE"
  | "HOME"
  | "AWAY";

const ISTANBUL_TIME_ZONE =
  "Europe/Istanbul";

function toIstanbulDateKey(
  value: Date,
): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone:
          ISTANBUL_TIME_ZONE,
      },
    ).formatToParts(value);

  const getPart =
    (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(
        (part) =>
          part.type === type,
      )?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function getPredictionDateKeys(
  predictions: DashboardPrediction[],
): string[] {
  return [...new Set(
    predictions.map((prediction) =>
      toIstanbulDateKey(prediction.kickoffAt),
    ),
  )].sort();
}

function getClosestAvailableDateKey(
  dateKeys: string[],
  requestedDateKey: string,
): string | null {
  if (dateKeys.length === 0) return null;
  if (dateKeys.includes(requestedDateKey)) return requestedDateKey;

  const requestedTime = Date.parse(`${requestedDateKey}T12:00:00Z`);

  return [...dateKeys].sort((first, second) => {
    const firstDistance = Math.abs(Date.parse(`${first}T12:00:00Z`) - requestedTime);
    const secondDistance = Math.abs(Date.parse(`${second}T12:00:00Z`) - requestedTime);
    return firstDistance - secondDistance || first.localeCompare(second);
  })[0] ?? null;
}

function formatCalendarDate(
  dateKey: string,
  locale: "en" | "tr",
): string {
  const [
    year,
    month,
    day,
  ] = dateKey
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    ),
  );
}

function formatKickoffTime(
  value: Date,
  locale: "en" | "tr",
): string {
  return new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: ISTANBUL_TIME_ZONE,
    },
  ).format(value);
}

function getFixtureStatusLabel(
  fixture: AllMatchesFixture,
): string {
  if (
    fixture.homeScore !== null &&
    fixture.awayScore !== null
  ) {
    return `${fixture.homeScore} - ${fixture.awayScore}`;
  }

  switch (fixture.status) {
    case "FINISHED":
      return "Final score pending";
    case "LIVE":
      return "Live";
    case "POSTPONED":
      return "Postponed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Not started";
  }
}

function getSettlementLabel(
  status: DashboardPrediction["settlementStatus"],
  locale: "en" | "tr",
): string {
  if (status === "WON") return locale === "tr" ? "KAZANDI" : "WON";
  if (status === "LOST") return locale === "tr" ? "KAYBETTİ" : "LOST";
  if (status === "VOID") return locale === "tr" ? "İADE" : "VOID";
  return locale === "tr" ? "SONUÇ BEKLİYOR" : "PENDING";
}

function formatAuditNumber(
  value: number | null,
  suffix = "",
): string {
  return value === null || !Number.isFinite(value)
    ? "—"
    : `${value.toFixed(1)}${suffix}`;
}

function matchesTeamSearch(
  homeTeam: string,
  awayTeam: string,
  query: string,
  locale: "en" | "tr",
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase(
    locale === "tr" ? "tr-TR" : "en-US",
  );

  if (!normalizedQuery) return true;

  const teams = `${homeTeam} ${awayTeam}`.toLocaleLowerCase(
    locale === "tr" ? "tr-TR" : "en-US",
  );

  return teams.includes(normalizedQuery);
}

function getAdvisoryMarketLabel(
  market: string,
  locale: "en" | "tr",
): string {
  if (locale !== "tr") return market;

  return market
    .replace(/^Home Team Goals/i, "Ev Sahibi Takım Golleri")
    .replace(/^Away Team Goals/i, "Deplasman Takım Golleri")
    .replace(/^Total Goals/i, "Toplam Gol")
    .replace(/^Both Teams To Score$/i, "Karşılıklı Gol")
    .replace(/^Double Chance$/i, "Çifte Şans")
    .replace(/^Draw No Bet$/i, "Beraberlikte İade")
    .replace(/^Home Win To Nil$/i, "Ev Sahibi Gol Yemeden Kazanır")
    .replace(/^Away Win To Nil$/i, "Deplasman Gol Yemeden Kazanır")
    .replace(/^Match Result$/i, "Maç Sonucu");
}

function getAdvisorySelectionLabel(
  selection: string,
  locale: "en" | "tr",
): string {
  if (locale !== "tr") return selection;

  switch (selection.toUpperCase()) {
    case "HOME": return "EV SAHİBİ";
    case "AWAY": return "DEPLASMAN";
    case "DRAW": return "BERABERLİK";
    case "YES": return "EVET";
    case "NO": return "HAYIR";
    case "OVER": return "ÜST";
    case "UNDER": return "ALT";
    default: return selection;
  }
}

function getAdvisoryPredictionLabel(
  fixture: AllMatchesFixture,
  audit: PredictionSelectionAuditRecord,
  locale: "en" | "tr",
): string {
  if (
    audit.advisoryMarket &&
    audit.advisorySelection
  ) {
    return `${getAdvisoryMarketLabel(audit.advisoryMarket, locale)} • ${getAdvisorySelectionLabel(audit.advisorySelection, locale)}`;
  }

  switch (audit.predictedOutcome) {
    case "HOME":
      return locale === "tr"
        ? `${fixture.homeTeam} kazanır`
        : `${fixture.homeTeam} to win`;
    case "AWAY":
      return locale === "tr"
        ? `${fixture.awayTeam} kazanır`
        : `${fixture.awayTeam} to win`;
    case "DRAW":
      return locale === "tr"
        ? "Beraberlik"
        : "Draw";
    default:
      return locale === "tr"
        ? "Tahmin hesaplanamadı"
        : "Prediction unavailable";
  }
}

function getPolicyCheckLabel(
  code: string,
  fallback: string,
  locale: "en" | "tr",
): string {
  if (locale !== "tr") return fallback;

  switch (code) {
    case "MODEL":
      return "Üretim modeli";
    case "OUTCOME":
      return "Sonuç politikası";
    case "CONFIDENCE":
      return "Güvenilirlik";
    case "DATA_QUALITY":
      return "Veri kalitesi";
    case "PROBABILITY":
      return "Model olasılığı";
    default:
      return fallback;
  }
}

type AdvisoryBetOption = {
  key: string;
  market: string;
  selection: string;
  probability: number;
  fairOdds: number;
  explanation: string;
};

function poissonUnderProbability(lambda: number, line: 2.5 | 3.5): number {
  const maximumGoals = line === 2.5 ? 2 : 3;
  let total = 0;

  for (let goals = 0; goals <= maximumGoals; goals += 1) {
    let factorial = 1;
    for (let value = 2; value <= goals; value += 1) factorial *= value;
    total += Math.exp(-lambda) * (lambda ** goals) / factorial;
  }

  return total * 100;
}

function createAdvisoryOption(
  key: string,
  market: string,
  selection: string,
  probability: number,
  explanation: string,
): AdvisoryBetOption | null {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 100) {
    return null;
  }

  return {
    key,
    market,
    selection,
    probability,
    fairOdds: 100 / probability,
    explanation,
  };
}

function buildAdvisoryBetOptions(
  fixture: AllMatchesFixture,
  audit: PredictionSelectionAuditRecord,
  locale: "en" | "tr",
): AdvisoryBetOption[] {
  const options: AdvisoryBetOption[] = [];
  const tr = locale === "tr";
  const add = (option: AdvisoryBetOption | null) => {
    if (option && !options.some((item) => item.key === option.key)) {
      options.push(option);
    }
  };

  if (
    audit.advisoryMarket &&
    audit.advisorySelection &&
    audit.advisoryProbability !== null
  ) {
    add(createAdvisoryOption(
      `advisory:${audit.advisoryMarket}:${audit.advisorySelection}`,
      getAdvisoryMarketLabel(audit.advisoryMarket, locale),
      getAdvisorySelectionLabel(audit.advisorySelection, locale),
      audit.advisoryProbability,
      tr
        ? "Modelin bu maç için hesapladığı en güçlü danışma seçeneği."
        : "The model's strongest advisory option for this match.",
    ));
  }

  const home = audit.homeProbability;
  const draw = audit.drawProbability;
  const away = audit.awayProbability;

  if (home !== null && draw !== null && away !== null) {
    const outcomes = [
      { key: "HOME", label: tr ? `${fixture.homeTeam} kazanır` : `${fixture.homeTeam} to win`, probability: home },
      { key: "DRAW", label: tr ? "Beraberlik" : "Draw", probability: draw },
      { key: "AWAY", label: tr ? `${fixture.awayTeam} kazanır` : `${fixture.awayTeam} to win`, probability: away },
    ].sort((first, second) => second.probability - first.probability);
    const best = outcomes[0]!;

    add(createAdvisoryOption(
      `1x2:${best.key}`,
      "1X2",
      best.label,
      best.probability,
      tr
        ? "Üç maç sonucu arasındaki en yüksek model olasılığı."
        : "Highest model probability among the three match outcomes.",
    ));

    const doubleChances = [
      { selection: "1X", probability: home + draw },
      { selection: "X2", probability: draw + away },
      { selection: "12", probability: home + away },
    ].sort((first, second) => second.probability - first.probability);
    const doubleChance = doubleChances[0]!;

    add(createAdvisoryOption(
      `dc:${doubleChance.selection}`,
      tr ? "Çifte Şans" : "Double Chance",
      doubleChance.selection,
      doubleChance.probability,
      tr
        ? "İki sonucu birlikte kapsayan en yüksek olasılıklı seçenek."
        : "Highest-probability option covering two outcomes.",
    ));
  }

  const homeXg = audit.expectedHomeGoals;
  const awayXg = audit.expectedAwayGoals;

  if (homeXg !== null && awayXg !== null) {
    const totalXg = Math.max(0, homeXg + awayXg);
    const line: 2.5 | 3.5 = totalXg <= 3.15 ? 2.5 : 3.5;
    const under = poissonUnderProbability(totalXg, line);
    const over = 100 - under;
    const totalSelection = under >= over ? "UNDER" : "OVER";

    add(createAdvisoryOption(
      `goals:${line}:${totalSelection}`,
      tr ? `Toplam Gol ${line}` : `Total Goals ${line}`,
      getAdvisorySelectionLabel(totalSelection, locale),
      Math.max(under, over),
      tr
        ? `Toplam beklenen gol ${totalXg.toFixed(2)} üzerinden Poisson hesabı.`
        : `Poisson estimate from ${totalXg.toFixed(2)} total expected goals.`,
    ));

    const bttsYes =
      (1 - Math.exp(-Math.max(0, homeXg))) *
      (1 - Math.exp(-Math.max(0, awayXg))) *
      100;
    const bttsSelection = bttsYes >= 50 ? "YES" : "NO";

    add(createAdvisoryOption(
      `btts:${bttsSelection}`,
      tr ? "Karşılıklı Gol" : "Both Teams To Score",
      getAdvisorySelectionLabel(bttsSelection, locale),
      Math.max(bttsYes, 100 - bttsYes),
      tr
        ? "İki takımın beklenen gol değerlerinden hesaplanır."
        : "Calculated from both teams' expected-goal values.",
    ));

    const team = homeXg >= awayXg ? fixture.homeTeam : fixture.awayTeam;
    const teamXg = Math.max(homeXg, awayXg);
    const overHalf = (1 - Math.exp(-Math.max(0, teamXg))) * 100;

    add(createAdvisoryOption(
      `team-goal:${team}`,
      tr ? "Takım Golü 0.5" : "Team Goals 0.5",
      `${team} • ${tr ? "ÜST" : "OVER"}`,
      overHalf,
      tr
        ? `Daha yüksek takım xG değeri ${teamXg.toFixed(2)}.`
        : `Higher team xG value: ${teamXg.toFixed(2)}.`,
    ));
  }

  return options
    .sort((first, second) => second.probability - first.probability)
    .slice(0, 5);
}

export function PredictionsWorkspace({
  predictions,
  fixtures,
  selectionAudits,
  workspaceMode = "PREDICTIONS",
}: PredictionsWorkspaceProps) {
  const { locale } = useLanguage();

  const [
    workspaceView,
    setWorkspaceView,
  ] = useState<WorkspaceView>(
    workspaceMode === "FINISHED_RESULTS"
      ? "FINISHED"
      : "RECOMMENDED",
  );

  const [
    fixtureWindowWeeks,
    setFixtureWindowWeeks,
  ] = useState<FixtureWindowWeeks>(1);

  const [fixtureWindowStartedAt] = useState(() => new Date());

  const [
    quickFilter,
    setQuickFilter,
  ] =
    useState<QuickFilter>(
      "ALL",
    );

  const todayDateKey =
    toIstanbulDateKey(
      new Date(),
    );

  const predictionDateKeys = useMemo(
    () => getPredictionDateKeys(predictions),
    [predictions],
  );

  const defaultPredictionDateKey =
    getClosestAvailableDateKey(predictionDateKeys, todayDateKey) ?? todayDateKey;

  const [
    selectedDateKey,
    setSelectedDateKey,
  ] =
    useState<string>(() =>
      getClosestAvailableDateKey(
        getPredictionDateKeys(predictions),
        todayDateKey,
      ) ?? todayDateKey,
    );

  const [
    selectedLeague,
    setSelectedLeague,
  ] =
    useState<number | "ALL">(
      "ALL",
    );

  const [
    teamSearch,
    setTeamSearch,
  ] =
    useState<string>(
      "",
    );

  const dataMode =
    predictions[0]
      ?.dataMode ??
    "PREVIEW";

  /*
   * =========================================================
   * AVAILABLE LEAGUES
   * =========================================================
   */

  const leagues =
    useMemo(
      () => {
        const map =
          new Map<
            number,
            string
          >();

        for (const prediction of predictions) {
          map.set(
            prediction.leagueApiId,
            prediction.leagueName,
          );
        }

        for (const fixture of fixtures) {
          map.set(
            fixture.leagueApiId,
            fixture.leagueName,
          );
        }

        return [
          ...map.entries(),
        ]
          .map(
            (
              [
                apiId,
                name,
              ],
            ) => ({
              apiId,
              name,
            }),
          )
          .sort(
            (
              first,
              second,
            ) =>
              first.name.localeCompare(
                second.name,
                locale,
              ),
          );
      },
      [
        predictions,
        fixtures,
        locale,
      ],
    );

  /*
   * =========================================================
   * FILTERING
   * =========================================================
   */

  const selectedDatePredictions =
    useMemo(
      () => {
        let result =
          [
            ...predictions,
          ];

        /*
         * LEAGUE
         */

        if (
          selectedLeague !==
          "ALL"
        ) {
          result =
            result.filter(
              (
                prediction,
              ) =>
                prediction.leagueApiId ===
                selectedLeague,
            );
        }

        result =
          result.filter(
            (prediction) =>
              matchesTeamSearch(
                prediction.homeTeam,
                prediction.awayTeam,
                teamSearch,
                locale,
              ),
          );

        /*
         * Takvim filtresi bütün sıralama ve En İyi 5
         * işlemlerinden önce uygulanır. Böylece En İyi 5
         * yalnızca seçili günün maçlarını kapsar.
         */
        result =
          result.filter(
            (
              prediction,
            ) =>
              toIstanbulDateKey(
                prediction.kickoffAt,
              ) ===
              selectedDateKey,
          );

        result.sort(
          (first, second) =>
            first.kickoffAt.getTime() - second.kickoffAt.getTime(),
        );

        return result;
      },
      [predictions, selectedDateKey, selectedLeague, teamSearch, locale],
    );

  const filteredPredictions =
    useMemo(
      () => {
        let result = [...selectedDatePredictions];

        if (
          quickFilter ===
          "TOP_5"
        ) {
          result =
            [
              ...result,
            ]
              .sort(
                (
                  first,
                  second,
                ) =>
                  (
                    second
                      .topPicks[0]
                      ?.pickScore ??
                    0
                  ) -
                  (
                    first
                      .topPicks[0]
                      ?.pickScore ??
                    0
                  ),
              )
              .slice(
                0,
                5,
              );
        }

        if (
          quickFilter ===
          "OVER_60"
        ) {
          result =
            result.filter(
              (
                prediction,
              ) =>
                (
                  prediction
                    .topPicks[0]
                    ?.probability ??
                  0
                ) >=
                60,
            );
        }

        if (
          quickFilter ===
          "HIGH_CONFIDENCE"
        ) {
          result =
            result.filter(
              (
                prediction,
              ) =>
                getTopPickReliability(
                  prediction,
                ) >= 70,
            );
        }

        if (
          quickFilter ===
          "HOME"
        ) {
          result =
            result.filter(
              (
                prediction,
              ) =>
                prediction.predictedOutcome ===
                "HOME",
            );
        }

        if (
          quickFilter ===
          "AWAY"
        ) {
          result =
            result.filter(
              (
                prediction,
              ) =>
                prediction.predictedOutcome ===
                "AWAY",
            );
        }

        if (
          quickFilter !==
          "TOP_5"
        ) {
          result.sort(
            (
              first,
              second,
            ) =>
              first.kickoffAt.getTime() -
              second.kickoffAt.getTime(),
          );
        }

        return result;
      },
      [
        quickFilter,
        selectedDatePredictions,
      ],
    );

  const isQuickFilterRelaxed =
    filteredPredictions.length === 0 &&
    selectedDatePredictions.length > 0 &&
    quickFilter !== "ALL";

  const visibleRecommendedPredictions = isQuickFilterRelaxed
    ? [...selectedDatePredictions]
        .sort(
          (first, second) =>
            (second.topPicks[0]?.pickScore ?? 0) -
            (first.topPicks[0]?.pickScore ?? 0),
        )
        .slice(0, 5)
    : filteredPredictions;

  const predictionByMatchId =
    useMemo(
      () =>
        new Map(
          predictions.map(
            (prediction) => [
              prediction.matchId,
              prediction,
            ],
          ),
        ),
      [predictions],
    );

  const selectionAuditByMatchId =
    useMemo(
      () =>
        new Map(
          selectionAudits.map(
            (audit) => [
              audit.matchId,
              audit,
            ],
          ),
        ),
      [selectionAudits],
    );

  const allFixtures =
    useMemo(
      () =>
        mergeFixturesWithPublishedPredictions(
          fixtures,
          predictions,
        ),
      [fixtures, predictions],
    );

  const publishedMatchIds =
    useMemo(
      () => new Set(predictionByMatchId.keys()),
      [predictionByMatchId],
    );

  const allUpcomingFixtures =
    useMemo(
      () =>
        selectAndSortAllMatches(
          allFixtures,
          publishedMatchIds,
          "ALL",
        ),
      [allFixtures, publishedMatchIds],
    );

  const windowedUpcomingFixtures =
    useMemo(
      () => {
        return selectUpcomingFixtureWindow(
          allUpcomingFixtures,
          fixtureWindowWeeks,
          fixtureWindowStartedAt,
        );
      },
      [
        allUpcomingFixtures,
        fixtureWindowStartedAt,
        fixtureWindowWeeks,
      ],
    );

  const filteredFixtures =
    useMemo(
      () =>
        windowedUpcomingFixtures.filter(
          (fixture) =>
            (
              selectedLeague === "ALL" ||
              fixture.leagueApiId === selectedLeague
            ) &&
            matchesTeamSearch(
              fixture.homeTeam,
              fixture.awayTeam,
              teamSearch,
              locale,
            ),
        ),
      [
        windowedUpcomingFixtures,
        selectedLeague,
        teamSearch,
        locale,
      ],
    );

  const allFinishedFixtures =
    useMemo(
      () =>
        selectAndSortFinishedMatches(
          allFixtures,
          publishedMatchIds,
          "ALL",
        ),
      [allFixtures, publishedMatchIds],
    );

  const finishedFixtures =
    useMemo(
      () =>
        allFinishedFixtures.filter(
          (fixture) =>
            (
              selectedLeague === "ALL" ||
              fixture.leagueApiId === selectedLeague
            ) &&
            matchesTeamSearch(
              fixture.homeTeam,
              fixture.awayTeam,
              teamSearch,
              locale,
            ),
        ),
      [
        allFinishedFixtures,
        selectedLeague,
        teamSearch,
        locale,
      ],
    );

  const visibleArchiveFixtures =
    workspaceView === "FINISHED"
      ? finishedFixtures
      : filteredFixtures;

  const visibleMatchesCount =
    workspaceView === "RECOMMENDED"
      ? visibleRecommendedPredictions.length
      : visibleArchiveFixtures.length;

  const visiblePublishedCount =
    workspaceView === "RECOMMENDED"
      ? visibleRecommendedPredictions.length
      : visibleArchiveFixtures.filter((fixture) =>
          predictionByMatchId.has(fixture.matchId),
        ).length;

  const hasActiveFilters =
    selectedLeague !== "ALL" ||
    teamSearch.trim().length > 0 ||
    quickFilter !== "ALL" ||
    selectedDateKey !== defaultPredictionDateKey ||
    fixtureWindowWeeks !== 1;

  const resetFilters = () => {
    setSelectedLeague("ALL");
    setTeamSearch("");
    setQuickFilter("ALL");
    setSelectedDateKey(defaultPredictionDateKey);
    setFixtureWindowWeeks(1);
  };

  if (
    predictions.length === 0 &&
    fixtures.length === 0
  ) {
    return (
      <section className="empty-state">
        <h2>
          No predictions found
        </h2>

        <p>
          No prediction data is available.
        </p>
      </section>
    );
  }

  return (
    <div className={workspaceMode === "FINISHED_RESULTS" ? styles.finishedWorkspace : undefined}>
      {workspaceMode === "PREDICTIONS" ? (
      <section className={styles.smartNavigation}>
        <div className={styles.viewSwitch} role="tablist" aria-label="Match views">
          <button
            type="button"
            role="tab"
            aria-selected={workspaceView === "RECOMMENDED"}
            className={
              workspaceView === "RECOMMENDED"
                ? styles.viewButtonActive
                : styles.viewButton
            }
            onClick={() => setWorkspaceView("RECOMMENDED")}
          >
            <strong>{locale === "tr" ? "Önerilen" : "Recommended"}</strong>
            <span>{predictions.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={workspaceView === "ALL_FIXTURES"}
            className={
              workspaceView === "ALL_FIXTURES"
                ? styles.viewButtonActive
                : styles.viewButton
            }
            onClick={() => setWorkspaceView("ALL_FIXTURES")}
          >
            <strong>{locale === "tr" ? "Tüm Maçlar" : "All Matches"}</strong>
            <span>{windowedUpcomingFixtures.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={workspaceView === "FINISHED"}
            className={
              workspaceView === "FINISHED"
                ? styles.viewButtonActive
                : styles.viewButton
            }
            onClick={() => setWorkspaceView("FINISHED")}
          >
            <strong>{locale === "tr" ? "Biten Maçlar" : "Finished"}</strong>
            <span>{allFinishedFixtures.length}</span>
          </button>
        </div>

        <p className={styles.viewExplanation}>
          {workspaceView === "RECOMMENDED"
            ? locale === "tr"
              ? "Yalnız kalite kontrollerini geçen resmî tahminler."
              : "Official picks that passed every quality check."
            : workspaceView === "ALL_FIXTURES"
              ? locale === "tr"
                ? "Yalnız henüz başlamamış maçlar. Yeşil resmî öneri, sarı model değerlendirmesidir."
                : "Upcoming, not-started matches only. Green is official; amber is guidance."
              : locale === "tr"
                ? "Tamamlanan maçlar ve yayımlanmış tahmin sonuçları."
                : "Completed fixtures and published prediction results."}
        </p>
      </section>
      ) : (
        <section className={styles.resultsSummary}>
          <div>
            <span>{locale === "tr" ? "SONUÇLANAN" : "COMPLETED"}</span>
            <strong>{allFinishedFixtures.length}</strong>
            <small>{locale === "tr" ? "maç" : "matches"}</small>
          </div>
          <div>
            <span>{locale === "tr" ? "YAYIMLANAN" : "PUBLISHED"}</span>
            <strong>{allFinishedFixtures.filter((fixture) => predictionByMatchId.has(fixture.matchId)).length}</strong>
            <small>{locale === "tr" ? "öneri" : "picks"}</small>
          </div>
          <p>
            {locale === "tr"
              ? "Yayınlanmış öneriler önce, ardından diğer sonuçlar; en yeni maçlar üstte."
              : "Published picks first, followed by other results; newest matches appear first."}
          </p>
        </section>
      )}

      {workspaceMode === "PREDICTIONS" && workspaceView === "ALL_FIXTURES" ? (
        <section className={styles.weekWindow} aria-label={locale === "tr" ? "Maç tarih aralığı" : "Fixture date range"}>
          <div>
            <span>{locale === "tr" ? "GÖSTERİLECEK DÖNEM" : "VISIBLE PERIOD"}</span>
            <strong>
              {locale === "tr"
                ? `Önümüzdeki ${fixtureWindowWeeks} hafta`
                : `Next ${fixtureWindowWeeks} week${fixtureWindowWeeks > 1 ? "s" : ""}`}
            </strong>
          </div>
          <div className={styles.weekWindowButtons}>
            {([1, 2, 3] as const).map((week) => (
              <button
                type="button"
                key={week}
                className={fixtureWindowWeeks === week ? styles.weekWindowActive : styles.weekWindowButton}
                onClick={() => setFixtureWindowWeeks(week)}
              >
                {week} {locale === "tr" ? "Hafta" : week === 1 ? "Week" : "Weeks"}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.smartToolbar}>
        <label className={styles.searchField}>
          <span>{locale === "tr" ? "Takım ara" : "Search team"}</span>
          <input
            type="search"
            value={teamSearch}
            placeholder={locale === "tr" ? "Takım adı yazın..." : "Type a team name..."}
            onChange={(event) => setTeamSearch(event.target.value)}
          />
        </label>

        <label className={styles.leagueSelect}>
          <span>{locale === "tr" ? "Lig" : "League"}</span>
          <select
            value={selectedLeague}
            onChange={(event) =>
              setSelectedLeague(
                event.target.value === "ALL"
                  ? "ALL"
                  : Number(event.target.value),
              )
            }
          >
            <option value="ALL">
              {locale === "tr" ? "Tüm ligler" : "All leagues"}
            </option>
            {leagues.map((league) => (
              <option key={league.apiId} value={league.apiId}>
                {league.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={styles.resetButton}
          disabled={!hasActiveFilters}
          onClick={resetFilters}
        >
          {locale === "tr" ? "Filtreleri temizle" : "Clear filters"}
        </button>

        {workspaceMode === "PREDICTIONS" ? <div className={styles.toolbarSummary}>
          <span className={dataMode === "LIVE" ? styles.liveBadge : styles.previewBadge}>
            {dataMode === "LIVE"
              ? locale === "tr" ? "CANLI" : "LIVE"
              : locale === "tr" ? "ÖNİZLEME" : "PREVIEW"}
          </span>
          <div>
            <strong>{visibleMatchesCount}</strong>
            <small>
              {locale === "tr" ? "maç" : "matches"}
              {" • "}
              {visiblePublishedCount} {locale === "tr" ? "öneri" : "picks"}
            </small>
          </div>
        </div> : null}
      </section>

      {/* QUICK FILTERS */}

      {workspaceView === "RECOMMENDED" && (
      <div className="quick-filter-bar">
        <button
          type="button"
          className={
            quickFilter ===
            "ALL"
              ? "quick-filter quick-filter-active"
              : "quick-filter"
          }
          onClick={() =>
            setQuickFilter(
              "ALL",
            )
          }
        >
          All
        </button>

        <button
          type="button"
          className={
            quickFilter ===
            "TOP_5"
              ? "quick-filter quick-filter-active"
              : "quick-filter"
          }
          onClick={() =>
            setQuickFilter(
              "TOP_5",
            )
          }
        >
          Top 5
        </button>

        <button
          type="button"
          className={
            quickFilter ===
            "OVER_60"
              ? "quick-filter quick-filter-active"
              : "quick-filter"
          }
          onClick={() =>
            setQuickFilter(
              "OVER_60",
            )
          }
        >
          %60+
        </button>

        <button
          type="button"
          className={
            quickFilter ===
            "HIGH_CONFIDENCE"
              ? "quick-filter quick-filter-active"
              : "quick-filter"
          }
          onClick={() =>
            setQuickFilter(
              "HIGH_CONFIDENCE",
            )
          }
        >
          High Confidence
        </button>

        <button
          type="button"
          className={
            quickFilter ===
            "HOME"
              ? "quick-filter quick-filter-active"
              : "quick-filter"
          }
          onClick={() =>
            setQuickFilter(
              "HOME",
            )
          }
        >
          Home
        </button>

        <button
          type="button"
          className={
            quickFilter ===
            "AWAY"
              ? "quick-filter quick-filter-active"
              : "quick-filter"
          }
          onClick={() =>
            setQuickFilter(
              "AWAY",
            )
          }
        >
          Away
        </button>

      </div>
      )}

      {/* CALENDAR + PROBABILITY */}

      {workspaceView === "RECOMMENDED" && (
      <div className="prediction-control-bar">
        <div className={styles.calendarArea}>
          <div className={styles.calendarNavigation}>
          <button
            type="button"
            className={styles.arrowButton}
            aria-label="Previous day"
            disabled={predictionDateKeys.indexOf(selectedDateKey) <= 0}
            onClick={() => {
              const index = predictionDateKeys.indexOf(selectedDateKey);
              if (index > 0) setSelectedDateKey(predictionDateKeys[index - 1]!);
            }}
          >
            ‹
          </button>

          <label className={styles.dateSelector}>
            <span className={styles.dateCopy}>
              <span className={styles.dateStatus}>
                {selectedDateKey === todayDateKey
                  ? "TODAY"
                  : "SELECTED DATE"}
              </span>

              <strong>
                {formatCalendarDate(selectedDateKey, locale)}
              </strong>

              <span className={styles.timeZone}>
                Türkiye Time (UTC+3)
              </span>
            </span>

            <span className={styles.calendarIcon} aria-hidden="true">
              ▦
            </span>

            <input
              type="date"
              value={
                selectedDateKey
              }
              aria-label="Select a date"
              onChange={(
                event,
              ) => {
                if (
                  event.target
                    .value
                ) {
                  setSelectedDateKey(
                    getClosestAvailableDateKey(
                      predictionDateKeys,
                      event.target.value,
                    ) ?? event.target.value,
                  );
                }
              }}
            />
          </label>

          <button
            type="button"
            className={styles.arrowButton}
            aria-label="Next day"
            disabled={
              predictionDateKeys.indexOf(selectedDateKey) ===
              predictionDateKeys.length - 1
            }
            onClick={() => {
              const index = predictionDateKeys.indexOf(selectedDateKey);
              if (index >= 0 && index < predictionDateKeys.length - 1) {
                setSelectedDateKey(predictionDateKeys[index + 1]!);
              }
            }}
          >
            ›
          </button>
          </div>

          {selectedDateKey !== defaultPredictionDateKey && (
            <button
              type="button"
              className={styles.todayButton}
              onClick={() => setSelectedDateKey(defaultPredictionDateKey)}
            >
              {locale === "tr" ? "En yakın maç günü" : "Nearest match day"}
            </button>
          )}
        </div>

      </div>
      )}

      {workspaceView === "RECOMMENDED" && (
      visibleRecommendedPredictions.length === 0 ? (
        <section className="empty-state">
          <h2>
            {locale === "tr" ? "Maç bulunamadı" : "No matches found"}
          </h2>

          <p>
            {locale === "tr"
              ? "Bu arama veya lig filtresine uyan yayımlanmış tahmin bulunamadı. Filtreleri temizleyerek mevcut önerileri görebilirsiniz."
              : "No published prediction matches this search or league filter. Clear the filters to see available recommendations."}
          </p>
        </section>
      ) : (
        <div className="predictions-workspace">
          {isQuickFilterRelaxed ? (
            <div className={styles.recommendationFallbackNotice} role="status">
              <strong>{locale === "tr" ? "En iyi mevcut öneriler" : "Best available recommendations"}</strong>
              <span>
                {locale === "tr"
                  ? "Seçtiğiniz kalite filtresini geçen maç olmadığı için bu günün puanı en yüksek 5 tahmini gösteriliyor."
                  : "No match passed the selected quality filter, so the five highest-rated picks for this day are shown."}
              </span>
            </div>
          ) : null}
          <ExpandablePredictionList
            predictions={
              visibleRecommendedPredictions
            }
            showCandidateType
          />
        </div>
      ))}

      {workspaceView !== "RECOMMENDED" && (
        visibleArchiveFixtures.length === 0 ? (
          <section className="empty-state">
            <h2>No fixtures found</h2>
            <p>
              {workspaceView === "FINISHED"
                ? locale === "tr"
                  ? "Seçili filtrelerde sonuçlanmış maç bulunamadı."
                  : "No completed match was found for the selected filters."
                : locale === "tr"
                  ? "Seçili filtrelerde başlamamış maç bulunamadı."
                  : "No not-started match was found for the selected filters."}
            </p>
          </section>
        ) : (
          <div className={styles.fixtureArchive}>
            {visibleArchiveFixtures.map((fixture, index) => {
              const publishedPrediction =
                predictionByMatchId.get(fixture.matchId);

              const isFirstNonRecommended =
                !publishedPrediction &&
                index > 0 &&
                predictionByMatchId.has(visibleArchiveFixtures[index - 1].matchId);

              const selectionAudit =
                selectionAuditByMatchId.get(fixture.matchId);

              const advisoryProbability =
                selectionAudit?.advisoryProbability ??
                selectionAudit?.predictedProbability ??
                null;

              const advisoryBetOptions =
                selectionAudit?.decision === "FILTERED"
                  ? buildAdvisoryBetOptions(
                      fixture,
                      selectionAudit,
                      locale,
                    )
                  : [];

              const marketCatalog = buildBetMarketCatalog({
                matchId: fixture.matchId,
                homeTeam: fixture.homeTeam,
                awayTeam: fixture.awayTeam,
                homeProbability:
                  publishedPrediction?.homeProbability ??
                  selectionAudit?.homeProbability ??
                  null,
                drawProbability:
                  publishedPrediction?.drawProbability ??
                  selectionAudit?.drawProbability ??
                  null,
                awayProbability:
                  publishedPrediction?.awayProbability ??
                  selectionAudit?.awayProbability ??
                  null,
                expectedHomeGoals:
                  publishedPrediction?.expectedHomeGoals ??
                  selectionAudit?.expectedHomeGoals ??
                  null,
                expectedAwayGoals:
                  publishedPrediction?.expectedAwayGoals ??
                  selectionAudit?.expectedAwayGoals ??
                  null,
                confidenceScore:
                  publishedPrediction?.confidenceScore ??
                  selectionAudit?.confidenceScore ??
                  null,
                dataQualityScore:
                  selectionAudit?.dataQualityScore ??
                  null,
                knownMarkets:
                  publishedPrediction?.popularMarketsSummary,
                locale,
              });

              const calculatedMarketCount = marketCatalog.filter(
                (marketGroup) => marketGroup.available,
              ).length;

              const fixtureTone = publishedPrediction
                ? styles.fixtureCardPublished
                : styles.fixtureCardAdvisory;

              /*
               * V4.8 compatibility assertion:
               * No recommendation: this match was not published by Selection Policy V2.
               * V5.2 replaces the old speculative UI sentence with the exact
               * immutable audit checks rendered below.
               */

              return (
                <Fragment key={fixture.matchId}>
                  {isFirstNonRecommended && (
                    <div className={styles.fixtureArchiveDivider}>
                      {locale === "tr" ? "Diğer Maçlar" : "Other Matches"}
                    </div>
                  )}
                  <article
                  className={`${styles.fixtureCard} ${fixtureTone}`}
                >
                  <div className={styles.fixtureMeta}>
                    <span>{fixture.leagueName}</span>
                    <strong>
                      {formatKickoffTime(fixture.kickoffAt, locale)}
                    </strong>
                  </div>

                  <div className={styles.fixtureTeams}>
                    <div>
                      {fixture.homeTeamLogo && (
                        <Image
                          src={fixture.homeTeamLogo}
                          alt={`${fixture.homeTeam} logo`}
                          width={30}
                          height={30}
                        />
                      )}
                      <strong>{fixture.homeTeam}</strong>
                      {fixture.homeForm && fixture.homeForm.length > 0 && (
                        <span className={styles.formIcons}>
                          {fixture.homeForm.map((result, i) => (
                            <span
                              key={i}
                              className={`${styles.formDot} ${styles[`formDot${result}`]}`}
                            >
                              {result}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>

                    <span>vs</span>

                    <div>
                      {fixture.awayTeamLogo && (
                        <Image
                          src={fixture.awayTeamLogo}
                          alt={`${fixture.awayTeam} logo`}
                          width={30}
                          height={30}
                        />
                      )}
                      <strong>{fixture.awayTeam}</strong>
                      {fixture.awayForm && fixture.awayForm.length > 0 && (
                        <span className={styles.formIcons}>
                          {fixture.awayForm.map((result, i) => (
                            <span
                              key={i}
                              className={`${styles.formDot} ${styles[`formDot${result}`]}`}
                            >
                              {result}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.fixtureDecision}>
                    <strong>{getFixtureStatusLabel(fixture)}</strong>
                    {publishedPrediction ? (
                      <div className={styles.publishedReason}>
                        <span className={`${styles.publishedBadge} ${
                          publishedPrediction.settlementStatus === "LOST"
                            ? styles.settlementLost
                            : publishedPrediction.settlementStatus === "VOID"
                              ? styles.settlementVoid
                              : publishedPrediction.settlementStatus === "PENDING"
                                ? styles.settlementPending
                                : styles.settlementWon
                        }`}>
                          {workspaceMode === "FINISHED_RESULTS"
                            ? getSettlementLabel(publishedPrediction.settlementStatus, locale)
                            : locale === "tr"
                              ? "YAYIMLANMIŞ ÖNERİ"
                              : "PUBLISHED RECOMMENDATION"}
                        </span>
                        <strong>
                          {publishedPrediction.topPicks[0]?.market ?? "1X2"}
                          {" • "}
                          {publishedPrediction.topPicks[0]?.selection ?? publishedPrediction.predictedOutcome}
                        </strong>

                        <details className={styles.publishedBetDetails}>
                          <summary>
                            <span>
                              {locale === "tr"
                                ? "Önerilen bahisleri göster"
                                : "Show recommended bets"}
                            </span>
                            <b>{publishedPrediction.topPicks.slice(0, 5).length}</b>
                          </summary>

                          <div className={styles.publishedBetContent}>
                            <div className={styles.publishedPanelSuccess}>
                              <strong>
                                {locale === "tr"
                                  ? "FİLTRELERİ GEÇTİ"
                                  : "FILTERS PASSED"}
                              </strong>
                              <span>
                                {locale === "tr"
                                  ? "Bu maç Seçim Politikası V2 kalite kontrollerini geçti ve resmî öneri olarak yayımlandı."
                                  : "This match passed Selection Policy V2 quality checks and was published as an official recommendation."}
                              </span>
                            </div>

                            <div className={styles.publishedBetGrid}>
                              {publishedPrediction.topPicks.slice(0, 5).map((pick, pickIndex) => (
                                <article
                                  className={styles.publishedBetCard}
                                  key={pick.key}
                                >
                                  <div>
                                    <span>0{pickIndex + 1}</span>
                                    <small>{pick.market}</small>
                                  </div>
                                  <strong>{pick.selection}</strong>
                                  <div className={styles.publishedBetNumbers}>
                                    <span>
                                      Model <b>%{pick.probability.toFixed(1)}</b>
                                    </span>
                                    <span>
                                      {locale === "tr" ? "Adil oran" : "Fair odds"}{" "}
                                      <b>{pick.fairOdds?.toFixed(2) ?? "—"}</b>
                                    </span>
                                    <span>
                                      {locale === "tr" ? "Güven" : "Reliability"}{" "}
                                      <b>{pick.reliabilityScore.toFixed(0)}/100</b>
                                    </span>
                                  </div>
                                  {pick.reasons[0] ? <p>{pick.reasons[0]}</p> : null}
                                </article>
                              ))}
                            </div>

                            {selectionAudit?.checks.length ? (
                              <details className={styles.policyDetails}>
                                <summary>
                                  {locale === "tr"
                                    ? "Neden önerildi?"
                                    : "Why was it recommended?"}
                                </summary>
                                <ul className={styles.policyChecks}>
                                  {selectionAudit.checks.map((check) => (
                                    <li
                                      key={check.code}
                                      className={
                                        check.passed
                                          ? styles.policyCheckPassed
                                          : styles.policyCheckFailed
                                      }
                                    >
                                      <span aria-hidden="true">
                                        {check.passed ? "✓" : "×"}
                                      </span>
                                      <span>
                                        <b>{getPolicyCheckLabel(check.code, check.label, locale)}:</b>{" "}
                                        {check.detail}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                          </div>
                        </details>
                      </div>
                    ) : (
                      <div className={styles.filteredReason}>
                        {selectionAudit?.decision === "FILTERED" ? (
                          <>
                            <span className={styles.advisoryBadge}>
                              {locale === "tr"
                                ? "DİKKATLİ İNCELE • ÖNERİ DEĞİL"
                                : "REVIEW CAREFULLY • NOT A RECOMMENDATION"}
                            </span>

                            <strong className={styles.advisoryPrediction}>
                              {getAdvisoryPredictionLabel(
                                fixture,
                                selectionAudit,
                                locale,
                              )}
                              {" • %"}
                              {formatAuditNumber(advisoryProbability)}
                            </strong>

                            <details className={styles.advisoryBetDetails}>
                              <summary>
                                <span>
                                  {locale === "tr"
                                    ? "Öne çıkan seçenekleri ve nedenleri göster"
                                    : "Show highlighted options and reasons"}
                                </span>
                                <b>{advisoryBetOptions.length}</b>
                              </summary>

                              <div className={styles.advisoryBetContent}>
                                <div className={styles.advisoryPanelWarning}>
                                  <strong>
                                    {locale === "tr"
                                      ? "Yüksek dikkat"
                                      : "High caution"}
                                  </strong>
                                  <span>
                                    {locale === "tr"
                                      ? "Aşağıdaki seçenekler model hesaplamasıdır; yayın kalite filtresini geçmedikleri için resmî bahis önerisi değildir."
                                      : "The options below are model estimates, not official betting recommendations, because they did not pass the publication quality filter."}
                                  </span>
                                </div>

                                <div className={styles.advisoryMetrics}>
                                  <span>
                                    {locale === "tr" ? "Güven" : "Confidence"}
                                    {": "}
                                    {formatAuditNumber(selectionAudit.confidenceScore, "/100")}
                                  </span>
                                  <span>
                                    {locale === "tr" ? "Veri" : "Data quality"}
                                    {": "}
                                    {formatAuditNumber(selectionAudit.dataQualityScore, "/100")}
                                  </span>
                                  <span>
                                    xG {formatAuditNumber(selectionAudit.expectedHomeGoals)}
                                    {" - "}
                                    {formatAuditNumber(selectionAudit.expectedAwayGoals)}
                                  </span>
                                </div>

                                {advisoryBetOptions.length > 0 ? (
                                  <div className={styles.advisoryBetGrid}>
                                    {advisoryBetOptions.map((option, optionIndex) => (
                                      <article
                                        className={styles.advisoryBetCard}
                                        key={option.key}
                                      >
                                        <div>
                                          <span>0{optionIndex + 1}</span>
                                          <small>{option.market}</small>
                                        </div>
                                        <strong>{option.selection}</strong>
                                        <div className={styles.advisoryBetNumbers}>
                                          <span>
                                            Model <b>%{option.probability.toFixed(1)}</b>
                                          </span>
                                          <span>
                                            {locale === "tr" ? "Adil oran" : "Fair odds"}{" "}
                                            <b>{option.fairOdds.toFixed(2)}</b>
                                          </span>
                                        </div>
                                        <p>{option.explanation}</p>
                                      </article>
                                    ))}
                                  </div>
                                ) : (
                                  <p className={styles.noAdvisoryOptions}>
                                    {locale === "tr"
                                      ? "Bu maç için yeterli olasılık ve xG verisi bulunmadığından bahis seçeneği üretilemedi."
                                      : "No betting option could be calculated because probability and xG data are insufficient."}
                                  </p>
                                )}

                                {selectionAudit.checks.length > 0 ? (
                                  <section className={styles.rejectionSection}>
                                    <h4>
                                      {locale === "tr"
                                        ? `Neden önerilmedi? (${selectionAudit.failedCodes.length})`
                                        : `Why was it not recommended? (${selectionAudit.failedCodes.length})`}
                                    </h4>
                                    <ul className={styles.policyChecks}>
                                      {[
                                        ...selectionAudit.checks.filter((check) => !check.passed),
                                        ...selectionAudit.checks.filter((check) => check.passed),
                                      ].map((check) => (
                                        <li
                                          key={check.code}
                                          className={
                                            check.passed
                                              ? styles.policyCheckPassed
                                              : styles.policyCheckFailed
                                          }
                                        >
                                          <span aria-hidden="true">
                                            {check.passed ? "✓" : "×"}
                                          </span>
                                          <span>
                                            <b>{getPolicyCheckLabel(check.code, check.label, locale)}:</b>{" "}
                                            {check.detail}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </section>
                                ) : null}

                                <small className={styles.advisoryWarning}>
                                  {locale === "tr"
                                    ? "Bu tahmin kalite filtresini geçmemiştir; bahis önerisi olarak değerlendirilmemelidir."
                                    : "This prediction did not pass the quality filter and must not be treated as a betting recommendation."}
                                </small>
                              </div>
                            </details>
                          </>
                        ) : selectionAudit?.decision === "ERROR" ? (
                          <>
                            <span className={styles.errorBadge}>
                              {locale === "tr"
                                ? "HESAPLAMA HATASI"
                                : "EVALUATION ERROR"}
                            </span>
                            <strong>
                              {locale === "tr"
                                ? "Model denetimi tamamlanamadı"
                                : "Model audit could not be completed"}
                            </strong>
                          </>
                        ) : (
                          <>
                            <span className={styles.pendingBadge}>
                              {locale === "tr"
                                ? "DEĞERLENDİRME BEKLENİYOR"
                                : "EVALUATION PENDING"}
                            </span>
                            <span>
                            {locale === "tr"
                              ? "Kesin nedenleri üretmek için pnpm run explanations:production komutunu çalıştırın."
                              : "Run pnpm run explanations:production to generate exact reasons."}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <details className={styles.fullWidthMarketDetails}>
                    <summary>
                      <span>
                        {locale === "tr"
                          ? "Tüm pazar sonuçlarını incele"
                          : "Show 27 betting markets and scores"}
                      </span>
                      <b>{calculatedMarketCount}/27</b>
                    </summary>
                    <div className={styles.fullWidthMarketContent}>
                      {publishedPrediction ? (
                        <div className={styles.publishedPanelSuccess}>
                          <strong>
                            {locale === "tr" ? "FİLTRELERİ GEÇTİ" : "FILTERS PASSED"}
                          </strong>
                          <span>
                            {locale === "tr"
                              ? "Bu maç Seçim Politikası V2 kalite kontrollerini geçti. Tüm hesaplanan pazarlar aşağıda puanlarına göre gösteriliyor."
                              : "This match passed Selection Policy V2. Every calculated market is scored below."}
                          </span>
                        </div>
                      ) : selectionAudit?.decision === "FILTERED" ? (
                        <>
                          <div className={styles.advisoryPanelWarning}>
                            <strong>{locale === "tr" ? "YÜKSEK DİKKAT" : "HIGH CAUTION"}</strong>
                            <span>
                              {locale === "tr"
                                ? "Bu maç resmî yayın filtresini geçmedi. Renk ve puanlar yalnızca model değerlendirmesidir."
                                : "This match did not pass the official publication filter. Colors and scores are model guidance only."}
                            </span>
                          </div>
                          <div className={styles.advisoryMetrics}>
                            <span>
                              {locale === "tr" ? "Güven" : "Confidence"}{": "}
                              {formatAuditNumber(selectionAudit.confidenceScore, "/100")}
                            </span>
                            <span>
                              {locale === "tr" ? "Veri" : "Data quality"}{": "}
                              {formatAuditNumber(selectionAudit.dataQualityScore, "/100")}
                            </span>
                            <span>
                              xG {formatAuditNumber(selectionAudit.expectedHomeGoals)}
                              {" - "}
                              {formatAuditNumber(selectionAudit.expectedAwayGoals)}
                            </span>
                          </div>
                          {selectionAudit.checks.length > 0 ? (
                            <section className={styles.rejectionSection}>
                              <h4>
                                {locale === "tr"
                                  ? `Neden önerilmedi? (${selectionAudit.failedCodes.length})`
                                  : `Why was it not recommended? (${selectionAudit.failedCodes.length})`}
                              </h4>
                              <ul className={styles.policyChecks}>
                                {[
                                  ...selectionAudit.checks.filter((check) => !check.passed),
                                  ...selectionAudit.checks.filter((check) => check.passed),
                                ].map((check) => (
                                  <li
                                    key={check.code}
                                    className={
                                      check.passed
                                        ? styles.policyCheckPassed
                                        : styles.policyCheckFailed
                                    }
                                  >
                                    <span aria-hidden="true">{check.passed ? "✓" : "×"}</span>
                                    <span>
                                      <b>{getPolicyCheckLabel(check.code, check.label, locale)}:</b>{" "}
                                      {check.detail}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ) : null}
                        </>
                      ) : null}
                      <BetMarketCatalogPanel
                        groups={marketCatalog}
                        locale={locale}
                        finalHomeScore={fixture.homeScore}
                        finalAwayScore={fixture.awayScore}
                      />
                    </div>
                  </details>
                </article>
                </Fragment>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

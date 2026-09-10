"use client";

import { useState } from "react";

import type {
  BetMarketGroup,
  BetMarketSettlement,
  BetMarketTier,
} from "@/lib/bet-market-catalog";
import { settleBetMarketOption } from "@/lib/bet-market-catalog";
import {
  canAccessBetMarket,
  MEMBERSHIP_PLAN_LABELS,
  MEMBERSHIP_PLAN_MARKET_LIMITS,
  requiredPlanForBetMarket,
  type MembershipPlanName,
} from "@/lib/membership-access";

import styles from "./predictions-workspace.module.css";

function getTierLabel(
  tier: BetMarketTier,
  locale: "en" | "tr",
): string {
  if (tier === "STRONG") return locale === "tr" ? "GÜÇLÜ" : "STRONG";
  if (tier === "MEDIUM") return locale === "tr" ? "ORTA" : "MEDIUM";
  return locale === "tr" ? "ÖNERİLMEZ" : "NOT RECOMMENDED";
}

function getSettlementLabel(
  settlement: BetMarketSettlement,
  locale: "en" | "tr",
): string {
  if (settlement === "WON") return locale === "tr" ? "KAZANDI" : "WON";
  if (settlement === "LOST") return locale === "tr" ? "KAYBETTİ" : "LOST";
  if (settlement === "VOID") return locale === "tr" ? "İADE" : "VOID";
  return locale === "tr" ? "VERİ YOK" : "NO DATA";
}

function getSettlementClass(settlement: BetMarketSettlement): string {
  if (settlement === "WON") return styles.marketSettlementWon;
  if (settlement === "LOST") return styles.marketSettlementLost;
  if (settlement === "VOID") return styles.marketSettlementVoid;
  return styles.marketSettlementMissing;
}

export function BetMarketCatalogPanel({
  groups,
  locale,
  finalHomeScore = null,
  finalAwayScore = null,
  accessPlan,
}: {
  groups: BetMarketGroup[];
  locale: "en" | "tr";
  finalHomeScore?: number | null;
  finalAwayScore?: number | null;
  accessPlan?: MembershipPlanName;
}) {
  const [activeTier, setActiveTier] = useState<"ALL" | BetMarketTier>("ALL");
  const hasFinalScore = finalHomeScore !== null && finalAwayScore !== null;
  const availableCount = groups.filter((groupItem) => groupItem.available).length;
  const strongCount = groups.filter((groupItem) => groupItem.options[0]?.tier === "STRONG").length;
  const mediumCount = groups.filter((groupItem) => groupItem.options[0]?.tier === "MEDIUM").length;
  const weakCount = groups.filter((groupItem) => groupItem.options[0]?.tier === "WEAK").length;
  const settlements = hasFinalScore
    ? groups.flatMap((groupItem) => groupItem.options).map((option) =>
        settleBetMarketOption(option.key, finalHomeScore, finalAwayScore),
      )
    : [];
  const wonCount = settlements.filter((result) => result === "WON").length;
  const lostCount = settlements.filter((result) => result === "LOST").length;
  const voidCount = settlements.filter((result) => result === "VOID").length;
  const accessibleGroups = accessPlan
    ? groups.filter((groupItem) => canAccessBetMarket(accessPlan, groupItem.number))
    : groups;
  const accessibleAvailableCount = accessibleGroups.filter((groupItem) => groupItem.available).length;
  const visibleGroups = groups.filter((groupItem) =>
    activeTier === "ALL" || groupItem.options[0]?.tier === activeTier,
  );
  const bestOpportunities = accessibleGroups
    .filter((groupItem) => groupItem.available && groupItem.options[0]?.tier === "STRONG")
    .sort((left, right) => (right.options[0]?.score ?? 0) - (left.options[0]?.score ?? 0))
    .slice(0, 3);
  const tierFilters: Array<{ key: "ALL" | BetMarketTier; count: number; label: string }> = [
    { key: "ALL", count: accessPlan ? accessibleGroups.length : groups.length, label: locale === "tr" ? "Tümü" : "All" },
    { key: "STRONG", count: strongCount, label: locale === "tr" ? "Güçlü" : "Strong" },
    { key: "MEDIUM", count: mediumCount, label: locale === "tr" ? "Orta" : "Medium" },
    { key: "WEAK", count: weakCount, label: locale === "tr" ? "Zayıf" : "Weak" },
  ];

  return (
    <section className={styles.marketCatalog}>
      <header className={styles.marketCatalogHeader}>
        <div>
          <span>
            {accessPlan
              ? locale === "tr"
                ? `${MEMBERSHIP_PLAN_LABELS[accessPlan].toLocaleUpperCase("tr-TR")} • ${MEMBERSHIP_PLAN_MARKET_LIMITS[accessPlan]} PAZAR ERİŞİMİ`
                : `${MEMBERSHIP_PLAN_LABELS[accessPlan].toUpperCase()} • ${MEMBERSHIP_PLAN_MARKET_LIMITS[accessPlan]} MARKET ACCESS`
              : locale === "tr" ? "27 PAZARLIK MAÇ ANALİZİ" : "27-MARKET MATCH ANALYSIS"}
          </span>
          <strong>{locale === "tr" ? "Tüm Bahis Pazarları" : "All Betting Markets"}</strong>
          <small>
            {hasFinalScore
              ? locale === "tr"
                ? `Maç sonucu ${finalHomeScore}-${finalAwayScore}. Skordan doğrulanabilen seçimler sonuçlandırıldı; olay verisi isteyen pazarlar açıkça işaretlendi.`
                : `Final score ${finalHomeScore}-${finalAwayScore}. Score-verifiable selections are settled; event-dependent markets are clearly marked.`
              : locale === "tr"
              ? "Her satırdaki en güçlü seçenek önde gösterilir; satırı açarak diğer seçenekleri inceleyin."
              : "The strongest option is shown first; expand a row to inspect alternatives."}
          </small>
        </div>
        <div className={styles.marketCatalogStats}>
          {hasFinalScore ? (
            <>
              <span className={styles.marketStatWon}><b>{wonCount}</b> {locale === "tr" ? "kazandı" : "won"}</span>
              <span className={styles.marketStatLost}><b>{lostCount}</b> {locale === "tr" ? "kaybetti" : "lost"}</span>
              {voidCount > 0 ? <span><b>{voidCount}</b> {locale === "tr" ? "iade" : "void"}</span> : null}
            </>
          ) : (
            <>
              <span><b>{accessPlan ? accessibleAvailableCount : availableCount}</b> {locale === "tr" ? "erişilebilir" : "available"}</span>
              <span className={styles.marketStatStrong}><b>{strongCount}</b> {locale === "tr" ? "güçlü" : "strong"}</span>
              <span className={styles.marketStatMedium}><b>{mediumCount}</b> {locale === "tr" ? "orta" : "medium"}</span>
              <span className={styles.marketStatWeak}><b>{weakCount}</b> {locale === "tr" ? "zayıf" : "weak"}</span>
            </>
          )}
        </div>
      </header>

      {hasFinalScore ? <div className={styles.marketCatalogLegend}>
        {hasFinalScore ? (
          <>
            <span className={styles.legendWon}>{locale === "tr" ? "Yeşil • Kazandı" : "Green • Won"}</span>
            <span className={styles.legendLost}>{locale === "tr" ? "Kırmızı • Kaybetti" : "Red • Lost"}</span>
            <span className={styles.legendVoid}>{locale === "tr" ? "Mavi • İade" : "Blue • Void"}</span>
            <span className={styles.legendUnavailable}>{locale === "tr" ? "Gri • Sonuç verisi yok" : "Grey • Result data missing"}</span>
          </>
        ) : (
          <>
            <span className={styles.legendStrong}>{locale === "tr" ? "Yeşil • Güçlü" : "Green • Strong"}</span>
            <span className={styles.legendMedium}>{locale === "tr" ? "Sarı • Orta" : "Amber • Medium"}</span>
            <span className={styles.legendWeak}>{locale === "tr" ? "Kırmızı • Önerilmez" : "Red • Not recommended"}</span>
            <span className={styles.legendUnavailable}>{locale === "tr" ? "Gri • Veri bekleniyor" : "Grey • Waiting for data"}</span>
          </>
        )}
      </div> : (
        <div className={styles.marketTierFilters} role="group" aria-label={locale === "tr" ? "Pazar gücü filtresi" : "Market strength filter"}>
          {tierFilters.map((filter) => (
            <button
              className={activeTier === filter.key ? styles.marketTierFilterActive : styles.marketTierFilter}
              key={filter.key}
              onClick={() => setActiveTier(filter.key)}
              type="button"
            >
              <span>{filter.label}</span>
              <b>{filter.count}</b>
            </button>
          ))}
        </div>
      )}

      {!hasFinalScore && bestOpportunities.length > 0 ? (
        <section className={styles.marketBestOpportunities}>
          <header>
            <span aria-hidden="true">✦</span>
            <div>
              <strong>{locale === "tr" ? "En iyi fırsatlar" : "Best opportunities"}</strong>
              <small>{locale === "tr" ? "Tüm pazarlardaki en güçlü 3 seçim" : "Top 3 strongest picks from all markets"}</small>
            </div>
          </header>
          <div>
            {bestOpportunities.map((groupItem, index) => {
              const option = groupItem.options[0];
              return option ? (
                <article key={groupItem.number}>
                  <span>#{index + 1}</span>
                  <div>
                    <strong>{option.selection}</strong>
                    <div className={styles.marketOpportunityMeter}><i style={{ width: `${Math.max(0, Math.min(100, option.score))}%` }} /></div>
                  </div>
                  <b>{option.score.toFixed(1)}<small>/100</small></b>
                </article>
              ) : null;
            })}
          </div>
        </section>
      ) : null}

      <div className={styles.marketGroupList}>
        {visibleGroups.map((marketGroup) => {
          const unlocked = !accessPlan || canAccessBetMarket(accessPlan, marketGroup.number);
          const requiredPlan = requiredPlanForBetMarket(marketGroup.number);
          const bestOption = marketGroup.options[0];
          const bestSettlement = bestOption && hasFinalScore
            ? settleBetMarketOption(bestOption.key, finalHomeScore, finalAwayScore)
            : null;
          const tone = !marketGroup.available
            ? styles.marketGroupUnavailable
            : bestOption?.tier === "STRONG"
              ? styles.marketGroupStrong
              : bestOption?.tier === "MEDIUM"
                ? styles.marketGroupMedium
                : styles.marketGroupWeak;

          return (
            <details
              className={`${styles.marketGroup} ${tone} ${!unlocked ? styles.marketGroupLocked : ""}`}
              key={marketGroup.number}
              onToggle={(event) => {
                if (!unlocked) event.currentTarget.open = false;
              }}
            >
              <summary>
                <span className={styles.marketNumber}>{String(marketGroup.number).padStart(2, "0")}</span>
                <span className={styles.marketTitle}>
                  <b>{marketGroup.title}</b>
                </span>
                {!unlocked ? (
                  <>
                    <span className={styles.marketBestSelection}>
                      <small>{locale === "tr" ? "PAKET ERİŞİMİ" : "PLAN ACCESS"}</small>
                      <strong className={styles.marketLockedSelection}>
                        {locale === "tr"
                          ? `${MEMBERSHIP_PLAN_LABELS[requiredPlan]} paketinde açılır`
                          : `Unlocks with ${MEMBERSHIP_PLAN_LABELS[requiredPlan]}`}
                      </strong>
                    </span>
                    <span className={styles.marketLockedBadge} aria-label={locale === "tr" ? "Kilitli" : "Locked"}>KİLİTLİ</span>
                  </>
                ) : bestOption ? (
                  <>
                    <span className={styles.marketBestSelection}>
                      <strong>{bestOption.selection}</strong>
                    </span>
                    <span className={styles.marketScore}>
                      <span className={styles.marketScoreMeter} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, bestOption.score))}%` }} /></span>
                      <span><b>{bestOption.score.toFixed(1)}</b>/100</span>
                    </span>
                    <span className={`${styles.marketTier} ${bestSettlement ? getSettlementClass(bestSettlement) : ""}`}>
                      {bestSettlement
                        ? getSettlementLabel(bestSettlement, locale)
                        : getTierLabel(bestOption.tier, locale)}
                    </span>
                  </>
                ) : (
                  <span className={styles.marketUnavailableLabel}>
                    {locale === "tr" ? "VERİ BEKLENİYOR" : "WAITING FOR DATA"}
                  </span>
                )}
              </summary>

              <div className={styles.marketGroupContent}>
                {!unlocked ? (
                  <div className={styles.marketUpgradePrompt}>
                    <div>
                      <strong>{locale === "tr" ? "Bu pazar paketinizde kapalı" : "This market is locked"}</strong>
                      <span>{locale === "tr" ? "Seçimi, olasılığı ve adil oranı görmek için paketinizi yükseltin." : "Upgrade to see the selection, probability and fair odds."}</span>
                    </div>
                    <a href="/member/plans">{locale === "tr" ? "Paketleri karşılaştır" : "Compare plans"}</a>
                  </div>
                ) : marketGroup.available ? (
                  <div className={styles.marketOptionGrid}>
                    {marketGroup.options.map((option) => {
                      const settlement = hasFinalScore
                        ? settleBetMarketOption(option.key, finalHomeScore, finalAwayScore)
                        : null;
                      const tierClass = option.tier === "STRONG"
                        ? styles.marketOptionStrong
                        : option.tier === "MEDIUM"
                          ? styles.marketOptionMedium
                          : styles.marketOptionWeak;

                      return (
                      <article
                        className={`${tierClass} ${settlement ? getSettlementClass(settlement) : ""}`}
                        key={option.key}
                      >
                        <header className={styles.marketOptionHeading}>
                          <strong>{option.selection}</strong>
                          {settlement ? (
                            <b className={styles.marketSettlementBadge}>
                              {getSettlementLabel(settlement, locale)}
                            </b>
                          ) : null}
                        </header>
                        <div>
                          <span>{locale === "tr" ? "Puan" : "Score"} <b>{option.score.toFixed(1)}</b></span>
                          <span>Model <b>%{option.probability.toFixed(1)}</b></span>
                          <span>{locale === "tr" ? "Adil oran" : "Fair odds"} <b>{option.fairOdds.toFixed(2)}</b></span>
                        </div>
                        {option.estimated ? (
                          <small>{locale === "tr" ? "Yaklaşık model hesabı" : "Estimated model calculation"}</small>
                        ) : null}
                      </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.marketUnavailableReason}>{marketGroup.reason}</p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

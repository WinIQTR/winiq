"use client";

import { useLanguage } from "@/components/language-provider";
import type { MarketLineMove } from "@/lib/market-line-move-shared";

import styles from "./market-line-move.module.css";

export function MarketLineMoveBlock({
  move,
  locked = false,
}: {
  move: MarketLineMove | null | undefined;
  locked?: boolean;
}) {
  const { t } = useLanguage();

  if (locked) {
    return (
      <div className={styles.wrap}>
        <span className={styles.label}>{t("Market line (book)")}</span>
        <span className={styles.empty}>—</span>
      </div>
    );
  }

  if (!move) {
    return (
      <div className={styles.wrap}>
        <span className={styles.label}>{t("Market line (book)")}</span>
        <span className={styles.empty}>{t("No book line yet")}</span>
      </div>
    );
  }

  const directionLabel =
    move.direction === "up"
      ? t("Rose")
      : move.direction === "down"
        ? t("Fell")
        : t("Unchanged");

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{t("Market line (book)")}</span>
      <div className={styles.row}>
        <strong className={styles.current}>{move.currentOdds.toFixed(2)}</strong>
        <span className={styles.badge} data-dir={move.direction}>
          {move.direction === "up" ? "↑" : move.direction === "down" ? "↓" : "→"}{" "}
          {directionLabel}
        </span>
      </div>
      <p className={styles.path}>
        {t("Open")} <b>{move.openingOdds.toFixed(2)}</b>
        {" → "}
        {t("Now")} <b>{move.currentOdds.toFixed(2)}</b>
      </p>
    </div>
  );
}

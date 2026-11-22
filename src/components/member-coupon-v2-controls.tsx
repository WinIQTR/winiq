"use client";

import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";

import styles from "./member-coupon-v2-controls.module.css";

const STORAGE_KEY = "winiq-v2-daily-budget-units";

export function MemberCouponV2Controls({
  legMatchIds = [],
  bookTotalOdds = null,
  modelTotalOdds = null,
}: {
  legMatchIds?: number[];
  bookTotalOdds?: number | null;
  modelTotalOdds?: number | null;
}) {
  const { t } = useLanguage();
  const [budget, setBudget] = useState(3);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? Number(raw) : 3;
      if (Number.isFinite(parsed) && parsed > 0) setBudget(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(budget));
    } catch {
      /* ignore */
    }
  }, [budget]);

  const duplicates = useMemo(() => {
    const seen = new Set<number>();
    const dups = new Set<number>();
    for (const id of legMatchIds) {
      if (seen.has(id)) dups.add(id);
      seen.add(id);
    }
    return dups.size;
  }, [legMatchIds]);

  return (
    <section className={styles.wrap} aria-label={t("Stake controls")}>
      <label className={styles.budget}>
        <span>
          {t("Daily budget")} · {budget.toFixed(1)}u
        </span>
        <input
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
        />
      </label>
      <div className={styles.oddsRow}>
        <article>
          <span>{t("Book total")}</span>
          <strong>
            {bookTotalOdds != null && bookTotalOdds > 1
              ? bookTotalOdds.toFixed(2)
              : "—"}
          </strong>
        </article>
        <article>
          <span>{t("Model total")}</span>
          <strong>
            {modelTotalOdds != null && modelTotalOdds > 1
              ? modelTotalOdds.toFixed(2)
              : "—"}
          </strong>
        </article>
      </div>
      {duplicates > 0 ? (
        <p className={styles.warn}>
          {t("Same-match legs detected — correlated risk.")}
        </p>
      ) : (
        <p className={styles.ok}>{t("No same-match correlation in view.")}</p>
      )}
    </section>
  );
}

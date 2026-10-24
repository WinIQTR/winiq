"use client";

import Link from "next/link";

import { useLanguage } from "@/components/language-provider";
import {
  dayPartFilterLabel,
  type DayPartFilter,
} from "@/lib/daypart-filter";

import styles from "./daypart-filter-chips.module.css";

type Props = {
  value: DayPartFilter;
  /** Build href for a given daypart (omit or ALL → no daypart / daypart=ALL cleared). */
  hrefFor: (next: DayPartFilter) => string;
  ariaLabel?: string;
};

const OPTIONS: DayPartFilter[] = ["ALL", "day", "night"];

export function DayPartFilterChips({ value, hrefFor, ariaLabel }: Props) {
  const { locale, t } = useLanguage();
  return (
    <div
      className={styles.row}
      role="group"
      aria-label={ariaLabel ?? t("Day / night")}
    >
      {OPTIONS.map((option) => (
        <Link
          key={option}
          href={hrefFor(option)}
          className={styles.chip}
          data-active={value === option ? "true" : undefined}
          scroll={false}
        >
          {dayPartFilterLabel(option, locale)}
        </Link>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "@/components/member-smart-dashboard.module.css";

export type MemberDateOption = {
  key: string;
  href: string;
  label: string;
};

export function MemberDateDayPicker({
  options,
  activeDate,
  prevHref,
  nextHref,
}: {
  options: MemberDateOption[];
  activeDate: string;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  const hrefByKey = new Map(options.map((option) => [option.key, option.href]));

  return (
    <div className={styles.dateMinimal}>
      {prevHref ? (
        <Link href={prevHref} aria-label="Önceki gün">
          ←
        </Link>
      ) : (
        <span aria-hidden="true">←</span>
      )}
      <label>
        Tarih
        <select
          value={activeDate}
          onChange={(event) => {
            const href = hrefByKey.get(event.target.value);
            if (href) router.push(href);
          }}
        >
          {options.map((option) => (
            <option value={option.key} key={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {nextHref ? (
        <Link href={nextHref} aria-label="Sonraki gün">
          →
        </Link>
      ) : (
        <span aria-hidden="true">→</span>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "@/components/member-smart-dashboard.module.css";

export function MemberDateDayPicker({
  dayKeys,
  activeDate,
  hrefFor,
  labelFor,
  isToday,
}: {
  dayKeys: string[];
  activeDate: string;
  hrefFor: (key: string) => string;
  labelFor: (key: string) => string;
  isToday: (key: string) => boolean;
}) {
  const router = useRouter();
  const index = Math.max(0, dayKeys.indexOf(activeDate));
  const prev = dayKeys[index - 1];
  const next = dayKeys[index + 1];

  return (
    <div className={styles.dateMinimal}>
      {prev ? (
        <Link href={hrefFor(prev)} aria-label="Önceki gün">
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
            router.push(hrefFor(event.target.value));
          }}
        >
          {dayKeys.map((key) => (
            <option value={key} key={key}>
              {isToday(key) ? `Bugün · ${labelFor(key)}` : labelFor(key)}
            </option>
          ))}
        </select>
      </label>
      {next ? (
        <Link href={hrefFor(next)} aria-label="Sonraki gün">
          →
        </Link>
      ) : (
        <span aria-hidden="true">→</span>
      )}
    </div>
  );
}

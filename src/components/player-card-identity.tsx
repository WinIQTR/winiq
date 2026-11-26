import Image from "next/image";
import type { ReactNode } from "react";

import {
  formatPlayerMarketValue,
  resolveBestPositionLabel,
  resolvePlayerFlagUrl,
  type PlayerCardIdentitySource,
} from "@/lib/player-card-meta";

import styles from "./player-card-identity.module.css";

export function PlayerCardIdentity({
  name,
  source,
  locale = "tr",
  star = false,
  injury = false,
  photoUrl,
  extraMeta,
  trailing,
  className,
}: {
  name: string;
  source: PlayerCardIdentitySource;
  locale?: "tr" | "en";
  star?: boolean;
  injury?: boolean;
  photoUrl?: string | null;
  /** Extra mid-line bits (e.g. team · appearances) — only pass real DB strings. */
  extraMeta?: string | null;
  trailing?: ReactNode;
  className?: string;
}) {
  const flagUrl = resolvePlayerFlagUrl(source);
  const bestPosition = resolveBestPositionLabel(source, locale);
  const market = formatPlayerMarketValue(source);
  const nationality = source.nationality?.trim() || null;

  const metaParts: string[] = [];
  if (bestPosition) metaParts.push(bestPosition);
  if (nationality) metaParts.push(nationality);
  if (extraMeta?.trim()) metaParts.push(extraMeta.trim());
  if (injury) metaParts.push(locale === "tr" ? "EKSİK / SAKAT" : "OUT");

  return (
    <div className={`${styles.row} ${className ?? ""}`.trim()}>
      {photoUrl ? (
        <Image className={styles.photo} src={photoUrl} alt="" width={48} height={48} />
      ) : (
        <span className={styles.photoFall} aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className={styles.copy}>
        <b>
          {star ? "★ " : ""}
          {name}
        </b>
        <small className={styles.meta}>
          {flagUrl ? (
            <Image
              className={styles.flag}
              src={flagUrl}
              alt={nationality ?? ""}
              width={18}
              height={12}
            />
          ) : null}
          <span>{metaParts.length ? metaParts.join(" · ") : "—"}</span>
          {market ? (
            <span className={styles.market} title={locale === "tr" ? "Piyasa değeri" : "Market value"}>
              {market}
            </span>
          ) : null}
        </small>
      </div>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}

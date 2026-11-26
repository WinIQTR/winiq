"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { useLanguage } from "@/components/language-provider";
import {
  readFavoriteMatchIds,
  toggleFavoriteMatchId,
} from "@/lib/member-local-prefs";
import {
  formatMatchScore,
  matchStatusLabel,
  type MatchLiveBoard,
} from "@/lib/match-live-board";

import styles from "../app/member/matches/[matchId]/member-match.module.css";

export function MemberMatchFavoriteButton({ matchId }: { matchId: number }) {
  const { t } = useLanguage();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(readFavoriteMatchIds().includes(matchId));
  }, [matchId]);

  return (
    <button
      type="button"
      className={styles.favBtn}
      data-on={on ? "true" : "false"}
      aria-pressed={on}
      aria-label={on ? t("Remove from favorites") : t("Add to favorites")}
      onClick={() => setOn(toggleFavoriteMatchId(matchId).includes(matchId))}
    >
      {on ? "★" : "☆"}
    </button>
  );
}

export function MemberMatchLiveScore({
  board,
  locale = "tr",
}: {
  board: MatchLiveBoard | null;
  locale?: "tr" | "en";
}) {
  const score = formatMatchScore(board);
  const status = matchStatusLabel(board, locale);
  if (!score && !status) return null;

  return (
    <div
      className={styles.liveScore}
      data-status={board?.status ?? "SCHEDULED"}
      aria-live="polite"
    >
      {status ? <span className={styles.liveStatus}>{status}</span> : null}
      {score ? (
        <strong className={styles.liveDigits}>{score}</strong>
      ) : board?.status === "LIVE" ? (
        <strong className={styles.liveDigits}>–</strong>
      ) : null}
    </div>
  );
}

type TabMeta = { id: string; label: string };

export function MemberMatchDetailTabs({
  tabs,
  children,
}: {
  tabs: TabMeta[];
  children: ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "summary");

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === active) && tabs[0]) {
      setActive(tabs[0].id);
    }
  }, [active, tabs]);

  if (!tabs.length) return null;

  return (
    <div className={styles.tabShell}>
      <div className={styles.tabBar} role="tablist" aria-label="Match sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={styles.tabBtn}
            data-active={active === tab.id ? "true" : "false"}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<{ "data-tab"?: string }>;
        const id = el.props["data-tab"];
        if (!id) return child;
        return (
          <div
            key={id}
            role="tabpanel"
            hidden={id !== active}
            className={styles.tabPanel}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useLanguage } from "@/components/language-provider";
import Image from "next/image";

import type {
  PredictionSettlementStatus,
  UiConfidence,
} from "@/lib/prediction-dashboard-shared";

type PredictionCardProps = {
  kickoffAt?: Date;

  leagueName?: string;

  homeTeam: string;
  awayTeam: string;

  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;

  homeRecentResults?: ("W" | "D" | "L")[];
  awayRecentResults?: ("W" | "D" | "L")[];

  homeProbability: number;
  drawProbability: number;
  awayProbability: number;

  expectedHomeGoals?: number;
  expectedAwayGoals?: number;

  bestPick: string;

  bestPickProbability?: number;

  confidence:
    UiConfidence;

  confidenceScore?: number;

  settlementStatus?:
    PredictionSettlementStatus;

  finalHomeScore?:
    number | null;

  finalAwayScore?:
    number | null;
};

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

function getResultPresentation(
  kickoffAt?: Date,
  settlementStatus?:
    PredictionSettlementStatus,
): {
  label: string;
  className: string;
} {
  const todayKey =
    toIstanbulDateKey(
      new Date(),
    );

  const matchDateKey =
    kickoffAt
      ? toIstanbulDateKey(
          kickoffAt,
        )
      : todayKey;

  if (
    matchDateKey >=
    todayKey
  ) {
    return {
      label:
        "Not settled yet",
      className:
        "prediction-result-badge prediction-result-neutral",
    };
  }

  switch (
    settlementStatus
  ) {
    case "WON":
      return {
        label: "Won",
        className:
          "prediction-result-badge prediction-result-success",
      };

    case "LOST":
      return {
        label: "Lost",
        className:
          "prediction-result-badge prediction-result-failure",
      };

    case "VOID":
      return {
        label: "Void",
        className:
          "prediction-result-badge prediction-result-neutral",
      };

    case "PENDING":
      return {
        label:
          "Result pending",
        className:
          "prediction-result-badge prediction-result-neutral",
      };

    default:
      return {
        label:
          "No archived result",
        className:
          "prediction-result-badge prediction-result-neutral",
      };
  }
}

function formatDate(
  value?: Date,
  locale: "en" | "tr" = "en",
): string {
  if (
    !value
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      timeZone:
        ISTANBUL_TIME_ZONE,
    },
  ).format(
    value,
  );
}

function formatTime(
  value?: Date,
  locale: "en" | "tr" = "en",
): string {
  if (
    !value
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-GB",
    {
      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,

      timeZone:
        ISTANBUL_TIME_ZONE,
    },
  ).format(
    value,
  );
}

function getConfidenceClass(
  confidence:
    UiConfidence,
): string {
  switch (
    confidence
  ) {
    case "Very High":
      return (
        "prediction-confidence-badge confidence-high"
      );

    case "High":
      return (
        "prediction-confidence-badge confidence-high"
      );

    case "Medium":
      return (
        "prediction-confidence-badge confidence-medium"
      );

    case "Low":
      return (
        "prediction-confidence-badge confidence-low"
      );

    case "Very Low":
      return (
        "prediction-confidence-badge confidence-low"
      );

    default:
      return (
        "prediction-confidence-badge confidence-low"
      );
  }
}

function TeamLogo({
  logo,
  team,
}: {
  logo?:
    string | null;

  team:
    string;
}) {
  if (
    logo
  ) {
    return (
      <Image
        src={logo}
        alt={`${team} logo`}
        className="team-logo"
        width={42}
        height={42}
      />
    );
  }

  return (
    <div
      className="team-logo-placeholder"
      aria-hidden="true"
    >
      {team
        .charAt(0)
        .toUpperCase()}
    </div>
  );
}

function FormIcons({
  results,
}: {
  results?: ("W" | "D" | "L")[];
}) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <span className="prediction-team-form">
      {results.map((result, index) => (
        <span
          key={index}
          className={`prediction-form-dot prediction-form-dot-${result}`}
        >
          {result}
        </span>
      ))}
    </span>
  );
}

export function PredictionCard({
  kickoffAt,

  leagueName,

  homeTeam,
  awayTeam,

  homeTeamLogo,
  awayTeamLogo,

  homeRecentResults,
  awayRecentResults,

  homeProbability,
  drawProbability,
  awayProbability,

  expectedHomeGoals,
  expectedAwayGoals,

  bestPick,

  bestPickProbability,

  confidence,
  confidenceScore,

  settlementStatus,
  finalHomeScore,
  finalAwayScore,
}: PredictionCardProps) {
  const { locale, t } = useLanguage();
  const resultPresentation =
    getResultPresentation(
      kickoffAt,
      settlementStatus,
    );

  const hasFinalScore =
    finalHomeScore !==
      undefined &&
    finalHomeScore !== null &&
    finalAwayScore !==
      undefined &&
    finalAwayScore !== null;

  return (
    <article className="prediction-card-pro prediction-card-smart">
      <header className="smart-match-meta">
        <span>{leagueName ?? (locale === "tr" ? "FUTBOL" : "FOOTBALL")}</span>
        <strong>{formatDate(kickoffAt, locale)} · {formatTime(kickoffAt, locale)}</strong>
        <span className={resultPresentation.className}>{t(resultPresentation.label)}</span>
      </header>

      <div className="smart-match-main">
        <div className="smart-team-matchup">
          <div className="prediction-team">
            <TeamLogo logo={homeTeamLogo} team={homeTeam} />
            <div><strong>{homeTeam}</strong><FormIcons results={homeRecentResults} /></div>
          </div>
          <span className="versus">VS</span>
          <div className="prediction-team">
            <TeamLogo logo={awayTeamLogo} team={awayTeam} />
            <div><strong>{awayTeam}</strong><FormIcons results={awayRecentResults} /></div>
          </div>
        </div>

        <section className="smart-best-pick">
          <div className="smart-pick-copy">
            <span>★ {locale === "tr" ? "EN İYİ ÖNERİ" : "BEST PICK"}</span>
            <strong>{t(bestPick)}</strong>
            {expectedHomeGoals !== undefined && expectedAwayGoals !== undefined ? (
              <small>xG {expectedHomeGoals.toFixed(2)} – {expectedAwayGoals.toFixed(2)}</small>
            ) : null}
          </div>
          <div className="smart-pick-score">
            <strong>%{(bestPickProbability ?? confidenceScore ?? 0).toFixed(0)}</strong>
            <span className={getConfidenceClass(confidence)}>{t(confidence)}</span>
          </div>
        </section>
      </div>

      <footer className="smart-outcome-strip">
        <span>1 <b>%{homeProbability.toFixed(1)}</b></span>
        <span>X <b>%{drawProbability.toFixed(1)}</b></span>
        <span>2 <b>%{awayProbability.toFixed(1)}</b></span>
        {hasFinalScore ? <strong>{locale === "tr" ? "Skor" : "Score"}: {finalHomeScore} – {finalAwayScore}</strong> : null}
      </footer>
    </article>
  );
}

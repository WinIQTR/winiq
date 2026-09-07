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

function getHighestOutcome(
  home: number,
  draw: number,
  away: number,
):
  | "HOME"
  | "DRAW"
  | "AWAY" {
  if (
    home >= draw &&
    home >= away
  ) {
    return "HOME";
  }

  if (
    away >= home &&
    away >= draw
  ) {
    return "AWAY";
  }

  return "DRAW";
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
  const highestOutcome =
    getHighestOutcome(
      homeProbability,
      drawProbability,
      awayProbability,
    );

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
    <article className="prediction-card-pro">
      <div className="prediction-date-column">
        <span className="date-icon">
          ◫
        </span>

        <div>
          <strong>
            {formatDate(
              kickoffAt,
              locale,
            )}
          </strong>

          <span>
            {formatTime(
              kickoffAt,
              locale,
            )}
          </span>

          {leagueName && (
            <span>
              {leagueName}
            </span>
          )}
        </div>
      </div>

      <div className="prediction-match-column">
        <div className="prediction-team-matchup">
          <div className="prediction-team">
            <TeamLogo
              logo={
                homeTeamLogo
              }
              team={
                homeTeam
              }
            />

            <strong>
              {homeTeam}
            </strong>

            <FormIcons results={homeRecentResults} />
          </div>

          <span className="versus">
            VS
          </span>

          <div className="prediction-team">
            <TeamLogo
              logo={
                awayTeamLogo
              }
              team={
                awayTeam
              }
            />

            <strong>
              {awayTeam}
            </strong>

            <FormIcons results={awayRecentResults} />
          </div>
        </div>

        <div className="prediction-best-pick">
          Top Pick:{" "}
          <strong>
            {t(bestPick)}
          </strong>

          {bestPickProbability !==
            undefined && (
            <>
              {" • "}
              %
              {bestPickProbability.toFixed(
                1,
              )}
            </>
          )}
        </div>

        {expectedHomeGoals !==
          undefined &&
          expectedAwayGoals !==
            undefined && (
            <div className="prediction-best-pick">
              xG:{" "}
              <strong>
                {expectedHomeGoals.toFixed(
                  2,
                )}
                {" - "}
                {expectedAwayGoals.toFixed(
                  2,
                )}
              </strong>
            </div>
          )}
      </div>

      <div className="prediction-outcomes">
        <div className="prediction-outcomes-header">
          <span>
            {locale === "tr"
              ? "MAÇ SONUCU OLASILIKLARI"
              : "MATCH RESULT PROBABILITIES"}
          </span>
          <b>1X2</b>
        </div>
        <div
          className={
            highestOutcome ===
            "HOME"
              ? "outcome-box outcome-box-active"
              : "outcome-box"
          }
        >
          <span>{locale === "tr" ? "MS 1 · EV SAHİBİ" : "1 · HOME"}</span>

          <strong>
            %
            {homeProbability.toFixed(
              1,
            )}
          </strong>
        </div>

        <div
          className={
            highestOutcome ===
            "DRAW"
              ? "outcome-box outcome-box-active"
              : "outcome-box"
          }
        >
          <span>{locale === "tr" ? "MS 0 · BERABERLİK" : "X · DRAW"}</span>

          <strong>
            %
            {drawProbability.toFixed(
              1,
            )}
          </strong>
        </div>

        <div
          className={
            highestOutcome ===
            "AWAY"
              ? "outcome-box outcome-box-active"
              : "outcome-box"
          }
        >
          <span>{locale === "tr" ? "MS 2 · DEPLASMAN" : "2 · AWAY"}</span>

          <strong>
            %
            {awayProbability.toFixed(
              1,
            )}
          </strong>
        </div>
      </div>

      <div className="prediction-confidence-column">
        <span
          className={
            getConfidenceClass(
              confidence,
            )
          }
        >
          {t(confidence)}
        </span>

        {confidenceScore !==
          undefined && (
          <small>
            Top Pick Confidence:{" "}
            {confidenceScore.toFixed(
              0,
            )}
            /100
          </small>
        )}

        <span
          className={
            resultPresentation.className
          }
        >
          {
            t(resultPresentation.label)
          }
        </span>

        {hasFinalScore && (
          <small>
            Final Score:{" "}
            {finalHomeScore}
            {" - "}
            {finalAwayScore}
          </small>
        )}
      </div>
    </article>
  );
}

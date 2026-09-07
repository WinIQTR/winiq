"use client";

import { useState } from "react";
import Image from "next/image";

type PlayerRow = {
  id: number;
  name: string;
  position: string;
  detailedPosition: string | null;
  photoUrl: string | null;
  seasonStatistics: {
    appearances: number;
    starts: number;
    minutes: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    averageRating: number | null;
  }[];
  injuries?: {
    status: string;
    injuryType: string | null;
  }[];
};

const POSITION_GROUPS = [
  "GOALKEEPER",
  "DEFENDER",
  "MIDFIELDER",
  "FORWARD",
  "UNKNOWN",
] as const;

type PositionGroup = (typeof POSITION_GROUPS)[number];

function positionShortLabel(position: PositionGroup): string {
  switch (position) {
    case "GOALKEEPER":
      return "Kaleci";
    case "DEFENDER":
      return "Defans";
    case "MIDFIELDER":
      return "Orta Saha";
    case "FORWARD":
      return "Forvet";
    case "UNKNOWN":
      return "Bilinmiyor";
  }
}

function formatPosition(position: string): string {
  switch (position) {
    case "GOALKEEPER":
      return "Kaleci";
    case "DEFENDER":
      return "Defans";
    case "MIDFIELDER":
      return "Orta Saha";
    case "FORWARD":
      return "Forvet";
    default:
      return "Bilinmiyor";
  }
}

export function PlayerPositionAccordion({
  players,
  idealXiIds,
}: {
  players: PlayerRow[];
  idealXiIds: number[];
}) {
  const [openGroup, setOpenGroup] = useState<PositionGroup | null>(null);

  const idealXiSet = new Set(idealXiIds);

  const grouped = new Map<PositionGroup, PlayerRow[]>();
  for (const group of POSITION_GROUPS) {
    grouped.set(group, []);
  }

  for (const player of players) {
    const key: PositionGroup =
      player.position === "GOALKEEPER" ||
      player.position === "DEFENDER" ||
      player.position === "MIDFIELDER" ||
      player.position === "FORWARD"
        ? player.position
        : "UNKNOWN";

    grouped.get(key)?.push(player);
  }

  const visibleGroups = POSITION_GROUPS.filter(
    (group) => (grouped.get(group)?.length ?? 0) > 0,
  );

  const rowsForGroup = (group: PositionGroup): PlayerRow[] =>
    grouped.get(group) ?? [];

  return (
    <div className="players-accordion">
      {visibleGroups.map((group) => {
        const rows = rowsForGroup(group);
        const isOpen = openGroup === group;

        return (
          <div key={group} className="players-accordion-section">
            <button
              type="button"
              className={
                isOpen
                  ? "players-accordion-header players-accordion-header-open"
                  : "players-accordion-header"
              }
              onClick={() => setOpenGroup(isOpen ? null : group)}
              aria-expanded={isOpen}
            >
              <span>{positionShortLabel(group)}</span>
              <strong>{rows.length}</strong>
              <span className="players-accordion-chevron" aria-hidden="true">
                {isOpen ? "▾" : "▸"}
              </span>
            </button>

            {isOpen && (
              rows.length === 0 ? (
                <p className="table-search-empty">
                  Bu kategoride oyuncu bulunamadı.
                </p>
              ) : (
                <div className="players-table">
                  <div className="players-row players-header-row">
                    <span>Oyuncu</span>
                    <span>Pozisyon</span>
                    <span>Maç</span>
                    <span>İlk 11</span>
                    <span>Sonradan</span>
                    <span>Gol / Asist</span>
                    <span>Kart</span>
                    <span>Form</span>
                  </div>

                  {rows.map((player) => (
                    <div
                      className={
                        idealXiSet.has(player.id)
                          ? "players-row player-ideal-row"
                          : "players-row"
                      }
                      key={player.id}
                    >
                      <div className="player-identity">
                        {player.photoUrl ? (
                          <Image
                            src={player.photoUrl}
                            alt={`${player.name} player photo`}
                            className="player-photo"
                            width={43}
                            height={43}
                          />
                        ) : (
                          <div className="player-photo-placeholder">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <strong>{player.name}</strong>

                          {idealXiSet.has(player.id) ? (
                            <span className="ideal-xi-badge">İDEAL 11</span>
                          ) : null}

                          {(() => {
                            const activeInjury = player.injuries?.[0];
                            if (!activeInjury) return null;
                            const label =
                              activeInjury.status === "DOUBTFUL"
                                ? "ŞÜPHELİ"
                                : "SAKAT";
                            return (
                              <span
                                className="injury-badge"
                                title={activeInjury.injuryType ?? undefined}
                              >
                                {label}
                              </span>
                            );
                          })()}

                          {player.detailedPosition ? (
                            <span>{player.detailedPosition}</span>
                          ) : null}
                        </div>
                      </div>

                      <span>{formatPosition(player.position)}</span>

                      {(() => {
                        const stats = player.seasonStatistics[0];
                        const appearances = stats?.appearances ?? 0;
                        const starts = stats?.starts ?? 0;
                        return (
                          <>
                            <strong>{appearances}</strong>
                            <span>{starts}</span>
                            <span>{Math.max(appearances - starts, 0)}</span>
                            <span className="player-form-cell">
                              <strong>
                                {stats?.goals ?? 0} / {stats?.assists ?? 0}
                              </strong>
                              <small>G / A</small>
                            </span>
                            <span className="player-form-cell">
                              <strong>
                                {stats?.yellowCards ?? 0} / {stats?.redCards ?? 0}
                              </strong>
                              <small>S / K</small>
                            </span>
                            <span className="player-form-cell">
                              <strong>
                                {stats?.averageRating?.toFixed(1) ?? "—"}
                              </strong>
                              <small>{stats?.minutes ?? 0} dk.</small>
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

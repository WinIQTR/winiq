import type { ReactNode } from "react";

/** Compact vector monograms for major competitions; fallback to raster logo. */
export function LeagueMark({
  apiId,
  name,
  logoUrl,
  className,
}: {
  apiId: number | null | undefined;
  name: string;
  logoUrl?: string | null;
  className?: string;
}): ReactNode {
  const mark = apiId != null ? MARKS[apiId] : null;
  if (mark) {
    return (
      <span className={className} title={name} aria-hidden="true" data-league={apiId}>
        {mark}
      </span>
    );
  }

  if (logoUrl) {
    return (
      <span className={className}>
        {/* Raster fallback when no vector monogram is defined */}
        <img src={logoUrl} alt="" width={28} height={28} />
      </span>
    );
  }

  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 28 28">
        <rect width="28" height="28" rx="8" fill="#12283c" stroke="#1e3b52" />
        <text x="14" y="18" textAnchor="middle" fill="#8eabc2" fontSize="10" fontWeight="800">
          {(name.slice(0, 2) || "LG").toUpperCase()}
        </text>
      </svg>
    </span>
  );
}

const MARKS: Record<number, ReactNode> = {
  // Premier League
  39: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#3d195b" />
      <path d="M8 20 V9 h5.2c2.4 0 3.9 1.2 3.9 3.1 0 1.5-.9 2.5-2.3 2.9L18.5 20h-2.5l-3.2-4.6H10.2V20H8zm2.2-6.4h2.7c1.2 0 1.9-.6 1.9-1.5s-.7-1.4-1.9-1.4h-2.7v2.9z" fill="#fff" />
      <circle cx="20.5" cy="9.5" r="1.6" fill="#00ff85" />
    </svg>
  ),
  // La Liga
  140: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#ff4b44" />
      <text x="14" y="18" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900">
        LL
      </text>
    </svg>
  ),
  // Serie A
  135: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#024494" />
      <text x="14" y="18" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="900">
        SA
      </text>
    </svg>
  ),
  // Bundesliga
  78: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#d20515" />
      <text x="14" y="18" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="900">
        BL
      </text>
    </svg>
  ),
  // Ligue 1
  61: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#091c3e" />
      <text x="14" y="18" textAnchor="middle" fill="#dae025" fontSize="8" fontWeight="900">
        L1
      </text>
    </svg>
  ),
  // Süper Lig
  203: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#e30613" />
      <text x="14" y="18" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="900">
        SL
      </text>
    </svg>
  ),
  // UCL
  2: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#0a1e46" />
      <circle cx="14" cy="14" r="7.2" fill="none" stroke="#1a4cff" strokeWidth="1.4" strokeDasharray="1.6 1.4" />
      <text x="14" y="17" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="900">
        UCL
      </text>
    </svg>
  ),
  // UEL
  3: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#1b1533" />
      <text x="14" y="18" textAnchor="middle" fill="#f5a623" fontSize="7" fontWeight="900">
        UEL
      </text>
    </svg>
  ),
  // UECL
  848: (
    <svg viewBox="0 0 28 28">
      <rect width="28" height="28" rx="8" fill="#0d2a24" />
      <text x="14" y="18" textAnchor="middle" fill="#6ee7b7" fontSize="7" fontWeight="900">
        UECL
      </text>
    </svg>
  ),
};

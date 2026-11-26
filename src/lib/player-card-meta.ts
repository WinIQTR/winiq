/**
 * Display helpers for squad / top-scorer cards.
 * Never invent market values or positions — only format what the DB has.
 */

/** API-Football nationality string → media.api-sports.io flag code (display only). */
const NATIONALITY_FLAG_CODE: Record<string, string> = {
  albania: "al",
  algeria: "dz",
  argentina: "ar",
  armenia: "am",
  australia: "au",
  austria: "at",
  azerbaijan: "az",
  belgium: "be",
  bosnia: "ba",
  "bosnia-herzegovina": "ba",
  "bosnia and herzegovina": "ba",
  brazil: "br",
  bulgaria: "bg",
  cameroon: "cm",
  canada: "ca",
  chile: "cl",
  china: "cn",
  colombia: "co",
  croatia: "hr",
  "czech republic": "cz",
  czechia: "cz",
  denmark: "dk",
  ecuador: "ec",
  egypt: "eg",
  england: "gb-eng",
  finland: "fi",
  france: "fr",
  georgia: "ge",
  germany: "de",
  ghana: "gh",
  greece: "gr",
  hungary: "hu",
  iceland: "is",
  iran: "ir",
  iraq: "iq",
  ireland: "ie",
  "republic of ireland": "ie",
  israel: "il",
  italy: "it",
  "ivory coast": "ci",
  "cote d'ivoire": "ci",
  jamaica: "jm",
  japan: "jp",
  kazakhstan: "kz",
  korea: "kr",
  "south korea": "kr",
  "korea republic": "kr",
  kosovo: "xk",
  latvia: "lv",
  lithuania: "lt",
  luxembourg: "lu",
  mali: "ml",
  mexico: "mx",
  moldova: "md",
  montenegro: "me",
  morocco: "ma",
  netherlands: "nl",
  "new zealand": "nz",
  nigeria: "ng",
  "north macedonia": "mk",
  macedonia: "mk",
  northernireland: "gb-nir",
  "northern ireland": "gb-nir",
  norway: "no",
  paraguay: "py",
  peru: "pe",
  poland: "pl",
  portugal: "pt",
  romania: "ro",
  russia: "ru",
  scotland: "gb-sct",
  senegal: "sn",
  serbia: "rs",
  slovakia: "sk",
  slovenia: "si",
  spain: "es",
  sweden: "se",
  switzerland: "ch",
  tunisia: "tn",
  turkey: "tr",
  türkiye: "tr",
  ukraine: "ua",
  uruguay: "uy",
  usa: "us",
  "united states": "us",
  venezuela: "ve",
  wales: "gb-wls",
};

const COARSE_POSITION_TR: Record<string, string> = {
  GOALKEEPER: "Kaleci",
  DEFENDER: "Defans",
  MIDFIELDER: "Orta saha",
  FORWARD: "Forvet",
  UNKNOWN: "Belirsiz",
};

const DETAILED_POSITION_TR: Record<string, string> = {
  Goalkeeper: "Kaleci",
  Defender: "Defans",
  Midfielder: "Orta saha",
  Attacker: "Forvet",
  Forward: "Forvet",
  G: "Kaleci",
  D: "Defans",
  M: "Orta saha",
  F: "Forvet",
};

export type PlayerCardIdentitySource = {
  nationality?: string | null;
  position?: string | null;
  detailedPosition?: string | null;
  marketValue?: { toString(): string } | number | string | null;
  marketValueCurrency?: string | null;
  country?: { name?: string | null; code?: string | null; flagUrl?: string | null } | null;
};

export function resolvePlayerFlagUrl(source: PlayerCardIdentitySource): string | null {
  const fromCountry = source.country?.flagUrl?.trim();
  if (fromCountry) return fromCountry;

  const codeFromCountry = source.country?.code?.trim().toLowerCase();
  if (codeFromCountry) {
    return `https://media.api-sports.io/flags/${codeFromCountry}.svg`;
  }

  const nationality = source.nationality?.trim();
  if (!nationality) return null;
  const mapped = NATIONALITY_FLAG_CODE[nationality.toLowerCase()];
  if (!mapped) return null;
  return `https://media.api-sports.io/flags/${mapped}.svg`;
}

/** Best known position label — prefers API detailedPosition, else coarse enum. */
export function resolveBestPositionLabel(
  source: PlayerCardIdentitySource,
  locale: "tr" | "en" = "tr",
): string | null {
  const detailed = source.detailedPosition?.trim();
  if (detailed) {
    if (locale === "tr") return DETAILED_POSITION_TR[detailed] ?? detailed;
    return detailed;
  }
  const coarse = source.position?.trim();
  if (!coarse || coarse === "UNKNOWN") return null;
  if (locale === "tr") return COARSE_POSITION_TR[coarse] ?? coarse;
  return coarse.charAt(0) + coarse.slice(1).toLowerCase();
}

export function formatPlayerMarketValue(source: PlayerCardIdentitySource): string | null {
  if (source.marketValue == null) return null;
  const raw =
    typeof source.marketValue === "number"
      ? source.marketValue
      : Number(source.marketValue.toString());
  if (!Number.isFinite(raw) || raw <= 0) return null;

  const currency = (source.marketValueCurrency ?? "EUR").toUpperCase();
  const abs = Math.abs(raw);
  let scaled: string;
  if (abs >= 1_000_000) scaled = `${trimNum(raw / 1_000_000)}M`;
  else if (abs >= 1_000) scaled = `${trimNum(raw / 1_000)}K`;
  else scaled = trimNum(raw);

  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${scaled}`;
}

function trimNum(value: number) {
  const fixed = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return fixed.replace(/\.0$/, "");
}

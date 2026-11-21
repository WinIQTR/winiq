/**
 * Host country + neutral venue as first-class prediction inputs.
 */

export type VenueContextInput = {
  venueName?: string | null;
  venueCity?: string | null;
  homeTeamName?: string | null;
  homeTeamCity?: string | null;
  homeCountry?: string | null;
  competitionCountry?: string | null;
  /** Explicit flag from feed when present. */
  neutralFlag?: boolean | null;
};

export type VenueContext = {
  venueName: string | null;
  venueCity: string | null;
  hostCountry: string | null;
  isNeutral: boolean;
  homeAdvantageFactor: number;
  notes: string[];
};

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function includesLoose(haystack: string | null, needle: string | null): boolean {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function resolveVenueContext(input: VenueContextInput): VenueContext {
  const venueName = normalize(input.venueName);
  const venueCity = normalize(input.venueCity);
  const hostCountry =
    normalize(input.competitionCountry) ??
    normalize(input.homeCountry) ??
    null;
  const notes: string[] = [];

  let isNeutral = input.neutralFlag === true;
  if (input.neutralFlag == null) {
    const homeCity = normalize(input.homeTeamCity);
    if (venueCity && homeCity && !includesLoose(venueCity, homeCity)) {
      // Soft signal only — do not force neutral without feed flag.
      notes.push("Venue city differs from home team city (advisory).");
    }
    if (
      venueName &&
      /neutral|international|olympic|world cup|final/i.test(venueName)
    ) {
      isNeutral = true;
      notes.push("Venue name suggests a neutral site.");
    }
  }

  if (isNeutral) {
    notes.push("Neutral venue: home advantage factor reduced to 0.");
  }

  return {
    venueName,
    venueCity,
    hostCountry,
    isNeutral,
    homeAdvantageFactor: isNeutral ? 0 : 1,
    notes,
  };
}

export type MatchWeatherSummary = {
  temperatureC: number | null;
  condition: string | null;
  windKmh: number | null;
  text: string;
  icon: "sun" | "cloud" | "rain" | "wind" | "unknown";
};

type GeoResult = { latitude: number; longitude: number };
type ForecastHour = {
  time: string[];
  temperature_2m: number[];
  weathercode: number[];
  windspeed_10m: number[];
};

const geoCache = new Map<string, GeoResult | null>();
const forecastCache = new Map<string, MatchWeatherSummary | null>();

const WMO: Record<number, { en: string; tr: string; icon: MatchWeatherSummary["icon"] }> = {
  0: { en: "Clear", tr: "Açık", icon: "sun" },
  1: { en: "Mainly clear", tr: "Çoğunlukla açık", icon: "sun" },
  2: { en: "Partly cloudy", tr: "Parçalı bulutlu", icon: "cloud" },
  3: { en: "Overcast", tr: "Kapalı", icon: "cloud" },
  45: { en: "Fog", tr: "Sis", icon: "cloud" },
  48: { en: "Fog", tr: "Sis", icon: "cloud" },
  51: { en: "Drizzle", tr: "Hafif çisenti", icon: "rain" },
  53: { en: "Drizzle", tr: "Çisenti", icon: "rain" },
  55: { en: "Drizzle", tr: "Yoğun çisenti", icon: "rain" },
  61: { en: "Rain", tr: "Yağmur", icon: "rain" },
  63: { en: "Rain", tr: "Yağmur", icon: "rain" },
  65: { en: "Heavy rain", tr: "Şiddetli yağmur", icon: "rain" },
  71: { en: "Snow", tr: "Kar", icon: "cloud" },
  80: { en: "Showers", tr: "Sağanak", icon: "rain" },
  81: { en: "Showers", tr: "Sağanak", icon: "rain" },
  82: { en: "Heavy showers", tr: "Şiddetli sağanak", icon: "rain" },
  95: { en: "Thunderstorm", tr: "Fırtına", icon: "rain" },
};

function istanbulDay(kickoffAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(kickoffAt);
}

function istanbulHour(kickoffAt: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      hour12: false,
    }).format(kickoffAt),
  );
}

function summarize(
  temperatureC: number,
  code: number,
  windKmh: number,
  locale: "tr" | "en",
): MatchWeatherSummary {
  const meta = WMO[code] ?? { en: "Forecast", tr: "Tahmin", icon: "unknown" as const };
  const condition = locale === "tr" ? meta.tr : meta.en;
  const parts = [
    `${Math.round(temperatureC)}°C`,
    condition,
    windKmh >= 20 ? `${Math.round(windKmh)} km/s` : null,
  ].filter(Boolean);

  return {
    temperatureC,
    condition,
    windKmh,
    icon: meta.icon,
    text: parts.join(" · "),
  };
}

async function geocodeCity(city: string): Promise<GeoResult | null> {
  const key = city.trim().toLocaleLowerCase("en-US");
  if (!key) return null;
  if (geoCache.has(key)) return geoCache.get(key) ?? null;

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", city.trim());
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      geoCache.set(key, null);
      return null;
    }
    const json = (await response.json()) as {
      results?: Array<{ latitude: number; longitude: number }>;
    };
    const hit = json.results?.[0];
    const value = hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
    geoCache.set(key, value);
    return value;
  } catch {
    geoCache.set(key, null);
    return null;
  }
}

async function fetchForecast(
  geo: GeoResult,
  kickoffAt: Date,
  locale: "tr" | "en",
): Promise<MatchWeatherSummary | null> {
  const day = istanbulDay(kickoffAt);
  const cacheKey = `${geo.latitude},${geo.longitude}|${day}|${istanbulHour(kickoffAt)}|${locale}`;
  if (forecastCache.has(cacheKey)) return forecastCache.get(cacheKey) ?? null;

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(geo.latitude));
    url.searchParams.set("longitude", String(geo.longitude));
    url.searchParams.set("hourly", "temperature_2m,weathercode,windspeed_10m");
    url.searchParams.set("timezone", "Europe/Istanbul");
    url.searchParams.set("start_date", day);
    url.searchParams.set("end_date", day);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      forecastCache.set(cacheKey, null);
      return null;
    }

    const json = (await response.json()) as { hourly?: ForecastHour };
    const hourly = json.hourly;
    if (!hourly?.time?.length) {
      forecastCache.set(cacheKey, null);
      return null;
    }

    const hour = istanbulHour(kickoffAt);
    let index = hourly.time.findIndex((time) => Number(time.slice(11, 13)) === hour);
    if (index < 0) index = Math.min(hour, hourly.time.length - 1);

    const temperatureC = hourly.temperature_2m[index];
    const code = hourly.weathercode[index];
    const windKmh = hourly.windspeed_10m[index] ?? 0;
    if (temperatureC == null || code == null) {
      forecastCache.set(cacheKey, null);
      return null;
    }

    const summary = summarize(temperatureC, code, windKmh, locale);
    forecastCache.set(cacheKey, summary);
    return summary;
  } catch {
    forecastCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Kickoff weather for a venue city via Open-Meteo (no API key).
 * API-Football fixtures do not include weather; this fills the Hava column.
 */
export async function resolveMatchWeatherBatch(
  matches: Array<{
    matchId: number;
    kickoffAt: Date;
    venueCity: string | null | undefined;
  }>,
  options?: { locale?: "tr" | "en"; maxFetches?: number },
): Promise<Map<number, MatchWeatherSummary>> {
  const locale = options?.locale ?? "tr";
  const maxFetches = options?.maxFetches ?? 24;
  const result = new Map<number, MatchWeatherSummary>();
  const horizonMs = 10 * 86_400_000;

  const eligible = matches.filter((match) => {
    const city = match.venueCity?.trim();
    if (!city) return false;
    const delta = match.kickoffAt.getTime() - Date.now();
    // Keep current-week past kickoffs and upcoming fixtures within Open-Meteo range.
    return delta >= -7 * 86_400_000 && delta <= horizonMs;
  });

  const uniqueCities: string[] = [];
  for (const match of eligible) {
    const city = match.venueCity!.trim();
    const key = city.toLocaleLowerCase("en-US");
    if (uniqueCities.some((item) => item.toLocaleLowerCase("en-US") === key)) continue;
    uniqueCities.push(city);
    if (uniqueCities.length >= maxFetches) break;
  }

  await Promise.all(uniqueCities.map((city) => geocodeCity(city)));

  await Promise.all(
    eligible.map(async (match) => {
      const city = match.venueCity!.trim();
      const geo = geoCache.get(city.toLocaleLowerCase("en-US"));
      if (!geo) return;
      const weather = await fetchForecast(geo, match.kickoffAt, locale);
      if (weather) result.set(match.matchId, weather);
    }),
  );

  return result;
}

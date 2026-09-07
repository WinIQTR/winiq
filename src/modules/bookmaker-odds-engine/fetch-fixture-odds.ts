
import type {
  ApiFootballOddsResponse,
} from "./types";

export async function fetchFixtureOdds(
  options: {
    apiKey: string;
    baseUrl: string;
    fixtureApiId: number;
  },
): Promise<ApiFootballOddsResponse> {
  const url =
    new URL(
      "/odds",
      options.baseUrl,
    );

  url.searchParams.set(
    "fixture",
    String(
      options.fixtureApiId,
    ),
  );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          "x-apisports-key":
            options.apiKey,
        },
      },
    );

  const responseText =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      [
        "API-Football odds isteği başarısız.",
        `HTTP ${response.status}.`,
        responseText,
      ].join(
        " ",
      ),
    );
  }

  let parsedResponse:
    ApiFootballOddsResponse;

  try {
    parsedResponse =
      JSON.parse(
        responseText,
      ) as ApiFootballOddsResponse;
  } catch {
    throw new Error(
      "API-Football odds yanıtı geçerli JSON değil.",
    );
  }

  if (
    Object.keys(
      parsedResponse.errors ??
        {},
    ).length >
    0
  ) {
    throw new Error(
      `API-Football odds hatası: ${JSON.stringify(
        parsedResponse.errors,
      )}`,
    );
  }

  return parsedResponse;
}
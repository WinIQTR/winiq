import "dotenv/config";

const API_FOOTBALL_BASE_URL =
  process.env.API_FOOTBALL_BASE_URL ??
  "https://v3.football.api-sports.io";

const API_FOOTBALL_KEY =
  process.env.API_FOOTBALL_KEY;

/*
 * Free plan ve düşük istek limitlerinde
 * çağrıları birbirinden ayırır.
 *
 * İleride ücretli plana geçince .env içine:
 *
 * API_FOOTBALL_MIN_INTERVAL_MS="1000"
 *
 * gibi daha düşük bir değer yazılabilir.
 */
const API_FOOTBALL_MIN_INTERVAL_MS =
  Number(
    process.env
      .API_FOOTBALL_MIN_INTERVAL_MS ??
      "7000",
  );

const MAX_RETRY_COUNT = 5;

type ApiFootballParameters = Record<
  string,
  string | number | boolean | undefined
>;

export type ApiFootballResponse<T> = {
  get: string;

  parameters: Record<
    string,
    string
  >;

  errors:
    | Record<string, string>
    | string[];

  results: number;

  paging: {
    current: number;
    total: number;
  };

  response: T;
};

export class ApiFootballError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);

    this.name =
      "ApiFootballError";
  }
}

let lastRequestStartedAt = 0;

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

async function waitForRateLimit(): Promise<void> {
  if (
    !Number.isFinite(
      API_FOOTBALL_MIN_INTERVAL_MS,
    ) ||
    API_FOOTBALL_MIN_INTERVAL_MS <= 0
  ) {
    return;
  }

  const elapsed =
    Date.now() -
    lastRequestStartedAt;

  const remaining =
    API_FOOTBALL_MIN_INTERVAL_MS -
    elapsed;

  if (remaining > 0) {
    await sleep(remaining);
  }

  lastRequestStartedAt =
    Date.now();
}

function getRetryDelay(
  response: Response,
  attempt: number,
): number {
  const retryAfter =
    response.headers.get(
      "retry-after",
    );

  if (retryAfter) {
    const seconds =
      Number(retryAfter);

    if (
      Number.isFinite(seconds) &&
      seconds > 0
    ) {
      return seconds * 1000;
    }

    const retryDate =
      new Date(
        retryAfter,
      );

    if (
      !Number.isNaN(
        retryDate.getTime(),
      )
    ) {
      return Math.max(
        retryDate.getTime() -
          Date.now(),
        1000,
      );
    }
  }

  /*
   * Kademeli bekleme:
   *
   * 15 sn
   * 30 sn
   * 60 sn
   * 120 sn
   * 240 sn
   */
  return (
    15_000 *
    2 ** attempt
  );
}

export async function apiFootballRequest<T>(
  endpoint: string,
  parameters: ApiFootballParameters = {},
): Promise<ApiFootballResponse<T>> {
  if (!API_FOOTBALL_KEY) {
    throw new ApiFootballError(
      "API_FOOTBALL_KEY .env dosyasında tanımlı değil.",
    );
  }

  const url =
    new URL(
      endpoint.replace(
        /^\/+/,
        "",
      ),
      `${API_FOOTBALL_BASE_URL}/`,
    );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      parameters,
    )
  ) {
    if (
      value !== undefined
    ) {
      url.searchParams.set(
        key,
        String(value),
      );
    }
  }

  for (
    let attempt = 0;
    attempt <= MAX_RETRY_COUNT;
    attempt += 1
  ) {
    await waitForRateLimit();

    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            "x-apisports-key":
              API_FOOTBALL_KEY,
          },

          cache:
            "no-store",
        },
      );

    if (
      response.status === 429
    ) {
      if (
        attempt >=
        MAX_RETRY_COUNT
      ) {
        throw new ApiFootballError(
          "API-Football istek sınırı aşıldı. Maksimum yeniden deneme sayısına ulaşıldı.",
          429,
        );
      }

      const delay =
        getRetryDelay(
          response,
          attempt,
        );

      console.warn(
        `API hız sınırı: ${Math.ceil(
          delay / 1000,
        )} saniye beklenecek. Deneme ${
          attempt + 1
        }/${MAX_RETRY_COUNT}.`,
      );

      await sleep(delay);

      continue;
    }

    if (!response.ok) {
      const responseText =
        await response
          .text()
          .catch(
            () => "",
          );

      throw new ApiFootballError(
        [
          `API-Football isteği başarısız:`,
          `${response.status}`,
          response.statusText,
          responseText
            ? `• ${responseText}`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        response.status,
      );
    }

    const data =
      (await response.json()) as
        ApiFootballResponse<T>;

    const hasErrors =
      Array.isArray(
        data.errors,
      )
        ? data.errors.length >
          0
        : Object.keys(
            data.errors ?? {},
          ).length > 0;

    if (hasErrors) {
      throw new ApiFootballError(
        `API-Football hata döndürdü: ${JSON.stringify(
          data.errors,
        )}`,
      );
    }

    return data;
  }

  throw new ApiFootballError(
    "API-Football isteği beklenmeyen şekilde tamamlanamadı.",
  );
}
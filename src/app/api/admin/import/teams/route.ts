import { NextRequest, NextResponse } from "next/server";

import { ApiFootballError } from "@/lib/api-football/client";
import { getCurrentUser } from "@/lib/auth-session";
import { checkInMemoryRateLimit } from "@/lib/in-memory-rate-limit";
import { importTeamsFromApiFootball } from "@/modules/importer/football/api-football/import-teams";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  const rateLimit = checkInMemoryRateLimit(
    `import-teams:${user.id}`,
    5,
    60_000,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: `Çok fazla istek. ${rateLimit.retryAfterSeconds} saniye sonra tekrar deneyin.`,
      },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      leagueId?: unknown;
      season?: unknown;
    };

    const leagueId = Number(body.leagueId);

    const season =
      body.season === undefined || body.season === null
        ? undefined
        : Number(body.season);

    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "leagueId pozitif bir tam sayı olmalıdır.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      season !== undefined &&
      (!Number.isInteger(season) || season < 2000 || season > 2100)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "season geçerli bir yıl olmalıdır.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await importTeamsFromApiFootball(leagueId, season);

    return NextResponse.json({
      success: true,
      message: "Takımlar başarıyla içe aktarıldı.",
      result,
    });
  } catch (error) {
    console.error("Takım import hatası:", error);

    const message =
      error instanceof ApiFootballError || error instanceof Error
        ? error.message
        : "Bilinmeyen bir hata oluştu.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 500,
      },
    );
  }
}

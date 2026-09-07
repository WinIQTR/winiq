import { NextRequest, NextResponse } from "next/server";

import { ApiFootballError } from "@/lib/api-football/client";
import { getCurrentUser } from "@/lib/auth-session";
import { checkInMemoryRateLimit } from "@/lib/in-memory-rate-limit";
import { importLeagueFromApiFootball } from "@/modules/importer/football/api-football/import-league";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  const rateLimit = checkInMemoryRateLimit(
    `import-league:${user.id}`,
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
    };

    const leagueId = Number(body.leagueId);

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

    const result = await importLeagueFromApiFootball(leagueId);

    return NextResponse.json({
      success: true,
      message: "Lig ve sezon bilgileri başarıyla içe aktarıldı.",
      result,
    });
  } catch (error) {
    console.error("Lig import hatası:", error);

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

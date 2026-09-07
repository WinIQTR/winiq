import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-session";

import {
  ApiFootballError,
  apiFootballRequest,
} from "@/lib/api-football/client";

type ApiStatus = {
  account: {
    firstname?: string;
    lastname?: string;
    email?: string;
  };
  subscription: {
    plan?: string;
    end?: string;
    active?: boolean;
  };
  requests: {
    current?: number;
    limit_day?: number;
  };
};

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  try {
    const data = await apiFootballRequest<ApiStatus>("status");

    return NextResponse.json({
      success: true,
      message: "API-Football bağlantısı başarılı.",
      results: data.results,
      status: data.response,
    });
  } catch (error) {
    const message =
      error instanceof ApiFootballError
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

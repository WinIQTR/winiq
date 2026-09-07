export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "bet-project",
      version: "v3.4",
      timestamp: new Date().toISOString(),
      productionModel: "LOCKED",
    }),
    { status: 200, headers },
  );
}

export async function HEAD(): Promise<Response> {
  return new Response(null, { status: 200, headers });
}

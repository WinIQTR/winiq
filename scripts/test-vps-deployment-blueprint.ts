import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function main(): Promise<void> {
  const root = process.cwd();
  const dockerfile = await readFile(
    join(root, "deploy", "Dockerfile.production"),
    "utf8",
  );
  const dockerignore = await readFile(
    join(root, "deploy", "Dockerfile.production.dockerignore"),
    "utf8",
  );
  const compose = await readFile(
    join(root, "deploy", "compose.production.yaml"),
    "utf8",
  );
  const caddy = await readFile(
    join(root, "deploy", "Caddyfile.production"),
    "utf8",
  );
  const environment = await readFile(
    join(root, "deploy", ".env.production.example"),
    "utf8",
  );

  assert.match(dockerfile, /FROM node:24-bookworm-slim/);
  assert.match(dockerfile, /postgresql-client-17/);
  assert.match(dockerfile, /--mount=type=secret,id=production_env/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /\/api\/health/);
  assert.doesNotMatch(dockerfile, /COPY \.env/);

  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^node_modules$/m);

  assert.match(compose, /production_data:\/srv\/bet-project-data/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/);
  assert.match(compose, /file: \.env\.production/);
  assert.doesNotMatch(compose, /DATABASE_URL:/);
  assert.doesNotMatch(compose, /API_FOOTBALL_KEY:/);

  assert.match(caddy, /\{\$APP_DOMAIN\}/);
  assert.match(caddy, /reverse_proxy app:3000/);
  assert.match(caddy, /X-Content-Type-Options/);

  assert.match(environment, /sslmode=require/);
  assert.match(environment, /PRODUCTION_DEPLOYMENT_APPROVED=false/);
  assert.match(environment, /PRODUCTION_NOTIFICATION_DELIVERY_ENABLED=false/);
  assert.doesNotMatch(environment, /api-secret|database-password/i);

  console.log("Hetzner and Neon Deployment Blueprint V4.3.1 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

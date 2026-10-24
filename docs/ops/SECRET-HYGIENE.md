# Secret hygiene (UX audit item 4)

## In-repo rules (done)

- Never commit `.env`, `.env.*` (except `*.example`), or `data/operations/netlify-production.env`.
- These paths are gitignored. If a secret was ever committed historically, treat it as leaked and rotate.
- Local Netlify ops env: `data/operations/netlify-production.env` (gitignored).
- Netlify site env (source of truth for www.winiq.net): site `relaxed-tapioca-1acc81` → Site configuration → Environment variables.

## Verify nothing sensitive is tracked

```powershell
cd C:\Users\FMGammon\Desktop\bet-project
git ls-files .env .env.* data/operations/netlify-production.env
# Expected: empty output
```

If anything appears: `git rm --cached <file>` (keep local file), confirm `.gitignore`, commit the removal, then rotate.

## USER-ONLY: rotate API-Football key (do not invent keys in git)

Agents must **not** create or paste new API keys. Account owner rotates in the dashboard:

1. Open https://dashboard.api-football.com/  
2. Sign in with the WinIQ Ultra account.  
3. Go to **Account** → **My Access** (or **API Key** / subscription key panel — label may vary slightly).  
4. Use **Regenerate** / **Reset key** (or create a new key and disable the old one).  
5. Copy the new key once; store it only in:
   - Netlify → `relaxed-tapioca-1acc81` → Environment variables → `API_FOOTBALL_KEY`
   - Local gitignored `data/operations/netlify-production.env` → `API_FOOTBALL_KEY=...`
   - Local `.env` if used for `pnpm run dev` (gitignored)
6. Redeploy or restart local so the new value is loaded.
7. Confirm: signed-in admin → `/api/football/status` shows Ultra / active.

## USER-ONLY: rotate Neon / DATABASE_URL password

1. Open Neon console for the WinIQ project.  
2. Reset the role password (or rotate connection string).  
3. Update `DATABASE_URL` in Netlify env + local gitignored ops/`.env`.  
4. Redeploy / restart.

## After any rotate

1. Update Netlify production env.  
2. Update local gitignored env files.  
3. Redeploy production (only when explicitly approved).  
4. Smoke `/api/health` and a logged-in football status check.

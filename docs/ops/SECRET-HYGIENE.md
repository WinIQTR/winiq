# Secret hygiene (UX audit item 4)

- Keep `.env` and `data/operations/netlify-production.env` out of git (already gitignored).
- Rotate API-Football key and Neon password when convenient; historical public .env risk.
- After rotate: update Netlify env + local operations env, then redeploy.

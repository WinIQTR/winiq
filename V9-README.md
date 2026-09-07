# Bet Project V9 — Automatic Prediction Archive

V9 adds automatic pre-match publication and post-match settlement to the existing immutable Prediction Archive.

## Included behavior

- Publishes eligible Top Picks before kickoff.
- Uses `match + market + model version + kickoff` as the publication identity.
- Skips duplicate publications safely.
- Preserves every published prediction without recalculating historical values.
- Settles completed fixtures as `WON`, `LOST`, or `VOID`.
- Voids cancelled, postponed, rescheduled, and unsupported markets.
- Leaves finished fixtures with missing scores pending and reports them as warnings.
- Uses the API full-time score before the aggregate goal score for standard football markets.
- Keeps pending and void predictions out of win-rate calculations.

## Installation

Copy the ZIP contents over the project root. No Prisma migration is required.

Run:

```powershell
pnpm exec prisma generate
pnpm exec tsc --noEmit
pnpm run test:archive
pnpm run refresh
```

To run publication and settlement without requesting fixture data:

```powershell
pnpm run archive
```

Start the application after validation:

```powershell
pnpm dev
```

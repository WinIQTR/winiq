# Bet Project V10 — Shared Analytics Design System

Install this package on top of V9.1. Copy the complete `src` directory into the
project root and allow Windows to replace matching files.

No Prisma migration is required.

## Validation

```powershell
pnpm exec tsc --noEmit
pnpm dev
```

## Included changes

- Adds one shared analytics design system loaded after `globals.css`.
- Standardizes KPI cards, panels, tables, filters, status colors, borders,
  spacing, shadows, and responsive behavior.
- Applies the shared design language to Dashboard, Teams, Smart Picks, Model
  Performance, and the Prediction Archive section.
- Converts user-facing text in the updated pages and sidebar to English.
- Uses English percentage formatting such as `68.9%`.
- Preserves prediction, publishing, archive, and settlement logic.
- Adds production metadata for the application title and description.

## Files

- `src/app/analytics-design-system.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/smart-picks/page.tsx`
- `src/app/teams/page.tsx`
- `src/components/app-sidebar.tsx`

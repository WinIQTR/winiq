# Membership V6.1

## Access strategy

| Plan | Included |
| --- | --- |
| BASIC | Today's published predictions and simple confidence labels |
| ANALYSIS | BASIC plus advisory picks, explanations and recent result history |
| PROFESSIONAL | ANALYSIS plus value bets, smart picks and full analytics |

Open registration is disabled. An administrator creates and approves every account.
The first release exposes only the intentionally simple daily member dashboard. The
existing detailed application remains administrator-only while ANALYSIS and
PROFESSIONAL member views are completed in V6.2.

## Security controls

- Passwords are hashed with Node.js scrypt and a random salt.
- Session identifiers are random; only their SHA-256 hashes are stored.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production.
- Five failed login attempts in fifteen minutes temporarily block another attempt.
- Suspended and expired memberships cannot create an active session.
- Existing detailed pages and administrative API routes require an ADMIN session.
- Passwords are never printed by account-management scripts.

## Installation order

1. `pnpm exec prisma generate`
2. `pnpm exec prisma migrate deploy`
3. `pnpm run test:membership-v6`
4. `pnpm exec tsc --noEmit`
5. Create the first administrator using the secure PowerShell block supplied with the package.
6. Remove `.next`, run `pnpm build`, then start `pnpm dev`.

The production prediction Champion remains locked at 20% ML / 80% Poisson.

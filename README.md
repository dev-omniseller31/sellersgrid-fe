# MarketFlow

MarketFlow is a multi-tenant commerce SaaS that lets a seller create one master product and publish it to connected marketplace accounts. This repository contains a Next.js dashboard, a NestJS API, PostgreSQL persistence through Prisma, and Redis-backed BullMQ workers.

## What works

- Registration, login, secure HTTP-only sessions, organizations, and roles
- Persistent catalog CRUD, stock updates, validated image uploads, search, and CSV export
- Encrypted seller credentials using AES-256-GCM
- Shopify OAuth or manual tokens, eBay, Flipkart, and Amazon connector boundaries
- Per-channel readiness validation, durable publish jobs, retries, and actionable failures
- Shopify order webhooks with HMAC verification and replay protection
- Live dashboard, channels, publish center, orders, analytics, and settings screens
- Public SEO landing page, no-indexed private routes, sitemap, robots policy, web manifest, and responsive mobile navigation
- OpenAPI in development (or when explicitly enabled), health endpoint, audit records, Docker services, and checked-in SQL migrations

Publishing is deliberately honest: a connector calls the real marketplace API and records the real response. It does not report success when credentials, approved marketplace access, required attributes, or Amazon SigV4 signing are missing.

## Local setup

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Replace `JWT_SECRET` with at least 32 random characters and `ENCRYPTION_KEY` with a random 32-byte base64 value. Never commit that file.
3. Start PostgreSQL and Redis with `docker compose up -d postgres redis`.
4. Run `npm run db:migrate`, then start `npm run api:dev` and `npm run dev` in separate terminals.
5. Open `http://localhost:3000` for the public site, then sign in at `/login`; the private app lives at `/dashboard`.

For the complete container stack, export `JWT_SECRET` and `ENCRYPTION_KEY`, then run `docker compose --env-file apps/api/.env up --build`. The API applies checked-in migrations before starting. Set `SESSION_COOKIE_SECURE=false` only for local plain-HTTP testing; production must use HTTPS and the default secure cookie setting.

## Marketplace configuration

- Shopify: set the client ID, client secret, scopes, and callback URL `http://localhost:3000/api/stores/oauth/shopify/callback`. Configure order webhooks at `/api/webhooks/shopify`.
- eBay: provide an OAuth access token plus marketplace, inventory location, fulfillment, payment, and return policy IDs.
- Flipkart: provide an approved seller access token and required listing attributes.
- Amazon: provide an LWA access token and an HTTPS signing gateway in the store settings. Direct SP-API calls require AWS SigV4 and approved developer access, so unsigned requests are never attempted.

Marketplace developer approval and production credentials are external prerequisites; they are not included in this repository.

## Verification

```text
npm run lint
npm test
npm run api:build
npm run build
npm audit
```

The credential encryption and constant-time webhook signature checks have automated tests. The current full dependency audit reports zero known vulnerabilities. See `security_best_practices_report.md` for the code audit and production prerequisites; provider sandbox contract tests and an independent penetration test remain release requirements.

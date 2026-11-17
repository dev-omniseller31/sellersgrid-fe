# MarketFlow security review

Reviewed: 2026-09-07

## Executive summary

The application now has a strong secure-by-default baseline for its current MVP scope. The complete npm dependency tree reports **0 known vulnerabilities**, TypeScript checks pass, and the production frontend and backend builds pass. The review found and fixed one high-severity tenant-isolation weakness, three medium-severity weaknesses, and four low-severity hardening issues.

No responsible security review can guarantee that an internet-facing product has “zero vulnerabilities.” The verified statement is narrower: the current dependency audit is zero, the listed code findings are remediated, and no critical/high unresolved application finding was identified in this source review. A production release still requires HTTPS, a trusted reverse proxy/WAF configuration, managed secrets, provider sandbox tests, and periodic penetration testing.

## Remediated findings

### MF-SEC-001 — Marketplace identity could be shared across tenants

- Severity: High
- Location: `apps/api/prisma/schema.prisma:101`; `apps/api/src/app.service.ts:109-114,145`
- Evidence: store identity was unique only within an organization, while Shopify webhooks locate stores globally by marketplace account.
- Impact: the same external Shopify store could be connected to multiple organizations, making webhook ownership ambiguous.
- Fix: marketplace account identity is now globally unique; OAuth rejects an account owned by another organization; webhook routing uses the same unique key.
- Mitigation: migration `20260907090000_global_store_identity` enforces the rule in PostgreSQL, closing race conditions that application checks alone cannot close.
- False-positive notes: none for the current single-platform-account ownership model.

### MF-SEC-002 — Revoked membership or changed role remained valid

- Severity: Medium
- Location: `apps/api/src/security.ts:13-28`
- Evidence: the guard previously trusted role and organization claims for the full eight-hour JWT lifetime.
- Impact: a removed member or downgraded role could retain stale access until token expiry.
- Fix: every protected request now verifies the membership in PostgreSQL and refreshes the effective role from the database.
- Mitigation: the JWT remains bounded to eight hours and is stored only in an HttpOnly SameSite cookie.
- False-positive notes: this adds one indexed membership lookup per authenticated request by design.

### MF-SEC-003 — Route identifiers lacked runtime validation

- Severity: Medium
- Location: `apps/api/src/app.controller.ts:22-42`
- Evidence: untrusted `:id` route values were passed to Prisma as plain strings.
- Impact: malformed IDs could trigger avoidable database errors and inconsistent 500 responses.
- Fix: all product, image, store, job, and order identifiers now pass through Nest's UUID v4 parser.
- Mitigation: tenant-scoped database predicates remain in place after validation.
- False-positive notes: none.

### MF-SEC-004 — WEBP validation checked only the RIFF prefix

- Severity: Medium
- Location: `apps/api/src/app.service.ts:67-75`
- Evidence: the former signature check accepted any RIFF container declared as `image/webp`.
- Impact: non-WEBP RIFF files could be stored as images.
- Fix: validation now requires both the `RIFF` container and `WEBP` marker, while retaining size limits and random server filenames.
- Mitigation: uploaded files stay outside the public web root and are served only through an authenticated tenant-scoped endpoint with `nosniff`.
- False-positive notes: full image decoding/malware scanning should be added if arbitrary public uploads become a product feature.

### MF-SEC-005 — Credential object resource limits were incomplete

- Severity: Low
- Location: `apps/api/src/app.service.ts:81-86`
- Evidence: credential values were checked for non-empty strings but had no property-count or value-length bounds.
- Impact: oversized encrypted credential records could waste CPU, storage, and log/error capacity.
- Fix: credentials are capped at 12 values and 4,096 characters per value, in addition to the global request-body limit.
- Mitigation: marketplace-specific credential DTOs can replace the generic object as connector requirements stabilize.
- False-positive notes: none.

### MF-SEC-006 — Production API schema exposure and fingerprinting

- Severity: Low
- Location: `apps/api/src/main.ts:14,28-31`
- Evidence: Express fingerprinting was enabled and OpenAPI was always public.
- Impact: unnecessary implementation detail was available to unauthenticated production clients.
- Fix: `X-Powered-By` is disabled and OpenAPI is off in production unless `ENABLE_OPENAPI=true` is explicitly set.
- Mitigation: retain API documentation in trusted development/staging environments.
- False-positive notes: API discovery is not an authorization boundary; protected endpoints still enforce sessions.

### MF-SEC-007 — Local database services listened on every interface

- Severity: Low
- Location: `docker-compose.yml:42,53`
- Evidence: PostgreSQL and Redis ports were published without a host-address restriction.
- Impact: on permissive host firewalls, development databases could be reachable from the local network.
- Fix: both ports bind to `127.0.0.1` only. The production cookie setting defaults to Secure in the complete container stack.
- Mitigation: production deployments should not publish database/cache ports at all.
- False-positive notes: host firewall policy could already reduce exposure, but was not visible in repository code.

### MF-SEC-008 — Known development-tool dependency advisories

- Severity: High (tooling only; production tree was already clean)
- Location: `apps/api/package.json`; `package-lock.json`
- Evidence: the initial full `npm audit` reported seven advisories through the Nest CLI toolchain.
- Impact: affected parsers could be abused only through development/build tooling inputs, not production requests.
- Fix: patched Nest CLI and transitive dependencies; final full `npm audit --json` reports 0 vulnerabilities.
- Mitigation: keep the lockfile and use `npm ci` in CI.
- False-positive notes: the initial `npm audit --omit=dev` already reported 0 production vulnerabilities.

## Existing controls verified

- Strict CSP with nonce-based scripts, clickjacking denial, no objects, and restricted connection sources: `proxy.ts:4-26`.
- Helmet, strict origin plus custom-header CSRF protection, no-store responses, throttling, and DTO whitelisting: `apps/api/src/main.ts:13-25`.
- AES-256-GCM authenticated encryption and constant-time HMAC comparison: `apps/api/src/security.ts:31-57`.
- HttpOnly, SameSite=Lax session cookie with deployment-controlled Secure flag: `apps/api/src/app.service.ts:35-40`.
- Tenant scoping on products, images, stores, jobs, orders, and settings in `apps/api/src/app.service.ts`.
- Raw-body Shopify webhook HMAC verification and replay protection: `apps/api/src/app.service.ts:137-161`.
- SSRF-reducing marketplace destination controls and request timeouts: `apps/api/src/connectors.ts`.

## Deployment requirements not provable from source

1. Terminate TLS at a trusted reverse proxy/CDN and redirect HTTP to HTTPS.
2. Configure the proxy to overwrite forwarding headers, cap body sizes/connections, and apply edge rate limits.
3. Store JWT, encryption, database, and marketplace secrets in a production secret manager; rotate them periodically.
4. Use distributed rate limiting before horizontally scaling the API; the current Nest throttler is process-local.
5. Run provider sandbox contract tests, DAST, and an independent penetration test before handling real seller accounts.

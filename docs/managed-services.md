# Managed services

Open **Services** in the dashboard. The catalog covers account onboarding, catalog creation, image editing, banner/rich-product design, brand stores, organic visibility, campaigns, account health, wrong-return claims, FBA/FBF prep, reports, AI video production, infographics, account/catalog managers, promotions, webinars, callbacks, chat and WhatsApp requests.

This is a human-delivered service workflow. It does not send ads, submit marketplace claims, generate videos, place calls or connect WhatsApp/Google Chat automatically. Shopsy and Meesho are brief destinations only; their publishing connectors have not been implemented.

## Workflow

1. An OWNER, ADMIN or STAFF member chooses a service and submits a brief.
2. Requests persist in PostgreSQL and appear in the paginated request board.
3. An OWNER or ADMIN assigns an existing, non-viewer member of the same organization and updates progress.
4. Editors record questions, delivery references and progress notes. Owners/admins mark requests delivered, closed, cancelled or reopened as appropriate.
5. Viewers can inspect but cannot write. Optimistic revision checking rejects stale updates.

Staff must already be members of that organization. There is no cross-organization agency-admin console or staff invitation flow in this change. A seller's organization owner can manage its own work; OWNER is not a global support role.

## Packages

Silver, Gold and Platinum display the supplied reference quantities for catalog, images, banners, videos and infographics, with a proposed 60-day period. Package actions create consultation requests only. Prices, taxes, quotas, support hours, subscription activation and staff availability are not asserted or enforced. Confirm these in your own quote. Duplicate account-manager and calling rows have been consolidated; ambiguous RPD work is described in the brief.

## Deploy

Run `npm run db:generate`, `npm test`, `npm run lint`, `npm run build`, and `npm exec --workspace @marketflow/api -- nest build`.

Apply the checked-in `20260915100000_service_desk` migration to the intended database with `npm run db:deploy --workspace @marketflow/api` (or the existing backend build migration step). Deploy backend before frontend. Do not reset the database. The two new tables are additive; existing catalog/store data is unchanged.

Acceptance: submit a brief, refresh, open it, assign a teammate, save a status and note, refresh again, and confirm persistence. Verify VIEWER is read-only and another organization cannot read the request ID. Test narrow/mobile widths.

The activity view shows the latest 100 updates per request; database history is retained. Asset/delivery references are plain text rather than automatic downloads or server-side fetches. Do not put credentials or sensitive customer details in briefs.

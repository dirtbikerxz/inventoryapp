# Convex Migration Guide (no Google Sheets)

Goal: store all parts, orders, groups, and roster data in Convex and remove Google Sheets/Apps Script entirely.

## 1) Create Convex deployment
1. `npm run convex:dev` (or `npx convex dev`) and follow the prompt to create a project. Convex CLI reads `.env.local` by default; set `CONVEX_URL` there (and keep `.env` for Docker if you want separation).
2. Copy the deployment URL (looks like `https://<project>.convex.cloud`) into `.env.local`/`.env` as `CONVEX_URL`.
3. (Optional) Create a prod deployment in the Convex dashboard and note its URL as well.

## 2) Apply schema and functions
- The Convex schema and functions live in `convex/`:
  - `schema.ts` — tables for `parts`, `orders`, `orderGroups`, `students`, `categories`.
  - `parts.ts` — list/filter parts, create parts, categories aggregation.
  - `orders.ts` — list orders (with groups), create orders, update status, assign group.
  - `orderGroups.ts` — list/create/update groups and attach orders.
  - `students.ts` — list/upsert roster entries.
  - `categories.ts` — list/upsert category metadata.
- Run locally: `npm run convex:dev` (generates `_generated` folder).
- Deploy to Convex cloud: `npm run convex:deploy` (uses `CONVEX_DEPLOYMENT` if set).

## 3) Wire the Node API to Convex
- The Express server (`server/index.js`) now uses `ConvexHttpClient` with `CONVEX_URL`.
- Docker compose uses `.env`; ensure `CONVEX_URL` is set before running `docker compose watch` or `docker compose up`.

## 4) Import existing data (one-time)
- Export CSVs from Google Sheets (Parts, Orders, Students/Categories).
- Write a small import script using Convex actions or Node with `ConvexHttpClient`, e.g.:
  - Read CSV → call `parts:create` for each row (maintain `partId`).
  - Read Orders → call `orders:create` (preserve order numbers if you want; otherwise let Convex generate new ones).
  - Read Students → call `students:upsert`.
- If you prefer server-side actions, add a Convex `action` for bulk import and secure it with `CONVEX_ADMIN_KEY`.

## 5) Order grouping and tracking
- Use `orderGroups:create` with `orderIds` to bundle multiple student requests into one purchase batch.
- Update tracking/status via:
  - `orders:updateStatus` (per order) with optional `trackingNumber`.
  - `orderGroups:update` (per group) to store supplier, tracking, expected date, notes, and bulk attach orders.
- The REST API exposes these via:
  - `PATCH /api/orders/:id/status`
  - `PATCH /api/orders/:id/group`
  - `POST /api/order-groups`
  - `PATCH /api/order-groups/:id`

## 6) Frontend migration notes
- Replace `google.script.run` calls in `src/WebApp.html` with `fetch` calls to the Node API, or swap to Convex client-side hooks.
- For direct Convex usage in a React/modern frontend, use `convex/react` or `ConvexHttpClient` with the same function names used by the REST API.
- Add auth (Convex Auth) before exposing admin mutations (part creation, status changes) to the wider team.

## 7) Operations
- Local dev with hot reload: `docker compose watch` (uses Convex cloud).
- Health check: `GET /health`.
- Minimal smoke test:
  ```
  curl -X POST http://localhost:3000/api/orders \
    -H "Content-Type: application/json" \
    -d '{"studentName":"Test","partName":"Sprocket","quantityRequested":1}'
  ```

This guide is the source of truth for the Convex-based stack and how to operate it without Google.

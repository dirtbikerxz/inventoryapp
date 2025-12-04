# Containerization Plan (Convex backend)

The app now targets Convex for all data (parts catalog, orders, groups, students). The Node/Express service is just a thin API/proxy you can self-host in Docker; it calls Convex functions for all reads/writes. Google Sheets/Apps Script are no longer used.

## Environment variables
Copy `.env.example` to `.env.local` (Docker compose uses `.env.local` via `env_file`; Convex CLI also prefers `.env.local`). If you prefer `.env`, create it too and add it to `docker-compose.yml`.

```
PORT=3000
LOG_LEVEL=info
CONVEX_URL=https://<your-convex-deployment>.convex.cloud
CONVEX_DEPLOYMENT=dev   # optional: used by convex CLI (dev/prod)
CONVEX_ADMIN_KEY=       # optional: only for scripted data import/admin
```

## Local development (with Docker Compose watch)
1. `cp .env.example .env` and set `CONVEX_URL`.
2. Start live-reloading dev stack:
   ```
   docker compose watch
   ```
   - Uses the `development` build target and `nodemon` to reload on server file changes.
   - Ports: `localhost:3000`.
3. API smoke tests (once the container is up):
   - `curl http://localhost:3000/health`
   - `curl http://localhost:3000/api/inventory`
   - `curl http://localhost:3000/api/orders`
   - `curl -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" -d '{"studentName":"Test","partName":"Sprocket","quantityRequested":1}'`

## Running without watch (still local)
```
docker compose up --build
```

## Build & push to Docker Hub
1. Build production image (uses `production` stage in `Dockerfile`):
   ```
   docker build -t <dockerhub-user>/inventory-app:latest .
   ```
2. Test locally (Convex URL required):
   ```
   docker run --rm -p 3000:3000 \
     -e CONVEX_URL=https://<your-convex-deployment>.convex.cloud \
     <dockerhub-user>/inventory-app:latest
   ```
3. Push:
   ```
   docker login
   docker push <dockerhub-user>/inventory-app:latest
   ```

## Deploying to Unraid
- Set the same env vars, especially `CONVEX_URL`.
- Expose port 3000 (or whatever you set in `PORT`).
- Set restart policy to `unless-stopped` (already in `docker-compose.yml`).

## Current API surface (Convex-backed)
- `GET /health` – liveness.
- `GET /api/categories` – unique categories/subcategories/types from Convex parts.
- `GET /api/inventory` – list parts (optional filters: `category`, `subcategory`, `type`, `search`).
- `GET /api/orders` – list orders + attached groups (optional `status`).
- `POST /api/orders` – create order (order number generated server-side in Convex).
- `PATCH /api/orders/:id/status` – update order status (and optional tracking).
- `PATCH /api/orders/:id/group` – assign order to a group.
- `GET /api/order-groups` – list groups.
- `POST /api/order-groups` – create a group and optionally attach orders.
- `PATCH /api/order-groups/:id` – update group metadata and/or attached orders.
- `GET /api/students` – list roster (optional `activeOnly=true`).
- `POST /api/students` – upsert student.

## Next steps
- Point the frontend (currently Apps Script HTML) to this API or use Convex clients directly.
- Add auth (Convex Auth or custom) for admin actions.
- Build migration scripts to import existing Sheets CSV exports into Convex (`convex:dev` + `convex:deploy`).

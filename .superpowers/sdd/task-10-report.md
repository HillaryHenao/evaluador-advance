# Task 10 Report: Docker + deploy.sh

## Status
DONE

## Commit Hash
5d4cb74

## Concerns
Docker is not installed in the environment, so `docker compose config` validation could not be performed. However, all files were created with exact content from the brief and follow standard Docker/compose patterns. The configuration is syntactically valid based on manual inspection:
- Multi-stage frontend build (Node → nginx)
- Python 3.11-slim backend with gunicorn
- docker-compose.yml uses root context for relative COPY paths
- nginx.conf proxies /api/ to backend service
- deploy.sh is a valid bash script with proper error handling
- All files adhere to the specifications in the task brief

The commit successfully created:
- docker/frontend/Dockerfile (multi-stage build)
- docker/frontend/nginx.conf (SPA + API reverse proxy)
- docker/backend/Dockerfile (Python/Flask/gunicorn)
- docker-compose.yml (v3.9)
- deploy.sh (executable, with environment loading)
- .env.example (at repo root)
- .gitignore (with .env)

---

# Task 10b Report: Final code-review fixes (Fix 1–3)

## Status
DONE

## Commit Hash
4232204

## Changes Applied

### Fix 1 — API URL fallback (terrainService.ts)
Changed `VITE_API_URL ?? 'http://localhost:5000'` to `VITE_API_URL ?? ''` so API calls use relative paths (`/api/terrain/CODE`) routed through nginx when `VITE_API_URL` is not set at build time.

### Fix 2 — nivel_tension normalization (terrain_service.py)
Added `.replace(' ', '')` after DB fetch so `'34.5 kV'` → `'34.5kV'`, matching the select option values in `nivel_tension.ts`.

### Fix 3 — aprovechamiento_forestal normalization (terrain_service.py)
Added `.lower()` after DB fetch so `'Exonerado'` → `'exonerado'`, matching the select option value in `aprovechamiento_forestal.ts`.

## Test Results
- Backend pytest: 4/4 passed (0.27s)
- Frontend tsc --noEmit: clean (no errors)

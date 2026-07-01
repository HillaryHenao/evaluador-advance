# Task 10 Brief: Docker + deploy.sh

## Context
Task 10 of 10 — the final task. The frontend (Tasks 1-8) and Flask backend (Task 9) are complete. Your job: write all Docker configuration, docker-compose.yml, and a deploy.sh script that builds and starts the containers. No tests required for this task.

## Global Constraints
- Work in `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\`
- Frontend: nginx serving built Vue app
- Backend: gunicorn serving Flask app
- Use PowerShell for commands
- `deploy.sh` must be a valid bash script (for Linux/CI execution)
- Do NOT create a `.env` file — only update `.env.example` at repo root

## Directory Structure to Create
```
docker/
├── frontend/
│   ├── Dockerfile
│   └── nginx.conf
└── backend/
    └── Dockerfile
docker-compose.yml
deploy.sh
.env.example          (root level)
.gitignore            (update existing)
```

## File Contents

### docker/frontend/Dockerfile
```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### docker/frontend/nginx.conf
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### docker/backend/Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "run:app"]
```

### docker-compose.yml
```yaml
version: '3.9'

services:
  frontend:
    build:
      context: .
      dockerfile: docker/frontend/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: docker/backend/Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - FLASK_ENV=${FLASK_ENV:-production}
    ports:
      - "5000:5000"
    restart: unless-stopped
```

### deploy.sh
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Evaluador Advance — Deploy ==="

# Load env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Build and start
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

echo "=== Deploy complete ==="
echo "Frontend: http://localhost"
echo "Backend:  http://localhost:5000/api/health"
```

### .env.example (root)
```
# Database
DATABASE_URL=postgresql://user:password@host:5432/originabotdb

# JWT
JWT_SECRET=your-jwt-secret-or-public-key

# Flask
FLASK_ENV=production
```

## Steps

1. Create directories:
   ```powershell
   New-Item -ItemType Directory -Force "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\docker\frontend"
   New-Item -ItemType Directory -Force "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\docker\backend"
   ```

2. Write all files (exact content above):
   - `docker/frontend/Dockerfile`
   - `docker/frontend/nginx.conf`
   - `docker/backend/Dockerfile`
   - `docker-compose.yml`
   - `deploy.sh`
   - `.env.example` (at repo root)

3. Check if `.gitignore` at repo root already ignores `.env`. If not, add `.env` to it.
   - Read existing `.gitignore`
   - If `.env` (or `*.env`) is not already listed, append `.env` to it

4. Make deploy.sh executable in git:
   ```powershell
   cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
   git update-index --chmod=+x deploy.sh
   ```

5. Verify docker-compose syntax (if Docker is installed):
   ```powershell
   docker compose config
   ```
   If Docker is not installed, skip this step and note it in concerns.

6. Commit:
   ```powershell
   cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
   git add docker/ docker-compose.yml deploy.sh .env.example .gitignore
   git commit -m "feat: add Docker multi-stage build, nginx reverse proxy, and deploy.sh"
   ```

## Important Notes
- The `docker-compose.yml` uses `context: .` (repo root) because both Dockerfiles need to COPY from subdirectories (`frontend/` and `backend/`). If context were set to `docker/frontend/`, it couldn't reach the frontend source.
- `nginx.conf` proxies `/api/` to `http://backend:5000` — this means the Vue frontend only needs to call `/api/terrain/CODE` (relative URL), not the full `http://localhost:5000/api/terrain/CODE`. However, the existing `terrainService.ts` uses `VITE_API_URL` — this is fine for dev; in production the nginx proxy handles it without env var.
- `deploy.sh` uses `grep -v '^#' .env | xargs` to load env vars — standard pattern, safe for well-formed .env files.

## Report Contract
Write report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-10-report.md`

Return ONLY: status, commit hash(es), concerns (especially if docker compose config check was skipped).

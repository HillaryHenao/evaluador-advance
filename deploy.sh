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

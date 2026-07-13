#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
  compose_env_file="$COMPOSE_ENV_FILE"
elif [[ -f .env.docker ]]; then
  compose_env_file=.env.docker
else
  compose_env_file=.env.docker.example
fi

if [[ ! -f "$compose_env_file" ]]; then
  echo "Compose environment file not found: $compose_env_file" >&2
  exit 1
fi

echo "Validating docker-compose.yaml with ${compose_env_file}…"
pnpm dotenvx run -f "$compose_env_file" -- docker compose config --quiet

echo "Validating docker-compose.coolify.yaml (syntax; Coolify-specific keys such as exclude_from_hc are allowed)…"
python3 - <<'PY'
import yaml
from pathlib import Path
yaml.safe_load(Path("docker-compose.coolify.yaml").read_text())
print("coolify compose YAML syntax OK")
PY

echo "Compose validation passed."

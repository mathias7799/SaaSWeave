#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

echo "Validating docker-compose.yaml…"
pnpm dotenvx run -f .env.docker -- docker compose config --quiet

echo "Validating docker-compose.coolify.yaml (syntax; Coolify-specific keys such as exclude_from_hc are allowed)…"
python3 - <<'PY'
import yaml
from pathlib import Path
yaml.safe_load(Path("docker-compose.coolify.yaml").read_text())
print("coolify compose YAML syntax OK")
PY

echo "Compose validation passed."

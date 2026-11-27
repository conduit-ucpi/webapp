#!/usr/bin/env bash
# Builds the webapp server (Next standalone) that the box image packs: the API at api.stabledrop.me.
#
# Run by two jobs in .github/workflows/build.yml, from one place so they cannot drift:
#   - the box release (test / cherry / production), before it deploys;
#   - the Cloudflare release's server-image job, which builds the image a later cherry release of
#     the same commit then deploys without building.
# Reads its settings from the environment the calling step passes.
set -euo pipefail

npm ci --legacy-peer-deps

# The Farcaster manifest is a committed file (public/.well-known/farcaster.json), never generated
# here, so the box build and the static build cannot disagree about it.
echo "=== Farcaster manifest (committed) ==="
cat public/.well-known/farcaster.json

npm run build

# Static assets and public/ are not in the standalone output; the image needs both.
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
echo "=== Standalone bundle ==="
ls -la .next/standalone/.next/static/ .next/standalone/public/ | head -20

#!/usr/bin/env bash
# Builds the static site (out/) that Cloudflare Pages serves at stabledrop.me.
#
# Run by two jobs in .github/workflows/build.yml, from one place so they cannot drift:
#   - the cherry release, which builds it once per commit and stores it as an image;
#   - the Cloudflare release, only when no image exists yet for its commit.
#
# Reads the NEXT_PUBLIC_* values from the environment the calling step passes. Only
# NEXT_PUBLIC_* values belong here: the output is world-readable static files.
set -euo pipefail

mkdir -p public/.well-known

# ⚠️ FAILS THE BUILD. Publishing without the MCP server card is invisible from outside: a
#    crawler finds nothing and moves on. Taken from the RUNNING ap2service, so the card
#    describes what is actually deployed.
curl -sf --max-time 30 https://api.stabledrop.me/.well-known/mcp.json -o public/.well-known/mcp.json
python3 -c "import json;d=json.load(open('public/.well-known/mcp.json'));print('card:',d['name'],d['version'])"

# Stamp this bundle with its own version; the API reports its own via /api/config.
export NEXT_PUBLIC_GIT_TAG="$(git describe --tags --abbrev=0 2>/dev/null || echo '')"
export NEXT_PUBLIC_GIT_SHA="$(git rev-parse --short HEAD)"
echo "Building client version: ${NEXT_PUBLIC_GIT_TAG:-<no tag>} ${NEXT_PUBLIC_GIT_SHA}"

if [ -z "${NEXT_PUBLIC_API_BASE_URL:-}" ]; then
  echo "NEXT_PUBLIC_API_BASE_URL is not set: the site would call /api/* on Pages and every call would 404." >&2
  exit 1
fi
# Verification must read the chain through an endpoint the API cannot choose.
if [ -z "${NEXT_PUBLIC_RPC_URL:-}" ]; then
  echo "NEXT_PUBLIC_RPC_URL is not set (RPC_URL on this environment)." >&2
  exit 1
fi
# The escrow trust anchor: without it every escrow verification fails closed.
if [ -z "${NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS:-}" ]; then
  echo "NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS is not set (ESCROW_IMPLEMENTATION_ADDRESS on this environment)." >&2
  exit 1
fi

export STATIC_EXPORT=true
npm ci --legacy-peer-deps
npm run build:static

# Client-side routing fallback: Pages serves 404.html for any path it has no file for, so the
# app shell there lets the router resolve dynamic routes such as /projects/<groupId>.
cp out/index.html out/404.html

#!/usr/bin/env bash
# The static site (out/) stored as an image named by commit SHA, so it is built once per commit:
# the cherry release builds and pushes it; the Cloudflare release pulls it instead of rebuilding.
#
#   static-site-image.sh exists   # exit 0 if this commit's image is in the registry
#   static-site-image.sh push     # out/ -> ghcr.io/<repo>-static:<sha>
#   static-site-image.sh pull     # ghcr.io/<repo>-static:<sha> -> out/
#
# It carries files and nothing else (FROM scratch): Cloudflare Pages still receives files.
# Needs REPO_LOWER and SHA_TAG, and a docker login to ghcr.io.
set -euo pipefail

IMAGE="ghcr.io/${REPO_LOWER}-static:${SHA_TAG}"

case "${1:-}" in
  exists)
    docker buildx imagetools inspect "$IMAGE" >/dev/null 2>&1
    ;;
  push)
    printf 'FROM scratch\nCOPY . /site\n' | docker buildx build --platform linux/amd64 --file - --push --tag "$IMAGE" out
    echo "Pushed $IMAGE"
    ;;
  pull)
    rm -rf out
    docker pull --platform linux/amd64 "$IMAGE" >/dev/null
    container=$(docker create --platform linux/amd64 "$IMAGE" /none)
    docker cp "$container:/site" out
    docker rm "$container" >/dev/null
    echo "Pulled $IMAGE into out/ ($(find out -type f | wc -l | tr -d ' ') files)"
    ;;
  *)
    echo "usage: $0 exists|push|pull" >&2
    exit 2
    ;;
esac

#!/usr/bin/env bash
# The static site (out/) stored as an image named <environment>-<sha>, so it is built once per
# commit: the cherry release builds and pushes it; the Cloudflare release only ever pulls it.
#
#   static-site-image.sh exists   # exit 0 if this commit's image is in the registry
#   static-site-image.sh push     # out/ -> ghcr.io/<repo>-static:<IMAGE_TAG>
#   static-site-image.sh pull     # ghcr.io/<repo>-static:<IMAGE_TAG> -> out/
#
# It carries files and nothing else (FROM scratch): Cloudflare Pages still receives files.
# Needs REPO_LOWER and IMAGE_TAG (cherry-<sha>), and a docker login to ghcr.io.
set -euo pipefail

IMAGE="ghcr.io/${REPO_LOWER}-static:${IMAGE_TAG}"

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

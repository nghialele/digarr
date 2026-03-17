#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="digarr-pg"

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }

if docker inspect "$CONTAINER_NAME" &>/dev/null; then
  echo "stopping and removing $CONTAINER_NAME..."
  docker rm -f "$CONTAINER_NAME"
  green "postgres container removed"
else
  green "no container to remove"
fi

echo ""
echo "data was in a docker volume. to also wipe the data:"
echo "  docker volume rm \$(docker volume ls -q | grep digarr)"
echo ""

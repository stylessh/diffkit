#!/usr/bin/env bash

set -euo pipefail

if [[ "${1-}" == "" ]]; then
	echo "Usage: $0 <owner/repo>"
	echo "Example: $0 stylessh/diffkit"
	exit 1
fi

REPO="$1"

if [[ ! "$REPO" =~ ^[^/]+/[^/]+$ ]]; then
	echo "Invalid repo '$REPO'. Expected format: owner/repo"
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$APP_DIR/.local"

mkdir -p "$DATA_DIR"

echo "Bootstrapping livegrep index for $REPO"
echo "Output directory: $DATA_DIR"

docker run --rm \
	-v "$DATA_DIR:/data" \
	ghcr.io/livegrep/livegrep/indexer:latest \
	/livegrep/bin/livegrep-github-reindex \
	-repo "$REPO" \
	-http \
	-dir /data

echo
echo "Done. Expected files:"
echo "  $DATA_DIR/livegrep.idx"
echo "  $DATA_DIR/livegrep.json"

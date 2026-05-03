#!/bin/bash
set -e

VERSION="${1:-dev}"
OUTPUT_DIR="./dist"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo "Building vui v${VERSION}..."

bun build --compile --minify --target=bun-linux-x64 ./src/index.tsx -o "${OUTPUT_DIR}/vui-linux-amd64"
echo "Built: vui-linux-amd64"

bun build --compile --minify --target=bun-linux-arm64 ./src/index.tsx -o "${OUTPUT_DIR}/vui-linux-arm64"
echo "Built: vui-linux-arm64"

ls -lh "${OUTPUT_DIR}/"
echo "Done!"

#!/usr/bin/env sh
# Serve the production build over http so the game can load its GLB/texture assets.
# Usage: ./play.sh            -> serves dist/ on http://127.0.0.1:8080
#        ./play.sh dist-single -> serves the single-file build folder instead
cd "$(dirname "$0")" || exit 1
DIR="${1:-dist}"
if [ ! -f "$DIR/index.html" ] && [ ! -f "$DIR/aetheria.html" ]; then
  echo "$DIR/ not found. Build first: npm install && npm run build"
  exit 1
fi
echo "Open http://127.0.0.1:8080/?quality=medium (Ctrl+C to stop)"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server 8080 --bind 127.0.0.1 --directory "$DIR"
fi
exec npx --yes serve "$DIR" -l 8080

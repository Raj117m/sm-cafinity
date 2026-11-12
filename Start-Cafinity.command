#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22.13 or newer, then open this file again."
  read -r "?Press Enter to close."
  exit 1
fi
if [ ! -f dist/index.html ]; then
  echo "Missing compiled frontend. Run npm ci and npm run build first."
  read -r "?Press Enter to close."
  exit 1
fi
echo "Open http://localhost:4173 in your browser."
echo "Use the LAN address printed below on your phone, on the same Wi-Fi."
echo "Keep this window open. Press Control-C to stop."
node backend/server.mjs
read -r "?Press Enter to close."

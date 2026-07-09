#!/bin/bash
# Double-click this file to run the CAIN talismans board through a small local
# web server. Serving it (instead of opening the .html directly) lets the page
# read the reference/ folders live -- drop new images into reference/details or
# reference/backgrounds, then just refresh the page to see them.
#
# Leave this Terminal window open while you use the board. Press Ctrl-C (or close
# the window) to stop the server.

cd "$(dirname "$0")" || exit 1
PORT=8137

PY="$(command -v python3 || command -v python)"
if [ -z "$PY" ]; then
  echo "Python 3 is required but could not be found on this Mac."
  read -r -p "Press return to close this window."
  exit 1
fi

URL="http://localhost:${PORT}/talismans.html"
echo "Serving CAIN talismans at:"
echo "    $URL"
echo
echo "Add art to reference/details or reference/backgrounds, then refresh the page."
echo "Press Ctrl-C to stop the server."
echo

# open the page once the server has had a moment to start
( sleep 1; open "$URL" ) &

exec "$PY" -m http.server "$PORT"

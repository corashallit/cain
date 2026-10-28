#!/usr/bin/env python3
"""Writes reference/manifest.json, the list of art the talisman board offers.

The board (talismans.html) reads the manifest to learn which images are in
reference/talismans, reference/details and reference/backgrounds. Run this
after adding or removing art:

    python3 make-manifest.py           # rewrite reference/manifest.json
    python3 make-manifest.py --check   # exit 1 if it's out of date
    python3 make-manifest.py --serve 8137
        # serve the board on that port, rewriting the manifest whenever the
        # page asks for it, so new art shows up on a refresh (the launchers
        # use this)
"""
import http.server
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REFERENCE = os.path.join(HERE, "reference")
MANIFEST = os.path.join(REFERENCE, "manifest.json")
FOLDERS = ["talismans", "details", "backgrounds"]
# The same as IMG_RE and FOLDER_EXCLUDE in talismans.html.
IMG_RE = re.compile(r"\.(png|jpe?g|gif|webp|svg|avif|bmp)$", re.IGNORECASE)
EXCLUDE = {"talismans": {"slashes.png"}}  # the reference image, not a strip


def manifest():
    out = {}
    for folder in FOLDERS:
        path = os.path.join(REFERENCE, folder)
        names = [
            n for n in os.listdir(path)
            if IMG_RE.search(n)
            and n not in EXCLUDE.get(folder, set())
            and os.path.isfile(os.path.join(path, n))
        ]
        # The page sorts again with localeCompare; this just keeps the file
        # stable from one run to the next.
        out[folder] = sorted(names, key=lambda n: (n.lower(), n))
    return json.dumps(out, indent=2, ensure_ascii=False) + "\n"


def write():
    text = manifest()
    with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def check():
    try:
        with open(MANIFEST, encoding="utf-8") as f:
            current = f.read()
    except FileNotFoundError:
        current = None
    if current != manifest():
        print("reference/manifest.json is out of date; run python3 make-manifest.py",
              file=sys.stderr)
        sys.exit(1)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def do_GET(self):
        if self.path.split("?")[0] == "/reference/manifest.json":
            write()
        super().do_GET()


if __name__ == "__main__":
    args = sys.argv[1:]
    if args == ["--check"]:
        check()
    elif len(args) == 2 and args[0] == "--serve":
        write()
        # All interfaces, like python3 -m http.server.
        http.server.ThreadingHTTPServer(("", int(args[1])), Handler).serve_forever()
    elif not args:
        write()
    else:
        sys.exit(__doc__)

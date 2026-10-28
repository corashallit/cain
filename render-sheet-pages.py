#!/usr/bin/env python3
"""Render the exorcist sheet's page art from the official CAIN sheets PDF.

    python3 render-sheet-pages.py path/to/CAINsheets_1.4.5.pdf

Writes exorcist-sheet/assets/art/page-1.webp .. page-4.webp: the first four
pages of the PDF (the player sheets) at 300 dpi, which is 3x the sheet's
850x1100 CSS px. Every page object is drawn as printed, so nothing is cropped,
except the few things the web sheet replaces with live content:

  - the book page numbers (156-159), which mean nothing on a standalone sheet
  - page 2's default kit list, which index.html seeds into the editable kit box

The overlay positions in exorcist-sheet/index.html are measured against these renders, so
check them with a screenshot after rendering a new PDF version.

Needs pypdfium2 and Pillow (pip install pypdfium2 pillow).
"""
import ctypes
import pathlib
import sys

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

PAGES = 4
WIDTH_PX = 2550  # 850 CSS px x 3
QUALITY = 82
OUT = pathlib.Path(__file__).resolve().parent / "exorcist-sheet" / "assets" / "art"

PAGE_NUMBERS = {"156", "157", "158", "159"}
KIT_DEFAULTS = (
    "SERVICE WEAPONS (2 KP)",
    "spending 3 scrip to max of CAT 3",
    "ISSUE UNIFORM (0 KP)",
    "NOTEBOOK, PEN (1 KP)",
    "MATCHBOOK (20 MATCHES)",
)


def text_of(obj, textpage):
    n = pdfium_c.FPDFTextObj_GetText(obj.raw, textpage.raw, None, 0)
    buf = ctypes.create_string_buffer(n)
    pdfium_c.FPDFTextObj_GetText(
        obj.raw, textpage.raw, ctypes.cast(buf, ctypes.POINTER(ctypes.c_ushort)), n)
    return buf.raw.decode("utf-16-le", "ignore").rstrip("\x00").strip()


def drop(text, page_no):
    if text in PAGE_NUMBERS:
        return True
    return page_no == 2 and text.startswith(KIT_DEFAULTS)


def main(pdf_path):
    pdf = pdfium.PdfDocument(pdf_path)
    OUT.mkdir(parents=True, exist_ok=True)
    for i in range(PAGES):
        page = pdf[i]
        textpage = page.get_textpage()
        doomed = [o for o in page.get_objects(max_depth=1)
                  if o.type == pdfium_c.FPDF_PAGEOBJ_TEXT and drop(text_of(o, textpage), i + 1)]
        textpage.close()
        for o in doomed:
            page.remove_obj(o)
        page.gen_content()
        expected = 1 + (len(KIT_DEFAULTS) if i + 1 == 2 else 0)
        if len(doomed) != expected:
            print(f"page {i + 1}: removed {len(doomed)} text objects, expected {expected}; "
                  "check the PDF layout", file=sys.stderr)
        scale = WIDTH_PX / page.get_width()
        img = page.render(scale=scale, may_draw_forms=False).to_pil().convert("RGB")
        dest = OUT / f"page-{i + 1}.webp"
        img.save(dest, "WEBP", quality=QUALITY, method=6)
        print(f"{dest.name}: {img.size[0]}x{img.size[1]}, {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

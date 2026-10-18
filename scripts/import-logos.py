#!/usr/bin/env python3
"""Imports white-on-transparent logo PNGs into the logo catalogue.

    python3 scripts/import-logos.py regions ~/Downloads/region-pngs
    python3 scripts/import-logos.py branches ~/Downloads/new-branches --strip-prefix "Branch White Logo "

Each PNG's file name (minus any --strip-prefix) becomes the logo's display
name. The logo is resized to at most 1600px wide, a 240px preview is written
under thumbs/, both are compressed with pngquant when it is installed, and
assets/logos/catalogue.json is updated (existing ids are replaced). Then run
npm run docs to refresh docs/LOGOS.md. Needs Pillow (pip install pillow).
JPEGs are refused: they cannot hold transparency, so a white logo saved as
JPEG is invisible.
"""
import argparse, json, re, shutil, subprocess, sys, unicodedata
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "assets" / "logos"
CATEGORIES = {"branches": "branches", "regions": "regions", "sub-brands": "subBrands"}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\((sub-branch|[a-z ]+ sub-branch)\)", "", s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def squash(path, quality):
    if shutil.which("pngquant"):
        subprocess.run(["pngquant", "--force", "--skip-if-larger", "--quality", quality, "--strip", "--output", str(path), str(path)], check=False)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("category", choices=CATEGORIES)
    ap.add_argument("folder")
    ap.add_argument("--strip-prefix", default="")
    a = ap.parse_args()
    cat_file = ROOT / "catalogue.json"
    catalogue = json.loads(cat_file.read_text())
    key = CATEGORIES[a.category]
    entries = {e["id"]: e for e in catalogue[key]}
    (ROOT / a.category).mkdir(exist_ok=True)
    (ROOT / "thumbs" / a.category).mkdir(parents=True, exist_ok=True)
    files = sorted(Path(a.folder).expanduser().iterdir())
    bad = [f.name for f in files if f.suffix.lower() in (".jpg", ".jpeg")]
    if bad:
        sys.exit("Refusing JPEG files (no transparency): " + ", ".join(bad))
    for f in files:
        if f.suffix.lower() != ".png":
            continue
        name = f.stem
        if a.strip_prefix and name.startswith(a.strip_prefix):
            name = name[len(a.strip_prefix):]
        name = re.sub(r"\s*\(\d+\)$", "", name).strip()
        lid = slug(name)
        im = Image.open(f).convert("RGBA")
        if im.getchannel("A").getextrema() == (255, 255):
            print("warning: " + f.name + " has no transparency")
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        out = ROOT / a.category / (lid + ".png")
        im.save(out, optimize=True)
        squash(out, "70-95")
        thumb = ROOT / "thumbs" / a.category / (lid + ".png")
        im.resize((240, round(im.height * 240 / im.width)), Image.LANCZOS).save(thumb, optimize=True)
        squash(thumb, "60-90")
        e = entries.get(lid, {"id": lid, "name": name})
        e.update({"file": f"{a.category}/{lid}.png", "thumb": f"thumbs/{a.category}/{lid}.png"})
        entries[lid] = e
        print("imported", lid)
    catalogue[key] = sorted(entries.values(), key=lambda e: e["name"].lower())
    cat_file.write_text(json.dumps(catalogue, indent=1, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()

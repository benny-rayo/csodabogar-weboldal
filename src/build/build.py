#!/usr/bin/env python3
"""
Csodabogár Fejlesztőműhely · mini statikus build (csak Python 3 standard könyvtár)

Mit csinál?
  A src/build/pages/*.html FORRÁS oldalakból elkészíti a public/*.html KÉSZ oldalakat:
    <!-- @include NÉV kulcs="érték" ... -->   -> src/build/partials/NÉV.html tartalma,
                                               benne a {{kulcs}} / {{kulcs|alapérték}} helyek kitöltve
    <!-- @icon NÉV -->                        -> assets/svg/ui-NÉV.svg inline (currentColor, aria-hidden)
    <!-- @svg NÉV class="..." -->             -> assets/svg/NÉV.svg inline, díszítőként (aria-hidden)
  A fejléc aktív menüpontját az `active` paraméter adja (index | programok | rolunk | galeria | kapcsolat);
  ha hiányzik, a fájlnévből következtet (program-*.html -> programok).

  Ezen felül legyártja a public/sitemap.xml és public/robots.txt fájlt, a <head>-be canonical és
  abszolút og:url / og:image kerül, a JSON-LD relatív hivatkozásai pedig abszolút URL-ek lesznek.
  A domain a SITE_URL környezeti változóból jön (alapérték: https://tataifejlesztes.hu).

Futtatás (a projekt bármely mappájából):
  python3 src/build/build.py            # minden oldal
  python3 src/build/build.py index      # csak egy oldal (fájlnév .html nélkül)
  SITE_URL=https://masik-domain.hu python3 src/build/build.py

A kész public/*.html fájlokat NE szerkeszd kézzel: a következő build felülírja őket.
"""
import os
import re
import sys
from pathlib import Path
from datetime import date

BUILD = Path(__file__).resolve().parent
SITE = BUILD.parent.parent / "public"   # a kész, Vercelre kerülő oldal
PAGES = BUILD / "pages"
PARTIALS = BUILD / "partials"
SVG = SITE / "assets" / "svg"

NAV_KEYS = ["index", "programok", "rolunk", "galeria", "kapcsolat"]

# Az éles domain (canonical, og:url, og:image, sitemap). Domainváltáskor itt vagy a SITE_URL változóban írd át.
SITE_URL = os.environ.get("SITE_URL", "https://tataifejlesztes.hu").rstrip("/")
# Ezek az oldalak nem kerülnek a sitemap-be (noindex).
NOINDEX = {"404"}
# A 404-es oldalt bármilyen mély útvonalon is kiszolgálhatja a Vercel, ezért ott gyökér-relatív linkek kellenek.
ROOT_RELATIVE = {"404"}

INCLUDE_RE = re.compile(r"<!--\s*@include\s+([\w-]+)(.*?)-->", re.S)
ICON_RE = re.compile(r"<!--\s*@icon\s+([\w-]+)(.*?)-->")
SVG_RE = re.compile(r"<!--\s*@svg\s+([\w-]+)(.*?)-->")
ATTR_RE = re.compile(r'([\w-]+)="(.*?)"', re.S)
VAR_RE = re.compile(r"\{\{\s*([\w-]+)\s*(?:\|(.*?))?\}\}", re.S)

warnings = []


def parse_attrs(s):
    return {k: v for k, v in ATTR_RE.findall(s or "")}


def fill(template, params, where):
    def rep(m):
        key, default = m.group(1), m.group(2)
        if key in params:
            return params[key]
        if default is not None:
            return default
        warnings.append(f"{where}: hiányzó paraméter: {key}")
        return ""
    return VAR_RE.sub(rep, template)


def svg_inline(name, extra_class="", ui=False):
    path = SVG / (f"ui-{name}.svg" if ui else f"{name}.svg")
    if not path.exists():
        warnings.append(f"nincs ilyen SVG: {path.name}")
        return ""
    src = path.read_text(encoding="utf-8").strip()
    src = re.sub(r"<\?xml.*?\?>", "", src).strip()
    src = re.sub(r"<title[^>]*>.*?</title>", "", src, flags=re.S)
    src = re.sub(r'\s(role|aria-labelledby|aria-hidden)="[^"]*"', "", src)
    cls = ("icon " if ui else "") + extra_class
    attrs = f' class="{cls.strip()}" aria-hidden="true" focusable="false"'
    return re.sub(r"<svg\b", "<svg" + attrs, src, count=1)


RANGE_RE = re.compile(r"(?<![\w-])(\d{1,2}-\d{1,2})(?![\w-])")
NO_WRAP_TAGS = {"script", "style", "title", "textarea", "option", "head"}


def keep_ranges_together(html):
    """Korosztály-tartományok (3-16, 6-10) ne törjenek két sorba a kötőjelnél.
    A fontokban nincs nem törő kötőjel (U+2011), ezért <span class="nowrap">-be tesszük
    a látható szövegben (címkéken, attribútumokban, script/title/option belsejében nem)."""
    parts = re.split(r"(<[^>]+>)", html)
    stack = []  # nyitott "tiltott" elemek; a nowrap span-t "span"-ként jegyezzük, és a mélységét is
    span_depth = 0
    for i, part in enumerate(parts):
        if part.startswith("<"):
            m = re.match(r"<(/?)([a-zA-Z0-9]+)", part)
            if not m:
                continue
            closing, tag = m.group(1), m.group(2).lower()
            if tag == "span" and stack and stack[-1] == "span":
                span_depth += -1 if closing else 1
                if span_depth == 0:
                    stack.pop()
                continue
            if closing:
                if stack and stack[-1] == tag:
                    stack.pop()
            elif tag in NO_WRAP_TAGS:
                stack.append(tag)
            elif tag == "span" and 'class="nowrap"' in part:
                stack.append("span")
                span_depth = 1
            continue
        if not stack and part.strip():
            parts[i] = RANGE_RE.sub(r'<span class="nowrap">\1</span>', part)
    return "".join(parts)


def page_url(name):
    """Tiszta (kiterjesztés nélküli) abszolút URL, ahogy a Vercel cleanUrls kiszolgálja."""
    return SITE_URL + "/" if name == "index" else f"{SITE_URL}/{name}"


LD_RE = re.compile(r'(<script type="application/ld\+json">)(.*?)(</script>)', re.S)
LD_URL_RE = re.compile(r'("(?:@id|url|image|logo|item)":\s*")([^"]+)(")')


def absolutize_jsonld(html):
    """A JSON-LD-ben a relatív hivatkozásokból (#id, oldal.html, assets/...) abszolút URL lesz."""
    def fix(v):
        if re.match(r"^(https?:|mailto:|tel:)", v):
            return v
        if v.startswith("#"):
            return f"{SITE_URL}/{v}"
        if v.endswith(".html") and "/" not in v:
            return page_url(v[:-5])
        return f"{SITE_URL}/{v.lstrip('/')}"

    def block(m):
        return m.group(1) + LD_URL_RE.sub(lambda u: u.group(1) + fix(u.group(2)) + u.group(3), m.group(2)) + m.group(3)
    return LD_RE.sub(block, html)


def root_relative(html):
    """Relatív src/href/srcset -> gyökér-relatív (/assets/..., /index.html). Csak a 404-es oldalhoz."""
    skip = r"(?!https?:|mailto:|tel:|#|data:|/)"
    html = re.sub(r'\b(src|href)="' + skip, r'\1="/', html)
    html = re.sub(r'(imagesrcset|srcset)="([^"]+)"',
                  lambda m: m.group(1) + '="' + ", ".join(
                      ("/" + p.strip()) if not p.strip().startswith(("/", "http")) else p.strip()
                      for p in m.group(2).split(",")) + '"', html)
    return html


def nav_active(page_html, active):
    """aria-current="page" a data-nav="<active>" linkekre."""
    return re.sub(
        r'data-nav="%s"' % re.escape(active),
        f'data-nav="{active}" aria-current="page"',
        page_html,
    )


def render(name):
    src_path = PAGES / f"{name}.html"
    text = src_path.read_text(encoding="utf-8")
    active_from_name = "programok" if name.startswith("program") else name

    # 1) include-ok (partial-on belül is lehet @icon / @svg, ezért előbb ezek)
    def inc(m):
        pname, params = m.group(1), parse_attrs(m.group(2))
        ppath = PARTIALS / f"{pname}.html"
        if not ppath.exists():
            warnings.append(f"{name}: nincs ilyen partial: {pname}")
            return m.group(0)
        params.setdefault("year", str(date.today().year))
        params.setdefault("site_url", SITE_URL)
        params.setdefault("canonical", page_url(name))
        out = fill(ppath.read_text(encoding="utf-8"), params, f"{name}/{pname}")
        if pname == "header":
            out = nav_active(out, params.get("active", active_from_name))
        return out.strip()
    text = INCLUDE_RE.sub(inc, text)

    # 2) ikonok és inline SVG-k
    text = ICON_RE.sub(lambda m: svg_inline(m.group(1), parse_attrs(m.group(2)).get("class", ""), ui=True), text)
    text = SVG_RE.sub(lambda m: svg_inline(m.group(1), parse_attrs(m.group(2)).get("class", "")), text)
    text = text.replace("{{year}}", str(date.today().year))
    text = keep_ranges_together(text)
    text = absolutize_jsonld(text)
    if name in NOINDEX:  # nem indexelt oldalnak nincs saját canonical / og:url címe
        text = re.sub(r'<(?:link rel="canonical"|meta property="og:url")[^>]*>\n?', "", text)
    if name in ROOT_RELATIVE:
        text = root_relative(text)

    # 3) ellenőrzések
    if "@include" in text or "{{" in text:
        warnings.append(f"{name}: maradt feldolgozatlan jelölő (@include vagy {{{{ }}}})")

    banner = f"<!-- GENERÁLT FÁJL: ne szerkeszd kézzel. Forrás: src/build/pages/{name}.html, build: python3 src/build/build.py -->\n"
    text = re.sub(r"^(<!doctype html>\s*)", r"\1" + banner, text, count=1, flags=re.I)
    (SITE / f"{name}.html").write_text(text, encoding="utf-8")


def check_refs(name):
    """A kész oldal helyi hivatkozásai léteznek-e (a build után fut, hogy az oldalak egymásra mutathassanak)."""
    text = (SITE / f"{name}.html").read_text(encoding="utf-8")
    missing = set()
    for attr in re.findall(r'(?:src|href)="([^"]+)"', text):
        if re.match(r"^(https?:|mailto:|tel:|#|data:)", attr):
            continue
        local = attr.split("#")[0].split("?")[0].lstrip("/")
        if local and not (SITE / local).exists():
            missing.add(local)
    for s in re.findall(r'srcset="([^"]+)"', text):
        for part in s.split(","):
            local = part.strip().split(" ")[0].lstrip("/")
            if local and not (SITE / local).exists():
                missing.add(local)
    for m in re.findall(r'content="(assets/[^"]+)"', text):
        if not (SITE / m).exists():
            missing.add(m)
    return missing


def write_seo_files():
    """sitemap.xml és robots.txt a public/ gyökerébe (mindig az összes oldalból)."""
    names = sorted(p.stem for p in PAGES.glob("*.html") if p.stem not in NOINDEX)
    names.sort(key=lambda n: (n != "index", n))
    urls = "\n".join(f"  <url><loc>{page_url(n)}</loc></url>" for n in names)
    (SITE / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n",
        encoding="utf-8")
    (SITE / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: " + SITE_URL + "/sitemap.xml\n",
        encoding="utf-8")


def main():
    only = sys.argv[1:]
    names = sorted(p.stem for p in PAGES.glob("*.html"))
    if only:
        names = [n for n in names if n in only]
    all_missing = {}
    for n in names:
        render(n)
        print(f"  ✓ {n}.html")
    write_seo_files()
    print("  ✓ sitemap.xml, robots.txt")
    for n in names:
        for m in check_refs(n):
            all_missing.setdefault(m, []).append(n)
    if all_missing:
        pages = {k: v for k, v in all_missing.items() if k.endswith(".html")}
        other = {k: v for k, v in all_missing.items() if not k.endswith(".html")}
        if pages:
            print("\nMég nem létező oldalak, amikre link mutat (más ügynök készíti):")
            for k in sorted(pages):
                print(f"  - {k}")
        if other:
            print("\nHIBA: hiányzó erőforrások:")
            for k, v in sorted(other.items()):
                print(f"  - {k}  (itt: {', '.join(v)})")
    if warnings:
        print("\nFigyelmeztetések:")
        for w in warnings:
            print("  ! " + w)
    print(f"\nKész: {len(names)} oldal -> {SITE}")
    return 1 if any(not k.endswith('.html') for k in all_missing) else 0


if __name__ == "__main__":
    sys.exit(main())

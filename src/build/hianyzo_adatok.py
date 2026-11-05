#!/usr/bin/env python3
"""
Összegyűjti az oldalak összes sárga cetlijét (<mark class="todo">) egy ellenőrző listába:
  docs/hianyzo-adatok.md

A build.py minden futáskor meghívja, így a lista mindig az oldalak aktuális állapotát mutatja.
Ha egy cetlit tényleges tartalomra cserélsz, a következő buildnél eltűnik a listáról.
Kézzel is futtatható:  python3 src/build/hianyzo_adatok.py

Csoportosítás: oldal → szakasz (a cetli előtti legközelebbi h1/h2/h3) → „Adat kell” / „Ellenőrizendő”.
A technikai/jogi tételek (Supabase, DPA, szakértői átnézés) külön, a fejlesztőnek szóló részbe kerülnek.
"""
import re
from pathlib import Path

BUILD = Path(__file__).resolve().parent
ROOT = BUILD.parent.parent
PAGES = BUILD / "pages"
PARTIALS = BUILD / "partials"
OUT = ROOT / "docs" / "hianyzo-adatok.md"

# Az oldalak sorrendje és magyar neve a listában (ami nincs itt, az a <title> alapján, a végére kerül).
PAGE_NAMES = {
    "index": "Főoldal",
    "rolunk": "Rólunk",
    "programok": "Programok (áttekintő)",
    "program-egyeni-fejlesztes": "Egyéni fejlesztés",
    "program-iskolaelokeszites": "Iskolaelőkészítő",
    "program-mozaik": "MOZAIK szorongásoldó műhely",
    "program-meresz-macska": "Merész Macska",
    "program-kutyas-foglalkozasok": "Kutyás foglalkozások Zafírral",
    "program-baratsagtabor": "Barátságtábor",
    "program-szulokonzultacio": "Szülőkonzultáció",
    "galeria": "Galéria",
    "kapcsolat": "Kapcsolat",
    "adatkezelesi-tajekoztato": "Adatkezelési tájékoztató",
    "impresszum": "Impresszum",
}
PARTIAL_NAMES = {"footer": "Minden oldalon (lábléc)", "header": "Minden oldalon (fejléc)", "cta-band": "Minden oldalon (CTA-sáv)"}

# Ezek nem Margarétára tartoznak, hanem a fejlesztőre vagy jogi átnézésre.
TECH_RE = re.compile(r"Supabase|DPA|adatfeldolgozói|adatvédelemben jártas|EU-USA", re.I)

MARK_RE = re.compile(r"<mark\b[^>]*\bclass=\"todo\"[^>]*>(.*?)</mark>", re.S)
TITLE_RE = re.compile(r'\btitle="([^"]*)"')
HEAD_RE = re.compile(r"<h([1-3])\b[^>]*>(.*?)</h\1>", re.S)
BLOCK_RE = re.compile(r"<(?:p|li|h[1-6]|dd|dt|td|th|figcaption|blockquote|label|summary)\b[^>]*>", re.S)


def clean(html):
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    html = re.sub(r"<mark\b.*?</mark>", "", html, flags=re.S)
    html = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", html).strip()


def context(text, mark_start):
    """A mondat/blokk, amelyhez a cetli tartozik (a cetli előtti szöveg ugyanabban az elemben)."""
    starts = [m.end() for m in BLOCK_RE.finditer(text, 0, mark_start)]
    if not starts:
        return ""
    ctx = clean(text[starts[-1]:mark_start])
    if len(ctx) > 170:
        ctx = "..." + ctx[-167:].split(" ", 1)[-1]
    return ctx


def scan(text):
    """[(szakasz, típus, kérdés, szövegkörnyezet)] a forrás sorrendjében, ismétlődés nélkül."""
    heads = [(m.start(), clean(m.group(2))) for m in HEAD_RE.finditer(text)]
    items, seen = [], set()
    for m in MARK_RE.finditer(text):
        tag = m.group(0)[: m.group(0).index(">") + 1]
        t = TITLE_RE.search(tag)
        title = (t.group(1) if t else "").strip()
        label = clean(m.group(1))
        ctx = context(text, m.start())
        kind = "Ellenőrizendő" if title.upper().startswith("ELLENŐRIZENDŐ") or label.startswith("Ellenőrizendő") else "Adat kell"
        question = re.sub(r"^(ADAT KELL|ELLENŐRIZENDŐ)\s*:\s*", "", title, flags=re.I) or label
        question = question[:1].upper() + question[1:]
        section = next((h for pos, h in reversed(heads) if pos < m.start()), "Az oldal teteje")
        key = (section, question)
        if key in seen:
            continue
        seen.add(key)
        items.append((section, kind, question, ctx))
    return items


def page_title(text, slug):
    m = re.search(r'@include head title="([^"|]*)', text)
    return (m.group(1).strip() if m else slug)


def main():
    groups = []  # (név, slug, [tételek])
    for slug, name in PARTIAL_NAMES.items():
        p = PARTIALS / f"{slug}.html"
        if p.exists():
            groups.append((name, f"partials/{slug}", scan(p.read_text(encoding="utf-8"))))
    sources = {p.stem: p for p in PAGES.glob("*.html")}
    order = [s for s in PAGE_NAMES if s in sources] + sorted(s for s in sources if s not in PAGE_NAMES)
    for slug in order:
        text = sources[slug].read_text(encoding="utf-8")
        groups.append((PAGE_NAMES.get(slug) or page_title(text, slug), f"pages/{slug}", scan(text)))

    margareta, tech = [], []
    for name, src, items in groups:
        m_items = [i for i in items if not TECH_RE.search(i[2])]
        t_items = [i for i in items if TECH_RE.search(i[2])]
        if m_items:
            margareta.append((name, src, m_items))
        if t_items:
            tech.append((name, src, t_items))

    n_adat = sum(1 for _, _, its in margareta for i in its if i[1] == "Adat kell")
    n_ell = sum(1 for _, _, its in margareta for i in its if i[1] == "Ellenőrizendő")

    out = [
        "# Hiányzó és ellenőrizendő adatok",
        "",
        "> **Ez a fájl automatikusan készül** (`src/build/hianyzo_adatok.py`, minden buildnél). Ne szerkeszd kézzel:",
        "> ha egy sárga cetlit valódi tartalomra cserélünk az oldalon, a következő buildnél eltűnik innen.",
        "> A rövid, emberi kérdéslista Margarétának: `docs/kerdesek-margaretanak.md`.",
        "",
        "Kedves Margaréta! Ez a lista az oldal összes sárga cetlijét tartalmazza, oldalanként és szakaszonként.",
        "",
        "- **Adat kell**: hiányzó információ, ezt Öntől kérjük.",
        "- **Ellenőrizendő**: már beírtunk valamit, de nem vagyunk biztosak benne. Kérjük, erősítse meg, vagy javítsa.",
        "",
        "Elég, ha a válaszokat a kérdés mellé írja (vagy szóban elmondja), mi beépítjük. Ami nem releváns, azt nyugodtan húzza át.",
        "",
        f"**Összesen: {n_adat} hiányzó adat és {n_ell} ellenőrizendő pont.**",
        "",
        "## Tartalom",
        "",
    ]
    for name, src, items in margareta:
        anchor = re.sub(r"[^\w\- ]", "", name.lower()).strip().replace(" ", "-")
        out.append(f"- [{name}](#{anchor}) ({len(items)})")
    if tech:
        out.append("- [Fejlesztőnek és jogi átnézéshez](#fejlesztőnek-és-jogi-átnézéshez)")
    out.append("")

    def emit(items):
        last = None
        for section, kind, question, ctx in items:
            if section != last:
                out.append("")
                out.append(f"**{section}**")
                out.append("")
                last = section
            out.append(f"- [ ] *{kind}:* {question}")
            if ctx and ctx.rstrip(" .:") != section.rstrip(" .:"):
                out.append(f"  <br><sub>Az oldalon: „{ctx}”</sub>")

    for name, src, items in margareta:
        out += ["", f"## {name}", "", f"<sub>Forrás: `src/build/{src}.html`</sub>"]
        emit(items)
        out.append("")
    if tech:
        out += ["", "## Fejlesztőnek és jogi átnézéshez", "", "Ezek nem Margaréta feladatai, hanem az élesítést végzőé."]
        for name, src, items in tech:
            out += ["", f"### {name}", "", f"<sub>Forrás: `src/build/{src}.html`</sub>"]
            emit(items)
        out.append("")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
    return n_adat, n_ell


if __name__ == "__main__":
    a, e = main()
    print(f"docs/hianyzo-adatok.md: {a} hiányzó adat, {e} ellenőrizendő pont")

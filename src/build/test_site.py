#!/usr/bin/env python3
"""
Gyors minőségellenőrzés Playwrighttal (chromium).
  python3 site/_build/test_site.py                 # minden kész site/*.html
  python3 site/_build/test_site.py index programok # csak ezek
Mit csinál: saját http szervert indít a site/ mappán, oldalanként 1440px és 390px széles
teljes oldalas screenshotot készít a _screens/ mappába, és jelenti:
  - konzolhibák és oldalhibák (JS kivételek)
  - 4xx/5xx válaszok és sikertelen kérések (404-es erőforrások)
  - vízszintes túlcsordulás (document.documentElement.scrollWidth > innerWidth, és olyan elem, ami csak a html/body vágása miatt nem okoz görgetést) + a "bűnös" elemek
  - képek alt / width / height hiánya, 44px-nél kisebb gombok/linkek (csak figyelmeztetés)
  - interakciók (1440px-en, ha az oldalon van ilyen):
      lightbox  [data-lightbox]: megnyílik, nyíl jobbra lapoz, Tab a dialógusban marad, Esc bezár, a fókusz visszatér
      űrlap     form[data-demo-form]: üres küldés -> hibaüzenetek; kitöltve -> (szimulált /api/kapcsolat) -> .form-success köszönő kártya
      másolás   button[data-copy]: kattintásra visszajelzés (Kimásolva / Kijelölve)
Kilépési kód 1, ha hiba volt.
"""
import os
import sys
import threading
import functools
import http.server
import socketserver
from pathlib import Path
from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parent.parent.parent / "public"
SCREENS = Path(__file__).resolve().parent.parent.parent / "_screens"
WIDTHS = [1440, 390]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(SITE))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


OVERFLOW_JS = """() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1)) {
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body && p !== document.documentElement) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible') { clipped = true; break; } p = p.parentElement; }
        if (!clipped) out.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
      }
      if (out.length > 12) break;
    }
  }
  return {scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, offenders: out};
}"""

AUDIT_JS = """() => {
  const res = {imgs: [], small: []};
  document.querySelectorAll('img').forEach(i => {
    const miss = [];
    if (!i.hasAttribute('alt')) miss.push('alt');
    if (!i.hasAttribute('width') || !i.hasAttribute('height')) miss.push('width/height');
    if (miss.length) res.imgs.push(i.getAttribute('src') + ' (' + miss.join(', ') + ')');
  });
  document.querySelectorAll('a.btn, button, .chip--filter, .menu-toggle').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width && r.height && (r.height < 43.5 || r.width < 43.5) && getComputedStyle(el).visibility !== 'hidden')
      res.small.push((el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  return res;
}"""


def interactive_checks(page):
    """Lightbox, bemutató űrlap és másolás gomb kipróbálása. Hibák listáját adja vissza."""
    errs = []
    if page.locator("[data-lightbox] [data-lightbox-item]").count():
        page.keyboard.press("Escape")
        first = page.locator("[data-lightbox] [data-lightbox-item]").first
        first.scroll_into_view_if_needed()
        first.click()
        page.wait_for_timeout(150)
        dlg = page.locator("dialog.lightbox")
        if not dlg.evaluate("d => d.open"):
            errs.append("lightbox: nem nyílt meg")
        else:
            c1 = page.locator(".lightbox__count").inner_text()
            page.keyboard.press("ArrowRight")
            c2 = page.locator(".lightbox__count").inner_text()
            if c1 == c2:
                errs.append("lightbox: a jobbra nyíl nem lapozott")
            if not page.locator(".lightbox__media").evaluate("m => !!m.firstElementChild"):
                errs.append("lightbox: üres a kép helye")
            for _ in range(5):
                page.keyboard.press("Tab")
            if not page.evaluate("() => !!document.activeElement.closest('dialog.lightbox')"):
                errs.append("lightbox: a fókusz kiszökött a dialógusból")
            page.keyboard.press("Escape")
            page.wait_for_timeout(100)
            if dlg.evaluate("d => d.open"):
                errs.append("lightbox: Esc nem zárta be")
            elif not page.evaluate("() => !!document.activeElement.closest('[data-lightbox-item]')"):
                errs.append("lightbox: bezárás után a fókusz nem tért vissza a megnyitó elemre")
    if page.locator("button[data-copy]").count():
        b = page.locator("button[data-copy]").first
        b.scroll_into_view_if_needed()
        b.click()
        page.wait_for_timeout(250)
        if "copied" not in (b.get_attribute("class") or "") and "selected" not in (b.get_attribute("class") or ""):
            errs.append("másolás: nincs visszajelzés")
    form = page.locator("form[data-demo-form]")
    if form.count():
        f = form.first
        f.locator("[type=submit]").click()
        n_err = f.locator(".field__error").count()
        if n_err == 0:
            errs.append("űrlap: üres küldésre nincs hibaüzenet")
        if not page.evaluate("() => document.activeElement && document.activeElement.getAttribute('aria-invalid') === 'true'"):
            errs.append("űrlap: a fókusz nem az első hibás mezőre került")
        for inp in f.locator("input[required]:not([type=checkbox]), textarea[required]").all():
            inp.fill("Teszt Elek" if inp.get_attribute("name") != "email" else "teszt@pelda.hu")
        for name in ("email", "telefon"):
            loc = f.locator(f"[name={name}]")
            if loc.count():
                loc.fill("teszt@pelda.hu" if name == "email" else "30 123 4567")
        for cb in f.locator("input[type=checkbox][required]").all():
            cb.check(force=True)
        f.locator("[type=submit]").click()
        try:
            page.locator(".form-success").wait_for(timeout=3000)
        except Exception:
            pass
        if not page.locator(".form-success").count():
            errs.append("űrlap: kitöltött küldés után nincs köszönő kártya")
        elif "bemutató" in page.locator(".form-success").inner_text():
            errs.append("űrlap: éles köszönő kártyán nem lehet bemutató-megjegyzés")
    return errs


def main():
    names = sys.argv[1:] or sorted(p.stem for p in SITE.glob("*.html"))
    SCREENS.mkdir(exist_ok=True)
    httpd = serve()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"
    errors = 0
    with sync_playwright() as p:
        # CHROMIUM_PATH: meglévő Chromium használata (ha a Playwright saját böngészője nincs letöltve)
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for name in names:
            for w in WIDTHS:
                ctx = browser.new_context(viewport={"width": w, "height": 900}, device_scale_factor=1)
                page = ctx.new_page()
                # A statikus tesztszerver nem tud POST-ot: az /api/kapcsolat választ itt szimuláljuk.
                page.route("**/api/kapcsolat", lambda r: r.fulfill(status=200, content_type="application/json", body='{"ok":true}'))
                logs, bad = [], []
                page.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
                page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
                page.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 else None)
                page.on("requestfailed", lambda r: bad.append(f"FAILED {r.url}"))
                page.goto(f"{base}/{name}.html", wait_until="networkidle")
                # lusta képek betöltése: végiggörgetünk
                page.evaluate("""async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo({top: y, behavior: 'instant'}); await new Promise(r => setTimeout(r, 60)); } window.scrollTo({top: 0, behavior: 'instant'}); }""")
                page.wait_for_timeout(700)
                ov = page.evaluate(OVERFLOW_JS)
                au = page.evaluate(AUDIT_JS)
                shot = SCREENS / f"{name}-{w}.png"
                page.screenshot(path=str(shot), full_page=True, animations="disabled")
                inter = interactive_checks(page) if w == WIDTHS[0] else []
                logs.extend("interakció: " + e for e in inter)
                status = "OK"
                if logs or bad or ov["scrollWidth"] > ov["innerWidth"] or ov["offenders"]:
                    status = "HIBA"
                    errors += 1
                print(f"[{status}] {name} @ {w}px  scrollWidth={ov['scrollWidth']} innerWidth={ov['innerWidth']}  -> {shot.relative_to(SCREENS.parent)}")
                for l in logs:
                    print("   console:", l)
                for b in bad:
                    print("   http:", b)
                for o in ov["offenders"]:
                    print("   túllóg:", o)
                for i in au["imgs"]:
                    print("   ! img:", i)
                for s in au["small"]:
                    print("   ! kicsi célterület:", s)
                ctx.close()
        browser.close()
    httpd.shutdown()
    print("\nÖsszesen hibás nézet:", errors)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

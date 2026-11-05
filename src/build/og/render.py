#!/usr/bin/env python3
"""Az og-image.html-ből elkészíti az assets/img/og-image.png-t (1200x630). Playwright (chromium) kell hozzá."""
from pathlib import Path
from playwright.sync_api import sync_playwright
here = Path(__file__).resolve().parent
out = here.parent.parent.parent / "public" / "assets" / "img" / "og-image.png"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.goto((here / "og-image.html").as_uri())
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(out))
    b.close()
print("kész:", out)

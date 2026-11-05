# AI-wiki: Csodabogár weboldal

A projekt „emlékezete”. Minden új chat/munkamenet **ezzel kezd** (a `CLAUDE.md` után), és **ezzel zár**: a végén frissíti a munkanaplót, a döntéseket és a tanulságokat.
A `CLAUDE.md` a szabályokat tartalmazza (hogyan kell dolgozni), ez a fájl a történetet és a miérteket (mit csináltunk, mit döntöttünk, mit tanultunk).

---

## 1. Gyorsindítás új munkamenethez

1. Olvasd el: `CLAUDE.md` (szabályok) → ezt a fájlt → `README.md` (élesítés, szerkesztés).
2. Nézd meg a **6. Jelenlegi állapot** és a **7. Következő lépések** részt.
3. Ha tartalmat kell pótolni: `docs/hianyzo-adatok.md` (automatikus lista az összes sárga cetliről) és `docs/kerdesek-margaretanak.md` (rövid kérdéslista).
4. Munka közben: szöveg a `src/build/pages/` alatt → `python3 src/build/build.py` → tesztek → commit + push.
5. Tesztek:
   ```bash
   python3 src/build/build.py
   node --test tests/*.test.js
   python3 src/build/test_site.py          # Playwright kell; meglévő Chromiummal: CHROMIUM_PATH=/út/chrome
   ```
   Elvárás: 0 hibás nézet, minden API-teszt zöld, és a build után a `git diff` csak a szándékolt változást mutatja.
6. A munka végén: **frissítsd ezt a fájlt** (lásd 9. rész).

---

## 2. A projekt egy bekezdésben

A tatai Csodabogár Fejlesztő Műhely (Píri Margaréta, „Margó”, pszichológus és gyógypedagógus) weboldala, 5-16 éves gyerekek szüleinek. Megrendelő: Benedek (RAYO Marketing), Margaréta fia. A cél egy meleg hangú, játékos oldal, amiről a szülő időpontot kér. Az oldal statikus, a Vercel hostolja, a kapcsolati űrlap egy Vercel-függvényen át a Supabase-be ment, és e-mailt küld Margarétának (Resend). Tervezett domain: `tataifejlesztes.hu` (a régi oldal domainje, a Google ismeri).

---

## 3. Az egész logikája (architektúra)

```
src/build/pages/*.html  ─┐
src/build/partials/*.html ┼─ build.py ──► public/*.html, sitemap.xml, robots.txt ──► Vercel (statikus)
public/assets/svg/*.svg ─┘           └─► docs/hianyzo-adatok.md (sárga cetlik listája)

böngésző űrlap ──POST /api/kapcsolat──► api/kapcsolat.js (Vercel függvény)
                                          ├─► Supabase REST: kapcsolat_uzenetek tábla (service_role kulccsal)
                                          └─► Resend: értesítő e-mail Margarétának (reply_to = szülő e-mailje)
```

- **Build:** `src/build/build.py`, csak Python standard könyvtár. Jelölők: `@include` (partial + `{{param|alap}}`), `@icon` (ui-*.svg inline), `@svg` (díszítő SVG inline). Utómunka: korosztály-tartományok (pl. 6-10) nem törhetnek sort (`span.nowrap`), aktív menüpont (`aria-current`), JSON-LD abszolút URL-ek, canonical/og a `SITE_URL`-ből, a 404-es oldal gyökér-relatív linkjei, hivatkozás-ellenőrzés (hiányzó asset = hiba).
- **Kész oldalak:** a `public/` mappa **commitolva van**, a Vercelen nincs build (`vercel.json`: üres build/install, output `public`, `cleanUrls`).
- **Űrlap-függvény:** `api/kapcsolat.js`, külső npm-csomag nélkül (`fetch`). Szerveroldali validálás, honeypot (`weboldal` mező) + időzítés (2,5 mp-nél gyorsabb kitöltés = bot, ilyenkor álsikert ad vissza). Ha a Supabase-mentés hibázik, az e-mail akkor is kimegy, hogy a jelentkezés ne vesszen el.
- **Adatbázis:** egyetlen tábla (`supabase/migrations/...kapcsolat_uzenetek.sql`). RLS be van kapcsolva, és **nincs nyilvános policy**: böngészőből (anon kulccsal) senki nem ír és nem olvas, csak a függvény a service_role kulccsal. Margaréta a Supabase Table Editorban látja az üzeneteket, az `allapot` oszlopot (uj / visszahivva / lezarva) kézzel állítja.
- **Sárga cetlik:** `<mark class="todo">`. A `site.js` előnézeten (localhost, *.vercel.app, claude) mutatja, saját domainen automatikusan elrejti. A `docs/hianyzo-adatok.md` ezekből készül.
- **Tesztek:** `tests/kapcsolat.test.js` (validálás, botszűrés, handler-ágak, mockolt fetch-csel); `src/build/test_site.py` (Playwright: minden oldal 1440 és 390 px-en, konzolhiba, 4xx/5xx, vízszintes túlcsordulás, lightbox, űrlap, másolás gomb; képernyőképek a `_screens/` mappába).
- **CI:** `.github/workflows/ci.yml` minden pushnál: build → a `public/` és a `docs/hianyzo-adatok.md` naprakész-e → API-tesztek → böngészős teszt.

---

## 4. Döntésnapló

Formátum: dátum · döntés · miért. Újat a táblázat végére írj.

| Dátum | Döntés | Miért |
|---|---|---|
| 2026-11-05 (1. chat) | Statikus HTML + saját mini Python build, nem keretrendszer | Kicsi oldal, nincs szükség Reactra/Next-re; függőség nélkül bárhol fut, a kész HTML egyszerűen hostolható és olvasható. |
| 2026-11-05 (1. chat) | Vercel függvény + Supabase + Resend az űrlaphoz | Ingyenes szinten elég; a Supabase-ben visszakereshetők az üzenetek, az e-mail azonnal szól. |
| 2026-11-05 (1. chat) | RLS be, policy nélkül; csak service_role ír | Gyerekekről szóló érzékeny adat: a böngészőből semmilyen hozzáférés ne legyen. |
| 2026-11-05 (1. chat) | Supabase régió: Frankfurt (EU) | GDPR. Az adatkezelési tájékoztató is ezt állítja, ezért élesítéskor ellenőrizni kell. |
| 2026-11-05 (1. chat) | Fontok self-hostolva (Baloo 2, Nunito, Caveat) | GDPR (nincs Google Fonts-hívás), és mert a Fredoka/Comic Neue nem tud ő/ű betűt. |
| 2026-11-05 (1. chat) | „Csodabogár füzet” design, egytémás világos | Gyerekes, játékos, de a szülőnek szóló, nyugodt hangulat. Tudatos döntés, sötét mód nincs. |
| 2026-11-05 (1. chat) | Hiányzó adat helyén sárga cetli, nem kitalált szöveg | Nem találunk ki tényt; Margaréta előnézeten látja, mi hiányzik; élesen a cetli automatikusan rejtett. |
| 2026-11-05 (2. munkamenet) | A zip egyetlen commitját történettel együtt importáltuk a GitHub-repóba | Megmarad az eredeti szerző és állapot, a változások visszakövethetők. |
| 2026-11-05 (2.) | A `public/` commitolva marad, a Vercelen nincs build | A Vercel build-környezetében nem kell Pythonra hagyatkozni; ami a repóban van, pontosan az megy ki. A CI ellenőrzi, hogy a `public/` friss-e. |
| 2026-11-05 (2.) | `SITE_URL` a build.py-ban (alap: `https://tataifejlesztes.hu`) | A canonical, og:url/og:image, JSON-LD és sitemap abszolút URL-t igényel; domainváltáskor egy helyen kell átírni. |
| 2026-11-05 (2.) | Jogi oldalak (adatkezelési tájékoztató, impresszum) tervezetként, cetlikkel | Élesítés feltétele (gyermekekről szóló adatot gyűjtünk). A hiányzó jogi adatokat nem találtuk ki; szakértői átnézés kell. |
| 2026-11-05 (2.) | Az oldal sütimentes, nincs analitika | Így nem kell sütisáv, és a tájékoztató egyszerű. Ha analitika kerül be, a tájékoztatót és ezt a sort is frissíteni kell. |
| 2026-11-05 (2.) | A belső linkek `.html` végűek maradtak | Helyi előnézet `python -m http.server`-rel így működik; a Vercel `cleanUrls` 308-cal átirányít, a canonical a tiszta URL. Később átírható, ha számít a plusz átirányítás. |
| 2026-11-05 (2.) | npm-script neve `build:pages`, nem `build` | A Vercel a `build` nevű scriptet automatikusan futtathatná, pedig ott nincs build. |
| 2026-11-05 (3.) | `docs/hianyzo-adatok.md` automatikusan a cetlikből, minden buildnél | Egy helyen látszik minden hiányzó adat, mindig naprakészen, a pontos oldalszöveggel együtt. Kézi lista elavulna. |
| 2026-11-05 (3.) | AI-wiki (`docs/AI-WIKI.md`), kötelező olvasni/frissíteni | Új chat ne induljon nulláról: legyen meg a logika, a döntések és a tanulságok. |

---

## 5. Tanulságok, buktatók

- **Playwright verzió vs. böngésző:** a pip-ből frissen telepített Python Playwright más Chromium-revíziót vár, mint ami a gépen van. Megoldás: `CHROMIUM_PATH=/opt/pw-browsers/chromium-XXXX/chrome-linux64/chrome python3 src/build/test_site.py` (a teszt ezt támogatja). CI-ben `python -m playwright install --with-deps chromium`.
- **404-es oldal relatív linkjei:** a Vercel a 404-et bármilyen mély útvonalon (`/a/b/c`) kiszolgálja, ott a relatív `assets/...` eltörne. Ezért a 404 gyökér-relatív linkeket kap (`ROOT_RELATIVE` a build.py-ban).
- **Noindex oldalnak nem kell canonical:** a 404-ről a build kiveszi a canonical és og:url sort (`NOINDEX`).
- **JSON-LD:** a forrásban relatív (`#csodabogar`, `programok.html`), a build abszolútra írja. Az `@id`-k (pl. `https://tataifejlesztes.hu/#csodabogar`) oldalakon átívelően ugyanazt az entitást jelölik.
- **Sötét háttéren a link:** a láblécben a linkek fehérek (`.site-footer a:not(.btn)`); új link a láblécbe ezért külön stílus nélkül jó.
- **Évszám a láblécben:** buildkor kerül bele (`{{year}}`). Januárban egy build + commit kell, különben a CI jelzi, hogy a `public/` elavult.
- **A GitHub-repó üres volt, nincs `main` ág:** az első push a fejlesztési ágat tette alapértelmezetté. A Vercel élesítéshez `main` kell (vagy a Vercelben a production branch átállítása).
- **Push figyelmeztetés:** `fatal: expected 'acknowledgments'... proceeding anyway` a proxy miatt jön, a push ettől sikeres. `git ls-remote origin`-nal ellenőrizhető.
- **Szövegírás:** hosszú gondolatjel (– —) tilos, a szülőket magázzuk. Új szöveg után: `grep -rn "–\|—" src/build docs`.
- **Hangfelvételből jövő kérések:** a felhasználó gyakran diktál, a leirat torz lehet. Írd le, hogyan értelmezed a kérést, és ha nem egyértelmű, kérdezz vissza.

---

## 6. Jelenlegi állapot (2026-11-05)

- 15 oldal kész: főoldal, programok + 7 programoldal, rólunk, galéria, kapcsolat, adatkezelési tájékoztató, impresszum, 404.
- Tesztek zöldek (30/30 nézet, 6/6 API-teszt).
- Kód: `github.com/benny-rayo/csodabogar-weboldal`, ág: `claude/determined-volta-vmsoax` (még nincs `main`).
- **Nincs élesítve:** a Vercel- és a Supabase-projekt még nem jött létre, a környezeti változók nincsenek beállítva.
- Tartalom: 85 hiányzó adat és 57 ellenőrizendő pont (`docs/hianyzo-adatok.md`). A képek ideiglenes AI-képek és fotóhelyek.

---

## 7. Következő lépések

1. `main` ág létrehozása (PR a fejlesztési ágból).
2. Supabase-projekt (Frankfurt) + migráció; Vercel-projekt + környezeti változók; Resend-kulcs és domain-ellenőrzés (README 2-4. lépés).
3. Margaréta válaszai alapján a cetlik kiváltása (`docs/hianyzo-adatok.md`), valódi fotók.
4. Jogi oldalak: hiányzó cégadatok, szakértői átnézés, DPA-k.
5. Domain (`tataifejlesztes.hu`) bekötése, régi URL-ek átirányítása, Search Console + sitemap.

---

## 8. Munkanapló

Legújabb alul. Minden munkamenet egy bejegyzés: mit kértek, mit csináltunk, mi maradt nyitva.

### 2026-11-05 · 1. chat (repó nélkül)
- Claude-ügynökök sima chatben készítették az oldalt, zipben adták át. A folyamat részletei nem maradtak meg; ami tudható, a kódból, a `CLAUDE.md`-ből és a README-ből derül ki.
- Eredmény: 12 oldal, design-rendszer, űrlap + Vercel-függvény + Supabase-migráció, tesztek, kérdéslista Margarétának.

### 2026-11-05 · 2. munkamenet (GitHub, élesítés előkészítése)
- Kérés: a zipből GitHub-projekt, befejezés, hogy Vercellel és Supabase-zel hostolható legyen.
- Az eredeti commit importálva; alapállapot: minden teszt zöld.
- Új: adatkezelési tájékoztató, impresszum, 404, `SITE_URL` (canonical, og, JSON-LD), sitemap.xml, robots.txt, GitHub Actions CI, `CHROMIUM_PATH` a teszthez, README és CLAUDE.md frissítés.
- Nyitott: `main` ág, Vercel/Supabase létrehozása (a felhasználó jóváhagyására vár).

### 2026-11-05 · 3. munkamenet (hiányzó adatok, AI-wiki)
- Kérés (diktálva): gyűjtsük össze, mit kell Margarétának megadnia vagy megerősítenie; vezessünk AI-wikit a munkáról, döntésekről, tanulságokról.
- Új: `src/build/hianyzo_adatok.py` → `docs/hianyzo-adatok.md` (oldalanként, szakaszonként, a cetli melletti oldalszöveggel; a technikai/jogi tételek külön), a build és a CI része. Ez a wiki, és a `CLAUDE.md` szabálya a vezetésére.

---

## 9. Hogyan frissítsd ezt a fájlt

Minden munkamenet végén, a commit előtt:
1. **Munkanapló:** új bejegyzés (dátum, sorszám, rövid cím): mit kértek, mit csináltunk, mi maradt nyitva.
2. **Döntésnapló:** minden nem magától értetődő döntés egy sorban, a *miérttel* együtt. Ha egy korábbi döntést felülírunk, a régi sor marad, és az új sor hivatkozik rá.
3. **Tanulságok:** ami időt vitt el, vagy amibe a következő munkamenet is belefutna.
4. **Jelenlegi állapot** és **Következő lépések:** írd át, hogy a valóságot mutassák.
5. Ha a szabályok változtak (szövegírás, technika), az a `CLAUDE.md`-be megy, ide csak a döntés és az oka.

Tömören írj, a kód részleteit ne másold ide (azok a kódban és a kommentekben vannak). A cél: egy új munkamenet 5 perc alatt értse, hol tartunk és miért.

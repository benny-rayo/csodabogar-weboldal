# Csodabogár Fejlesztő Műhely: weboldal

A tatai Csodabogár Fejlesztő Műhely (Píri Margaréta) weboldala.
Statikus HTML/CSS/JS oldal, amit a **Vercel** hostol. A kapcsolati űrlap egy Vercel szerverfüggvényen keresztül a **Supabase**-be ment, és e-mailt küld (Resend).

Repó: [github.com/benny-rayo/csodabogar-weboldal](https://github.com/benny-rayo/csodabogar-weboldal)

```
public/                 ← ez kerül ki a Vercelre (kész oldalak + assets, sitemap.xml, robots.txt)
src/build/pages/        ← az oldalak FORRÁSA (ezt szerkeszd)
src/build/partials/     ← közös fejléc, lábléc, CTA-sáv, head
src/build/build.py      ← a forrásból legyártja a public/*.html, sitemap.xml, robots.txt fájlokat
src/build/test_site.py  ← böngészős teszt (konzolhiba, 404, mobil túlcsordulás, űrlap)
api/kapcsolat.js        ← POST /api/kapcsolat: űrlap → Supabase + e-mail
supabase/migrations/    ← az adatbázis-tábla SQL-je
tests/                  ← az API tesztjei (node --test)
.github/workflows/      ← CI: minden pushnál build-ellenőrzés + tesztek
```

Oldalak: főoldal, programok (+7 programoldal), rólunk, galéria, kapcsolat, adatkezelési tájékoztató, impresszum, 404.

## Élesítés (kb. 20 perc)

### 1. GitHub
A kód már a fenti repóban van. A Vercel a **`main`** ágat teszi ki élesre, minden más ágból előnézeti (preview) link készül.
Ha még nincs `main` ág: GitHubon nyiss egy pull requestet a fejlesztési ágból `main`-be, vagy a repó **Settings → Branches** alatt állítsd be az alapértelmezett ágat.

### 2. Supabase
1. [supabase.com](https://supabase.com) → **New project**. Régió: **Central EU (Frankfurt)** (GDPR miatt EU-s szerver kell, gyerekekről szóló adatok mennek bele, és az adatkezelési tájékoztató is ezt írja).
2. **SQL Editor** → másold be a `supabase/migrations/20261105000000_kapcsolat_uzenetek.sql` tartalmát → **Run**.
   (Supabase CLI-vel: `supabase link --project-ref <ref>`, majd `supabase db push`.)
3. **Project Settings → API**: jegyezd fel a `Project URL`-t és a `service_role` kulcsot. A service_role kulcs titkos, soha ne kerüljön a böngészős kódba vagy a GitHubra.

Az üzenetek a **Table Editor → kapcsolat_uzenetek** táblában látszanak. Az `allapot` oszlopot (uj / visszahivva / lezarva) Margaréta kézzel állíthatja.
A tábla RLS-sel védett, és nincs nyilvános szabálya: a böngészőből senki nem fér hozzá, csak a szerverfüggvény ír bele.

### 3. E-mail értesítés (Resend, ajánlott)
Supabase magától nem szól, ha új üzenet jön, ezért kell az e-mail.
1. [resend.com](https://resend.com) → regisztráció → **API Keys** → új kulcs.
2. Saját domainnél: **Domains** → domain hozzáadása, DNS rekordok beállítása. Amíg nincs domain, a `onboarding@resend.dev` feladóval csak a Resend-fiók saját e-mail-címére tud küldeni (teszteléshez jó).

Ha a Supabase-mentés valamiért nem sikerül, a függvény akkor is elküldi az e-mailt, hogy a jelentkezés ne vesszen el.

### 4. Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → importáld a `benny-rayo/csodabogar-weboldal` repót.
2. Framework: **Other**. Build/Install command üres, Output Directory: `public` (a `vercel.json` ezt beállítja, nem kell átírni). A Vercelen nincs build: a kész `public/` mappa van commitolva.
3. **Settings → Environment Variables** (a `.env.example` alapján, Production és Preview környezetre is):

   | Név | Érték |
   |---|---|
   | `SUPABASE_URL` | a Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | a service_role kulcs |
   | `RESEND_API_KEY` | a Resend kulcs |
   | `NOTIFY_EMAIL` | `tataifejlesztes@gmail.com` |
   | `FROM_EMAIL` | pl. `Csodabogár weboldal <uzenet@tataifejlesztes.hu>` |

4. **Deploy.** Ezután minden `git push` automatikusan új verziót tesz ki.
5. Domain: **Settings → Domains** → `tataifejlesztes.hu` (ez a régi domain, a Google már ismeri), és a `www.tataifejlesztes.hu` irányítson át rá.

### 5. Domain a kódban
A canonical link, az `og:url`/`og:image`, a JSON-LD és a `sitemap.xml` abszolút URL-jei a `SITE_URL`-ből készülnek (alapértelmezés: `https://tataifejlesztes.hu`, a `src/build/build.py` elején).
Ha más lesz a domain: `SITE_URL=https://masik-domain.hu python3 src/build/build.py`, és commitold a változást (vagy írd át az alapértéket a build.py-ban).

Élesítés után: **Google Search Console** → a domain hozzáadása → **Sitemaps** → `sitemap.xml` beküldése.

## Sárga „Adat kell” cetlik
- Előnézeten (`localhost`, `*.vercel.app`) a cetlik **látszanak**, hogy Margaréta lássa, mi hiányzik még.
- Saját domainen (pl. `tataifejlesztes.hu`) **automatikusan rejtve** vannak, a kapcsológombbal együtt.
- Élesítés előtt a cetliket érdemes tényleges tartalommal kiváltani. Lista: `grep -rn 'class="todo"' src/build`

## Szerkesztés
1. Szöveget/oldalt **mindig a `src/build/pages/` alatt** szerkessz (a `public/*.html` generált, felülíródik).
2. `python3 src/build/build.py` → legyártja a `public/` oldalakat.
3. Ellenőrzés: `python3 src/build/test_site.py` (Playwright kell: `pip install playwright && python -m playwright install chromium`) és `node --test tests/*.test.js`.
   Ha a gépen már van Chromium, a `CHROMIUM_PATH=/út/a/chrome` változóval azt is használhatja a teszt.
4. `git commit` + `git push` → a GitHub Actions lefuttatja a teszteket, a Vercel kiteszi.

A CI elbukik, ha a `public/` nem egyezik a forrásból generálttal (pl. valaki kézzel szerkesztette, vagy elfelejtett buildelni). Ilyenkor: build, commit, push.
Január elején egy build + commit frissíti a lábléc évszámát is.

Helyi előnézet: `python3 -m http.server 8000 --directory public` (az űrlap küldése így nem működik, ahhoz `vercel dev` kell).

## Élesítés előtti teendők
- [x] Adatkezelési tájékoztató és impresszum oldal (tervezet, a hiányzó adatok sárga cetlin).
- [ ] A jogi oldalak hiányzó adatai: hivatalos név és forma, székhely, nyilvántartási szám, adószám, megőrzési idő, hatályba lépés dátuma.
- [ ] Az adatkezelési tájékoztatót adatvédelemben jártas szakember nézze át (gyermekekről szóló, érzékeny adatok). Adatfeldolgozói szerződés (DPA) a Vercellel, Supabase-zel, Resenddel.
- [ ] Margaréta kérdéslistája: `docs/kerdesek-margaretanak.md`.
- [ ] Valódi fotók a helyőrzők helyére (a jelenlegi képek a kreatívokból kivágott, ideiglenes AI-képek).
- [x] Az `og:image` és az `og:url` abszolút URL (a `SITE_URL`-ből).
- [ ] Ha a régi `tataifejlesztes.hu` oldalnak voltak ismert aloldalai, azokra átirányítás a `vercel.json` `redirects` részében (különben 404-et kapnak a régi Google-találatok).
- [ ] Google Cégprofil egységesítése (cím: Alkotmány u. 2.).

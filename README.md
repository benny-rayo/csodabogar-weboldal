# Csodabogár Fejlesztő Műhely: weboldal

A tatai Csodabogár Fejlesztő Műhely (Píri Margaréta) weboldala.
Statikus HTML/CSS/JS oldal, amit a **Vercel** hostol. A kapcsolati űrlap egy Vercel szerverfüggvényen keresztül a **Supabase**-be ment, és e-mailt küld (Resend).

```
public/                 ← ez kerül ki a Vercelre (kész oldalak + assets)
src/build/pages/        ← az oldalak FORRÁSA (ezt szerkeszd)
src/build/partials/     ← közös fejléc, lábléc, CTA-sáv, head
src/build/build.py      ← a forrásból legyártja a public/*.html fájlokat
src/build/test_site.py  ← böngészős teszt (konzolhiba, 404, mobil túlcsordulás, űrlap)
api/kapcsolat.js        ← POST /api/kapcsolat: űrlap → Supabase + e-mail
supabase/migrations/    ← az adatbázis-tábla SQL-je
tests/                  ← az API tesztjei (node --test)
```

## Első élesítés (kb. 20 perc)

### 1. GitHub
1. Hozz létre egy új, **privát** repót (pl. `csodabogar-web`).
2. Töltsd fel ennek a mappának a teljes tartalmát (a `.gitignore`-ral együtt), vagy:
   ```bash
   git remote add origin https://github.com/<fiok>/csodabogar-web.git
   git push -u origin main
   ```

### 2. Supabase
1. [supabase.com](https://supabase.com) → **New project**. Régió: **Central EU (Frankfurt)** (GDPR miatt EU-s szerver kell, gyerekekről szóló adatok mennek bele).
2. **SQL Editor** → másold be a `supabase/migrations/20261105000000_kapcsolat_uzenetek.sql` tartalmát → **Run**.
3. **Project Settings → API**: jegyezd fel a `Project URL`-t és a `service_role` kulcsot. A service_role kulcs titkos, soha ne kerüljön a böngészős kódba vagy a GitHubra.

Az üzenetek a **Table Editor → kapcsolat_uzenetek** táblában látszanak. Az `allapot` oszlopot (uj / visszahivva / lezarva) Margaréta kézzel állíthatja.

### 3. E-mail értesítés (Resend, ajánlott)
Supabase magától nem szól, ha új üzenet jön, ezért kell az e-mail.
1. [resend.com](https://resend.com) → regisztráció → **API Keys** → új kulcs.
2. Saját domainnél: **Domains** → domain hozzáadása, DNS rekordok beállítása. Amíg nincs domain, a `onboarding@resend.dev` feladóval csak a Resend-fiók saját e-mail-címére tud küldeni (teszteléshez jó).

### 4. Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → importáld a GitHub repót.
2. Framework: **Other**. Build/Install command üres, Output Directory: `public` (a `vercel.json` ezt beállítja, nem kell átírni).
3. **Settings → Environment Variables** (a `.env.example` alapján):

   | Név | Érték |
   |---|---|
   | `SUPABASE_URL` | a Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | a service_role kulcs |
   | `RESEND_API_KEY` | a Resend kulcs |
   | `NOTIFY_EMAIL` | `tataifejlesztes@gmail.com` |
   | `FROM_EMAIL` | pl. `Csodabogár weboldal <uzenet@sajatdomain.hu>` |

4. **Deploy.** Ezután minden `git push` automatikusan új verziót tesz ki.
5. Domain: **Settings → Domains** → pl. `tataifejlesztes.hu` (ez a régi domain, a Google már ismeri, érdemes ezt használni).

## Sárga „Adat kell” cetlik
- Előnézeten (`localhost`, `*.vercel.app`) a cetlik **látszanak**, hogy Margaréta lássa, mi hiányzik még.
- Saját domainen (pl. `tataifejlesztes.hu`) **automatikusan rejtve** vannak, a kapcsológombbal együtt.
- Élesítés előtt a cetliket érdemes tényleges tartalommal kiváltani.

## Szerkesztés
1. Szöveget/oldalt **mindig a `src/build/pages/` alatt** szerkessz (a `public/*.html` generált, felülíródik).
2. `python3 src/build/build.py` → legyártja a `public/` oldalakat.
3. Ellenőrzés: `python3 src/build/test_site.py` (Playwright kell) és `node --test tests/*.test.js`.
4. `git commit` + `git push` → a Vercel kiteszi.

Helyi előnézet: `cd public && python3 -m http.server 8000` (az űrlap küldése így nem működik, ahhoz `vercel dev` kell).

## Élesítés előtti teendők
- [ ] Adatkezelési tájékoztató és impresszum (a láblécben még helyőrző). Az űrlap gyermekekről szóló, érzékeny adatokat gyűjt, ezért ez kötelező.
- [ ] Margaréta kérdéslistája: `docs/kerdesek-margaretanak.md`.
- [ ] Valódi fotók a helyőrzők helyére (a jelenlegi képek a kreatívokból kivágott, ideiglenes AI-képek).
- [ ] Az `og:image` és az `og:url` abszolút URL-re állítása a domain ismeretében (`src/build/partials/head.html`).
- [ ] Google Cégprofil egységesítése (cím: Alkotmány u. 2.).

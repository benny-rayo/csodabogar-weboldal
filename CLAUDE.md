# CLAUDE.md: Csodabogár Fejlesztő Műhely weboldal

Útmutató annak az AI-asszisztensnek (vagy fejlesztőnek), aki ebben a repóban dolgozik. Minden munka előtt olvasd el.

## A projekt
- Ügyfél: **Píri Margaréta** (becenév: Margó), pszichológus és gyógypedagógus, a tatai **Csodabogár Fejlesztő Műhely** vezetője. Megrendelő: Benedek (RAYO Marketing), Margaréta fia.
- Közönség: 5-16 éves gyerekek szülei. A design gyerekes és játékos, a szöveg a szülőknek szól.
- Elérhetőség: 2890 Tata, Alkotmány u. 2. · +36 30 632 5350 · tataifejlesztes@gmail.com · facebook.com/tataifejlesztes

## Technika
- A forrás a `src/build/pages/` és a `src/build/partials/` alatt van. A `public/*.html` fájlokat a `python3 src/build/build.py` gyártja, ezeket **soha ne szerkeszd kézzel**.
- Jelölők a forrásban: `<!-- @include NÉV kulcs="érték" -->`, `<!-- @icon NÉV -->`, `<!-- @svg NÉV -->`.
- Közös stílus: `public/assets/css/site.css`, a tokenek a fájl elején vannak. Közös JS: `public/assets/js/site.js`. Új CSS-t a fájl végére, külön kommentblokkba tegyél.
- Űrlap: `form[data-endpoint="/api/kapcsolat"]` → `api/kapcsolat.js` → Supabase `kapcsolat_uzenetek` tábla (RLS be van kapcsolva, és nincs nyilvános szabály) + Resend e-mail.
- Minden változtatás után futtasd: build, `python3 src/build/test_site.py` (0 hiba kell), `node --test tests/*.test.js`.
- A domain (canonical, og:url, og:image, JSON-LD, sitemap.xml) a `build.py` `SITE_URL` értékéből jön. A JSON-LD-ben relatív hivatkozást írj (`#id`, `oldal.html`, `assets/...`), a build teszi abszolúttá.
- Új oldal: `src/build/pages/<slug>.html`, a build automatikusan a sitemap-be teszi (kivéve a `NOINDEX` listát). A `public/` mappát is commitold: a Vercelen nincs build, és a CI elbukik, ha a `public/` elavult.
- Jogi oldalak: `adatkezelesi-tajekoztato.html`, `impresszum.html`. Ha az űrlap új mezőt kap, vagy új szolgáltató kerül be (pl. analitika), a tájékoztatót is frissíteni kell.

## Design-rendszer: „A Csodabogár füzet”
- Kockás füzetlap háttér, fehér körvonalas matrica-címsorok, ragasztószalagos polaroid fotók, égkék, felhős sávok. A logó négy színével (piros, zöld, kék, sárga) repülő katicák.
- Fontok (self-hostolva): **Baloo 2** a címsorokhoz, **Nunito** a szöveghez, **Caveat** a kézíráshoz. A Fredokát és a Comic Neue-t NE használd, mert nincs bennük ő/ű. Új fontot mindig glyph-ellenőrzés után válassz.
- A programok színkódot kapnak a `data-program="<slug>"` attribútummal.
- Egytémás, világos design. Ez tudatos döntés.
- Mobilon (390px) sehol nem lehet vízszintes görgetés. A gombok legalább 44px magasak legyenek, és tartsd tiszteletben a `prefers-reduced-motion` beállítást.

## Szövegírási szabályok (kötelező)
- A márkanév **„Csodabogár Fejlesztő Műhely”**, KÜLÖN írva. Mondatban köznévként „fejlesztő műhely”.
- Tények: **5-16 éves** gyerekek. **Egyéni fejlesztés 5 éves kortól.** „**10 éve Tatán**”, „**közel 1000 gyerek**” (NEM 1000+). „**10 nyári tábor**” az Öreg-tó partján.
- Kutyás foglalkozás Zafírral (golden retriever): óvodás csoport szerdánként 16:15-től, kisiskolás csoport szerdánként 17:30-tól, 10 alkalom, zárt csoportok.
- MOZAIK szorongásoldó műhely: 6-10 év, csütörtökönként 17:00-tól, 10 alkalom, 90 perc. Merész Macska: 12 éves kortól.
- A szülőket **magázzuk**. Tegezés csak ott lehet, ahol Zafír vagy a kabalafigura a gyerekhez szól.
- **Hosszú gondolatjelet (– és —) soha ne használj**, helyette sima kötőjel vagy átfogalmazás.
- Ne írj olyat, hogy „nem rontott el semmit”. Melegen írj, vád-keret nélkül (pl. „Nincsenek egyedül.”).
- Díjat ne írj ki, amíg Margaréta nem kéri. A hero-ban a neve mellé ne kerüljenek végzettségek.
- Ne legyenek aprólékos eszközfelsorolások. Ahol Margaréta maga beszél, ott írhatsz első személyben.
- Kedvelt mondatai: „Minden egy beszélgetéssel indul.” és „Foglalkozásainkon a gyermek erősségeire támaszkodva, a kis lépések elvét követve segítjük az elakadások feloldását.”
- Ne találj ki tényt. A hiányzó adat helye: `<mark class="todo" title="ADAT KELL: ...">Adat kell: ...</mark>`, a bizonytalané: „Ellenőrizendő: ...”. A cetli felirata érthető kérdés legyen. A hero-ban legfeljebb 2 cetli lehet.
- Margaréta javításai néha töredékesek („....”): ilyenkor a meglévő szöveg folytatódik. Előbb írd le, hogyan értelmezed, és csak utána építsd be.
- Kerüld az AI-szagú fordulatokat („nem csupán... hanem”, „fedezze fel”, „utazás”, „holisztikus”).

## Nyitott pontok
Lásd `docs/kerdesek-margaretanak.md` és a README „Élesítés előtti teendők” részét.

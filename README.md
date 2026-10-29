# Valto Quiz

Een live quiz voor een presentatie: deelnemers scannen een QR-code, antwoorden via hun
telefoon op de vraag die op het grote scherm staat, en na elke vraag verschijnt een
real-time tussenstand. Werkt met Supabase (gratis) als real-time datalaag, verder pure
HTML/CSS/JavaScript zonder build-stap.

## Hoe het werkt

- `index.html` + `js/host.js` — het presentatiescherm (laptop → beamer/TV). Bedient de
  quiz: QR-code tonen, vraag starten, antwoord onthullen, tussenstand tonen, volgende vraag.
- `speler.html` + `js/speler.js` — het telefoonscherm voor deelnemers. Naam invullen,
  antwoorden, feedback en tussenstand zien.
- Supabase (Postgres + Realtime) houdt spelers, vragen, antwoorden en de huidige quizfase
  bij; alle schermen abonneren zich hierop zodat ze automatisch meebewegen.

## Opzetten

1. **Supabase-project aanmaken**: ga naar [supabase.com](https://supabase.com), maak een
   gratis account/project aan.
2. **Schema aanmaken**: open in het Supabase dashboard "SQL Editor" → "New query", plak de
   inhoud van [`supabase/schema.sql`](supabase/schema.sql) en klik "Run". Dit maakt de
   tabellen, zet Realtime aan, en vult drie voorbeeldvragen in.
3. **Eigen vragen invullen**: pas de `insert into questions (...)` sectie onderaan
   `supabase/schema.sql` aan naar je eigen vragen, of voeg later rijen toe via de
   Supabase Table Editor (tabel `questions`). Velden: `volgorde` (1, 2, 3, ...), `tekst`,
   `opties` (JSON-array met antwoordopties), `correct_index` (0-based index van het juiste
   antwoord in `opties`), `punten`, `tijdslimiet_sec`.
4. **API-sleutels invullen**: ga naar Project Settings → API in Supabase, kopieer de
   "Project URL" en de "anon public" key naar [`js/config.js`](js/config.js).
5. **Lokaal testen**: open dit project in Claude Code / VS Code en start de dev-server
   (`.claude/launch.json` → `valto-quiz`, draait op `http://localhost:8766`), of dubbelklik
   `dev/serve.ps1`. Open `index.html` (host) en `speler.html` (speler) in aparte
   browservensters om de hele flow te testen.
6. **Deployen**: upload de map naar [Vercel](https://vercel.com) of
   [Netlify](https://netlify.com) (sleep de map in hun dashboard, of koppel een git-repo) —
   het is een statische site, geen build-commando nodig.

## Tijdens het event

1. Open `index.html` op de laptop die aan de beamer/TV hangt.
2. Laat deelnemers de QR-code scannen (opent `speler.html`) en hun naam invullen.
3. Klik "Start quiz" zodra iedereen is aangesloten.
4. Per vraag: wacht tot iedereen geantwoord heeft (of de tijd om is) → "Onthul antwoord" →
   "Toon tussenstand" → "Volgende vraag".
5. Na de laatste vraag verschijnt de eindstand.

## Bekende beperkingen

Dit is bewust simpel gehouden voor een eenmalig, informeel event:

- **Geen inloggen/accounts** — deelnemers hoeven alleen een naam in te vullen.
- **Geen bescherming tegen handige deelnemers**: omdat er geen eigen backend is, zou een
  technisch onderlegde deelnemer in theorie via de browserconsole het juiste antwoord
  kunnen opvragen of een score kunnen vervalsen. Voor een vriendengroep/teamuitje is dat
  een acceptabel risico; voor een wedstrijd met prijzengeld zou je dit verder moeten
  afschermen (bv. met een Supabase Edge Function die de score serverside berekent).
- **Eén quiz tegelijk** — er is geen ondersteuning voor meerdere gelijktijdige
  quizrooms/sessies; voor een volgend event zet je gewoon de `quiz_state`-rij en de
  antwoorden/spelers terug naar een beginstand (of maak een nieuw Supabase-project).

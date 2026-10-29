-- Valto Quiz - Supabase schema
-- Plak dit in de Supabase SQL Editor (Project -> SQL Editor -> New query) en klik "Run".

-- Spelers die meedoen
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  created_at timestamptz not null default now()
);

-- Quizvragen
create table if not exists questions (
  id serial primary key,
  volgorde int not null,
  tekst text not null,
  opties jsonb not null,       -- bv. ["Optie A", "Optie B", "Optie C", "Optie D"]
  correct_index int not null,  -- index (0-based) in "opties" van het juiste antwoord
  punten int not null default 1000,
  tijdslimiet_sec int not null default 20
);

-- Antwoorden van spelers
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  question_id int not null references questions(id) on delete cascade,
  gekozen_index int not null,
  is_correct boolean not null,
  punten_behaald int not null default 0,
  answered_at timestamptz not null default now(),
  unique (player_id, question_id)
);

-- Eén rij die de huidige fase van de quiz bijhoudt; alle schermen abonneren hierop
create table if not exists quiz_state (
  id int primary key default 1,
  fase text not null default 'wachten', -- wachten | vraag | onthulling | leaderboard | klaar
  current_question_id int references questions(id),
  question_started_at timestamptz,
  constraint single_row check (id = 1)
);
insert into quiz_state (id, fase) values (1, 'wachten')
  on conflict (id) do nothing;

-- Realtime inschakelen voor de tabellen die live moeten updaten
alter publication supabase_realtime add table quiz_state;
alter publication supabase_realtime add table answers;
alter publication supabase_realtime add table players;

-- Row Level Security: voor een eenmalig, informeel event laten we de anon-sleutel
-- lezen/schrijven toe op alle tabellen (geen inloggen nodig). Let op: dit betekent
-- dat een technisch onderlegde deelnemer in theorie data zou kunnen manipuleren
-- via de browserconsole. Voor een vriendengroep/teamuitje is dat een acceptabel risico.
alter table players enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table quiz_state enable row level security;

create policy "anon kan alles lezen - players" on players for select using (true);
create policy "anon kan spelers aanmaken" on players for insert with check (true);

create policy "anon kan alles lezen - questions" on questions for select using (true);

create policy "anon kan alles lezen - answers" on answers for select using (true);
create policy "anon kan antwoorden insturen" on answers for insert with check (true);

create policy "anon kan alles lezen - quiz_state" on quiz_state for select using (true);
create policy "anon kan quiz_state aanpassen" on quiz_state for update using (true);

-- Voorbeeldvragen (pas aan of vul aan naar wens)
insert into questions (volgorde, tekst, opties, correct_index, punten, tijdslimiet_sec) values
  (1, 'Wat is de hoofdstad van Nederland?', '["Rotterdam", "Amsterdam", "Utrecht", "Den Haag"]', 1, 1000, 20),
  (2, 'In welk jaar is CKV Valto opgericht?', '["1920", "1935", "1950", "1965"]', 1, 1000, 20),
  (3, 'Hoeveel spelers staan er bij korfbal per team op het veld?', '["6", "8", "11", "7"]', 1, 1000, 20)
on conflict do nothing;

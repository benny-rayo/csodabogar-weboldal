-- Csodabogár Fejlesztő Műhely: a kapcsolati űrlap üzenetei
-- Futtatás: Supabase > SQL Editor > ide bemásolni > Run  (vagy: supabase db push)

create extension if not exists pgcrypto;

create table if not exists public.kapcsolat_uzenetek (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  nev            text not null check (char_length(nev) between 1 and 120),
  telefon        text check (char_length(telefon) <= 40),
  email          text check (char_length(email) <= 160),
  gyermek_kora   text not null check (char_length(gyermek_kora) <= 80),
  program        text not null default 'nem-tudom',
  okok           text[] not null default '{}',
  uzenet         text check (char_length(uzenet) <= 4000),
  hivas_idopont  text not null default 'mindegy',
  hozzajarulas   boolean not null check (hozzajarulas),
  oldal          text,
  allapot        text not null default 'uj' check (allapot in ('uj', 'visszahivva', 'lezarva')),
  megjegyzes     text,
  constraint elerhetoseg_kell check (coalesce(telefon, '') <> '' or coalesce(email, '') <> '')
);

create index if not exists kapcsolat_uzenetek_created_at_idx on public.kapcsolat_uzenetek (created_at desc);

-- Row Level Security: BE van kapcsolva, és NINCS nyilvános szabály.
-- Így a böngészőből (anon kulccsal) senki nem tud se írni, se olvasni;
-- csak a Vercel szerverfüggvény ír a service_role kulccsal.
alter table public.kapcsolat_uzenetek enable row level security;

comment on table public.kapcsolat_uzenetek is 'A weboldal kapcsolati űrlapjának üzenetei. Személyes adat: csak a műhely vezetője férhet hozzá.';

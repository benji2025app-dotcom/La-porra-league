-- LA PORRA LEAGUE · 001 · Esquema base
-- Reglas: 2 partidos por jornada (Barça + Madrid), marcador exacto, ambos aciertos para ganar,
-- pronósticos ocultos hasta el inicio, bloqueo al inicio, bote acumulado, reparto entre acertantes.
-- La app NO gestiona pagos: los importes son informativos.

create schema if not exists private;

create type public.app_role as enum ('admin', 'player');
create type public.member_status as enum ('pending', 'active', 'blocked');
create type public.round_status as enum ('draft', 'open', 'settled', 'void');
create type public.club_key as enum ('barcelona', 'real_madrid');
create type public.fixture_status as enum ('scheduled', 'live', 'finished', 'postponed');
create type public.pot_movement_kind as enum ('contribution', 'payout', 'adjustment');
create type public.settlement_kind as enum ('settled', 'void');

-- Participantes ----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 30),
  role public.app_role not null default 'player',
  status public.member_status not null default 'pending',
  invite_code text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table public.invite_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{6,32}$'),
  note text check (note is null or char_length(note) <= 80),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Temporadas y jornadas --------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 40),
  is_active boolean not null default false,
  entry_fee_cents integer not null default 1500 check (entry_fee_cents >= 0),
  pot_contribution_cents integer not null default 1200 check (pot_contribution_cents >= 0),
  created_at timestamptz not null default now(),
  check (pot_contribution_cents <= entry_fee_cents)
);
create unique index seasons_single_active on public.seasons (is_active) where is_active;

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  number integer not null check (number > 0),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  status public.round_status not null default 'draft',
  created_at timestamptz not null default now(),
  unique (season_id, number)
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete restrict,
  club public.club_key not null,
  competition text not null check (char_length(btrim(competition)) between 2 and 60),
  home_team text not null check (char_length(btrim(home_team)) between 2 and 60),
  away_team text not null check (char_length(btrim(away_team)) between 2 and 60),
  kickoff_at timestamptz not null,
  status public.fixture_status not null default 'scheduled',
  home_goals smallint check (home_goals between 0 and 30),
  away_goals smallint check (away_goals between 0 and 30),
  -- Momento en que el partido quedó bloqueado. Una vez fijado no se borra nunca:
  -- retrasar la hora de inicio no reabre los pronósticos ya revelados.
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, club),
  check (lower(btrim(home_team)) <> lower(btrim(away_team))),
  check ((home_goals is null) = (away_goals is null)),
  check (status <> 'finished' or home_goals is not null)
);

-- Pronósticos ------------------------------------------------------------------
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  home_goals smallint not null check (home_goals between 0 and 20),
  away_goals smallint not null check (away_goals between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, user_id)
);
create index predictions_user_idx on public.predictions (user_id);

-- Registro inmutable de altas, cambios y reinicios de pronósticos.
create table public.prediction_log (
  id bigint generated always as identity primary key,
  fixture_id uuid not null references public.fixtures (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (action in ('create', 'update', 'reset')),
  home_goals smallint,
  away_goals smallint,
  created_at timestamptz not null default now()
);
create index prediction_log_fixture_idx on public.prediction_log (fixture_id);
create index prediction_log_user_idx on public.prediction_log (user_id);

-- Bote y resultados de jornada -------------------------------------------------
create table public.pot_movements (
  id bigint generated always as identity primary key,
  round_id uuid references public.rounds (id) on delete restrict,
  kind public.pot_movement_kind not null,
  amount_cents bigint not null check (amount_cents <> 0),
  user_id uuid references public.profiles (id) on delete restrict,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index pot_movements_round_idx on public.pot_movements (round_id);
create index pot_movements_user_idx on public.pot_movements (user_id);
create index pot_movements_created_by_idx on public.pot_movements (created_by);

create table public.round_winners (
  round_id uuid not null references public.rounds (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  share_cents bigint not null check (share_cents >= 0),
  created_at timestamptz not null default now(),
  primary key (round_id, user_id)
);
create index round_winners_user_idx on public.round_winners (user_id);

-- Resumen congelado de cada jornada cerrada (liquidada o anulada).
create table public.round_settlements (
  round_id uuid primary key references public.rounds (id) on delete restrict,
  kind public.settlement_kind not null,
  participants_count integer not null,
  entry_fee_cents integer not null,
  pot_contribution_cents integer not null,
  contribution_total_cents bigint not null,
  admin_fee_total_cents bigint not null,
  pot_before_cents bigint not null,
  pot_in_play_cents bigint not null,
  winners_count integer not null,
  share_cents bigint not null,
  pot_after_cents bigint not null,
  reason text,
  settled_by uuid references public.profiles (id) on delete set null,
  settled_at timestamptz not null default clock_timestamp()
);
create index round_settlements_settled_by_idx on public.round_settlements (settled_by);
create index invite_codes_created_by_idx on public.invite_codes (created_by);

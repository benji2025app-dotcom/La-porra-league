-- LA PORRA LEAGUE · 005 · Temporada inicial (15 € por boleto, 12 € al bote, 3 € para la gestión)
insert into public.seasons (name, is_active, entry_fee_cents, pot_contribution_cents)
values ('2026/27', true, 1500, 1200)
on conflict (name) do nothing;

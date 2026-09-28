-- =============================================================================
-- reward_images — admin-managed artwork for game tokens + XP boosts
-- =============================================================================
-- Key/value image URLs an admin uploads once and the app + emails reuse: the
-- game-token coin, the 2x XP token, the 1.5x XP token (and any future reward
-- art). Config-table pattern: public read (so emails/UI can show them via the
-- anon key), admin write. Referenced by key, e.g. game_token -> {{tokenImageUrl}}.
-- =============================================================================
create table if not exists public.reward_images (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  image_url   text,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

create trigger trg_reward_images_updated_at before update on public.reward_images
  for each row execute function public.set_updated_at();

insert into public.reward_images (key, label, sort_order) values
  ('game_token',   'Game token coin', 10),
  ('xp_boost_2x',  '2x XP token',     20),
  ('xp_boost_1_5x','1.5x XP token',   30)
on conflict (key) do nothing;

alter table public.reward_images enable row level security;

drop policy if exists reward_images_public_read on public.reward_images;
create policy reward_images_public_read on public.reward_images
  for select to anon, authenticated using (true);

drop policy if exists reward_images_admin_write on public.reward_images;
create policy reward_images_admin_write on public.reward_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.reward_images to anon, authenticated;
grant insert, update, delete on public.reward_images to authenticated;
grant select, insert, update, delete on public.reward_images to service_role;

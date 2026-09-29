-- =============================================================================
-- Blog / news posts (2026-09-29). Admin-managed feature-release + news posts,
-- rendered at /blog. Public reads published posts; admins manage all.
-- =============================================================================
create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null default '00000000-0000-0000-0000-000000000001' references public.operators(id) on delete cascade,
  slug            text not null,
  title           text not null,
  excerpt         text,
  body_md         text not null default '',
  cover_image_url text,
  author          text,
  is_published    boolean not null default false,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (operator_id, slug)
);

alter table public.blog_posts enable row level security;
drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts for select to anon, authenticated
  using (is_published or public.is_admin());
drop policy if exists blog_posts_admin on public.blog_posts;
create policy blog_posts_admin on public.blog_posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.blog_posts to anon, authenticated;
grant select, insert, update, delete on public.blog_posts to authenticated;

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();

insert into public.blog_posts (slug, title, excerpt, body_md, author, is_published, published_at)
values (
  'whats-new-in-the-v2-rebuild',
  'What is new in the V2 rebuild',
  'LaserOps has been rebuilt from the ground up. Here is everything new waiting for you in your player portal.',
  $md$LaserOps has been rebuilt from the ground up. Same game you love outdoors, but everything around it is new. Here is what is now waiting for you when you sign in.

## One home for everything

Your player portal is the hub. Book a game, join an open game, open your own, check your stats, manage your squad, and pick up your rewards, all from one place. Create an account once and it follows you from game to game.

## Book, join and create games online

No more messaging back and forth. Open games show up in the portal with live player counts, so you can jump into a match that is already filling up, or open your own and let others join. You can invite players directly, book a private game for your group, and see exactly when we are open on the booking calendar.

## Pay online and use game tokens

Confirming your place is now a tap. Pay online to lock in your spot for a game.

We also launched LaserOps Game Tokens. One token equals one game, so you can buy a bundle up front, save per game, and use tokens whenever you play. You can even gift tokens to a friend, or send them to someone by email to claim later.

## Level up and earn rewards

Every game you play now counts toward your XP and your level. Climbing the ranks unlocks rewards along the way, from game tokens to XP boosts. Apply a boost when you sign in to a game and earn extra XP for that session. Your whole progression, and everything still to unlock, is laid out on your Progression tab.

## Streaks and accolades

Standout play gets recognised. Accolades are handed out once per match to the players who topped a stat, like the most kills, the best kill to death ratio, or the most base captures, and they feed your Total XP. Streaks are the feats you pull off mid game, like a kill streak, a clutch play, or holding a base under pressure, and they earn points toward the match leaderboard. Kill streaks even carry across rounds now, so if you stay alive, your run keeps building. Head to the Streaks and Accolades page to see every one you can earn and how it works.

## Leaderboards, ratings, squads and ladders

See where you stand. Leaderboards, a proper rating system, and per season standings mean your results actually mean something. Team up by forming a squad, and take it further on the competitive ladders.

## Your profile, stats and match reports

Every match now generates a full report: your kills, damage, accuracy, objective play, and a breakdown of who got you and who you got. Your profile pulls it all together, with your history, your rivalries, your armory of unlocked guns, and even a short write up of how your match went. It is your LaserOps record, and it grows every time you play.

## Match photos

The photos from your games live in the gallery, tied to the match they came from. You can tag yourself in a shot and share a match photo story, so the good moments do not just disappear after the game.

## Stay in the loop

You will get notifications in the app and by email for the things that matter, like a game getting confirmed, your payment going through, or your match report going live. Confirmed games even send you a calendar invite so you never miss a booking.

## A fresh look

The whole site got a new look to go with it, so everything feels a bit sharper wherever you are, on your phone or at your desk.

## This is just the start

The rebuild gives us a foundation to keep adding to, and we have plenty more planned. We will post every new feature and update right here, so check back in. See you on the field.$md$,
  'LaserOps',
  true,
  now()
)
on conflict (operator_id, slug) do nothing;

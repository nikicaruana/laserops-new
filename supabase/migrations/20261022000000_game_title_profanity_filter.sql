-- 20261022000000_game_title_profanity_filter.sql
-- Players can create open games with a free-text title, which then shows in the
-- public "Join an open game" list, on the game card, and in squadmates'
-- notifications. Someone put profane titles there ("Fuck Cum Shit", etc.). Add a
-- server-side guard: reject a non-admin's game title that contains banned
-- language, and cap its length. Whole-word matching (\y...\y) keeps false
-- positives down (e.g. "Essex" is not flagged for "sex", "analysis" not for
-- "anal"). Admins are trusted and exempt from the word filter. Only touches the
-- title validation in create_player_match; the rest of the body is unchanged.

-- Banned-language check: true when the text contains a disallowed word.
create or replace function public.has_banned_language(p_text text)
returns boolean language sql immutable as $$
  select p_text is not null and p_text ~* ('\y(' ||
    'fuck|fucks|fucking|fucker|fuckers|fucked|motherfucker|motherfuckers|' ||
    'shit|shits|shitting|shitty|bullshit|' ||
    'cunt|cunts|' ||
    'cum|cums|cumming|cumshot|' ||
    'pussy|pussies|' ||
    'bitch|bitches|' ||
    'whore|whores|' ||
    'slut|sluts|' ||
    'sex|sexy|sexual|' ||
    'porn|porno|' ||
    'nigger|niggers|nigga|niggas|' ||
    'faggot|faggots|fag|fags|' ||
    'retard|retards|retarded|' ||
    'wank|wanker|wankers|' ||
    'jizz|' ||
    'dildo|dildos|' ||
    'blowjob|blowjobs|' ||
    'boner|' ||
    'kike|kikes|' ||
    'dyke|dykes|' ||
    'tranny|trannies|' ||
    'twat|twats|' ||
    'bollocks|' ||
    'arsehole|arseholes|asshole|assholes|' ||
    'cock|cocks|' ||
    'dick|dicks|' ||
    'rape|rapist|rapists|' ||
    'anal|' ||
    'shag|shagging|' ||
    'clit|clitoris|' ||
    'coon|coons|' ||
    'chink|' ||
    'prick|pricks|' ||
    'horny|' ||
    'nazi|nazis|' ||
    'penis|vagina|' ||
    'masturbate|masturbation|' ||
    'incest|' ||
    'pedo|pedophile|paedo|paedophile' ||
  ')\y');
$$;

-- Re-assert create_player_match with the title guard added (body otherwise
-- identical to 20260859000000).
create or replace function public.create_player_match(
  p_title text, p_scheduled_at timestamptz, p_min_players integer, p_max_players integer, p_price_eur numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid; tag text; clean_title text;
begin
  if acct is null then raise exception 'You need an account to create a game.'; end if;

  -- Title moderation: length + banned language (admins exempt from the word filter).
  clean_title := nullif(btrim(p_title), '');
  if clean_title is not null then
    if char_length(clean_title) > 80 then
      raise exception 'That game title is too long. Please keep it under 80 characters.';
    end if;
    if not public.is_admin() and public.has_banned_language(clean_title) then
      raise exception 'That title isn''t allowed. Please choose a different name for your game.';
    end if;
  end if;

  perform public.assert_bookable_account(acct);
  if not public.is_admin() and not public.has_played_game() then
    raise exception 'You can open your own games once you have played at least one. Join an open game to get started.';
  end if;
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
  end if;
  if not public.is_admin() and public.has_booking_conflict(p_scheduled_at, 180) then
    raise exception 'Another game is booked around that time. Games need a break between them.';
  end if;
  select count(*) into active from public.matches
    where created_by = acct and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then raise exception 'You can have at most 3 active games at a time.'; end if;

  insert into public.matches (title, scheduled_at, status, min_players, max_players, price_eur, duration_minutes, pricing_mode, is_double_xp, is_private, created_by, location_id)
    values (clean_title, p_scheduled_at, 'tentative', greatest(coalesce(p_min_players, 10), 1), p_max_players,
            coalesce((select default_price_eur from public.pricing_config where id = 1), 35),
            coalesce((select session_minutes from public.pricing_config where id = 1), 180),
            'per_player', false, false, acct,
            (select id from public.locations where is_default limit 1))
    returning id into new_id;

  insert into public.match_signups (match_id, account_id, status) values (new_id, acct, 'registered')
    on conflict (match_id, account_id) do nothing;

  select ops_tag into tag from public.accounts where id = acct;
  insert into public.notifications (account_id, type_key, priority, title, body, href)
  select distinct m2.account_id, 'squad_open_game', nt.priority,
         coalesce(tag, 'A squadmate') || ' opened a game',
         coalesce(clean_title, 'A new open game'),
         '/player-portal/games/' || new_id::text
  from public.squad_members m1
  join public.squad_members m2 on m2.squad_id = m1.squad_id and m2.account_id <> acct
  join public.notification_types nt on nt.key = 'squad_open_game' and nt.is_active
  where m1.account_id = acct;

  return new_id;
end;
$$;

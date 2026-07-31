-- =============================================================================
-- set_gun_damage — admin-facing, effective-dated damage changes (backdatable)
-- =============================================================================
-- The existing record_gun_damage_history() trigger handles the simple case
-- (edit guns.damage -> new window effective from now()). This adds the ability
-- to set a damage value effective from an ARBITRARY date ("from DD-MM-YYYY
-- onwards"), so admins can retroactively fix a mistake from a chosen point
-- without rewriting earlier games.
--
-- Semantics of set_gun_damage(gun, damage, effective_from, note): "from
-- effective_from onward, this gun's damage is <damage>." It truncates the
-- window covering effective_from, discards any windows starting at/after it,
-- and opens a new open-ended window. guns.damage is then synced to the value
-- in effect *now* (which may differ if effective_from is in the future).
-- =============================================================================

-- 1. Let a controlled caller suppress the auto-history trigger for one txn, so
--    set_gun_damage can sync guns.damage without the trigger double-recording.
create or replace function public.record_gun_damage_history()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.skip_gun_damage_trigger', true), 'off') = 'on' then
    return new;
  end if;

  if (tg_op = 'INSERT') then
    insert into public.gun_damage_history
      (operator_id, gun_id, damage, effective_from, effective_to, note)
    values (new.operator_id, new.id, new.damage, '-infinity', null, 'seed');
  elsif (tg_op = 'UPDATE' and new.damage is distinct from old.damage) then
    update public.gun_damage_history
      set effective_to = now()
      where gun_id = new.id and effective_to is null;
    insert into public.gun_damage_history
      (operator_id, gun_id, damage, effective_from, effective_to, note)
    values (new.operator_id, new.id, new.damage, now(), null, 'damage change');
  end if;
  return new;
end;
$$;

-- 2. Backdatable damage setter. Admin-only (checked inside, since SECURITY
--    DEFINER bypasses RLS).
create or replace function public.set_gun_damage(
  p_gun_id         uuid,
  p_damage         numeric,
  p_effective_from timestamptz,
  p_note           text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_operator uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select operator_id into v_operator from public.guns where id = p_gun_id;
  if v_operator is null then
    raise exception 'gun not found';
  end if;

  -- Discard any windows starting at or after the new change point.
  delete from public.gun_damage_history
    where gun_id = p_gun_id and effective_from >= p_effective_from;

  -- Truncate the window that spans the change point.
  update public.gun_damage_history
    set effective_to = p_effective_from
    where gun_id = p_gun_id
      and effective_from < p_effective_from
      and (effective_to is null or effective_to > p_effective_from);

  -- Open the new window.
  insert into public.gun_damage_history
    (operator_id, gun_id, damage, effective_from, effective_to, note)
  values (v_operator, p_gun_id, p_damage, p_effective_from, null,
          coalesce(nullif(btrim(p_note), ''), 'admin change'));

  -- Sync the denormalised current damage (value in effect right now), without
  -- letting the trigger record a second, now()-dated window.
  perform set_config('app.skip_gun_damage_trigger', 'on', true);
  update public.guns
    set damage = public.gun_damage_at(p_gun_id, now())
    where id = p_gun_id;
  perform set_config('app.skip_gun_damage_trigger', 'off', true);
end;
$$;

grant execute on function public.set_gun_damage(uuid, numeric, timestamptz, text) to authenticated;

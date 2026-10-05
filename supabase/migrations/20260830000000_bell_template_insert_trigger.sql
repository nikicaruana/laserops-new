-- =============================================================================
-- Apply the admin bell copy to EVERY notification, centrally.
--
-- Some notifications are created by the emit_notification RPC, others by SQL
-- trigger functions that INSERT into notifications directly (cancellations,
-- reschedules, follows, invites) and by the admin broadcast route. Previously
-- only the RPC rendered bell_title/bell_body, so the direct-insert ones ignored
-- the admin fields. This moves the rendering to ONE before-insert trigger on
-- public.notifications, so bell_title/bell_body control the in-app text for
-- every type uniformly, regardless of how the row was created.
--
-- Behaviour is unchanged: every type's bell copy is seeded to reproduce the old
-- text (echo tokens {{title}}/{{body}}, or a readable template that renders to
-- the same string). Editing a bell field in admin now always takes effect.
-- =============================================================================

create or replace function public.apply_bell_template()
returns trigger language plpgsql security definer set search_path = public as $$
declare bt text; bb text; tag text; orig_title text := NEW.title; orig_body text := NEW.body;
begin
  select bell_title, bell_body into bt, bb from public.notification_types where key = NEW.type_key;
  if bt is null and bb is null then return NEW; end if;
  select ops_tag into tag from public.accounts where id = NEW.account_id;
  if nullif(btrim(coalesce(bt, '')), '') is not null then
    NEW.title := public.render_notif_text(bt, NEW.data, tag, orig_title, orig_body);
  end if;
  if nullif(btrim(coalesce(bb, '')), '') is not null then
    NEW.body := public.render_notif_text(bb, NEW.data, tag, orig_title, orig_body);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_apply_bell_template on public.notifications;
create trigger trg_apply_bell_template before insert on public.notifications
  for each row execute function public.apply_bell_template();

-- emit_notification no longer renders the bell template itself (the trigger does
-- it for all insert paths); it inserts the code-provided title/body raw again.
create or replace function public.emit_notification(
  p_account_id uuid, p_type_key text, p_title text,
  p_body text default null, p_href text default null, p_data jsonb default null, p_deliver_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.notification_types; nid uuid;
begin
  select * into t from public.notification_types where key = p_type_key;
  if not found or not t.is_active then return null; end if;
  insert into public.notifications (account_id, type_key, priority, title, body, href, data, deliver_at)
    values (p_account_id, p_type_key, t.priority, p_title, p_body, p_href, p_data,
            coalesce(p_deliver_at, now() + make_interval(hours => coalesce(t.delay_hours, 0))))
    returning id into nid;
  return nid;
end;
$$;

-- Now that the direct-insert types render their bell copy too, give the game
-- ones readable wording (their data carries matchLabel). These reproduce the
-- current text; the follow/invite types keep {{title}}/{{body}} because the
-- person/game name lives in the code-built title (still editable via the fields).
update public.notification_types
  set bell_title = '{{matchLabel}} was moved',
      bell_body  = 'This game has a new date and time. Open it to see the details.'
  where key = 'game_rescheduled';
update public.notification_types
  set bell_title = '{{matchLabel}} was cancelled',
      bell_body  = 'This game was cancelled.'
  where key = 'match_cancelled';
update public.notification_types
  set bell_title = '{{matchLabel}} was cancelled',
      bell_body  = 'This game was cancelled. You will be refunded.'
  where key = 'match_cancelled_refund';

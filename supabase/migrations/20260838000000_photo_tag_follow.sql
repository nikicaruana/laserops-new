-- =============================================================================
-- Photo tags: allow tagging players you FOLLOW (not just yourself / admin)
-- =============================================================================
-- Previously a player could tag only themselves; admins could tag anyone. Extend
-- so a player can also tag/untag accounts they follow. Insert allows: admin, self,
-- or an account you follow. Delete allows: admin, self, or the tag's creator (so
-- the person who added a friend's tag can remove it).
-- =============================================================================

drop policy if exists match_photo_tags_insert on public.match_photo_tags;
create policy match_photo_tags_insert on public.match_photo_tags
  for insert to authenticated
  with check (
    public.is_admin()
    or account_id = public.current_account_id()
    or exists (
      select 1 from public.follows f
      where f.follower_id = public.current_account_id()
        and f.followee_id = account_id
    )
  );

drop policy if exists match_photo_tags_delete on public.match_photo_tags;
create policy match_photo_tags_delete on public.match_photo_tags
  for delete to authenticated
  using (
    public.is_admin()
    or account_id = public.current_account_id()
    or created_by = public.current_account_id()
  );

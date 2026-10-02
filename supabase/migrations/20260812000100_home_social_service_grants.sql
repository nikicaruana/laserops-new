-- =============================================================================
-- service_role needs EXPLICIT table grants in this project. Grant full DML on
-- the homepage social CMS tables so the launch seed script (and any future
-- maintenance run as service_role) can write them. RLS does not apply to
-- service_role; this is purely the table-level grant.
-- =============================================================================
grant select, insert, update, delete on public.home_social_posts to service_role;
grant select, insert, update, delete on public.home_reviews to service_role;

-- In-match scoreboard: the server builder (service client) needs gun artwork to
-- show each player's gun thumbnail (admins can tap any player's card). guns is a
-- public config table; grant service_role read. See [[service-role-table-grants]].
grant select on public.guns to service_role;

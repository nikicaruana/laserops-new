-- =============================================================================
-- Seed · guns (§4.7) — generated from the Gun_Damage sheet
-- =============================================================================
-- 19 rows. Authoritative damage = the Gun_Damage column (the duplicate
-- "Damage" column is dropped per spec). "Unknown Gun" is the fallback for
-- unclaimed "Head #" players: damage fixed at 25, is_visible=false so it never
-- appears on player-facing surfaces. fire_rate is text ("Semi Auto" for
-- DMR/Sniper/Shotgun). length/weight/gun_range are deprecated placeholders.
--
-- The gun_damage_history trigger auto-records each seeded damage as effective
-- since the beginning of time. Idempotent: upserts on (operator_id, name).
-- =============================================================================

insert into public.guns (
  name, damage, image_url, class, is_default, unlock_type, unlock_prerequisite_class, unlock_prerequisite_gun, unlock_requirement_points, unlock_requirement_level, unlock_display_text, sort_order, tree_branch, mag_size, reload, fire_rate, length, weight, gun_range, unlock_tier, difficulty, description, is_visible
) values
  ('AK-25 Predator', 30, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991355/Gun_Used-AK25_Predator_w3rppv.png', 'AR', true, 'Default', null, null, null, null, null, 1, 'AK', 30, 4, '605', 100, 100, 100, '1', 'Beginner', 'The AK-25 Predator is very popular amongst players of all skill levels. Lightweight, with a standard mag size and good reload time. For those that prefer something a little heavier-hitting, the Predator boasts the higher damage profile of the entry level assault rifles.', true),
  ('AR-15 Ranger', 25, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991357/Gun_Used-AR15_Ranger_doxnys.png', 'AR', true, 'Default', null, null, null, null, null, 1, 'AR', 40, 2, '725', 100, 100, 100, '1', 'Beginner', 'The AR-15 Ranger is a great entry level all-rounder. Lightweight, with a standard mag size and good reload time. For those that want to dominate the arena at all ranges. Boasting the faster fire rate of the entry level assault rifles.', true),
  ('Colt M4A3 Centurion', 35, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991360/Gun_Used-M4_A3_Centurion_qht3pf.png', 'AR', false, 'Class', 'AR', null, 30000, 9, '🔒 30,000 AR Pts + Lvl 9', 2, 'AR', 40, 3, '725', 100, 100, 100, '2', 'Intermediate', null, true),
  ('Akm Legend', 50, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991355/Gun_Used-AKM_Legend_n8ulu3.png', 'AR', false, 'Class', 'AK', null, 30000, 9, '🔒 30,000 AK Pts + Lvl 9', 2, 'AK', 45, 3, '660', 100, 100, 100, '2', 'Intermediate', null, true),
  ('Steyr Aug 3 Cobra', 35, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991354/Gun_Used-Steyr_Aug3_Cobra_u3gvzo.png', 'AR', false, 'Class', 'LMG', null, 25000, 10, '🔒 25,000 LMG Pts + Lvl 10', 3, 'LMG', 40, 4, '750', 100, 100, 100, '2', 'Advanced', null, true),
  ('HK416 Bergman', 40, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991358/Gun_Used-HK_M416_Bergman_muiw6m.png', 'AR', false, 'Class', 'AR', null, 45000, 14, '🔒 45,000 AR Pts + Lvl 14', 3, 'AR', 40, 4, '700', 100, 100, 100, '3', 'Intermediate', null, true),
  ('AKS-74U Falcon', 30, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991356/Gun_Used-AKS_74U_Falcon_ekk6wr.png', 'SMG', false, 'Class', 'AK', null, 45000, 14, '🔒 45,000 AK Pts + Lvl 14', 3, 'AK', 40, 2, '720', 100, 100, 100, '3', 'Advanced', null, true),
  ('AK-12 Serval', 40, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991354/Gun_Used-AK12_Serval_m2svcd.png', 'AR', false, 'Class', 'AK', null, 65000, 18, '🔒 65,000 AK Pts + Lvl 18', 4, 'AK', 45, 3, '720', 100, 100, 100, '4', 'Advanced', null, true),
  ('MP9LT Phoenix', 20, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991365/Gun_Used-MP9LT_Phoenix_kmnscb.png', 'SMG', true, 'Default', null, null, null, null, null, 1, 'SMG', 40, 1, '905', 100, 100, 100, '1', 'Beginner', 'Small and agile, whether you enjoy running and gunning or hiding in a bush somewhere, the MP9LT Phoenix allows you to keep a low profile and get the jump on your opponent. Boasting the fastest fire rate our of all our base weapons, this SMG will help you suffocate your opponents.', true),
  ('MP-5 Wolf', 30, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991365/Gun_Used-MP5_Wolf_qsj26m.png', 'SMG', false, 'Class', 'SMG', null, 40000, 14, '🔒 40,000 SMG Pts + Lvl 14', 3, 'SMG', 35, 2, '790', 100, 100, 100, '3', 'Intermediate', null, true),
  ('P-90 Kayman', 25, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991369/Gun_Used-P90_Kayman_gpkm9r.png', 'SMG', false, 'Class', 'SMG', null, 20000, 8, '🔒 20,000 SMG Pts + Lvl 8', 2, 'SMG', 60, 3, '950', 100, 100, 100, '2', 'Intermediate', null, true),
  ('ARP 556 Snowstorm', 30, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991358/Gun_Used-ARP_Snowstorm_hrp8ta.png', 'AR', false, 'Class', 'AR', null, 65000, 18, '🔒 65,000 AR Pts + Lvl 18', 4, 'AR', 30, 2, '850', 100, 100, 100, '4', 'Intermediate', null, true),
  ('KEDR', 35, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991359/Gun_Used-KEDR_sgjob4.png', 'SMG', false, 'Class', 'SMG', null, 60000, 18, '🔒 60,000 SMG Pts + Lvl 18', 4, 'SMG', 30, 1, '1500', 100, 100, 100, '4', 'Advanced', null, true),
  ('MG21 Berserk', 25, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991362/Gun_Used-MG21_Berserk_v4nvuu.png', 'LMG', true, 'Default', null, null, null, null, null, 1, 'LMG', 60, 6, '725', 100, 100, 100, '1', 'Beginner', 'The MG21 Berserk is perfect for those with a heavy trigger finger. Excellent at laying down covering fire, the MG21 boasts a 60 round drum that can wipe multiple enemies out without breaking a sweat. Don''t get caught reloading though!', true),
  ('MG25 Berserk', 25, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991363/Gun_Used-MG25_Berserk_zj5rlo.png', 'LMG', true, 'Default', null, null, null, null, null, 2, 'LMG', 120, 12, '725', 100, 100, 100, '1', 'Beginner', null, true),
  ('SR-21 Ghost', 50, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991369/Gun_Used-SR21_Ghost_teye0m.png', 'DMR', true, 'Default', null, null, null, null, null, 1, 'DMR', 20, 4, 'Semi Auto', 100, 100, 100, '1', 'Intermediate', null, true),
  ('MR-512 Sniper', 100, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991366/Gun_Used-MR512_Sniper_zw6tf7.png', 'Sniper', true, 'Default', null, null, null, null, null, 1, 'Sniper', 10, 3, 'Semi Auto', 100, 100, 100, '1', 'Intermediate', 'The MR-512 Sniper. Calling for those with the steadiest of aim, the MR-512 Sniper Rifle can be supremely effective in the right hands. Nothing puts opponents down quicker. That, however, comes at the cost of a steeper learning curve.', true),
  ('M4 Gastat', 75, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777991361/Gun_Used-M4_Gastat_obj35q.png', 'Shotgun', true, 'Default', null, null, null, null, null, 1, 'Shotgun', 8, 3, 'Semi Auto', 100, 100, 100, '1', 'Intermediate', 'The M4 Gastat. A favourite of those who like to get up close and personal, the Gastat can make light work of rooms and corridors packed with opponents. Considerably longer and heavier than most entry level guns, this shotgun takes some getting used to, but can be used to completely dominate the tighter areas of the map.', true),
  ('Unknown Gun', 25, null, 'AR', true, 'Default', null, null, null, null, null, 99, 'AR', null, null, null, null, null, null, null, null, null, false)
on conflict (operator_id, name) do update set
      damage = excluded.damage,
      image_url = excluded.image_url,
      class = excluded.class,
      is_default = excluded.is_default,
      unlock_type = excluded.unlock_type,
      unlock_prerequisite_class = excluded.unlock_prerequisite_class,
      unlock_prerequisite_gun = excluded.unlock_prerequisite_gun,
      unlock_requirement_points = excluded.unlock_requirement_points,
      unlock_requirement_level = excluded.unlock_requirement_level,
      unlock_display_text = excluded.unlock_display_text,
      sort_order = excluded.sort_order,
      tree_branch = excluded.tree_branch,
      mag_size = excluded.mag_size,
      reload = excluded.reload,
      fire_rate = excluded.fire_rate,
      length = excluded.length,
      weight = excluded.weight,
      gun_range = excluded.gun_range,
      unlock_tier = excluded.unlock_tier,
      difficulty = excluded.difficulty,
      description = excluded.description,
      is_visible = excluded.is_visible,
      updated_at = now();

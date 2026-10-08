-- =============================================================================
-- Gun unlock rework: XP-based unlocks + CQC and Ranged tree merges.
-- =============================================================================
-- Unlocks now cost TREE XP (XP earned with guns in that tree) + a level floor,
-- replacing the old class "points". Thresholds (approved): Tier 1 = 28,000 XP /
-- Lvl 6 (~5 games), Tier 2 = 55,000 / Lvl 9 (~10), Tier 3 = 85,000 / Lvl 11 (~15).
-- Tree merges: CQC = M4 Gastat + MP9LT Phoenix (starters) -> P-90 -> MP-5 -> KEDR;
-- Ranged = SR-21 Ghost + MR-512 Sniper (both starters). The per-player unlock
-- state is recomputed by refresh_player_armory (next migration).
-- unlock_requirement_points now holds an XP value (column kept for compatibility).
-- =============================================================================

-- 1. Tree merges.
-- CQC: M4 Gastat is already CQC. Move the Phoenix + the old SMG guns in.
update public.guns set tree_branch = 'CQC', sort_order = 1 where name = 'M4 Gastat';
update public.guns set tree_branch = 'CQC', sort_order = 2, unlock_prerequisite_class = null where name = 'MP9LT Phoenix';
update public.guns set tree_branch = 'CQC', sort_order = 3 where name = 'P-90 Kayman';
update public.guns set tree_branch = 'CQC', sort_order = 4 where name = 'MP-5 Wolf';
update public.guns set tree_branch = 'CQC', sort_order = 5 where name = 'KEDR';
-- Ranged: SR-21 Ghost + MR-512 Sniper, both starters.
update public.guns set tree_branch = 'Ranged', sort_order = 1 where name = 'SR-21 Ghost';
update public.guns set tree_branch = 'Ranged', sort_order = 2 where name = 'MR-512 Sniper';

-- 2. XP thresholds + level floors + display text per unlockable gun.
--    (prerequisite_class = the tree whose XP counts.)
-- AR tree
update public.guns set unlock_type='Class', unlock_prerequisite_class='AR', unlock_requirement_points=28000, unlock_requirement_level=6,  unlock_display_text='🔒 28,000 AR XP · Lvl 6'  where name='Colt M4A3 Centurion';
update public.guns set unlock_type='Class', unlock_prerequisite_class='AR', unlock_requirement_points=55000, unlock_requirement_level=9,  unlock_display_text='🔒 55,000 AR XP · Lvl 9'  where name='HK416 Bergman';
update public.guns set unlock_type='Class', unlock_prerequisite_class='AR', unlock_requirement_points=85000, unlock_requirement_level=11, unlock_display_text='🔒 85,000 AR XP · Lvl 11' where name='ARP 556 Snowstorm';
-- AK tree
update public.guns set unlock_type='Class', unlock_prerequisite_class='AK', unlock_requirement_points=28000, unlock_requirement_level=6,  unlock_display_text='🔒 28,000 AK XP · Lvl 6'  where name='Akm Legend';
update public.guns set unlock_type='Class', unlock_prerequisite_class='AK', unlock_requirement_points=55000, unlock_requirement_level=9,  unlock_display_text='🔒 55,000 AK XP · Lvl 9'  where name='AKS-74U Falcon';
update public.guns set unlock_type='Class', unlock_prerequisite_class='AK', unlock_requirement_points=85000, unlock_requirement_level=11, unlock_display_text='🔒 85,000 AK XP · Lvl 11' where name='AK-12 Serval';
-- CQC tree
update public.guns set unlock_type='Class', unlock_prerequisite_class='CQC', unlock_requirement_points=28000, unlock_requirement_level=6,  unlock_display_text='🔒 28,000 CQC XP · Lvl 6'  where name='P-90 Kayman';
update public.guns set unlock_type='Class', unlock_prerequisite_class='CQC', unlock_requirement_points=55000, unlock_requirement_level=9,  unlock_display_text='🔒 55,000 CQC XP · Lvl 9'  where name='MP-5 Wolf';
update public.guns set unlock_type='Class', unlock_prerequisite_class='CQC', unlock_requirement_points=85000, unlock_requirement_level=11, unlock_display_text='🔒 85,000 CQC XP · Lvl 11' where name='KEDR';
-- LMG tree (single unlock)
update public.guns set unlock_type='Class', unlock_prerequisite_class='LMG', unlock_requirement_points=45000, unlock_requirement_level=8,  unlock_display_text='🔒 45,000 LMG XP · Lvl 8'  where name='Steyr Aug 3 Cobra';

-- 3. Starters stay Default (no requirement). Make sure the merged starters are clean.
update public.guns set unlock_type='Default', unlock_prerequisite_class=null, unlock_prerequisite_gun=null, unlock_requirement_points=null, unlock_requirement_level=null, unlock_display_text=null
  where name in ('M4 Gastat','MP9LT Phoenix','SR-21 Ghost','MR-512 Sniper');

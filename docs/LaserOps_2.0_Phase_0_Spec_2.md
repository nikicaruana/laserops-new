# LaserOps Malta 2.0 — Phase 0 Specification (Rev 2)
### Database Schema, Migration, and Cutover

**Status:** Draft for review — Rev 2, rebuilt on the match → round → player hierarchy
**Stack:** Vercel (Next.js) + Supabase Postgres
**Build model:** Feature branch + staging Supabase DB + Vercel preview deployment. `main` stays live and untouched throughout.

---

## 0. What changed since Rev 1 (read this first)

Rev 1 assumed one JSON file = one match. That was wrong, and the correction reshapes the schema's spine:

- **A JSON file is one ROUND.** A **match** is a set of rounds (usually ~5, sometimes fewer/more) that an admin groups together at upload.
- **Rounds are first-class.** Events, teams, team scores, round wins, and ELO all live at the **round** level. The **match** aggregates its rounds.
- **Teams are round-scoped and may shuffle between rounds** (to rebalance). No stable match-level team is assumed.
- **ELO is computed per round; the match reports the net ELO change** (sum of a player's round deltas).
- **Streaks are a separate engine from accolades** — they fire multiple times per round, each grants points, admin-editable.
- **Accolades can be round-scoped or match-scoped** (round MVP vs match MVP).
- **New admin-config subsystems:** spawn-camping adjudication, objective-play scoring, a scoring-era reset, and an earned (non-purchasable) progression currency.

Two items **await live game files this weekend**; the schema is built so neither can force a structural change (§12).

---

## 1. Design principles

1. **JSON event stream is the primary, ground-truth stats source** — one file per round; every stat, rating, streak, accolade, and report derives from it. The old CSV is historical migration input only.
2. **Raw events are retained per round** so any round is recomputable against future rules.
3. **Rounds group into matches by admin decision at upload** — never inferred from players or time (avoids mis-grouping when matches run close together).
4. **Teams are round-scoped**; read per round; may shuffle. Match results derive from round wins.
5. **Identity is bridged by headband number, per round** (nickname-as-headband on the JSON side, NFC scan on the account side).
6. **Multi-tenant-aware schema, single-tenant build** (`operator_id` everywhere; no tenant UI now).
7. **Migration is re-runnable and idempotent** (once to build, again at cutover).
8. **Config lives in data, not code** — ELO, XP, scoring coefficients, ranks, rating weights, guns, teams, streak/accolade rules, spawn-camp rules, seasons, eras: all admin-editable rows.
9. **PII is isolated and protected** with RLS; the public site reads PII-free views.
10. **Design for live, build later** — the event layer is round-scoped timestamped rows; a future live feed writes them incrementally. Not built in Phase 0; nothing precludes it.

---

## 2. Entity overview

```
operators (tenant root — single row for now)
  │
  ├─ accounts ──────────── player identity, PII, consent, auth link
  │     ├─ player_stats_lifetime   (rolling aggregates, era-aware)
  │     ├─ player_gun_stats        (per player × gun)
  │     ├─ player_armory           (per player × gun unlock state)
  │     ├─ account_balance         (earned currency — plumbing only)
  │     ├─ points_ledger           (append-only earn/spend history)
  │     └─ account_awards          (accolades + streaks earned, rolled up)
  │
  ├─ matches ───────────── admin-grouped set of rounds (LO-YYYY-NN)
  │     └─ rounds ──────── one per JSON file; the real unit of play
  │           ├─ round_teams          (teams THIS round — may differ each round)
  │           ├─ round_players        (one per player slot this round)
  │           │     └─ round_player_stats  (computed per-player-per-round line)
  │           ├─ round_events          (retained parsed events — ground truth)
  │           ├─ round_awards          (accolades + streaks awarded this round)
  │           └─ elo_snapshots         (per-round ELO deltas)
  │
  ├─ headband_map ───────── per-ROUND headband→account bridge
  │
  └─ CONFIG (admin-editable)
        ├─ guns / teams / seasons
        ├─ elo_config / xp_config / rank_levels / rating_config
        ├─ score_formula_config        (incl. objective-play weights)
        ├─ scoring_eras                 (the 2.0 reset point)
        ├─ spawn_camp_config            (protection window + consequence)
        ├─ accolade_definitions (+ accolade_rules, round/match scoped)
        └─ streak_definitions   (+ streak_rules, stackable, point-granting)
```

Baked-in structural facts: **Match → Round → Player** is the spine; "match stats" are aggregates of round stats. **Teams live on rounds.** Green team seeded from the start; team count never hardcoded. **`LO-YYYY-NN` match codes preserved**, per-year sequence continues after cutover.

---

## 3. Conventions

- **PKs:** UUID, except matches also keep their `LO-...` business code as a unique key.
- **Timestamps:** `created_at` everywhere; `updated_at` where rows mutate.
- **Tenancy:** `operator_id uuid not null` on every non-global table.
- **[PII]** marks tables needing RLS and inclusion in the data-subject export/delete story.
- Team colours, gun classes, rule types are lookup/config (admin-editable), not hardcoded.

---

## 4. Schema detail

### 4.1 `accounts` **[PII]**
Replaces `Player_Base`. Email is the identity anchor; ops tag the public display name.
Core columns: `id`, `operator_id`, `auth_user_id` (→ Supabase `auth.users`; null until claimed), `email` (citext unique), `full_name`, `date_of_birth` (13+ gating), `phone_e164`, `ops_tag` (citext unique, public), `profile_pic_url`, `marketing_opt_in`, `photo_consent` (**confirm default**), `waiver_accepted_at`, `waiver_version`, `found_us_via`, `played_before`, `claim_status` (`migrated_unclaimed`|`claimed`|`native`), `created_at`, `updated_at`.
Earned currency lives in its own table (§4.15).
**Claim flow (manual):** migrated players are `migrated_unclaimed`, `auth_user_id` null. When a real person signs up (OAuth/verified email), an admin merges the authenticated account into the unclaimed record — logged, reversible (§4.13), never a hard overwrite. Verification is free (sign-up already verified).
**RLS:** player reads/updates own row; admins read all.

### 4.2 `matches`
An admin-grouped container of rounds. Replaces the identity/result half of `Game_ID_Map`.
Columns: `id`, `operator_id`, `match_code` (`LO-YYYY-NN`, preserved), `year`, `sequence_no` (per-year, unique within operator+year), `played_on`, `scoring_era_id` (§4.10), `is_private` (`Is_Private_Match`), `is_double_xp` (`Is_Double_XP`), `teams_stable` (bool — same teams across all rounds? derived at ingestion; drives how the winner is expressed, §4.4), `net_result_summary` jsonb (derived round-win distribution + outcome), `created_at`.
> A match has no team columns; teams belong to rounds. Its outcome is derived from its rounds.

### 4.3 `rounds`
One per uploaded JSON file — the real unit of play.
Columns: `id`, `operator_id`, `match_id` (FK; assigned when admin groups the round in; briefly nullable), `round_no` (1..N), `source_game_id` (software `GameId` — **idempotency key**), `source_file_ref` (stored raw JSON key), `started_at` (`GameStart`), `duration` (`GameDuration`), `scenario_name`, `scenario_type`, `team_count`, `winning_team_colour` (nullable), `result_source` (`computed`|`reported`), `created_at`.
Idempotency: a round already imported (by `source_game_id`) is updated, never duplicated — makes the migration safe to re-run at cutover.

### 4.4 Round teams, match results, and the shuffle
**`round_teams`** — one per team *that round*: `id`, `round_id`, `team_colour` (→ `teams`), `team_score`, `is_round_winner`. Unique (round_id, team_colour).
**Deriving the match winner (handles shuffled teams):**
- Each round has a winner (`rounds.winning_team_colour`).
- Round wins credit **both the team colour AND the players on the winning side that round** (`round_players.was_on_winning_side`).
- `teams_stable = true` → match winner is the **team** with most round wins (your current model).
- `teams_stable = false` (shuffled) → a single winning team is meaningless; the result is expressed as **rounds-won**, with each player carrying a personal round-win tally.
`net_result_summary` stores whichever form applies. Shuffling is a supported first-class case, not a breakage.
**ELO:** per round (a coherent team-vs-team contest); the match reports each player's **net ELO change** = sum of round deltas (§4.12). Works identically for stable or shuffled teams.

### 4.5 `round_players` and `round_player_stats`
**`round_players`** — one per slot: `id`, `round_id`, `account_id` (nullable; via `headband_map`; null for unclaimed walk-ins), `team_colour` (this round), `in_game_player_id` (JSON slot), `headband_no`, `gun_used` (→ `guns`), `was_on_winning_side`.
**`round_player_stats`** — computed per-player-per-round line, 1:1 with `round_players`: shots, hits, frags, deaths, wounds, revivals, treatments, captures, capture_time (if available §12), accuracy (`hits/shots`), kd, damage (`hits × gun_damage`), score (§4.9 incl. objective terms), within-round ranks, round_rating, performance-vs-round-average, XP components (points, wins, accolades, streaks).
> **Adjudication (spawn-camping §4.11) runs BEFORE these compute**, so stats/accolades reflect adjudicated truth.
**Match-level per-player** stats are aggregates: `match_player_aggregate` (per match_id + account_id: summed counts, net ELO, total XP, match accolades), recomputed from rounds, stored for fast reads.

### 4.6 `round_events` — retained ground truth
Parsed JSONL per round: `id` (bigint), `round_id`, `event_time`, `seq` (line order), `item_type` (GameStart/PlayerEvent/PlayerHitEvent/PlayerFragEvent/TeamScoreChangedEvent/FieldDeviceEvent/LeaderTeamsChangedEvent/GameEnd), `player_id` (nullable), `victim_player_id` (nullable), `payload` jsonb (full `Item`, untouched).
Indexes `(round_id, seq)`, `(round_id, item_type)`. Powers streaks, spawn-camp adjudication, objective scoring, recompute — and what a live feed writes incrementally.

### 4.7 `guns` (config)
From `Gun_Damage`; **collapse the duplicate Damage column** on migration. Columns: `name` (unique), `damage`, `image_url`, `class`, `tree_branch`, `is_default`, `unlock_type` (class|gun), `unlock_prerequisite_class`, `unlock_prerequisite_gun`, `unlock_requirement_points`, `unlock_requirement_level`, `unlock_display_text`, `sort_order`, `unlock_tier`, `mag_size`, `reload`, `fire_rate`, `difficulty`, `description`. (Length/weight/range: migrate, mark deprecated.)

### 4.8 `teams` (config) — Green included
`colour` (Red/Blue/Yellow/**Green**/…), `display_name`, `badge_url`, `sort_order`, `is_active`. Green seeded now. All per-team logic iterates this table; count never hardcoded.

### 4.9 `score_formula_config` (config) — with objective play
```
score = ROUNDUP(
  ( (frags × KILL_WEIGHT)
    + (damage × DAMAGE_WEIGHT)
    + (captures × CAPTURE_WEIGHT)
    + (capture_time × CAPTURE_TIME_WEIGHT) )
  × (1 + accuracy × ACCURACY_WEIGHT)
  × (1 + kd × KD_WEIGHT)
, 0)
```
Seed: `KILL_WEIGHT=50`, `DAMAGE_WEIGHT=0.2`, `ACCURACY_WEIGHT=0.2`, `KD_WEIGHT=0.12`. New: `CAPTURE_WEIGHT`, `CAPTURE_TIME_WEIGHT` (values TBD). One row per coefficient (`key`, `value`, `note`), admin-editable. `capture_time` availability is a §12 item.

### 4.10 `scoring_eras` (config) — the 2.0 reset
Because 2.0 adds capture + streak points, scores rise and post-2.0 isn't comparable to legacy.
`scoring_eras`: `id`, `name` (Legacy/2.0), `starts_at`, `ends_at` (null=current), `is_default_view`. Every match carries `scoring_era_id`.
**Era-aware aggregation:** point-based lifetime stats (overall score, score/match) computed per era; **default view = 2.0 only**; players can toggle to include Legacy. Count-based stats (kills, accuracy, wins) are unaffected and span all eras. Surgical reset, not a wipe.

### 4.11 `spawn_camp_config` (config) + adjudication
Admin rules: `protection_window_seconds` (3/5…), `consequence_mode` (`void`|`penalty`), `penalty_points`.
**Adjudication pass** (ingestion, before stats): for each `PlayerFragEvent`, check victim's time-since-respawn (respawn detection = §12 item, likely HP reset). If inside window: **victim takes NO death** (your decision — protects K/D and Ghost); **shooter** → `void` (no frag) or `penalty` (frag may stand, `penalty_points` subtracted from round score). Runs before stat/accolade compute. Logged for transparency and AI reports.

### 4.12 `elo_config` + `elo_snapshots` (per round) + `rank_levels` + `rating_config`
**`elo_config`** — `ELO_Setting`/`ELO_Value` pairs (Starting_ELO 1000, K_Factor 36, Performance_K 13, match-size multipliers) + ELO tier bands (Recruit…Elite).
**`elo_snapshots`** — **one per player per ROUND**: before, expected, actual, team-result change, performance adjustment, delta, after, config values *used* (past math stays reproducible), batch id, timestamp. Applies in **round chronological order**; `Resnapshot_Mode = From_Round_Onwards`.
**Match net ELO** = sum of a player's round deltas, stored on `match_player_aggregate`.
**`rank_levels`** — 1–50 ladder (level, rank_name, score_threshold, est_games, badge_url).
**`rating_config`** — percentile brackets (0–5★), gates (Min_Level 4, Min_Matches 2, Min_Eligible_Pool 10), weighted components (sum to 1).

### 4.13 `admin_audit`
Append-only: merges/claims, round→match grouping, manual result entry, config edits, streak/accolade overrides, adjudication overrides. Backs reversible-merge and accountability.

### 4.14 Accolades AND Streaks — two engines, shared plumbing
**Accolades** — superlatives/awards, **one winner per category per scope** (round or match).
- `accolade_definitions`: `id`, `name`, `description`, `badge_url`, `xp`, `points`, `scope` (`round`|`match`), `is_active`.
- `accolade_rules`: `match_superlative` (max/min of a stat — your 15, now scope-aware so **round MVP** and **match MVP** both work), `threshold`, `custom`.

**Streaks** — event-level, **fire multiple times per round**, each grants points, admin-editable.
- `streak_definitions`: `id`, `name` (5-kill-streak, 10-kill-streak, Clutch, First Blood), `description`, `badge_url`, `xp`, `points`, `is_active`.
- `streak_rules`:
  - `streak` — N consecutive events, no interrupt (kill/capture streaks); params event_type, breaks_on, min_length.
  - `time_window` — N events of given kinds within T seconds, optional state condition; params event_types[], window_seconds, min_count, state_condition (HP<50). Covers **Clutch** (2 kills + capture in 30s), **Survivor** (2 kills at HP<50).
  - `first_event` — first occurrence in a round (**First Blood**).
  - `custom` — escape hatch.
Streaks require retained ordered events (§4.6) — impossible from a summary.

**Awards:**
- `round_awards`: `round_id`, `account_id` (or headband if unresolved), `kind` (`accolade`|`streak`), `definition_id`, `awarded_at`, `xp_granted`, `points_granted`, `detail` jsonb.
- `match_awards`: match-scoped accolades (match MVP), derived after all rounds ingest.
- `account_awards`: rolled-up per-player counts/history.
Points from streaks/accolades post to the ledger (§4.15).

> **AI report hook (Phase 1, reserved):** `round_player_reports` / `match_player_reports` (`beats` jsonb, `narrative` text, `generated_at`, `voice_version`). Beats = what the stats/streak/accolade/adjudication layers already produce. Held, not built.

### 4.15 Earned currency — `account_balance` + `points_ledger` (plumbing only)
Earned, **non-purchasable**. Nothing is bought → no stored-value/e-money weight. Purchasing stays in the future booking/Stripe flow, never touching this balance.
- `account_balance` **[PII]**: `account_id` (1:1), `balance`, `updated_at`.
- `points_ledger` **[PII]**: append-only — `id`, `account_id`, `delta` (+earn/−spend), `reason` (`round_win`|`streak`|`accolade`|`armory_unlock`|`admin_adjust`), `ref_id`, `created_at`.
**Spending rules unspecified in Phase 0.** Plumbing accrues earnings from day one; what it buys is later. Armory unlock (§4.16) is the first natural spend.

### 4.16 `player_gun_stats`, `player_armory` **[PII]** (first-class)
**`player_gun_stats`** — per player × gun aggregates (games, frags, deaths, hits, shots, damage, avg damage). Junction (`account_id`, `gun_name`), recomputed from round stats.
**`player_armory`** — per player × gun **unlock state**, first-class: junction (`account_id`, `gun_name`) with `is_unlocked`, `points_toward_unlock`, `unlocked_at`, display state. Rules live on `guns` (§4.7); this tracks progress. Evaluator runs at ingestion; logic Phase 1, schema supports it now.

### 4.17 `player_stats_lifetime` **[PII]**, leaderboards, seasons
**`player_stats_lifetime`** — 1:1 with account: totals, averages, current ELO, level/XP, rating, games, win rate. **Era-aware** for point-based fields (§4.10). Recomputed as rounds ingest.
**`seasons`** (config): `id`, `name`, `starts_on`, `ends_on`, `is_active` — **admin-defined date ranges**, not hardcoded quarters.
**`leaderboard_period_stats`** — keyed (`account_id`, `period_type`, `period_key`); `period_type` ∈ month|year|season|all-time (season → a `seasons` row). **Leaderboards filter by month, year, and custom seasons.**
**PUBLIC data** — the Sheets' PUBLIC variants become **views / RLS policies**, not duplicated tables. No sync drift.

---

## 5. PII, security, RLS
RLS on: `accounts`, `player_stats_lifetime`, `player_gun_stats`, `player_armory`, `account_balance`, `points_ledger`, `headband_map`, `elo_snapshots`, `round_players`/`round_player_stats` + match aggregates, `admin_audit`. Player reads own (`auth_user_id = auth.uid()`); admins all; public site reads PII-free views only. Config tables world-readable, admin-writable. EU/Malta data-subject support built in (§8).

---

## 6. Ingestion pipeline (schema-level contract)
1. Admin uploads round JSON(s) and **groups them into a match** (assigns `match_id`, `round_no`); match code continues `LO-YYYY-NN`.
2. Parse JSONL → `round_events` (+ store raw file).
3. Per round `GameStart` → `rounds`, `round_teams`, `round_players`, **reading that round's teams** (handles shuffle).
4. **Validate headband nicknames = expected numbers** → `headband_map`; flag anomalies as round errors.
5. Resolve identity → `account_id` (NFC scan / manual email; unresolved stay null, admin-fixable).
6. **Spawn-camp adjudication** (§4.11) — void/penalise before stats.
7. Compute `round_player_stats` via `score_formula_config` (incl. objective terms).
8. Round winner: computed/reported → `rounds`, `round_teams.is_round_winner`, `round_players.was_on_winning_side`.
9. **Per-round ELO** chronological → `elo_snapshots`.
10. **Streak** + **accolade** engines (round scope) → `round_awards`; post points to ledger.
11. Update `player_gun_stats`; evaluate `player_armory` unlocks.
12. When all rounds in: match aggregates — `match_player_aggregate` (net ELO), match accolades → `match_awards`, `matches.teams_stable` + `net_result_summary`.
13. Update `player_stats_lifetime` (era-aware) + `leaderboard_period_stats`.
14. (Phase 1) report beats + narrative.
`ingestion_errors` (`round_id`/`match_id`, `stage`, `detail`, `resolved`) backs the admin "Errors" column.
**Live-feed readiness (later):** steps 2–3 batch-write today; a future venue watcher writes the same rows incrementally, Supabase real-time pushes to a live match page. No schema change.

---

## 7. Migration from Google Sheets
Re-runnable, idempotent on `rounds.source_game_id`.
**Order:** config first (`operators`, `teams` incl. Green, `guns` w/ Damage fix, `elo_config`, `xp_config`, `rank_levels`, `rating_config`, `score_formula_config`, `scoring_eras` Legacy+2.0, `seasons`, `spawn_camp_config`, `accolade_definitions`+rules for the 15 as `match_superlative`, `streak_definitions` as designed) → `accounts` (all `migrated_unclaimed`) → historical matches/rounds → derived history.
**Flat-export split:** `Game_Data_Raw` is one row per player-per-team-per-**round**, match-level fields repeated. Split into `rounds` (distinct `GameId`) → `round_teams` (distinct GameId+TeamColor) → `round_players`/`round_player_stats`. **Group historical rounds into matches** via `Game_ID_Map`'s existing `LO-...` grouping. **Multiple `Game_Data_Raw` instances** — iterate all.
**Historical era:** all migrated matches tagged **Legacy**; point-based stats taken as-given (pre-JSON rounds can't be re-derived from absent events). Only 2.0-era rounds fully replayable.
**Preserve identifiers:** `LO-YYYY-NN` codes + per-year counter; `GameId` → `source_game_id`.
**Phone:** run `STANDARDIZE_PHONE_3` once → `phone_e164`.
**Hygiene:** report suspected duplicate players (don't auto-merge); collapse duplicate Gun Damage; expect inconsistent historical nicknames; note formula-change seasons. Produce a **reconciliation report** — review, don't just trust a green run.

---

## 8. GDPR / data-subject support
- **Access:** full data by `account_id` across PII tables.
- **Deletion/anonymisation:** don't break round/match integrity — null `account_id` on `round_players`/`headband_map` (round still happened; aggregates stand) and hard-delete `accounts` PII. Ledger/awards/snapshots anonymise-or-cascade per policy — **decide in Phase 0, switch in Phase 1.**
- Consent flags first-class and queryable.

---

## 9. Suggested build order
1. `operators` + all config + seed (Green team, Legacy+2.0 eras, spawn-camp defaults, objective coefficients). Verify vs current numbers.
2. `accounts` migration. Verify counts, PII, ops-tag uniqueness.
3. `rounds`+`round_teams`+`round_players`+`round_player_stats` from flat export; **group into `matches`** via `LO-...` IDs. Reconcile scores + known results.
4. `round_events` — parse real round JSONs; confirm index matches raw.
5. `headband_map` for migrated rounds; wire identity resolution.
6. Per-round `elo_snapshots` (chronological) → match net-ELO; `player_stats_lifetime` (era-aware); `player_gun_stats`; `player_armory`.
7. Accolade + **streak** engines; seed 15 as `match_superlative`; validate vs Sheets. (Streaks start at 2.0 — no legacy history.)
8. Earned-currency plumbing — accrues 2.0-era only.
9. Seasons + `leaderboard_period_stats`; confirm month/year/season filtering.
10. PUBLIC views + RLS. Confirm non-owner can't read PII.
11. **Full migration end-to-end** → reconciliation report → review.
Done when step 11 reconciles cleanly against the live Sheets.

---

## 10. Cutover
1. Freeze Sheets processing (quiet window).
2. Re-run idempotent migration to capture everything since the snapshot.
3. Review reconciliation; counts must match.
4. Flip production env vars to the production DB.
5. DB becomes source of truth; Sheets → read-only archive.
6. Keep Sheets for a rollback window before decommissioning.
`main` and its data were never touched during development — cutover is the first deliberate movement of production data.

---

## 11. What Phase 0 deliberately excludes
Auth flows, ingestion-engine implementation, booking, payments, the AI report generator, the live event feed, and **points *spending* rules** are Phase 1+. Schema supports all without change. Earned-currency *earning* is in (plumbing); *spending* deferred. Purchasing stays in the future Stripe flow, never touching the earned balance.

---

## 12. Open questions / confirm-items
**Awaiting live game files this weekend (neither forces a structural change):**
1. **Do per-round `GameStart` payloads list that round's teams?** If yes (expected), shuffle-capture is automatic. If teams persist, that's the same-teams case. Schema handles both.
2. **Are JSON files written live (growing during a round)?** If yes, the live-feed path is open. Confirm by watching the appdata file during a test round.

**For me to verify against real multi-player event data:**
3. **Respawn detection** for spawn-camp adjudication (likely HP reset in `PlayerEvent`).
4. **Capture timing** for objective scoring — does `FieldDeviceEvent` give duration/timestamp for `capture_time`?

**Product decisions (none block starting):**
5. `photo_consent` default for migrated players.
6. `CAPTURE_WEIGHT` and `CAPTURE_TIME_WEIGHT` values.
7. Deletion cascade-vs-anonymise policy.
8. Confirm seeded `match_superlative` rules reproduce the 15 accolades exactly.
9. `spawn_camp_config` seed values (window; void vs penalty; amount).

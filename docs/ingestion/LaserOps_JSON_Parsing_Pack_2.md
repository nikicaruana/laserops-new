# LaserOps — JSON Event File Parsing Pack
### Instructions for Claude Code to build the round-file parser

**Purpose:** Turn one LaserWar/Alphatag online game JSON file (one round) into clean, structured, per-player and per-base data that downstream stats/streak/scoring logic can consume. This pack is the ground-truth extraction layer. It is verified against a real 4-player game file.

**Scope:** Two layers, in order. **(A) Parsing and fact-extraction** (§0–§4) — turn the raw file into clean facts. **(B) Streak detection** (§7) — compute streaks from those facts. It does NOT compute ELO, XP, or scores; those consume this output. Keep layer A pure: a clean extraction layer stays reusable no matter how the streak rules evolve.

---

## 0. File format fundamentals (read before coding)

- The file is **JSONL**: one JSON object per line, not a single JSON array. Parse line by line; skip blank lines; tolerate a malformed final line.
- Each line has the shape: `{"EventTime": "YYYY.MM.DD HH:MM:SS", "ItemType": "...", "Item": {...}}`.
- `GameEnd` events may have **no `Item`** — guard against a missing `Item` key everywhere (`e.get('Item', {})`), or the parser crashes on that line.
- **Timestamps are whole-second wall-clock**, captured at the device. Resolution is 1 second (no milliseconds). Format: `%Y.%m.%d %H:%M:%S`.
- **The file is NOT globally time-sorted.** Devices buffer events when out of wifi range and dump them on reconnect, so a later line can carry an earlier timestamp. **Any time-based logic MUST sort events (per player) by timestamp first — never trust raw file/line order for timing.** Raw line order is only reliable for same-second same-burst grouping (see captures).
- Discard implausibly late events: this file had one junk `GameEnd` stamped ~3 hours after the round. Flag any event whose time is wildly beyond the game window as suspect and exclude from stats.

### The 8 event types (the complete vocabulary)
| ItemType | Item fields | Meaning |
|---|---|---|
| `GameStart` | StartTime, Duration, Teams[], Players[], FieldDevices[] | Round setup — roster, teams, bases |
| `PlayerEvent` | PlayerId, HP, + running counters (Shots, Hits, Frags, Deaths, Wounds, Revivals, Treatments, Captures, StartCaptures, Score) | A player's cumulative counters at a moment |
| `PlayerHitEvent` | PlayerId, VictimPlayerId, Damage | A dealt damage instance |
| `PlayerFragEvent` | PlayerId, VictimPlayerId | A kill |
| `FieldDeviceEvent` | PlayerId (= device id), Team, Captures, Wounds | A base reporting its state/ownership |
| `TeamScoreChangedEvent` | Colour, Index, Name, Score | Running team score |
| `LeaderTeamsChangedEvent` | Colour, Index, Name | Lead changed hands |
| `GameEnd` | (none) | Round ended |

**Critical id caveat:** in `FieldDeviceEvent`, the `PlayerId` field is actually the **device/base id** (matching `FieldDeviceId` in GameStart), NOT a player. **Never hardcode which numbers are devices vs players — the ranges shift between games.** (File A: players 1–4, devices 5–7. File B: devices 1–3, players 4–7.) Always build the player-id set from `GameStart.Players` and the device-id set from `GameStart.FieldDevices`, then classify every event's id by set membership.

---

## 1. What to extract (the target output)

Produce a single structured object per round, e.g.:

```
Round {
  meta: { start_time, duration_seconds, team_count, player_count, has_field_devices }
  scenario: { name: null, type: null, inferred_mode: "capture/domination" | "unknown" }   // see §2.1
  teams: [ { colour, name } ]
  players: [ { in_game_player_id, name, nickname, team, headband_no: null } ]              // headband null for now, see §2.2
  bases:  [ { device_id, nickname } ]
  events: {
    damage:   [ { time, actor_id, victim_id, damage, is_spawn_damage } ]
    kills:    [ { time, actor_id, victim_id, is_spawn_kill } ]
    respawns: [ { time, player_id } ]
    captures: [ { time, base_id, capturing_player_id, new_owner_team } ]
  }
  base_ownership: [ { base_id, team, from_time, to_time|null, held_seconds } ]
  final_player_counters: { player_id: { shots, hits, frags, deaths, wounds, revivals, treatments, captures, score } }
  ingestion_flags: [ ...anomalies... ]
}
```

Everything below explains how to fill each part, with the field names verified against real data.

---

## 2. Extraction rules, item by item

### 2.1 Scenario / game mode  ⚠️ NOT DIRECTLY AVAILABLE
- **There is no scenario/game-mode field anywhere in the JSON.** Confirmed against the real file. `GameStart` has only StartTime, Duration, Teams, Players, FieldDevices.
- The CSV export *does* have `ScenarioName`/`ScenarioType`, so the software has it — it's just absent from the JSON. This is a known gap (like headband, §2.2).
- **For now:** set `scenario.name`/`scenario.type` to `null`. Infer a coarse `inferred_mode`: if `FieldDevices` is non-empty, it's a capture/domination-style mode; else unknown. Do not fabricate a scenario name.
- **Flag for later:** scenario likely needs the CSV bridge or a dev request to appear in JSON.

### 2.2 Headband number  ✅ AVAILABLE (via `Name`)
- Each player in `GameStart.Players` has: `PlayerId` (per-round slot), `Name`, `Nickname`, `Team`.
- **The headband number arrives in the `Name` field**, formatted `"Head NN"` (e.g. `"Head 04"`, `"Head 43"`). Confirmed in an online game after the server-side equipment-ID configuration was applied.
- Parse the integer out of `Name` with a tolerant regex (e.g. `Head\s*0*(\d+)`) → `headband_no`. **Do not assume zero-padding or exact spacing.**
- `Nickname` is still blank — do not rely on it.
- **`PlayerId` is still a per-round slot, NOT the headband.** In the confirmed file, players were ids 4–7 while headbands were 04/34/20/43. Always key within-round joins on `PlayerId`; use `headband_no` for cross-round identity.
- **Fallback:** if `Name` does not match the `Head NN` pattern (older files, or config not applied), set `headband_no: null` and add an `ingestion_flag`. Historic files (pre-fix) carry generic callsigns like "Knight"/"Paladin" and have no recoverable identity.

### 2.3 Number of players & teams  ✅
- `player_count = len(GameStart.Players)`.
- `teams` from `GameStart.Teams` (each has Index, Name, Colour). **Do not hardcode 2 teams** — read the array (system supports Red/Blue/Yellow/Green).
- Each player's team is on the player object (`Team`), matching a team Colour.

### 2.4 Who damaged who and when  ✅
- From `PlayerHitEvent`: `{ time: EventTime, actor_id: Item.PlayerId, victim_id: Item.VictimPlayerId, damage: Item.Damage }`.
- Verified: 192 hit events in the sample; e.g. P4 hit P2 for 30.

### 2.5 Who killed who and when  ✅
- From `PlayerFragEvent`: `{ time, actor_id: Item.PlayerId, victim_id: Item.VictimPlayerId }`. No damage field on kills.
- Verified: 29 kills in the sample.

### 2.6 Who spawned and when  ✅ (with care)
- **A respawn = a `PlayerEvent` where `HP` becomes full (150 in sample) AND the player's `Revivals` counter increments** vs their previous `PlayerEvent`. Respawn is instant to full HP (confirmed against gameplay — there is NO gradual heal ramp; descending HP sequences are the player being shot, not respawning).
- Algorithm: iterate a player's PlayerEvents **sorted by time**, track previous `Revivals`; when `Revivals` increases and `HP == max`, record a respawn at that EventTime.
- **DO NOT de-duplicate close-together respawns.** Rapid successive respawns by the same player are **legitimate gameplay**, not artifacts — a player can genuinely die and respawn repeatedly within seconds (e.g. when a mobile spawn point is near the fighting, or when being spawn-trapped). Collapsing them would destroy real data and, critically, would erase the exact signature that spawn-camp detection depends on.
- The only respawns to drop are exact duplicates: the *same* respawn reported twice with an identical timestamp AND identical `Revivals` value (a true buffering re-send). Deduplicate on `(player_id, Revivals)` — never on time-proximity alone. Since `Revivals` is a monotonic counter, each genuine respawn has a unique value, which makes this exact and safe.
- Record any exact-duplicate drops in `ingestion_flags`.
- **Max HP is not guaranteed 150 forever** — read it from the data (it's the health config) rather than hardcoding; default to observed max per player if unsure.
- The initial spawn at game start is NOT a respawn — don't emit one for it (matters for spawn-camp logic later).

### 2.7 Who captured what base, when  ✅ (timestamp join)
- A capture produces a **same-second burst** of events:
  - a `FieldDeviceEvent` with the base's `PlayerId` (= device id), the new `Team`, and the base's `Captures` count;
  - a `PlayerEvent` for the capturing player whose `Captures` counter increments, at the **same EventTime**.
- **Join by timestamp:** the player whose `Captures` increments in the same second as a base's `Team` flip is the capturer.
  `{ time, base_id: device PlayerId, capturing_player_id: that player, new_owner_team: Team }`.
- Verified: all 8 captures in the sample joined cleanly (e.g. 02:44:24 base 6 → Blue by P3).
- **Ambiguity guard:** if two different bases flip in the *same second*, the single-second join can be ambiguous. Detect this (two device flips sharing a timestamp) and, if the capturing players can't be uniquely matched, record both candidates and add an `ingestion_flag` rather than guessing. (Did not occur in sample, but will in busier games.)

### 2.8 How long a base was held  ✅
- Sort each base's ownership flips by time; the hold duration of an ownership period = next flip's time − this flip's time. The final period runs to `GameEnd` (or last event) — mark it `to_time: null` and compute held_seconds to round end.
- Verified: e.g. base 7 held by Red 259s, then Blue 31s, then Red 150s.
- This yields per-base, per-team hold time — the input for objective/capture-time scoring later.

### 2.9 Final per-player counters  ✅
- `PlayerEvent`s carry **cumulative running totals**. A player's final value for each counter = the **last** value seen for that player (after sorting by time), for: Shots, Hits, Frags, Deaths, Wounds, Revivals, Treatments, Captures, Score.
- Cross-check: `Frags` final total should match the count of that player's `PlayerFragEvent`s; `Captures` final should match their capture count from §2.7. If they disagree, record an `ingestion_flag` (indicates a lost/buffered event).

### 2.10 Spawn-protection flagging (spawn damage & spawn kills)  ✅
Fixed spawn points are used in real games, so any hit or kill landing on a player immediately after they respawn is treated as shooting at the spawn.

- **Protection window: 3 seconds** (must be a config value, not hardcoded — expect it to be tuned).
- For **every** `PlayerHitEvent` and `PlayerFragEvent`, compute the gap between the event time and the **victim's most recent respawn** (§2.6). If `gap <= 3s`, flag it:
  - `PlayerHitEvent` → `is_spawn_damage: true`
  - `PlayerFragEvent` → `is_spawn_kill: true`
- **Exclude the initial spawn of the round.** Protection applies only to genuine mid-round respawns (Revivals-increment events), never to the game-start spawn — otherwise legitimate first-blood kills falsely flag.
- **The rule is strictly per-event and victim-centric.** Judge each hit/kill solely on how soon it followed *that victim's* respawn. Do NOT consider the shooter's identity, or how many times one player has hit/killed another — repeatedly beating the same opponent in open play is legitimate and must not flag. The timing alone separates spawn camping from normal play.
- Use the per-player time-sorted respawn list from §2.6; a victim's "most recent respawn" is the latest respawn at or before the event time.
- The parser only **flags**; it does not void, penalise, or adjust stats. Applying consequences (void the damage/kill, or apply a points penalty) belongs to the downstream adjudication step, which should have **separate settings for spawn damage and spawn kills** — they may warrant different treatment (e.g. void damage but penalise kills).
- Output these as fields on the existing damage/kill event records, plus a round-level count in `ingestion_flags` (e.g. `spawn_kills: 11, spawn_damage: N`) so operators can see at a glance whether a round had a spawn-camping problem.

**Verified on sample data:** with a 5s window, 11 of 29 kills flagged — including a clear run where one player killed the same opponent 1–3 seconds after each respawn, repeatedly. A 3s window will be stricter still.
- `PlayerEvent`s carry **cumulative running totals**. A player's final value for each counter = the **last** value seen for that player (after sorting by time), for: Shots, Hits, Frags, Deaths, Wounds, Revivals, Treatments, Captures, Score.
- Cross-check: `Frags` final total should match the count of that player's `PlayerFragEvent`s; `Captures` final should match their capture count from §2.7. If they disagree, record an `ingestion_flag` (indicates a lost/buffered event).

---

## 3. Processing order (important)

1. Read all lines → parse JSON, skipping blanks and guarding missing `Item`.
2. Split out `GameStart` → build meta, teams, players, bases.
3. Bucket events by type.
4. **Sort each per-player and per-base stream by `EventTime`.** (Do not skip — file is not globally sorted.)
5. Flag & drop implausibly-late events (e.g. > game duration + small margin beyond the last real activity).
6. Extract damage, kills (direct).
7. Extract respawns (Revivals-increment + full HP), with de-dup.
8. Extract captures (timestamp join of device flip ↔ player Captures increment), with same-second ambiguity guard.
9. Compute base ownership periods & hold durations.
10. **Flag spawn damage / spawn kills** (§2.10): for each hit and kill, compare to the victim's most recent mid-round respawn; flag if within the 3s window. Must run *after* respawns are extracted and sorted.
11. Compute final per-player counters (last cumulative value), with cross-checks.
12. Emit the structured Round object + `ingestion_flags`.

---

## 4. Things to build defensively (learned from real data)

- **Never trust raw line order for time.** Always sort by timestamp within a player/base stream first.
- **Guard `Item` absence** (GameEnd).
- **Don't hardcode:** team count, max HP, player count, base count — read them all from the file.
- **`FieldDeviceEvent.PlayerId` is a base id, not a player.** Keep base ids and player ids in separate namespaces.
- **Whole-second resolution** means same-second ties are possible — handle capture ambiguity accordingly. For respawns, use the `Revivals` counter (not timing) to distinguish genuine repeats from re-sends.
- **Cross-check cumulative-vs-counted** (frags, captures) and surface mismatches as flags rather than silently trusting one source.
- **Everything keys on `in_game_player_id` within one round.** Identity (headband→person) is a separate, later join. Keep the parser identity-agnostic so it works unchanged once the headband gap is fixed.

---

## 5. Known gaps to carry forward (not the parser's job to solve)
1. ~~Headband / stable identity~~ — **RESOLVED.** Headband number now arrives in `Name` as `"Head NN"` (§2.2). Files created *before* this fix carry generic callsigns and have no recoverable identity — treat them as identity-less.
2. **Scenario name/type** — still absent from JSON (present in CSV). Parser infers coarse mode from field-device presence only. Remains a candidate for a dev request.
3. **Burn state** — not signalled in the JSON; reconstructed from ownership durations (§7.0). Still unvalidated against a game where bases actually burned.

## 6. Suggested validation for the parser

**Reference file A** (`RealtimeStatistics_20260725_144337.json`, 4 players, pre-identity-fix):
- player_count 4; teams Red(Vertex)/Blue(Scream Shadow); 3 bases; players ids 1–4, devices 5–7.
- kills 29; hits 192; captures 8, all attributed with no ambiguity.
- base 7 ownership holds ≈ 259s, 31s, 150s.
- `Name` = generic callsigns → `headband_no` null + flag.

**Reference file B** (`RealtimeStatistics_20260801_143005.json`, 4 players, post-identity-fix):
- players ids **4–7**, devices **1–3** (proves id ranges shift — classify by GameStart membership).
- teams **Yellow**(Noob Power)/Blue(Alpha Impact) — note Yellow, not Red: never assume Red/Blue.
- `Name` = `Head 04`/`Head 34`/`Head 20`/`Head 43` → headband_no 4/34/20/43.
- kills 26; hits 201; captures **30/30 attributed**, 0 ambiguous.
- max kill streak: Head 43 = 6 (fires 3-Streak and 5-Streak).
- cumulative burn timers: base 1 Blue 492s, base 2 Blue 309s, base 3 Yellow 517s — **none reach 600s, so no burns** (matches the real game).
- longest continuous holds: base 1 236s, base 2 309s, base 3 496s.
- contains a `GameEnd` line with **no `Item` key** — parser must not crash (verified failure mode).

Then run against further files and watch for: multi-base same-second captures, long out-of-range buffering, larger player counts, 3+ teams, and cumulative-vs-counted disagreements.

---

## 7. Streak detection

Streaks are computed **from the extracted facts in §2**, after parsing completes. They are distinct from accolades: a streak can fire **multiple times per round**, and multiple different streaks can fire from the same run of play. Each grants points (admin-configurable).

### 7.0 Game mode context — "Domination"

The primary competitive mode. Required context for the base-related streaks:

- **3 bases** on the map. Each team spawns at opposite ends.
- A base is captured by shooting it from above.
- Each base has a **per-team cumulative hold timer**. When a team captures it, that team's timer runs; if the other team takes it, the first team's timer **pauses** and the second team's starts. Timers are **per base and run in parallel** across bases.
- When a team's cumulative timer on a base reaches **10 minutes**, that base is **burned** — permanently captured, out of the game.
- **First team to burn 2 bases wins.** Rounds typically run 15–25 minutes.

⚠️ **The burn is NOT signalled in the JSON.** `FieldDeviceEvent` carries only owning team, capture count, and wounds — no burn flag and no hold timer. The cumulative timers and burns must be **reconstructed** by accumulating ownership durations per team per base (§2.8). **This reconstruction is UNVALIDATED** — it must be checked against a real game file in which bases actually burned, confirming computed burn moments match what happened in-game. Until then, treat Burner as provisional.

### 7.1 General rules

- **Thresholds stack.** A single run crossing multiple thresholds awards each one (a 10-kill run awards 3-Streak, 5-Streak *and* 10-Streak).
- **"In one life"** means between one respawn and the player's next death (or round end). Use the respawn list from §2.6 to bound lives. The first life runs from round start to first death.
- All streaks are computed on **time-sorted** per-player event streams (§0).
- Streaks are attributed to **individual players**, never teams — including the base-hold and burn streaks (see §7.4).
- Every streak emitted should carry: `player_id`, `streak_name`, `time` (when it completed), and a `detail` object with the specifics (streak length, base ids, window, etc.) for use in match reports.

### 7.2 Kill-based streaks

| Streak | Rule |
|---|---|
| **3-Streak / 5-Streak / 10-Streak / 20-Streak** | N consecutive kills by the player with **no death of that player** in between. Walk the player's merged, time-sorted stream of their own kills and their own deaths; increment on kill, reset to 0 on death; emit each threshold as it is crossed. |
| **First Blood** | The first kill of the round (earliest `PlayerFragEvent` by time). Exactly one per round. |
| **Last Blood** | The final kill of the round (latest by time). Exactly one per round; only determinable once the round is complete. |
| **Survivor** | 3 kills made while the player's HP is **≤ 50 (absolute)**, within a **single life**. HP at the moment of a kill is reconstructable — every hit carries an HP reading for the victim (verified 192/192), so HP is a step function changed by hits and respawns. Take the player's last known HP at or before the kill time. |
| **Streak Ender** | Killing a player who is currently on a kill streak of **≥5**. Requires tracking every player's live streak counter across the round and evaluating the victim's counter at the moment of the kill. |
| **Bully** | Killing the **same** opponent 10 times in one round. Count kills per (killer, victim) pair. |
| **Clean Sweep** | Killing **every** member of the opposing team at least once in the round. Opposing-team roster comes from `GameStart.Players` filtered by team. |
| **Grim Reaper** | Killing every member of the opposing team at least once **within a single life** (no death in between). Strictly harder than Clean Sweep. |

### 7.3 Objective streaks (per player)

| Streak | Rule |
|---|---|
| **PTFO** | Capturing **2 different** bases (distinct base ids) within a single life. |
| **Map Domination** | Capturing **all 3** different bases within a single life. |
| **3 / 5 / 10 base captures in one round** | Player's total captures in the round crossing each threshold (from §2.7 capture attribution). Thresholds stack. |
| **Burner (1 base) / Burner (2 bases)** | Being credited with burning 1 (and 2) bases in the round. See §7.4 for attribution and the validation caveat. |

### 7.4 Base hold & burn streaks — attribution

These are **individual** awards even though holding a base is a team effort. Attribution rule:

- **Hold streaks (3 / 5 / 10 minutes continuous)** — awarded to the player who **captured** the base, i.e. whoever started that continuous ownership period. The hold must be **continuous** (uninterrupted by the base changing hands); measure from that capture to the next ownership flip, or to round end. Thresholds stack: a continuous 10-minute hold awards the 3-, 5- and 10-minute streaks.
  > Note: continuous hold is a *different* measure from the cumulative burn timer. Cumulative sums a team's separate holding periods; continuous requires one unbroken period.
- **Burner** — awarded to the player who made the **most recent capture before the burn threshold was crossed**, i.e. whoever was holding it when their team's cumulative timer hit 10 minutes.
- To compute burns: accumulate each team's ownership durations per base (§2.8); when a team's running total for a base reaches 600 seconds, emit a burn for that base at that moment and stop accumulating for that base.

### 7.5 Unnamed streaks in the source list

Several streaks were supplied without names. Implement them with placeholder keys and let the names be set in config (the definitions are admin-editable):
`hold_base_3min`, `hold_base_5min`, `hold_base_10min`, `captures_3`, `captures_5`, `captures_10`, `burner_1`, `burner_2`.

### 7.6 Validation targets for streak logic

Once a comprehensive game file is available:
- Confirm computed **burn moments** match when bases actually burned in-game, and that the round outcome (first to 2 burns) matches the real result. **This is the highest-priority validation.**
- Confirm cumulative hold timers pause/resume correctly across contested bases.
- Confirm kill-streak counters reset correctly on death and survive the reconnect-buffering re-ordering (they must be computed on time-sorted streams).
- Sanity-check Survivor against a game where players genuinely fought at low HP.

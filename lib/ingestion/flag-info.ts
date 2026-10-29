/**
 * lib/ingestion/flag-info.ts
 * --------------------------------------------------------------------
 * Human-readable reference for the ingestion flags the round parser emits
 * (round-parser.ts). Flags are POSSIBLE PARSING ISSUES - things to be aware of
 * when trusting the extracted stats - each with a plain-English explanation and
 * an urgency rating so an admin knows what (if anything) to act on.
 *
 * Note: spawn kills / spawn damage are NOT issues - they're normal gameplay
 * stats (shown in the per-player table and facts), so they're listed in
 * NON_ISSUE_FLAG_CODES and filtered out of the Flags display.
 */
export type FlagUrgency = "high" | "medium" | "low";

export type FlagInfo = { label: string; urgency: FlagUrgency; description: string };

/** Gameplay facts the parser records as flags but which are NOT parsing issues. */
export const NON_ISSUE_FLAG_CODES = new Set<string>(["spawn_kills", "spawn_damage"]);

export const URGENCY_META: Record<
  FlagUrgency,
  { label: string; order: number; chip: string; badge: string; dot: string }
> = {
  high: {
    label: "High",
    order: 0,
    chip: "border-red-700/60 bg-red-950/40 text-red-300 hover:bg-red-950/60",
    badge: "border border-red-700/60 bg-red-950/40 text-red-300",
    dot: "bg-red-400",
  },
  medium: {
    label: "Medium",
    order: 1,
    chip: "border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50",
    badge: "border border-amber-700/60 bg-amber-950/30 text-amber-300",
    dot: "bg-amber-400",
  },
  low: {
    label: "Low / info",
    order: 2,
    chip: "border-border-strong bg-bg-elevated text-text-muted hover:text-text",
    badge: "border border-border-strong bg-bg-elevated text-text-muted",
    dot: "bg-text-subtle",
  },
};

export const FLAG_INFO: Record<string, FlagInfo> = {
  // --- High: real events may be missing, or a result couldn't be determined ---
  malformed_line: {
    label: "Malformed line",
    urgency: "high",
    description:
      "A line in the middle of the file couldn't be read and was skipped. Some events from the round may be missing, which can affect stats. Cross-check this round against its .lwa / CSV before publishing.",
  },
  capture_no_base_flip: {
    label: "Capture with no base flip",
    urgency: "high",
    description:
      "A capture was recorded but no base actually changed hands at that moment, so it couldn't be tied to a base. Capture credit for that moment may be wrong - review the captures for this round.",
  },
  no_burn_winner: {
    label: "No base-control winner",
    urgency: "high",
    description:
      "No team burned enough bases to win on base control, so the parser couldn't pick a round winner automatically. If the round did have a winner, set it by hand with the Round winner override above.",
  },
  late_events_dropped: {
    label: "Late events dropped",
    urgency: "high",
    description:
      "Some events happened after the round's expected end and were dropped. If real play actually continued past that point, those events are missing - check that the round's end time is right.",
  },

  // --- Medium: worth a look; may need a manual decision ---
  no_headband: {
    label: "No headband number",
    urgency: "medium",
    description:
      "A player's name didn't include a headband number, so they couldn't be matched to a headband automatically. Assign their headband by hand (in Players & headbands) so their stats land on the right person.",
  },
  capture_base_inferred: {
    label: "Capture base inferred",
    urgency: "medium",
    description:
      "Two teammates captured in the same second, so which base each one took had to be inferred. Use the same-second capture review above to confirm who captured which base.",
  },
  capture_count_mismatch: {
    label: "Capture count mismatch",
    urgency: "medium",
    description:
      "A player's capture counter from the device didn't match the number of capture events we joined for them. Usually minor, but worth a glance if their captures look off.",
  },
  duplicate_respawn: {
    label: "Duplicate respawn",
    urgency: "medium",
    description:
      "A player's respawn / revival counter repeated unexpectedly. Usually a hardware hiccup - deaths are counted from the kill/death events instead, so scoring is unaffected, but check the player looks right.",
  },

  // --- Low / info: auto-corrected or purely informational ---
  malformed_final_line: {
    label: "Malformed final line",
    urgency: "low",
    description:
      "The very last line of the file was cut off or incomplete - common when the file was still being written. Almost always harmless; just confirm the round looks complete.",
  },
  clock_rollover_corrected: {
    label: "Clock rollover corrected",
    urgency: "low",
    description:
      "The game clock is 12-hour with no AM/PM. This round crossed 1 o'clock, so later events were automatically shifted forward 12 hours to keep them in order. No action needed.",
  },
  mid_round_join: {
    label: "Mid-round join",
    urgency: "low",
    description:
      "One or more players joined after the round had already started (a drop-in). Normal - just confirm their stats look right.",
  },
  device_id_remapped: {
    label: "Base named by position",
    urgency: "low",
    description:
      "The base / device IDs listed at game start didn't match the IDs seen during play, so bases were named by their position instead. Base names may be approximate; scoring is unaffected.",
  },
  late_game_end: {
    label: "Late game end trimmed",
    urgency: "low",
    description:
      "The game-end marker came a while after the last real activity, so the extra idle time at the end of the round was trimmed. No action needed.",
  },
  frag_counter_lag: {
    label: "Frag counter lag",
    urgency: "low",
    description:
      "The player's running kill counter disagreed with the number of actual kill events. We use the event count (more reliable), so the kills shown are correct.",
  },
  death_counter_lag: {
    label: "Death counter lag",
    urgency: "low",
    description:
      "The player's running death counter disagreed with the number of actual death events. We use the event count (more reliable), so the deaths shown are correct.",
  },
};

/** Look up a flag's info, with a safe fallback for any code not in the table. */
export function flagInfo(code: string): FlagInfo {
  return (
    FLAG_INFO[code] ?? {
      label: code,
      urgency: "low",
      description: "No plain-English description for this flag yet.",
    }
  );
}

/** All known issue flags, ordered by urgency (high first) then label - for the reference list. */
export function flagReferenceList(): { code: string; info: FlagInfo }[] {
  return Object.entries(FLAG_INFO)
    .map(([code, info]) => ({ code, info }))
    .sort(
      (a, b) =>
        URGENCY_META[a.info.urgency].order - URGENCY_META[b.info.urgency].order ||
        a.info.label.localeCompare(b.info.label),
    );
}

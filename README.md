# Pass 26 — Accolades headers fix (small)

One file. Accolades column headers now read "Tier 1" / "Tier 2" /
"Tier 3" on desktop, kept as "T1" / "T2" / "T3" on mobile (where
the columns are only ~32px wide and don't have room for the full
word).

Done with sibling `<span>`s gated by Tailwind's `sm:` breakpoint
(640px). Same pattern any time we want responsive label text.

Bumped the desktop column width from 55px → 70px to fit "Tier 1"
without crowding the numbers.

## Files

```
patch/
├── README.md                                          ← this file
└── components/
    └── portal/
        └── tables/
            └── AccoladesLeaderboardTable.tsx          ← REPLACE
```

## What's still broken (need your help)

The screenshots show Kills, Damage, and Accuracy tables all rendering
zeros (or empty for Accuracy). Pattern matches a single root cause:
**the period-sheet column names I assumed in pass 24 don't match
your actual sheet headers.**

When `parseNumericOr(r.raw.Kills_Total, 0)` doesn't find a column,
it defaults to 0 — so every player gets 0, every cell renders 0.
Accuracy shows the empty state because the aggregator filters out
players with `shots <= 0` and they all resolve to 0.

I flagged this risk in pass 24's README:

> If any are named differently in the actual sheet (e.g.
> `Total_Damage` instead of `Damage_Total`), the leaderboard will
> silently render with zeros.

Confirmed: that's what's happening. Sandbox can't reach
docs.google.com to peek at the headers directly.

**To fix, I need the actual column names from your
Leaderboard_Period_Stats sheet.** Either:

1. Open the sheet, paste the header row text into chat, OR
2. Send a screenshot of just the header row, OR
3. Tell me the column names individually:
   - kills total →
   - deaths total →
   - damage total →
   - hits total →
   - shots total →
   - matches played → (you confirmed `Matches_Played` already)

Once I have the real names, the fix is a 5-line patch — one column
name string in each of `lib/leaderboards/kills.ts`,
`damage.ts`, `accuracy.ts`. Plus a similar fix in
`lib/leaderboards/season-challenges.ts` which I just noticed also
references `Kills_Total` / `Deaths_Total` and is presumably also
silently broken on those tiebreakers.

## Apply + test

1. Extract over local
2. Restart `npm run dev`
3. Reload `/player-portal/leaderboards/all-time` and expand Accolades

### Test checklist

- Mobile: Accolades headers still read "T1 / T2 / T3" (narrow columns).
- Desktop: Accolades headers read "Tier 1 / Tier 2 / Tier 3" with
  comfortable spacing.

I tsc'd this. Clean except for the unrelated globals.css pre-existing
warning.

# Pass 27 — column-name hotfix for Kills/Damage/Accuracy

The pattern was the opposite of what I guessed: your sheet uses
`Total_<thing>` not `<thing>_Total`. Five string swaps.

## Files in this zip

```
patch/
└── lib/
    └── leaderboards/
        ├── kills.ts                ← REPLACE  (Kills_Total → Total_Kills, Deaths_Total → Total_Deaths)
        ├── damage.ts               ← REPLACE  (Damage_Total → Total_Damage)
        ├── accuracy.ts             ← REPLACE  (Hits_Total → Total_Hits, Shots_Total → Total_Shots)
        └── season-challenges.ts    ← REPLACE  (same Kills_Total/Deaths_Total fixes)
```

## What was broken & is now fixed

- **Kills leaderboard**: was reading `Kills_Total` and `Deaths_Total`,
  both undefined in the actual sheet, defaulted to 0 → every row 0/0/0.
- **Damage leaderboard**: was reading `Damage_Total`, undefined →
  every row 0/0.
- **Accuracy leaderboard**: was reading `Hits_Total` and `Shots_Total`,
  both undefined → every player resolved to 0 shots → aggregator
  filtered them all out → empty state.
- **season-challenges aggregator** (bonus fix): was using `Kills_Total`
  and `Deaths_Total` as tiebreakers in some season configs.
  Silently broken there too, but only visible if a season was
  configured to tiebreak on kills/deaths. Patched in the same go.

## Apply + test

1. Extract over local
2. Restart `npm run dev`
3. Reload `/player-portal/leaderboards/all-time`

### Test checklist

- Kills table: real numbers across all four columns. Top row has
  highest total kills, K/M and K/D scale with the data.
- Damage table: real numbers in Total Damage and Damage/Match.
- Accuracy table: real percentages in Accuracy column (e.g. 23.4%),
  real shot counts in Total Shots. No more "No matches found"
  empty state (assuming there's data in the period).
- Accolades table: still works, plus the desktop "Tier 1 / 2 / 3"
  headers from pass 26.

## Side observations from your header dump

A couple of things I noticed that aren't fixes for this pass but
worth flagging for later:

1. **`Total_Accolades` exists in the period sheet.** That's a
   pre-aggregated total, much cheaper than walking Game_Data_Lookup.
   We could migrate the Accolades leaderboard's "Total" column to
   read from the period sheet instead, while the T1/T2/T3 breakdowns
   would still need the per-match accolade columns. Not urgent —
   current implementation works — but a perf win if/when you want it.

2. **Period sheet has individual `Accolade_<Name>` columns too.** The
   per-match accolade flags exist in BOTH Game_Data_Lookup AND the
   period sheet (presumably summed per period in the period version).
   The Accolades leaderboard could be entirely period-sheet-based,
   matching the other three. Same status: works now, can refactor
   later for consistency.

Leaving these alone unless you want the refactor explicitly.

I tsc'd this. Clean except for the unrelated globals.css pre-existing
warning.

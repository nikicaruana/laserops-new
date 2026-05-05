# Pass 10 — History page polish: profile sizing, chart window, mobile space, table header fix

Five issues from the latest screenshot review, all real file replacements
(no manual edits required).

## Files in this zip

```
patch/
├── README.md                                                    ← this file
├── lib/
│   └── player-history/
│       └── engine.ts                                            ← REPLACE
└── components/
    ├── portal/
    │   ├── player-history/
    │   │   ├── HistoryProfileCard.tsx                           ← REPLACE
    │   │   ├── PlayerHistoryView.tsx                            ← REPLACE
    │   │   ├── ChartCard.tsx                                    ← REPLACE
    │   │   ├── EloProgressionChart.tsx                          ← REPLACE
    │   │   ├── ScoreVsAvgChart.tsx                              ← REPLACE
    │   │   ├── KillsVsKdChart.tsx                               ← REPLACE
    │   │   └── ShotsVsAccuracyChart.tsx                         ← REPLACE
    │   └── tables/
    │       └── LeaderboardTable.tsx                             ← REPLACE
```

All real drop-in files. Extract over local, restart `npm run dev`,
done.

## What each change does

### 1. Profile card — smaller badge, "Level N" actually shows now
- `lib/player-history/engine.ts` adds `currentLevel: number` to the
  `PlayerHistory` type and populates it from the most recent match's
  `level` field. This is the engine half of pass 2's profile-card
  fix that was sent as patch notes and never applied — that's why
  "Level 9" wasn't appearing under the badge.
- `HistoryProfileCard.tsx` reduces both the photo and badge from
  `h-32 sm:h-40` (128 / 160px) to `h-24 sm:h-32` (96 / 128px). On
  mobile the badge looks balanced now, not oversized.

### 2. Charts capped at last 10 matches
- `PlayerHistoryView.tsx` slices `history.matches.slice(-10)` and
  passes that windowed array to all four chart components. The
  Match Summaries table at the bottom continues to receive the full
  `history.matches` — table is the persistent record, charts are
  the trend window.
- 10 was your spec; if you want to make it tunable later (e.g. a
  "show all / show last 10 / show last 20" toggle), the constant
  `CHART_WINDOW_SIZE` lives at the top of `PlayerHistoryView.tsx`
  and that's the only knob to thread.

### 3. ELO chart: rightmost label no longer clips
- `EloProgressionChart.tsx` bumps `margin.right` from 8 to 24px.
  The `LabelList` text ("1,084" etc.) extends past the data point
  and was getting clipped by the card edge. The other charts don't
  have this problem because their line labels were removed in pass 4.
- Also tightens the YAxis from `width={48}` to `width={40}` since
  4-character ELO values fit comfortably in 40px at 11px font.

### 4. Mobile layout — more chart, less wasted padding
- `ChartCard.tsx` body padding goes from mobile-`px-0` to
  mobile-`pl-2 pr-1` (8 / 4px). Pass 4 over-corrected — the YAxis
  tick labels ("1095", "1.5k") were sitting flush against the card
  border with zero breathing room. The thin asymmetric pad gives
  axis labels room without giving back chart width to the right.
- All composed charts get tighter YAxis widths to claw back more
  plot area:
    - Score vs Avg: left 48→40, right 36→32
    - Kills vs KD: left 36→28, right 36→32
    - Shots vs Accuracy: left 48→36, right 40→36
- Net per chart on mobile: ~12-20px more horizontal plot area.

### 5. Match Summaries header banding — properly fixed this time
This is the pass-5 fix that never landed (was patch notes only).
`LeaderboardTable.tsx` restructures the sticky header region:
- The yellow accent strip moves **inside** the scroll container,
  bundled with the header rowgroup into a single `sticky top-0
  z-10 min-w-max` wrapper.
- `min-w-max` makes the wrapper grow to fit the full grid content
  width — so when you scroll horizontally on mobile, the strip and
  header bg follow rather than stopping at the viewport edge.
- Drops the `bg-bg-overlay/95 backdrop-blur-sm` on the header bg in
  favour of solid `bg-bg-overlay`. Both the transparency and the
  blur produced subtle grey-banding artifacts at column boundaries
  during horizontal scroll on iOS Safari and Android Chrome — solid
  colour eliminates them.

This change touches the SHARED LeaderboardTable, but is fully
backwards compatible with all existing leaderboards (XP/Levels,
Score, etc.). For tables narrower than the viewport, `min-w-max`
resolves to container width — no visual change.

## What's still pending from previous passes that wasn't applied

Cleanup — you can delete these stray instruction files left over
in your repo from earlier passes (they were never code, just
instructions, and now they're obsolete because everything they
described is in this pass as a real file):
- `app/player-portal/player-stats/layout.tsx.PATCH-NOTES.md`
  *(if it still exists — pass 8 may have already removed it)*
- `lib/player-stats/shared.ts.PATCH-NOTES.md`
  *(same)*

## Apply

1. Extract over local (overwrites all the listed files).
2. Stop and restart `npm run dev`.
3. Refresh browser.

## Test

1. **Profile card**: badge is smaller and "Level 9" (or whatever
   level) now appears under it.
2. **Charts**: each chart shows at most 10 X-axis points, even for
   players with 20+ matches. Match Summaries table at the bottom
   still shows everything.
3. **ELO chart**: rightmost data label fully visible, no clipping
   at the card edge.
4. **Mobile spacing**: charts use more of the horizontal viewport;
   Y-axis tick labels have a hairline of breathing room from the
   card border (not flush).
5. **Match Summaries header on horizontal scroll**: yellow strip
   and dark header background now extend across the entire scrolled
   width. No grey banding at column boundaries.

I ran `tsc --noEmit` against your codebase before shipping — clean
except for one unrelated pre-existing warning about the
`globals.css` import (which is a TypeScript config quirk for CSS
modules, not a code bug).

# Pass 20 — bubble size = avg kills per match (not total kills)

Two files, one metric swap.

## What changed

Bubble size on the meta chart now tracks **average kills per match**
instead of **total kills**. The old metric was a popularity signal —
a heavily-played mediocre gun outsized a great-but-rarely-played
one. Average kills/match is an effectiveness signal — it answers
"how lethal is this gun in a typical game?" regardless of how often
players pick it.

## Files in this zip

```
patch/
├── README.md                                          ← this file
├── lib/
│   └── weapons/
│       └── usage-stats.ts                             ← REPLACE
└── components/
    └── weapons/
        └── WeaponMetaChart.tsx                        ← REPLACE
```

## What each change does

### Aggregator — `lib/weapons/usage-stats.ts`

Adds `avgKillsPerMatch: number` to the `WeaponUsageStats` type.
Computed once in the aggregator as `totalKills / matchCount`. Always
finite because the aggregator only emits entries with `matchCount >= 1`.

`totalKills` stays in the type — useful for tooltip context, future
features, and not worth removing.

### Chart — `components/weapons/WeaponMetaChart.tsx`

- ZAxis dataKey switches from `totalKills` to `avgKillsPerMatch`.
  Bubble area scaling is unchanged — `[BUBBLE_MIN_R², BUBBLE_MAX_R²]`
  area-proportional. Recharts handles the linear interpolation
  between min and max z values, so the swap just remaps which gun
  gets which size.
- ZAxis name updated to "Kills/Match" (used by recharts as the
  default tooltip label and accessible metadata).
- Subtitle copy: "bigger bubbles mean more kills per match on
  average."
- Tooltip now shows BOTH metrics: Kills/Match (the bubble-size
  driver, prominent) and Total Kills (context, secondary).

## Apply + test

1. Extract over local
2. Restart `npm run dev`
3. Reload `/weapons`

### Test checklist

- Bubble sizes shift: guns with high avg kills/match (regardless of
  popularity) get bigger bubbles. Guns with lots of total kills but
  middling per-match kills shrink.
- Tooltip on hover/tap shows Kills/Match prominently, then Total
  Kills below.
- Subtitle reads "...bigger bubbles mean more kills per match on
  average."

## Pre-existing warnings to ignore

The unrelated globals.css side-effect import warning is still there
— that's a TypeScript config quirk for CSS modules in your project,
not a code issue.

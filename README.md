# Pass 22 — remove mobile bubble labels

One file. Quick reversal of the pass 21 mobile-label addition now
that the underlying mobile tap problem is fixed.

## What changed

`components/weapons/WeaponMetaChart.tsx`:

- `<LabelList>` is once again gated on `isDesktop`. Mobile gets a
  clean chart with no overlapping labels; desktop keeps the
  at-a-glance label readability.
- Top margin reverts to conditional: 36px on desktop (labels need
  clearance above topmost bubbles), 24px on mobile.

What stays from pass 21: the larger `BUBBLE_MIN_R` / `BUBBLE_MAX_R`
(12 / 36 px). That's what actually fixed the mobile tap reliability,
and removing it would put us back where we started. Bigger tap
targets are a win on mobile and a no-op on desktop.

## Files

```
patch/
├── README.md                                          ← this file
└── components/
    └── weapons/
        └── WeaponMetaChart.tsx                        ← REPLACE
```

## Apply + test

1. Extract over local
2. Restart `npm run dev`
3. Reload `/weapons`

### Test checklist

- Mobile: bubbles only, no text labels. Tap a bubble → tooltip
  shows accuracy / K/D / kills/match / total kills / match count.
- Desktop: labels still appear above each bubble.
- Resize a desktop browser narrow past 1024px: labels disappear.

I tsc'd this. Clean except for the unrelated globals.css pre-existing
warning.

# Pass 19 — hotfix: "Unknown Gun" leaking through filter

One file. Sorry, missed this in the last pass.

## What I broke / didn't catch

The data row's gun name is literally **"Unknown Gun"** (with the word
"Gun" appended). My pass-18 filter was an exact-match against
`"unknown"`, `"none"`, `"n/a"`, `"na"`, `"no gun"` — so `"unknown gun"`
slipped through both the gallery and the meta chart.

## What this pass does

Replaces the exact-match list in `isFallbackGunName` with a
word-boundary regex match for `\bunknown\b`. That catches:

- "unknown"
- "Unknown Gun"
- "UNKNOWN WEAPON"
- " unknown " (with surrounding whitespace)
- any future variant

Doesn't catch:

- "unknownified" (word boundary respected)
- real gun names like "MP9LT Phoenix", "AK-25 Predator", etc.

The other fallbacks (none / n/a / na / no gun / empty string) stay
as exact-match. Those are unlikely to grow new variants, and a
regex would risk false positives on any real gun with "n" or "a"
characters.

The shared helper is used by both `fetchWeapons` (gallery) and the
meta-chart aggregator, so the fix lands in both views from this
single change.

## Files

```
patch/
└── lib/
    └── cms/
        └── weapons.ts                                 ← REPLACE
```

## Apply + test

1. Extract over local
2. Restart `npm run dev`
3. Reload `/weapons`

### Test checklist

- "Unknown Gun" no longer appears in the gallery scroller.
- "Unknown Gun" no longer appears in the meta chart bubble.
- M512 Sniper, Gastat, etc. still appear (they're not affected by
  this change — already shipped in pass 18 by lowering MIN_MATCHES).

I tsc'd this and verified the regex behaviour with a quick node
sanity check. Real gun names pass; "Unknown Gun" / "Unknown Weapon"
/ etc. get filtered.

# Pass 29 — revert object-position that caused the right-side black band

You're right, that wasn't great — sorry I called it "great" in my
last response, I missed it on first look at the screenshot.

## What happened

In pass 25 I made two changes to fix the laptop hero. The aspect-
ratio constraint was the right move and stays. The other change —
flipping `objectPosition` from `"80% center"` to `"100% center"` to
"maximise the left text zone" — turned out to be wrong and
introduced the black band you're seeing on the right.

The 80% original was carefully chosen for the actual image content
and section sizes. 100% pushed the image's anchoring in a way that
broke the cover behaviour on real viewports.

## The fix

Reverted just the `objectPosition` change. Aspect-ratio fix stays.

```diff
- objectPosition="100% center"
+ objectPosition="80% center"
```

Single property change. Should restore the right side to yellow-
filled across all viewports.

## Files

```
patch/
├── README.md                                          ← this file
└── components/
    └── sections/
        └── HomeHero.tsx                               ← REPLACE
```

## Apply + test

1. Extract over local
2. Restart `npm run dev`
3. Reload `/`

### Test checklist

- Right side of hero is no longer solid black — yellow background
  reaches all the way to the right edge of the section.
- Figure is positioned slightly right of centre (the original 80%
  framing).
- Headline + CTAs + stats still readable on the left.
- Behaviour matches across laptop and big-monitor viewports.

## If it's still wrong

If the black band persists after this, please send me a screenshot
of the hero with browser DevTools open — specifically the Elements
panel showing the `<section>` with the duotone image visible, plus
the Computed styles for the image element. That'll tell me exactly
how the layout is resolving and I can stop guessing.

I tsc'd this. Clean except for the unrelated globals.css pre-existing
warning.

# Pass 23 — hero fits laptops without breaking large monitors

One file. The hero was designed against a big monitor (1536px+
viewport) so it fit perfectly there but felt oversized on a typical
laptop. This pass introduces a 2-tier desktop ramp: dialed-down sizing
on `xl` (laptops, 1280-1535px), original generous sizing on `2xl`
(monitors, 1536px+).

## What was wrong

On a 13-15" laptop with viewport ~1440x900:
- Heading `text-7xl` (72px) ate too much vertical space
- Stats grid plus 64px top margin pushed content below the fold
- Forced full-svh-minus-header height meant the section had to be
  ~828px tall regardless of what content fit
- `py-28` (112px top + bottom) added 224px of pure padding

Total: content didn't comfortably fit on a single laptop screen.

On a 27" monitor with viewport ~2560x1440 these same values felt
right — that's how it was designed.

## The fix

Three-tier responsive ramp via `xl:` and `2xl:` modifiers:

| Property        | Below xl (mobile/tablet) | xl (laptops)   | 2xl (monitors) |
| --------------- | ------------------------ | -------------- | -------------- |
| min-height      | `100svh - 72px`          | natural height | `100svh - 72px` |
| Section padding | n/a (uses pt-6/sm:pt-10) | `py-16` (64px) | `py-28` (112px) |
| Heading         | `4xl/5xl`                | `5xl` (48px)   | `7xl` (72px)   |
| Paragraph       | `base/lg`                | `base`         | `lg`           |
| Buttons         | `md`                     | `md`           | `lg`           |
| Stats heading   | n/a (hidden)             | `2xl`          | `3xl`          |
| Stats padding   | n/a (hidden)             | `p-4`          | `p-5`          |
| Stats top mgn   | n/a (hidden)             | `mt-10`        | `mt-16`        |
| Heading→para gap| n/a                      | `mt-4`         | `mt-5`         |
| Para→CTAs gap   | n/a                      | `mt-6`         | `mt-10`        |
| CTA gap         | n/a                      | `gap-3`        | `gap-4`        |

Mobile layout untouched. The full-svh constraint is preserved on
mobile because the layered figure design depends on it.

## Why width-based breakpoints (not height-based)

The complaint is fundamentally about height, but Tailwind's standard
breakpoints are width-based. In practice they work well as a proxy:
- 13" laptop @ 1440x900 → matches xl ✓
- 15" laptop @ 1920x1080 → matches xl (just) ✓
- 24" monitor @ 1920x1080 → matches xl (debatable, but close)
- 27" iMac @ 2560x1440 → matches 2xl ✓
- 32" 4K @ 3840x2160 → matches 2xl ✓

A 24" monitor at 1920x1200 sitting on someone's desk falls in the
xl tier and gets the laptop sizing, even though the screen is bigger
than a laptop. That's a small downgrade for that user. If it matters
later, we can shift the threshold from 2xl (1536px) to a custom
1700px breakpoint.

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

- 13-15" laptop (1280-1535px viewport width): hero content fits
  without vertical scrolling. Heading reads as a hero (not tiny)
  but doesn't dominate. Stats grid sits comfortably below CTAs.
- 27"+ monitor (1536px+ viewport width): hero looks identical to
  before — same big heading, generous spacing, full-viewport-tall
  section.
- Mobile and tablet (below 1280px): unchanged.
- Resize a desktop browser window from 1500px down to 1280px while
  the hero is visible: layout reflows to the laptop variant. No
  jarring jumps because every property has a single breakpoint
  threshold (1536px); they all transition together.

I tsc'd this. Clean except for the unrelated globals.css pre-existing
warning.

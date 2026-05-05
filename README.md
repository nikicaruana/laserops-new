# Pass 25 — hero photo no longer dominates on laptop

The pass-23 fix dialed down content sizing on xl viewports — that
worked. But the screenshot you sent showed the underlying photo was
ALSO problematic: the figure's head was enormous, gun extended off
the right edge, and the right portion of the section was a wall of
saturated yellow.

This pass fixes the photo framing.

## Why it was broken

`<DuotoneImage>` uses `object-fit: cover` to fill the section. Cover
keeps the image's aspect ratio and crops whichever dimension
overflows the container.

The section was content-height (~720px) on xl after pass 23. The
image is 1920×1080 (16:9). Section aspect was ~25:12, image aspect
~16:9 — wider section than image. Cover scaled the image to fit
width, leaving ~120px of vertical overflow that got clipped equally
top and bottom.

End result: the figure's head (top of original frame) clipped at
the top of the section, the figure's lower body clipped at the
bottom, and we saw "head to gun" filling the entire section height
— making the figure feel zoomed-in and dominating.

## The fix

Two changes in `HomeHero.tsx`:

### 1. Section aspect-locked to 16:9 on xl

```
xl:aspect-[16/9] xl:max-h-[calc(100svh-72px)] 2xl:aspect-auto 2xl:max-h-none
```

On xl viewports (1280-1535px wide), the section now matches the
image's native 16:9 aspect ratio. The image fits without aggressive
cropping — figure renders at natural framing.

`max-h` caps the section at viewport height so the 16:9 ratio
doesn't push the section taller than the laptop screen on roomy xl
widths. When the cap kicks in (e.g. 1500×800 viewport), aspect
mismatch returns but at most 5-10% — way less aggressive than
before, barely noticeable.

`2xl` reverts to `aspect-auto` so the original full-svh behaviour
kicks back in for big monitors where the unconstrained section is
already close to 16:9.

### 2. Object-position pushed to right edge

```diff
- objectPosition="80% center"
+ objectPosition="100% center"
```

With the section now properly aspect-locked, object-position controls
horizontal framing. Anchoring the figure 100% right (right-edge of
image to right-edge of section) maximises the left-side empty
yellow-background zone where the headline + CTAs sit. The figure
becomes "the right half of the image" instead of "filling the
section."

### Plumbing for aspect-locked layout

For the desktop content block's existing `xl:my-auto` to actually
center vertically, all ancestors need to share the section's height:

- `Container` gets `xl:h-full`
- Content div gets `xl:h-full`, drops `xl:justify-start` (was
  fighting `my-auto`), and reduces vertical padding from `py-16`
  to `py-10` since the now-taller section already provides
  breathing room.

## Files in this zip

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

- 13-15" laptop (1280-1535px): hero section is 16:9 aspect, capped
  at viewport height. Figure is in the right half of the section,
  not dominating the whole thing. Headline + CTAs comfortably overlay
  the left yellow zone.
- 27"+ monitor (1536px+): unchanged — original full-viewport 16:9-ish
  hero behaviour. (`2xl:aspect-auto` reverts to content-driven height
  which was already the design.)
- Mobile/tablet (below 1280px): unchanged. Mobile uses different
  layered figure design that doesn't go through this code path.

I tsc'd this. Clean except for the unrelated globals.css pre-existing
warning.

## If it's still not right

The fix above assumes the design intent is "figure on the right,
text on the left, full image visible." If your actual design intent
on laptop is something different — e.g. "show only the gun and arm,
hide the face entirely," or "letterbox the image with proper padding
above and below" — let me know and I'll adjust. The right escalation
would probably be a separate xl-cropped image asset rather than
trying to coax the desktop image into a different framing via CSS.

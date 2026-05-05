# Pass 16 — drop "Unknown" gun + tap-to-popup description

Two changes plus one new file.

## Files in this zip

```
patch/
└── lib/
│   └── cms/
│       └── weapons.ts                                  ← REPLACE
└── components/
    └── weapons/
        ├── WeaponGallery.tsx                           ← REPLACE
        └── WeaponDetailDialog.tsx                      ← NEW
```

## What each change does

### 1. "Unknown" gun filtered out

`lib/cms/weapons.ts` now drops any row where the trimmed lowercased
gun name is `"unknown"`. The data sheet keeps an "Unknown" entry as a
fallback for matches where no gun was logged (so Match Report joins
don't break) — but it's not a real weapon and shouldn't appear in
the gallery.

Filter is at the fetcher layer, so every consumer (current gallery,
future Armory subtab, anywhere else that reads `fetchWeapons()`) gets
the cleaned list automatically.

### 2. New `Gun_Description` column → tap-to-popup

The `Weapon` type gained a `description: string` field, parsed from
the new `Gun_Description` column. The parser trims whitespace and
defaults to empty string if the column is missing.

### 3. Tap-on-centred-card opens detail popup

The gallery's tap behaviour is now two-stage:
  - First tap on a NON-centred gun → scroll-snap it into the centre
    (focus). Same as before.
  - Tap on the gun that's ALREADY centred → open the description
    popup. This is the "commit" action.

This pattern matches the iOS App Store and iOS Photos: first tap is
exploration ("show me this one"), second tap is commitment ("tell me
more"). It avoids the conflict between the carousel's primary
interaction (panning/focusing) and the new popup interaction.

Keyboard: arrow keys still cycle through guns (always focus, never
open). Enter on the centred card opens the dialog. Same UX through
all input modes.

### 4. WeaponDetailDialog component

Native HTML `<dialog>` element, opened via `showModal()` for proper
top-layer modal behaviour:
  - Backdrop with subtle blur
  - ESC dismisses
  - Focus trap (browser handles it)
  - Click outside to close (wired explicitly — native dialog doesn't
    do this for free)
  - Close button in the corner

Pattern mirrors the existing `AccoladeTile` modal in the Match
Report — same visual chrome, same dismissal behaviours.

Dialog content:
  - Eyebrow "Weapon" + gun name
  - Yellow band with the gun image (matches gallery strip styling)
  - Description body — falls back to "No description available yet."
    when the cell is empty, so users get confirmed feedback even
    before you've populated the column
  - Compact 4-up stat recap below the description (Mag / Dmg /
    Reload / Rate) so the user has the numbers handy while reading

## Apply + test

1. Extract over local
2. Restart `npm run dev`
3. Reload `/weapons`

### Test checklist

- "Unknown" no longer appears in any gallery, regardless of filter.
- Add `Gun_Description` to your CSV with text for one gun. Reload.
  Tap that gun (twice if it's not already centred). Popup appears
  with the description.
- Tap a gun without a description — popup still appears, body says
  "No description available yet."
- Press ESC, click outside the popup, or click the X — all close it.
- In compare mode, tapping a centred gun in either gallery opens
  its dialog. Each gallery has its own dialog state — opening one
  doesn't affect the other (though they're modal so only one shows
  at a time anyway).
- Keyboard: tab into a gallery, arrow keys cycle without opening
  popups. Enter on the centred card opens the popup.

I tsc'd this. Clean except for the unrelated globals.css pre-existing
warning.

## Pending

Bubble chart still queued — pass 17.

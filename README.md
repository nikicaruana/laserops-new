# Pass 9 — column-header info tooltips (capability only)

Mechanism for adding "(i)" info popovers to table column headers.
Built but **not wired to any specific columns yet** — that's the
column-by-column copy pass you said you'd do later when all the
tables are in place.

## Files in this zip

```
patch/
├── README.md                                                    ← this file
└── components/
    └── portal/
        └── tables/
            ├── HeaderInfoIcon.tsx                               ← NEW file
            └── LeaderboardTable.tsx                             ← REPLACE
```

## What's new

### `HeaderInfoIcon.tsx` (new)
A reusable component that renders a small "(i)" SVG glyph and a
popover with explanatory text. Drop it next to any header label.

Behaviour:
  - **Desktop**: hovers open the popover, with a small (~120ms)
    grace period before pointer-leave closes it (so users can move
    onto the popover to read it).
  - **Mobile / touch**: tap to toggle. Tap outside (or press Escape
    or tap the icon a second time) to dismiss.
  - **Positioning**: flip-aware. Tries below-left of the icon first;
    flips to right-anchored or above as needed to stay on-screen.
  - **Portalled to `document.body`**: avoids being clipped by the
    sticky header / `overflow-hidden` ancestors that the leaderboard
    chrome uses. State and accessibility wiring stay correct via
    React's createPortal.
  - **Hit target**: the visual icon is 14px but the clickable area
    is 28px square — meets the 24-44px minimum tap target without
    visually inflating the row.

### `LeaderboardTable.tsx` (replace)
Two new optional fields on `LeaderboardColumn<T>`:

```ts
tooltip?: string;
tooltipAriaLabel?: string;
```

When `tooltip` is set on a column, the header automatically renders
the info icon next to the label. Independent of `sortable` — both
can be true at once.

Important structural change inside the file: when both `sortable`
and `tooltip` are set, the sort button and the info icon are
rendered as **siblings** within the columnheader (not nested), to
avoid the invalid-HTML "button inside a button" problem. Browsers
handle nested buttons inconsistently — Safari and Firefox will
both swallow click events in unpredictable ways.

Visual order in the header:
  - Right-aligned columns: `[ i ] [ sort button ]`
  - Left/center columns:   `[ sort button ] [ i ]`

The icon sits adjacent to the label so it visually groups as
"this label has more info."

## How to wire a tooltip onto a column (for later)

Just add a `tooltip` field to the column definition. Example:

```tsx
{
  key: "rating",
  header: "Rating",
  align: "right",
  sortable: true,
  numeric: true,
  width: "48px",
  widthSm: "60px",
  accessor: (row) => row.matchRating,
  cell: (row) => row.matchRating.toFixed(2),
  // ↓ NEW — adds the info icon and popover
  tooltip:
    "Match rating is your score divided by the average score of all players in that match. Above 1 means you outscored the field; below 1 means you underperformed.",
  tooltipAriaLabel: "About match rating",
},
```

Optional `tooltipAriaLabel` overrides the default "More info" for
screen readers.

## What's NOT done in this pass

- No tooltip strings written for any column. As discussed, that's
  a separate pass once all tables are stable. When you're ready,
  ping me and we'll go through them table by table — I'll suggest
  copy and you'll edit/approve.
- No styling tweaks beyond defaults. The popover uses the same dark
  chrome as your chart tooltips for consistency. If you want a
  different visual treatment (different border accent, different
  font weight, etc.) it's easy to adjust in `HeaderInfoIcon.tsx`.

## Apply

Extract the zip over local. The `LeaderboardTable.tsx` change is
fully backwards compatible — every existing leaderboard renders
exactly as it does today (no tooltips, no icon shown). Restart dev
to be safe (`Ctrl+C`, then `npm run dev`).

## Test

1. **Backwards compat sanity check.** Open any existing leaderboard
   (XP/Levels, Match Rounds Won, Score, Challenges). Should look
   identical to before — no info icons, layout unchanged, sort still
   works.
2. **Quick smoke test of the tooltip itself.** If you want to verify
   the mechanism works before we do the full copy pass, add a
   tooltip field to any one column temporarily — e.g.
   `tooltip: "Test"` on the "K/D" column of Match Summaries — and
   eyeball it on desktop and mobile. Then remove it.

I checked the patch compiles cleanly against your codebase before
shipping. Two pre-existing TS warnings (the `globals.css` side-effect
import and `currentLevel` on `PlayerHistory`) are unrelated to this
patch — the latter is the manual edit from pass 2 that wasn't applied.
Worth fixing eventually but not blocking this work.

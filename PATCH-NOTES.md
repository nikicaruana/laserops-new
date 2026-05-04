# Patch — Match Summaries header bleeds out on horizontal scroll

## What's wrong

Open `components/portal/tables/LeaderboardTable.tsx` and find the JSX
that renders the table chrome. There are two coloured regions:

1. The yellow accent strip — `<div aria-hidden className="h-1 w-full bg-accent" />`
2. The sticky header background — a `<div role="rowgroup" className="sticky top-0 z-10 border-b border-border-strong bg-bg-overlay/95 backdrop-blur-sm">`

Both are `w-full`, which means 100% of their parent's width — the
visible viewport. The grid rows inside them have a column template
that sums to wider than the viewport on mobile (10 columns of match
data is a lot), so when you scroll right, the rows extend past where
the coloured regions stop. Result: header text floating against bare
card background, no yellow strip, no header fill.

## What to change

The fix is structural. Currently the shape is roughly:

```tsx
<div role="table" overflow-hidden>
  <div h-1 w-full bg-accent />              {/* strip — stops at viewport */}
  <div overflow-y-auto>                      {/* scroll container */}
    <div sticky top-0 bg-bg-overlay/95>     {/* header bg — stops at viewport */}
      <div role="row" grid>...cells...</div>
    </div>
    <div role="rowgroup">...rows...</div>
  </div>
</div>
```

We want the strip and the header background to size themselves to the
**content width**, not the viewport width. Easiest way: bundle them
together inside a single sticky wrapper, give that wrapper
`min-w-max` so it grows to fit its children.

Refactored shape:

```tsx
<div role="table" overflow-hidden>
  <div overflow-y-auto>                      {/* scroll container */}
    <div sticky top-0 z-10 min-w-max>        {/* whole sticky region */}
      <div aria-hidden h-1 bg-accent />      {/* strip — now content-wide */}
      <div role="rowgroup" border-b bg-bg-overlay/95 backdrop-blur-sm>
        <div role="row" grid>...cells...</div>
      </div>
    </div>
    <div role="rowgroup">...rows...</div>
  </div>
</div>
```

Three things changed from the current file:

1. The yellow accent strip moves **inside** the scroll container,
   above the sticky header rowgroup.
2. A new wrapper `<div>` wraps both the strip and the header
   rowgroup, with classes `sticky top-0 z-10 min-w-max`.
3. The existing sticky classes (`sticky top-0 z-10`) come **off**
   the header rowgroup — that wrapper handles stickiness now. Keep
   the header rowgroup's other classes (border, bg, backdrop-blur).

## Why this works

`min-w-max` makes an element take the maximum of its container width
and its content's intrinsic minimum width. For the History page's
Match Summaries table where the grid columns sum to ~700px on mobile,
the wrapper grows to ~700px and the coloured regions stretch with
it. For the all-time leaderboards where the grid fits within the
viewport, content width ≤ container width, so `min-w-max` resolves
to the container width — no visible change. Safe across all current
uses of LeaderboardTable.

Wrapping both the strip and the header background in a single sticky
element means they stay together while scrolling vertically — exactly
the same as before — and their union now spans the full grid width.

## The exact JSX edit

Find this block:

```tsx
<div aria-hidden className="h-1 w-full bg-accent" />

<div className="overflow-y-auto" style={{ maxHeight }}>
  {/* Sticky header */}
  <div
    role="rowgroup"
    className="sticky top-0 z-10 border-b border-border-strong bg-bg-overlay/95 backdrop-blur-sm"
  >
    <div
      role="row"
      className={cn(
        // ...header cell classes...
      )}
    >
      {/* header cells */}
    </div>
  </div>

  <div role="rowgroup">
    {/* body rows */}
  </div>
</div>
```

Replace with:

```tsx
<div className="overflow-y-auto" style={{ maxHeight }}>
  {/* Sticky region: yellow accent strip + header background, bundled
      together so they stay aligned during vertical scroll. min-w-max
      makes them span the full grid content width, not just the
      viewport — fixes the header losing its colour when the user
      scrolls horizontally on a wide table (Match Summaries on mobile). */}
  <div className="sticky top-0 z-10 min-w-max">
    <div aria-hidden className="h-1 bg-accent" />
    <div
      role="rowgroup"
      className="border-b border-border-strong bg-bg-overlay/95 backdrop-blur-sm"
    >
      <div
        role="row"
        className={cn(
          // ...same header cell classes as before...
        )}
      >
        {/* header cells — unchanged */}
      </div>
    </div>
  </div>

  <div role="rowgroup">
    {/* body rows — unchanged */}
  </div>
</div>
```

Three concrete things to double-check after editing:

- The accent strip's `<div>` lost its `w-full` class. It used to need
  it because it was a top-level child of the table; now it's inside
  a `min-w-max` parent and naturally spans full parent width. Don't
  re-add `w-full` — that would constrain it back to viewport width
  in some layout edge cases.
- The new wrapper `<div className="sticky top-0 z-10 min-w-max">`
  is the **only** sticky element now. The inner header rowgroup is
  not sticky any more. Make sure you removed `sticky top-0 z-10`
  from its className.
- The body rowgroup `<div role="rowgroup">` is unchanged.

## Why I'm sending instructions instead of a file

I don't have the canonical current content of `LeaderboardTable.tsx`
in my context — the file has been edited a few times and I can see
fragments rather than a single up-to-date version. Patching three
specific changes is safer than dropping a full file that might
overwrite drift you've made since.

If you'd rather I generate the full file, paste the current content
of `LeaderboardTable.tsx` and I'll produce a drop-in replacement.

## Quick test plan

After editing:
1. Mobile viewport (or DevTools 380px-wide). Open
   `/player-portal/player-stats/history?ops=Glenn`. Scroll the Match
   Summaries table horizontally. Yellow strip and header bg should
   now extend across the whole scrolled width. Header cells should
   sit on the dark overlay background no matter where you scroll.
2. Desktop. Open the All-Time XP leaderboard
   (`/player-portal/leaderboards/all-time/xp-levels`). It should look
   exactly the same as before — no horizontal scroll, header chrome
   spans the full table width as it always did.
3. Sticky behaviour. In the Match Summaries table, scroll vertically
   within the table. Header should stay pinned to the top of the
   scroll container, both the strip and the row labels staying
   aligned with each other.

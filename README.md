# Pass 8 — proper drop-in replacements (no manual edits)

Two files, both are drop-in replacements. Extract over your local
project, restart `npm run dev`, you're done.

## What's in the zip

```
patch/
├── README.md                                              ← this file
├── app/
│   └── player-portal/
│       └── player-stats/
│           └── layout.tsx                                 ← REPLACE
└── lib/
    └── player-stats/
        └── shared.ts                                      ← REPLACE
```

## What each file fixes

### `app/player-portal/player-stats/layout.tsx`
Adds `forwardParams={["ops"]}` to the `<SubTabs />` call. This is
the prop the patched `SubTabs` component needs to know it should
carry `?ops=` across subtab clicks.

Before: `<SubTabs tabs={playerStatsSubTabs} />`
After:  `<SubTabs tabs={playerStatsSubTabs} forwardParams={["ops"]} />`

Once this is in, clicking Summary → History will preserve the
selected player.

### `lib/player-stats/shared.ts`
Updates `listAllNicknames` to dedupe before returning. Two players
in your data have "Nick" as their Ops Tag, which made the autocomplete
`<datalist>` emit two `<option key="Nick">` and React threw a warning.

The dedupe is case-insensitive (so "Nick" and "nick" collapse to a
single entry), with the first-seen casing winning. Order is still
alphabetical, so visually the dropdown will look identical except
duplicates are collapsed.

The function signature is unchanged — every existing caller
continues to work without modification.

## Apply

1. Extract this zip over your local project (same as you did before
   — overwrites the existing `layout.tsx` and `shared.ts`).
2. Stop the dev server (Ctrl+C in the terminal running it).
3. Start it again: `npm run dev`.
4. Refresh the browser.
5. While you're at it, you can delete the two `.PATCH-NOTES.md` files
   left over in your project from earlier passes:
     - `app/player-portal/player-stats/layout.tsx.PATCH-NOTES.md`
     - `lib/player-stats/shared.ts.PATCH-NOTES.md`
   They're just leftover instruction files, not active code.

## Test

1. Go to `/player-portal/player-stats/summary?ops=KKKyle`. Click
   "History" — URL should become
   `/player-portal/player-stats/history?ops=KKKyle` and the page
   should render KKKyle's history. Same when clicking back to Summary.
2. Open the browser console — the "Encountered two children with the
   same key, `Nick`" error should be gone.
3. Type "Nic" in the search bar — autocomplete should show one
   "Nick" entry, not two.

## My apologies for the friction

The `.PATCH-NOTES.md` approach was a bad call on my part. Going
forward I'll always send full file replacements, never instructions
that require manual editing. If a file is too uncertain (drift, etc.),
I'll ask you to paste it first like you did this round.

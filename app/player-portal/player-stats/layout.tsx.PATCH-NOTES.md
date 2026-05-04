# Patch instructions for `app/player-portal/player-stats/layout.tsx`

The layout is currently passing `tabs={...}` to `<SubTabs />`. Add one
new prop, `forwardParams={["ops"]}`, so the player selection follows
the user across Summary / History / Armory.

## The edit

Find the JSX that renders `<SubTabs ... />` in the layout. It should
look something like:

```tsx
<SubTabs tabs={playerStatsSubTabs} />
```

Add `forwardParams={["ops"]}`:

```tsx
<SubTabs tabs={playerStatsSubTabs} forwardParams={["ops"]} />
```

That's it. One prop, one line.

## Why only `ops`

The Player Stats subtabs all share one piece of cross-cutting state:
which player you're looking at, encoded as `?ops=<OpsTag>`. Forwarding
that key carries the player across subtab clicks.

Anything subtab-specific — e.g. a future sort key on the History
table, or an expanded-accolade flag on Summary — should NOT be in
forwardParams. Those describe how *that one page* is configured and
shouldn't bleed across.

## What this fixes

Before: clicking Summary → History dropped `?ops=Glenn`, so you'd
land on the History page with no player selected.

After: the `?ops=` value is read off the current URL inside SubTabs
and appended to each subtab href, so clicks preserve it.

## What this does NOT touch

- `PortalTabs` (the top-level Leaderboards / Player Stats tabs) is
  unchanged. Clicking up to Leaderboards still drops `?ops=`. If you
  later want clicking back into Player Stats from Leaderboards to
  remember your last viewed player, that's a different fix
  (likely sessionStorage or a route remount strategy) — let me know.

- The Leaderboards subtab nav (All-Time / Challenges / Hall of Fame)
  is unchanged. Those subtabs don't share any cross-cutting URL state
  today, so there's nothing to forward. If that changes, you can
  pass `forwardParams` there too.

## Quick test

1. Go to `/player-portal/player-stats/summary?ops=Glenn`. Click the
   "History" pill — URL should become
   `/player-portal/player-stats/history?ops=Glenn` and the History
   page should render with Glenn loaded.
2. Click "Summary" again — URL goes back to
   `/player-portal/player-stats/summary?ops=Glenn`.
3. Now navigate without a player: go to
   `/player-portal/player-stats/summary` (no query). Click "History".
   URL should stay clean: `/player-portal/player-stats/history`,
   no empty `?ops=`.
4. Direct deep links still work — pasting
   `/player-portal/player-stats/history?ops=Glenn` into the URL bar
   still loads Glenn directly. (No regression — forwardParams is a
   read-from-URL feature, not a write-to-URL feature.)

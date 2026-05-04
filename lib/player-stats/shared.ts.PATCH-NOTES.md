# Bug fix — duplicate `Nick` key in autocomplete

## What's happening

The browser console shows:

> Encountered two children with the same key, `Nick`. Keys should be unique...

This is fired from the `<datalist>` autocomplete inside `PlayerSearch`,
where we render one `<option>` per known nickname. Two players in the
data have the literal string "Nick" as their Ops Tag, so the rendered
loop emits two `<option key="Nick" value="Nick" />` and React
complains.

It's a real-data clash, not a code bug per se — but the data utility
that produces the list should guarantee uniqueness, because that's
the contract every consumer (the search dropdown, future filters,
etc.) reasonably expects.

## The fix — dedupe in `listAllNicknames`

Open `lib/player-stats/shared.ts` and find the `listAllNicknames`
function. It probably looks something like:

```ts
export function listAllNicknames(rows: PlayerStatsRow[]): string[] {
  return rows.map((r) => r.nickname).sort((a, b) => a.localeCompare(b));
}
```

Replace with the deduped version (uses a `Set` to collapse duplicates
before sorting):

```ts
export function listAllNicknames(rows: PlayerStatsRow[]): string[] {
  // Dedupe before returning — two players can share an Ops Tag in
  // the underlying data (e.g. "Nick"), and the autocomplete <datalist>
  // requires React keys to be unique. Doing the dedupe here means
  // every consumer benefits without having to remember.
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.nickname && r.nickname !== "") seen.add(r.nickname);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
```

The signature is unchanged. All call sites continue to work as-is.

## Why deduplicate at the source

Three call sites for this function as far as I can tell from earlier
sessions:
  - Summary page autocomplete
  - History page autocomplete
  - (eventually) Armory page autocomplete

If we deduped at each call site we'd repeat the same logic three
times. Doing it in the shared helper means one fix for everywhere.

## Side effects to watch for

- If anything downstream relied on the **count** of names returned
  (`.length`) as a proxy for total match count or total rows — that
  would now under-report. Quick scan the codebase for `listAllNicknames(`
  call sites; if any use `.length` for stats, switch them to count
  the underlying `rows` array instead.
- The order is still alphabetical; nothing visual changes in the
  dropdown except duplicates collapse into one entry.

## After applying

The "Encountered two children with the same key" error should
disappear from the console. The search bar dropdown will show one
"Nick" entry instead of two, which is what users expect anyway —
duplicate items in autocomplete are confusing.

## This does NOT fix the missing `?ops=` issue

This patch only addresses the React key warning. The separate issue
where `?ops=KKKyle` doesn't carry over from Summary to History is a
different fix. Apply this one, then we'll dig into that one.

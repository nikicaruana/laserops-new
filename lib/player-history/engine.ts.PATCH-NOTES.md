# Engine patch notes

Two small surgical edits to `lib/player-history/engine.ts` — the rest
of the file stays exactly as-is. These are the **only** changes needed
on the engine side; everything else is in the components.

## Edit 1 — add `currentLevel` to the `PlayerHistory` type

Find the existing type:

```ts
export type PlayerHistory = {
  matches: PlayerMatch[];
  records: PersonalRecord[];
  /** Most recent rank badge URL — for the profile card. */
  currentRankBadgeUrl: string;
  /** Most recent rank name. */
  currentRankName: string;
  /** Most recent profile picture URL. */
  profilePicUrl: string;
};
```

Replace with (just adds `currentLevel`):

```ts
export type PlayerHistory = {
  matches: PlayerMatch[];
  records: PersonalRecord[];
  /** Most recent rank badge URL — for the profile card. */
  currentRankBadgeUrl: string;
  /** Most recent rank name. */
  currentRankName: string;
  /** Most recent level number — used for the "Level N" label under
   *  the rank badge in the profile card. */
  currentLevel: number;
  /** Most recent profile picture URL. */
  profilePicUrl: string;
};
```

## Edit 2 — populate `currentLevel` in the return value

In `fetchPlayerHistory`, find the existing return:

```ts
  return {
    ok: true,
    history: {
      matches,
      records,
      currentRankBadgeUrl: currentRank?.badgeUrl ?? "",
      currentRankName: currentRank?.rankName ?? "",
      profilePicUrl: mostRecent.profilePicUrl,
    },
  };
```

Replace with (adds one line):

```ts
  return {
    ok: true,
    history: {
      matches,
      records,
      currentRankBadgeUrl: currentRank?.badgeUrl ?? "",
      currentRankName: currentRank?.rankName ?? "",
      currentLevel: mostRecent.level,
      profilePicUrl: mostRecent.profilePicUrl,
    },
  };
```

That's it for the engine. No other changes.

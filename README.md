# Pass 12 — hotfix: wrap useSearchParams in a Suspense boundary

One file. Fixes the Vercel build error introduced by pass 6 that
didn't surface until production-build time:

```
useSearchParams() should be wrapped in a suspense boundary at page
"/player-portal/leaderboards"
```

## Why this happened

When pass 6 added `useSearchParams()` to `SubTabs` so that the player
selection (`?ops=`) could be carried across subtab clicks, it
inadvertently opted every page that renders `SubTabs` into client-
side rendering. Next.js explicitly requires `useSearchParams()`
calls to be wrapped in `<Suspense>` for prerendering to work — a
rule that's enforced at `next build` time but doesn't fire in
`next dev`. That's why this never surfaced locally during testing
and only blew up on the Vercel build.

The error specifically calls out `/player-portal/leaderboards`,
but in reality every route that renders `SubTabs` is affected
(player-stats, leaderboards, future portal subtab pages).

## The fix

In `components/portal/SubTabs.tsx`, the structure goes from one
component into three layers:

1. **`SubTabs` (public)** — wraps the inner component in
   `<Suspense>`. The fallback renders the same UI but with an empty
   search-params object (so tab hrefs don't include forwarded
   params during the initial prerender).
2. **`SubTabsInner` (private)** — calls `useSearchParams()` and
   passes the result down. This is the only component that
   triggers the CSR-bailout requirement, and it's now safely
   behind the Suspense boundary.
3. **`SubTabsShell` (private)** — pure render given the props plus
   a search params object. No CSR-triggering hooks.

Visually identical to before for the user. The only difference:
during the initial server-rendered HTML, tab hrefs are the original
hrefs (without `?ops=` forwarded). Within milliseconds of hydration
the real client-side render kicks in and updates them. Users can't
click anything before hydration completes anyway.

## Files in this zip

```
patch/
├── README.md                                          ← this file
└── components/
    └── portal/
        └── SubTabs.tsx                                ← REPLACE
```

Single file, drop-in replacement. Same public API (`SubTabs` still
takes `tabs` and optional `forwardParams`).

## Apply

Extract over local. The change is purely additive at the boundary
— no other files care about SubTabs internals.

```
1. Extract pass 12 over your project
2. (Locally, optional) npm run build to confirm it builds clean
3. git push
4. Vercel rebuilds — should now succeed
```

## Why this is the canonical fix

Next.js docs spell out this exact pattern in the
"Missing Suspense boundary with useSearchParams" error page:

> "To keep the route statically generated, wrap the smallest subtree
>  that calls useSearchParams() in Suspense, for example you may
>  move its usage into a child Client Component and render that
>  component wrapped with Suspense."

That's what this does — minimum subtree, isolated client component,
Suspense at the boundary.

I tsc'd this against your codebase before shipping. Clean except
for the unrelated globals.css pre-existing warning.

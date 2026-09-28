# Sample game data (real session, 5v5 online)

Drop the real game files here so they can be parsed + cross-checked. This folder's
data files are git-ignored (only this README is tracked), so nothing here gets
committed or deployed.

## Naming (please follow exactly so rounds line up)

Round JSON files (one per round, in play order):
- `r1.json`, `r2.json`, `r3.json`, `r4.json`, `r5.json`  (however many rounds there were)

Per-round CSV exports (all rounds except round 1, which wasn't exported):
- `r2.csv`, `r3.csv`, `r4.csv`, `r5.csv`

Whole-session PDF (all rounds together, exported after the session ended):
- `session.pdf`

Offline headband pull (the "pull offline game statistics" CSV; partial data):
- `offline-pull.csv`

If a real filename is awkward to rename, just drop it in as-is and tell me which
round/type it is — I'll map it. The important thing is I can tell rounds apart.

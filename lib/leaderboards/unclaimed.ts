/**
 * lib/leaderboards/unclaimed.ts
 * --------------------------------------------------------------------
 * Unclaimed headset scores are labelled "Head NN" (e.g. "Head 01") — the
 * physical headset number, used before a player claims that game's score to
 * their profile. These must never appear on LEADERBOARDS (Hall of Fame,
 * all-time boards, challenges). Match reports DO show them — that's where a
 * player identifies and claims their score.
 */
export function isUnclaimedNickname(nickname: string): boolean {
  return /^head\s+\d+$/i.test(nickname.trim());
}

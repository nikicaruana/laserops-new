/**
 * lib/opsTag.ts
 * --------------------------------------------------------------------
 * Server-side validation for a player's ops tag (public nickname):
 * length, allowed characters, and a profanity screen via `obscenity`
 * (catches obfuscations like "sh1t"). Uniqueness is NOT checked here – the
 * DB's case-insensitive unique index is the source of truth; the API route
 * catches the unique-violation and reports "taken". Runs server-side only.
 */
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export const OPS_TAG_MIN = 3;
export const OPS_TAG_MAX = 24;

// Letters, numbers, spaces, and a few name-friendly punctuation marks.
const OPS_TAG_RE = /^[A-Za-z0-9 ._-]+$/;

export type OpsTagResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateOpsTag(raw: string): OpsTagResult {
  const value = raw.trim().replace(/\s+/g, " ");

  if (value.length < OPS_TAG_MIN) {
    return { ok: false, error: `Ops tag must be at least ${OPS_TAG_MIN} characters.` };
  }
  if (value.length > OPS_TAG_MAX) {
    return { ok: false, error: `Ops tag must be at most ${OPS_TAG_MAX} characters.` };
  }
  if (!OPS_TAG_RE.test(value)) {
    return { ok: false, error: "Use only letters, numbers, spaces, and . _ -" };
  }
  if (matcher.hasMatch(value)) {
    return { ok: false, error: "That ops tag isn't allowed. Please choose another." };
  }
  return { ok: true, value };
}

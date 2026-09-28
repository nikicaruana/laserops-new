/**
 * lib/squadText.ts
 * --------------------------------------------------------------------
 * Server-side validation for squad name + description: length limits and a
 * profanity screen (via `obscenity`, catching obfuscations). Same approach as
 * lib/opsTag.ts. Runs in the /api/squads route before the create/update RPC.
 */
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export const SQUAD_NAME_MIN = 2;
export const SQUAD_NAME_MAX = 40;
export const SQUAD_DESC_MAX = 400;

export type TextResult = { ok: true; value: string } | { ok: false; error: string };

export function validateSquadName(raw: string): TextResult {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (value.length < SQUAD_NAME_MIN) return { ok: false, error: `Squad name must be at least ${SQUAD_NAME_MIN} characters.` };
  if (value.length > SQUAD_NAME_MAX) return { ok: false, error: `Squad name must be at most ${SQUAD_NAME_MAX} characters.` };
  if (matcher.hasMatch(value)) return { ok: false, error: "That squad name isn't allowed. Please choose another." };
  return { ok: true, value };
}

export function validateSquadDescription(raw: string | null): TextResult {
  const value = (raw ?? "").trim();
  if (value === "") return { ok: true, value: "" };
  if (value.length > SQUAD_DESC_MAX) return { ok: false, error: `Description must be at most ${SQUAD_DESC_MAX} characters.` };
  if (matcher.hasMatch(value)) return { ok: false, error: "Please remove inappropriate language from the description." };
  return { ok: true, value };
}

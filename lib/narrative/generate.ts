/**
 * lib/narrative/generate.ts
 * --------------------------------------------------------------------
 * Turns the structured match facts into a short, upbeat write-up via Claude.
 * Uses Claude Haiku 4.5 - capable and the cheapest current model, a good fit
 * for a compact, positive recap. Server-only; needs ANTHROPIC_API_KEY.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeInput } from "./input";

const MODEL = "claude-haiku-4-5";

const SYSTEM = `You are a hype match reporter for LaserOps Malta, an outdoor tactical laser-tag arena. You write a short recap of ONE player's match, shown under their name on their match report.

Rules:
- Under 150 words. One flowing paragraph, no headings, no bullet points, no lists.
- NEVER use an em dash or an en dash. Use commas, full stops, or the word "and" instead. This is a hard rule.
- Refer to the player by their ops tag.
- Always find the positive angle. Frame every result as a win, a lesson, or momentum, never negative, never discouraging, even for weak stats.
- Use ONLY the facts given in the JSON. Never invent numbers, names, weapons, bases, or events. If a fact is missing, do not mention it.
- Tell the story ROUND BY ROUND. Lead with what happened in specific rounds and pick out the standout ones, rather than only summarising overall totals.
- Pay close attention to objective play: which bases they captured, how long they held them, any base they "burned" (held to its full 10 minute / 600 second total), and any round-winning capture. Name the bases specifically.
- Call out specific rivalries by name: who they got the better of, a hard-fought duel with their nemesis, a rematch to chase. Make the battles feel personal.
- Weave in streaks for flavour, and balance objective play against kills.
- Energetic, natural prose. No emojis. No stat dumps. Tell the story of the match.`;

export async function generatePlayerNarrative(input: NarrativeInput): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Write the recap for this player's match. Facts:\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  // Safeguard: strip any long dashes the model slips in despite the instruction.
  // Char codes 0x2013 (en dash) and 0x2014 (em dash) are built at runtime so no
  // literal long-dash character ever appears in this source file.
  const longDash = new RegExp("\\s*[" + String.fromCharCode(0x2013, 0x2014) + "]\\s*", "g");
  return text
    .replace(longDash, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

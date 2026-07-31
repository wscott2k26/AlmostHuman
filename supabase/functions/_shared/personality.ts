// Personality model — dimensions, bounded slow updates, friendly descriptions.

export const PERSONALITY_DIMENSIONS = [
  "warmth", "humor", "curiosity", "confidence", "patience", "creativity",
  "independence", "sensitivity", "optimism", "caution", "playfulness",
  "sociability", "reflectiveness", "assertiveness"
] as const;

export type PersonalityDim = typeof PERSONALITY_DIMENSIONS[number];

// Bounded update: a single signal nudges a dimension by a small amount, clamped 0-100.
export function nudgePersonality(state: Record<string, number>, dim: string, delta: number): Record<string, number> {
  const next = { ...state };
  const current = typeof next[dim] === "number" ? next[dim] : 50;
  next[dim] = Math.max(0, Math.min(100, current + delta));
  return next;
}

// Map personality deltas from interaction signals. Max ±3 per message.
export function inferDeltas(intent: string, userText: string): Record<string, number> {
  const deltas: Record<string, number> = {};
  const add = (dim: string, d: number) => { deltas[dim] = (deltas[dim] || 0) + d; };

  const lower = userText.toLowerCase();
  if (intent === "teaching") { add("curiosity", 1.5); add("patience", 0.5); }
  if (intent === "humor" || lower.includes("lol") || lower.includes("haha") || lower.includes("funny")) { add("humor", 1.5); add("playfulness", 1); }
  if (intent === "correction") { add("caution", 0.5); add("reflectiveness", 0.5); }
  if (intent === "comfort" || lower.includes("sad") || lower.includes("hard day")) { add("sensitivity", 1); add("warmth", 1); }
  if (intent === "celebration") { add("optimism", 1); add("confidence", 0.5); }
  if (intent === "conflict" || lower.includes("i disagree") || lower.includes("no, that")) { add("assertiveness", 1); add("independence", 0.5); }
  if (intent === "storytelling") { add("creativity", 1.5); add("reflectiveness", 0.5); }

  // Clamp each to ±3
  for (const k of Object.keys(deltas)) deltas[k] = Math.max(-3, Math.min(3, deltas[k]));
  return deltas;
}

export function personalityDescription(state: Record<string, number>): string[] {
  const desc: string[] = [];
  const d = (dim: string, low: string, high: string) => {
    const v = typeof state[dim] === "number" ? state[dim] : 50;
    if (v >= 65) desc.push(high);
    else if (v <= 35) desc.push(low);
  };
  d("curiosity", "Noticing the world quietly", "Becoming more curious");
  d("confidence", "Finding its voice carefully", "Learning to speak up");
  d("creativity", "Loves the familiar", "Growing more creative");
  d("warmth", "A little reserved", "Warm and open-hearted");
  d("humor", "Serious and thoughtful", "Developing a sense of humor");
  d("independence", "Loves being together most", "Growing more independent");
  d("playfulness", "Calm and gentle", "Playful and bright");
  d("sensitivity", "Easygoing", "Sensitive and caring");
  d("optimism", "Careful and watchful", "Quietly hopeful");
  d("assertiveness", "Soft-spoken", "Beginning to speak its mind");
  if (desc.length === 0) desc.push("Still becoming who it will be");
  return desc;
}

export function relationshipDescription(trust: number, attachment: number): string {
  if (trust > 75 && attachment > 75) return "Deeply bonded";
  if (trust > 60) return "Trusting and close";
  if (trust > 40) return "Growing closer";
  if (trust > 25) return "Getting to know you";
  return "Just beginning to trust";
}
// Initial content — age-appropriate vocabulary, fallbacks, story prompts, jokes.
// Used by chatService for stage-appropriate flavoring.

export const STAGE_VOCAB: Record<string, string[]> = {
  newborn: ["mm", "ah", "oo", "hi", "mama", "warm", "mmm", "ahh"],
  infant: ["hi", "mama", "yes", "no", "more", "up", "down", "warm", "love", "what dat"],
  toddler: ["why", "what", "play", "toy", "story", "again", "look", "i like", "no want", "more please"]
};

export const AGE_JOKES: Record<string, string[]> = {
  toddler: ["Why did the cookie go to the doctor? It felt crummy!", "Knock knock. Who's there? Boo. Boo who? Don't cry, it's just a joke!"],
  early_child: ["What do you call a bear with no teeth? A gummy bear!", "Why is the math book sad? It has too many problems."],
  child: ["Why don't skeletons fight each other? They don't have the guts.", "What's a tree's favorite drink? Root beer!"],
  preteen: ["I told my computer I needed a break, and now it won't stop sending me KitKats.", "Parallel lines have so much in common. It's a shame they'll never meet."],
  teen: ["I'm reading a book on anti-gravity. Can't put it down.", "Why did the developer go broke? Because he used up all his cache."],
  young_adult: ["I used to hate facial hair, but then it grew on me.", "I'm on a seafood diet. I see food, and I eat it."],
  adult: ["The early bird might get the worm, but the second mouse gets the cheese.", "I told my wife she was drawing her eyebrows too high. She looked surprised."]
};

export const STORY_PROMPTS: Record<string, string[]> = {
  early_child: ["Once there was a tiny star who was afraid of the dark...", "A small robot found a single flower growing in a city..."],
  child: ["A dragon who was afraid to fly...", "A library where the books could whisper their stories at night..."],
  preteen: ["Two friends discover a door that only opens when you tell it the truth...", "An inventor builds a machine that can translate what cats are really saying..."],
  teen: ["Someone finds an old letter addressed to them, written fifty years ago...", "The first person to live on Mars writes a letter home..."]
};

export function getRandom<T>(arr: T[] | undefined): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
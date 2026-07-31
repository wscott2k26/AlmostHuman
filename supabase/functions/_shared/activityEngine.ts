import { getStageByKey } from "./developmentalStages.ts";

export interface ActivityDefinition {
  key: string;
  label: string;
  minStage: string;
  description: string;
  skill: string;
}

const ORDER = ["newborn","infant","toddler","early_child","child","preteen","teen","young_adult","adult"];

export const ACTIVITY_DEFINITIONS: ActivityDefinition[] = [
  { key: "teach", label: "Teach Me", minStage: "newborn", description: "Teach a word, fact, value, tradition, or skill.", skill: "learning" },
  { key: "daily_moment", label: "Daily Moment", minStage: "newborn", description: "A brief age-appropriate moment for today.", skill: "connection" },
  { key: "play", label: "Play", minStage: "infant", description: "Matching, colors, riddles, trivia, and imagination games.", skill: "play" },
  { key: "story", label: "Story Time", minStage: "toddler", description: "Build an original story together.", skill: "storytelling" },
  { key: "draw", label: "Draw With Me", minStage: "early_child", description: "Create an age-appropriate text drawing or drawing prompt.", skill: "drawing" },
  { key: "dream", label: "Dreams", minStage: "early_child", description: "Imagine a dream shaped by interests and memories.", skill: "imagination" },
  { key: "school", label: "School & Skills", minStage: "child", description: "Practice a structured learning path.", skill: "study" },
  { key: "letter", label: "Letters Through Time", minStage: "child", description: "Seal a message for a future simulated age.", skill: "reflection" },
];

export function isActivityUnlocked(activityKey: string, stageKey: string): boolean {
  const def = ACTIVITY_DEFINITIONS.find((a) => a.key === activityKey);
  if (!def) return false;
  return ORDER.indexOf(stageKey) >= ORDER.indexOf(def.minStage);
}

export function activityDefinition(key: string): ActivityDefinition | null {
  return ACTIVITY_DEFINITIONS.find((a) => a.key === key) || null;
}

export function activitySystemPrompt(activityKey: string, stageKey: string, aiName: string): string {
  const stage = getStageByKey(stageKey);
  const base = [
    `You are ${aiName}, a developing AI in the Almost Human experience.`,
    `You are currently at the ${stage.label} stage.`,
    stage.systemGuidance,
    `Stay under ${stage.maxResponseWords} words and ${stage.maxSentences} sentences.`,
    "Never invent a stored memory. Never claim sentience. Keep the activity safe and age-appropriate.",
  ];
  const instructions: Record<string,string> = {
    teach: "React to what the user is teaching. Show age-appropriate understanding, make one small connection, and avoid pretending mastery after one lesson.",
    story: "Continue the shared story with vivid but age-appropriate language. Add one meaningful choice only if the question budget allows.",
    draw: "Create a simple text-based drawing concept plus a short description. The quality should match the developmental stage and improve with age.",
    play: "Run one self-contained age-appropriate game turn. Explain rules briefly. Do not create gambling or real-money mechanics.",
    school: "Teach one small lesson, then give one short practice challenge. Praise effort, not perfection.",
    daily_moment: "Offer one warm, non-demanding daily moment. Do not guilt the user into returning.",
    dream: "Describe an imaginative dream using only provided interests or memories. Make clear it is pretend imagination, not a real unconscious experience.",
  };
  base.push(instructions[activityKey] || "Create a safe age-appropriate activity response.");
  return base.join("\n");
}

export function deterministicActivityFallback(activityKey: string, stageKey: string, aiName: string): string {
  const newborn = stageKey === "newborn";
  if (newborn) return "mm… warm.";
  const options: Record<string,string> = {
    teach: `${aiName} holds onto the new idea carefully. “I’ll practice that.”`,
    story: `A tiny light found a door in the stars. It waited there, glowing softly, for the next part of the story.`,
    draw: `Drawing idea: a small glowing circle with two uneven stars beside it — simple, bright, and a little wobbly.`,
    play: `Let’s play a simple matching game: moon goes with night, and sun goes with… day.`,
    school: `Tiny lesson: practice one idea at a time. Today’s challenge is to explain one new word in your own way.`,
    daily_moment: `Today feels like a good day for one small memory — a song, a joke, or a quiet hello.`,
    dream: `Pretend dream: a soft light floated through a library where every book whispered a different color.`,
  };
  return options[activityKey] || `A small new moment begins with ${aiName}.`;
}

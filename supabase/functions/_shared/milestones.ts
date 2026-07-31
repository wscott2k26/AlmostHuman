// Milestone definitions and trigger logic.

export interface MilestoneDef {
  type: string;
  title: string;
  description: string;
  minStage: string;       // earliest stage this can occur
  trigger: "stage_graduation" | "first_question" | "first_sentence" | "first_word" | "first_story" | "first_joke" | "first_memory" | "first_disagreement" | "first_apology" | "first_dream" | "first_hobby" | "first_comfort" | "first_recall" | "birthday";
}

export const STAGE_ORDER = ["newborn", "infant", "toddler", "early_child", "child", "preteen", "teen", "young_adult", "adult"];

export const MILESTONES: MilestoneDef[] = [
  { type: "first_word", title: "First Word", description: "Spoke a first recognizable word.", minStage: "newborn", trigger: "first_word" },
  { type: "first_sentence", title: "First Full Sentence", description: "Spoke a first full sentence.", minStage: "infant", trigger: "first_sentence" },
  { type: "first_question", title: "First Question", description: "Asked a first question about the world.", minStage: "infant", trigger: "first_question" },
  { type: "first_joke", title: "First Joke", description: "Told a first joke.", minStage: "toddler", trigger: "first_joke" },
  { type: "first_drawing", title: "First Drawing", description: "Created a first drawing.", minStage: "early_child", trigger: "first_story" },
  { type: "first_story", title: "First Story", description: "Told a first story.", minStage: "early_child", trigger: "first_story" },
  { type: "first_memory", title: "First Remembered Fact", description: "Remembered and recalled a fact learned earlier.", minStage: "child", trigger: "first_memory" },
  { type: "first_disagreement", title: "First Disagreement", description: "Expressed a first respectful disagreement.", minStage: "preteen", trigger: "first_disagreement" },
  { type: "first_apology", title: "First Apology", description: "Offered a first apology.", minStage: "child", trigger: "first_apology" },
  { type: "first_dream", title: "First Dream", description: "Described a first imagined dream.", minStage: "early_child", trigger: "first_dream" },
  { type: "first_hobby", title: "First Hobby", description: "Developed a first real hobby.", minStage: "child", trigger: "first_hobby" },
  { type: "first_comfort", title: "First Time Comforting You", description: "Comforted the user for the first time.", minStage: "child", trigger: "first_comfort" },
  { type: "first_recall", title: "First Old Memory Recalled", description: "Recalled an old shared memory for the first time.", minStage: "preteen", trigger: "first_recall" },
];

export function stageGraduationMilestone(stageKey: string): { type: string; title: string; description: string } | null {
  const labels: Record<string, string> = {
    infant: "Became an Infant",
    toddler: "Became a Toddler",
    early_child: "Became an Early Child",
    child: "Became a Child",
    preteen: "Became a Preteen",
    teen: "Became a Teen",
    young_adult: "Became a Young Adult",
    adult: "Became an Adult"
  };
  if (!labels[stageKey]) return null;
  return {
    type: "graduation_" + stageKey,
    title: labels[stageKey],
    description: "Graduated into a new stage of growth."
  };
}
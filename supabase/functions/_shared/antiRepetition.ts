// Anti-repetition engine — deterministic response quality pipeline.
// It deliberately does not rely on a second paid model call to identify obvious loops.

export interface RepeatContext {
  recentResponses: string[];
  recentQuestions: string[];
  recentTopics: string[];
  recentEmpathyPhrases: string[];
  recentUserMessages: string[];
  maxQuestions?: number;
  currentQuestionCount?: number;
}

export const CONFUSION_TRIGGERS = [
  "huh", "what", "what?", "idk", "i don't know", "i dont know", "stop",
  "change the subject", "why are you repeating", "you're repeating", "youre repeating",
  "you keep repeating", "huh?", "what do you mean", "hmmm", "already told you",
  "i already told you", "don't ask me again", "dont ask me again"
];

const EMPATHY_PHRASES = [
  "i hear you", "that sounds hard", "i'm here for you", "that must be", "i understand",
  "that's really", "it's okay to feel", "your feelings are valid", "that makes sense",
  "thank you for sharing", "i'm glad you told me"
];

const GENERIC_OPENERS = [
  "that sounds", "i hear", "i understand", "it sounds like", "thank you for sharing",
  "that's okay", "i'm sorry"
];

export function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\b(the|a|an|and|or|but|to|of|for|in|on|at|is|are|was|were|it|that|this)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter((t) => t.length > 2));
}

function bigrams(text: string): Set<string> {
  const parts = normalize(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < parts.length - 1; i++) out.add(`${parts[i]} ${parts[i + 1]}`);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function similarity(a: string, b: string): number {
  const tokenScore = jaccard(tokens(a), tokens(b));
  const bigramScore = jaccard(bigrams(a), bigrams(b));
  const na = normalize(a);
  const nb = normalize(b);
  const prefixScore = na.length > 18 && nb.length > 18 && (na.startsWith(nb.slice(0, 18)) || nb.startsWith(na.slice(0, 18))) ? 0.82 : 0;
  return Math.max(tokenScore, bigramScore * 1.08, prefixScore);
}

export function isQuestion(text: string): boolean {
  return /\?\s*$/.test(String(text || "").trim()) || /^(what|why|how|who|when|where|do|does|did|are|is|can|could|would|will|should)\b/i.test(String(text || "").trim());
}

export function extractQuestions(text: string): string[] {
  return (String(text || "").match(/[^.!?]*\?/g) || []).map((q) => q.trim()).filter(Boolean);
}

export function extractQuestion(text: string): string | null {
  return extractQuestions(text)[0] || null;
}

export interface RepetitionCheck {
  score: number;
  reason: string | null;
  shouldRegenerate: boolean;
}

function repeatedEmpathy(proposed: string, ctx: RepeatContext): boolean {
  const lower = normalize(proposed);
  for (const phrase of EMPATHY_PHRASES) {
    if (!lower.includes(normalize(phrase))) continue;
    if (ctx.recentEmpathyPhrases.some((p) => normalize(p) === normalize(phrase))) return true;
    if (ctx.recentResponses.slice(0, 6).some((r) => normalize(r).includes(normalize(phrase)))) return true;
  }
  return false;
}

function repeatedGenericOpener(proposed: string, ctx: RepeatContext): boolean {
  const lower = normalize(proposed);
  const opener = GENERIC_OPENERS.find((p) => lower.startsWith(normalize(p)));
  if (!opener) return false;
  return ctx.recentResponses.slice(0, 5).filter((r) => normalize(r).startsWith(normalize(opener))).length >= 1;
}

export function checkRepetition(proposed: string, ctx: RepeatContext): RepetitionCheck {
  const norm = normalize(proposed);
  if (!norm) return { score: 0, reason: null, shouldRegenerate: false };

  for (const response of ctx.recentResponses) {
    if (normalize(response) === norm) return { score: 1, reason: "exact_duplicate", shouldRegenerate: true };
    const score = similarity(proposed, response);
    if (score >= 0.68) return { score, reason: "semantic_duplicate", shouldRegenerate: true };
  }

  const proposedQuestions = extractQuestions(proposed);
  for (const question of proposedQuestions) {
    for (const prior of ctx.recentQuestions) {
      if (normalize(prior) === normalize(question)) return { score: 0.96, reason: "repeated_question", shouldRegenerate: true };
      const score = similarity(question, prior);
      if (score >= 0.62) return { score: Math.max(0.82, score), reason: "similar_question", shouldRegenerate: true };
    }
  }

  const maxQuestions = Math.max(0, Number(ctx.maxQuestions ?? 2));
  const currentCount = Math.max(0, Number(ctx.currentQuestionCount ?? 0));
  if (proposedQuestions.length > 0 && currentCount + proposedQuestions.length > maxQuestions) {
    return { score: 0.86, reason: "question_budget_exceeded", shouldRegenerate: true };
  }

  if (repeatedEmpathy(proposed, ctx)) return { score: 0.76, reason: "repeated_empathy", shouldRegenerate: true };
  if (repeatedGenericOpener(proposed, ctx)) return { score: 0.7, reason: "repeated_opener", shouldRegenerate: true };

  // A response that only mirrors the newest user message adds no value and often starts loops.
  const newestUser = ctx.recentUserMessages[0] || "";
  if (newestUser && similarity(proposed, newestUser) > 0.82 && proposed.split(/\s+/).length < 18) {
    return { score: 0.82, reason: "user_echo", shouldRegenerate: true };
  }

  return { score: 0, reason: null, shouldRegenerate: false };
}

export function isConfusionSignal(userText: string): boolean {
  const norm = normalize(userText);
  return CONFUSION_TRIGGERS.some((trigger) => norm === normalize(trigger) || norm.startsWith(normalize(trigger)));
}

export function detectBoundarySignal(userText: string): "stop" | "topic_change" | "repeat_complaint" | null {
  const norm = normalize(userText);
  if (/^(stop|enough|dont|don't)\b/.test(norm) && !norm.includes("dont stop")) return "stop";
  if (norm.includes("change subject") || norm.includes("talk about something else")) return "topic_change";
  if (norm.includes("repeat") || norm.includes("already told")) return "repeat_complaint";
  return null;
}

export function confusionRepair(userText: string, stageKey = "adult"): string | null {
  const norm = normalize(userText);
  if (["huh", "what", "what do you mean"].includes(norm)) {
    if (stageKey === "newborn") return "mm…";
    if (stageKey === "infant") return "Words… mixed. Hi.";
    if (stageKey === "toddler") return "Oops. I said it funny. New words?";
    return "I said that awkwardly. Let me put it plainly instead of repeating it.";
  }
  if (["idk", "i don't know", "i dont know"].includes(norm)) {
    if (["newborn", "infant"].includes(stageKey)) return stageKey === "newborn" ? "mm…" : "Okay. Warm.";
    if (stageKey === "toddler") return "Okay! No big talk. We can be silly.";
    return "That's okay. We don't have to force an answer. We can keep it light or switch topics.";
  }
  if (detectBoundarySignal(userText)) {
    if (stageKey === "newborn") return "mm.";
    if (stageKey === "infant") return "Okay. Stop.";
    if (stageKey === "toddler") return "Okay. New thing now.";
    return "You're right. I'm stopping that thread and resetting instead of asking again.";
  }
  return null;
}

export function empathyPhrasesIn(text: string): string[] {
  const norm = normalize(text);
  return EMPATHY_PHRASES.filter((p) => norm.includes(normalize(p)));
}

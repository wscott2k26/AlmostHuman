// Memory utilities shared by extraction, chat retrieval, correction, and export.

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","to","of","for","in","on","at","is","are","was","were",
  "it","that","this","i","you","me","my","your","we","our","they","them","he","she","with",
  "from","as","be","been","being","have","has","had","do","does","did","so","if","then"
]);

export function normalizeMemoryText(text: string): string {
  return String(text || "").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

export function memoryTerms(text: string): string[] {
  return [...new Set(normalizeMemoryText(text).split(" ").filter((t) => t.length > 2 && !STOP_WORDS.has(t)))].slice(0, 40);
}

export function memoryKey(type: string, title: string, content: string): string {
  const basis = `${type}:${title || content}`;
  return memoryTerms(basis).slice(0, 10).join("_").slice(0, 120);
}

export function memorySimilarity(a: string, b: string): number {
  const aa = new Set(memoryTerms(a));
  const bb = new Set(memoryTerms(b));
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const term of aa) if (bb.has(term)) intersection += 1;
  return intersection / Math.max(1, aa.size + bb.size - intersection);
}

export function findDuplicateMemory(candidate: any, existing: any[]): any | null {
  const key = candidate.normalized_key || memoryKey(candidate.memory_type, candidate.title, candidate.content);
  const exact = existing.find((m) => m.normalized_key === key && m.status !== "deleted");
  if (exact) return exact;
  return existing.find((m) => {
    if (m.status === "deleted" || m.memory_type !== candidate.memory_type) return false;
    return memorySimilarity(`${candidate.title || ""} ${candidate.content || ""}`, `${m.title || ""} ${m.content || ""}`) >= 0.72;
  }) || null;
}

export function mergeMemory(existing: any, incoming: any): any {
  const oldImportance = Number(existing.importance_score || 0.5);
  const newImportance = Number(incoming.importance_score || 0.5);
  const oldConfidence = Number(existing.confidence_score || 0.6);
  const newConfidence = Number(incoming.confidence_score || 0.6);
  const mergedCount = Math.max(1, Number(existing.merged_count || 1)) + 1;
  return {
    title: existing.title || incoming.title || "",
    content: incoming.content && incoming.content.length > String(existing.content || "").length ? incoming.content : existing.content,
    importance_score: Math.min(1, Math.max(oldImportance, (oldImportance + newImportance) / 2)),
    confidence_score: Math.min(1, (oldConfidence * 0.65) + (newConfidence * 0.35)),
    emotional_tone: incoming.emotional_tone || existing.emotional_tone || "",
    is_core_memory: Boolean(existing.is_core_memory || incoming.is_core_memory || newImportance >= 0.9),
    merged_count: mergedCount,
    search_terms: memoryTerms(`${existing.title || ""} ${existing.content || ""} ${incoming.title || ""} ${incoming.content || ""}`),
    status: "active",
  };
}

export function scoreMemoryRelevance(memory: any, query: string): number {
  if (memory.hidden || memory.status === "hidden" || memory.status === "deleted") return -1;
  const lexical = memorySimilarity(query, `${memory.title || ""} ${memory.content || ""} ${(memory.search_terms || []).join(" ")}`);
  const importance = Math.max(0, Math.min(1, Number(memory.importance_score || 0.5)));
  const confidence = Math.max(0, Math.min(1, Number(memory.confidence_score || 0.6)));
  const coreBoost = memory.is_core_memory ? 0.14 : 0;
  const recencyBoost = memory.last_recalled_at ? 0 : 0.03;
  return lexical * 0.62 + importance * 0.21 + confidence * 0.12 + coreBoost + recencyBoost;
}

export function selectRelevantMemories(memories: any[], query: string, limit = 8): any[] {
  const scored = memories
    .map((memory) => ({ memory, score: scoreMemoryRelevance(memory, query) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const lexicalMatches = scored.filter((entry) => entry.score >= 0.28).slice(0, limit);
  if (lexicalMatches.length >= Math.min(3, limit)) return lexicalMatches.map((entry) => entry.memory);

  // Keep a couple of high-importance/core memories even when the new message is vague.
  const fallback = scored.filter((entry) => entry.memory.is_core_memory || Number(entry.memory.importance_score || 0) >= 0.75).slice(0, Math.max(2, limit - lexicalMatches.length));
  const unique = new Map<string, any>();
  [...lexicalMatches, ...fallback].forEach((entry) => unique.set(entry.memory.id, entry.memory));
  return [...unique.values()].slice(0, limit);
}

export function sanitizeExtractedMemory(raw: any): any | null {
  if (!raw || !String(raw.content || "").trim()) return null;
  const allowed = new Set(["episodic","semantic","emotional","skill","relationship","core"]);
  const type = allowed.has(raw.memory_type) ? raw.memory_type : "episodic";
  const title = String(raw.title || "").trim().slice(0, 120);
  const content = String(raw.content || "").trim().slice(0, 1200);
  const importance = Math.max(0, Math.min(1, Number(raw.importance_score ?? 0.5)));
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence_score ?? 0.65)));
  return {
    memory_type: type,
    title,
    content,
    importance_score: importance,
    confidence_score: confidence,
    emotional_tone: String(raw.emotional_tone || "").trim().slice(0, 40),
    is_core_memory: type === "core" || importance >= 0.9,
    is_private: confidence < 0.4 || Boolean(raw.is_private),
    normalized_key: memoryKey(type, title, content),
    search_terms: memoryTerms(`${title} ${content}`),
    status: "active",
  };
}

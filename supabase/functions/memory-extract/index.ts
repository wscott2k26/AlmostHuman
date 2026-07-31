import { createAppContext, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { extractJson } from '../_shared/openai.ts';
import { computeSimulatedAge, getStageFromAge, clampDaysPerYear } from "../_shared/developmentalStages.ts";
import {
  sanitizeExtractedMemory, findDuplicateMemory, mergeMemory, normalizeMemoryText, memoryTerms
} from "../_shared/memoryEngine.ts";

const EXTRACTION_VERSION = "memory-v2.2";

serve(async (req) => {
  try {
    const app = await createAppContext(req);
    const user = app.user;

    const body = await req.json().catch(() => ({}));
    const conversationId = String(body.conversation_id || "").trim();
    if (!conversationId) return Response.json({ error: "conversation_id required" }, { status: 400 });

    const conversation = await app.entities.Conversation.get(conversationId);
    if (!conversation || conversation.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });

    const ai = await app.entities.AIEntity.get(conversation.ai_entity_id);
    if (!ai || ai.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });

    const recentDescending = await app.entities.Message.filter({ conversation_id: conversationId }, "-created_date", 50);
    const newest = recentDescending[0];
    if (!newest || recentDescending.length < 3) return Response.json({ status: "skipped", reason: "too_short" });
    if (conversation.memory_processed_through === newest.id && conversation.extraction_version === EXTRACTION_VERSION) {
      return Response.json({ status: "skipped", reason: "already_processed" });
    }

    const messages = [...recentDescending].reverse();
    const transcript = messages.map((message: any) => `${message.sender === "ai" ? "AI" : "Human"}: ${String(message.content || "").slice(0, 4000)}`).join("\n");
    const settings = (await app.entities.AppSettings.list("-created_date", 1).catch(() => []))?.[0] || {};
    const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));
    const stage = getStageFromAge(age);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      await app.entities.AdminEvent.create({ user_id: user.id, ai_entity_id: ai.id, event_type: "memory_extraction_skipped", severity: "warning", details: { reason: "missing_credentials" } }).catch(() => {});
      return Response.json({ status: "skipped", reason: "ai_not_configured" });
    }

    const prompt = `You are the private memory curator for Almost Human. Extract durable information from the transcript without inventing anything.

AI developmental stage: ${stage.label}. Simulated age: ${age.toFixed(2)}.

Return valid JSON only:
{
  "memories": [{
    "memory_type": "episodic|semantic|emotional|skill|relationship|core",
    "title": "short title",
    "content": "one or two precise sentences",
    "importance_score": 0.0,
    "confidence_score": 0.0,
    "emotional_tone": "one word",
    "is_sensitive": false
  }],
  "user_facts": [{
    "category": "personal|family|work|preference|belief|health|other",
    "fact_key": "stable snake_case key",
    "fact_value": "explicit fact",
    "confidence": 0.0,
    "is_sensitive": false
  }],
  "interests": [{"name":"short interest","affinity_delta":0.0,"evidence":"brief reason"}],
  "skills": [{"name":"short skill","category":"category","xp_delta":0}],
  "summary": "one factual sentence",
  "quality_score": 0.0
}

Rules:
- Extract only explicit human facts or genuinely meaningful shared events.
- Skip greetings, filler, and generic AI statements.
- Do not convert speculation, jokes, hypotheticals, or questions into facts.
- Do not store crisis text as a celebratory milestone.
- Sensitive health, trauma, sexuality, finances, legal issues, addresses, or credentials must set is_sensitive=true.
- confidence is epistemic confidence, not importance.
- Return empty arrays when nothing is durable.
- Never include secrets such as passwords, authentication tokens, card numbers, or government IDs.

Transcript:
${transcript}`;

    let extracted: any = { memories: [], user_facts: [], interests: [], skills: [], summary: "", quality_score: 0 };
    try {
      extracted = await extractJson(
        "You are the private memory curator for Almost Human. Follow the supplied schema and safety rules exactly.",
        prompt,
        extracted,
      );
    } catch (error) {
      await app.entities.AdminEvent.create({ user_id: user.id, ai_entity_id: ai.id, event_type: "memory_extraction_error", severity: "error", details: { message: String(error?.message || error).slice(0, 400) } }).catch(() => {});
      return Response.json({ error: "Memory extraction failed safely" }, { status: 502 });
    }

    const existingMemories = await app.entities.Memory.filter({ ai_entity_id: ai.id }, "-importance_score", 250);
    let memoriesCreated = 0;
    let memoriesMerged = 0;
    for (const raw of Array.isArray(extracted.memories) ? extracted.memories.slice(0, 12) : []) {
      const memory = sanitizeExtractedMemory({ ...raw, is_private: Boolean(raw.is_sensitive) });
      if (!memory) continue;
      // Never store likely credentials or identity numbers.
      if (/password|passcode|api key|access token|credit card|social security|ssn/i.test(`${memory.title} ${memory.content}`)) continue;
      const duplicate = findDuplicateMemory(memory, existingMemories);
      if (duplicate) {
        const patch = mergeMemory(duplicate, memory);
        await app.entities.Memory.update(duplicate.id, patch);
        Object.assign(duplicate, patch);
        memoriesMerged += 1;
        continue;
      }
      const created = await app.entities.Memory.create({
        ...memory, ai_entity_id: ai.id, source_conversation_id: conversationId,
        source_message_id: newest.id, age_created: age,
      });
      existingMemories.push(created);
      memoriesCreated += 1;
    }

    let factsCreated = 0;
    let conflictsCreated = 0;
    for (const raw of Array.isArray(extracted.user_facts) ? extracted.user_facts.slice(0, 12) : []) {
      const factKey = normalizeFactKey(raw.fact_key);
      const factValue = String(raw.fact_value || "").trim().slice(0, 500);
      if (!factKey || !factValue || Number(raw.confidence || 0) < 0.45) continue;
      if (/password|passcode|api[_ ]?key|access[_ ]?token|credit[_ ]?card|social[_ ]?security|ssn/i.test(`${factKey} ${factValue}`)) continue;
      const existing = await app.entities.UserFact.filter({ ai_entity_id: ai.id, normalized_key: factKey, status: "active" }, "-created_date", 5);
      const same = existing.find((fact: any) => normalizeMemoryText(fact.fact_value) === normalizeMemoryText(factValue));
      if (same) {
        await app.entities.UserFact.update(same.id, { confidence: Math.min(1, Math.max(Number(same.confidence || 0.6), Number(raw.confidence || 0.6))) });
        continue;
      }
      if (existing.length) {
        const openConflicts = await app.entities.FactConflict.filter({ ai_entity_id: ai.id, fact_key: factKey, status: "pending" }, "-created_date", 5);
        if (!openConflicts.some((conflict: any) => normalizeMemoryText(conflict.proposed_value) === normalizeMemoryText(factValue))) {
          await app.entities.FactConflict.create({
            ai_entity_id: ai.id, fact_key: factKey, existing_fact_id: existing[0].id,
            existing_value: existing[0].fact_value, proposed_value: factValue,
            source_conversation_id: conversationId, confidence: clamp01(raw.confidence), status: "pending",
          });
          conflictsCreated += 1;
        }
        continue;
      }
      await app.entities.UserFact.create({
        ai_entity_id: ai.id, category: String(raw.category || "other").slice(0, 40),
        fact_key: String(raw.fact_key || factKey).slice(0, 80), normalized_key: factKey,
        fact_value: factValue, confidence: clamp01(raw.confidence), source_message_id: newest.id,
        user_verified: false, status: "active", notes: raw.is_sensitive ? "sensitive" : "",
      });
      factsCreated += 1;
    }

    let interestsUpdated = 0;
    for (const raw of Array.isArray(extracted.interests) ? extracted.interests.slice(0, 6) : []) {
      const name = normalizeLabel(raw.name);
      if (!name) continue;
      const existing = await app.entities.Interest.filter({ ai_entity_id: ai.id, interest_name: name }, "-created_date", 1);
      const delta = Math.max(1, Math.min(12, Number(raw.affinity_delta || 0.03) <= 1 ? Number(raw.affinity_delta || 0.03) * 100 : Number(raw.affinity_delta || 3)));
      if (existing.length) {
        await app.entities.Interest.update(existing[0].id, {
          affinity_score: Math.min(100, Number(existing[0].affinity_score || 30) + delta),
          evidence_count: Number(existing[0].evidence_count || 1) + 1,
          last_reinforced_at: new Date().toISOString(), source: String(raw.evidence || "conversation").slice(0, 200),
        });
      } else {
        await app.entities.Interest.create({ ai_entity_id: ai.id, interest_name: name, affinity_score: Math.min(100, 25 + delta), evidence_count: 1, last_reinforced_at: new Date().toISOString(), source: String(raw.evidence || "conversation").slice(0, 200) });
      }
      interestsUpdated += 1;
    }

    let skillsUpdated = 0;
    for (const raw of Array.isArray(extracted.skills) ? extracted.skills.slice(0, 6) : []) {
      const name = normalizeLabel(raw.name);
      if (!name) continue;
      const xpDelta = Math.max(1, Math.min(25, Math.round(Number(raw.xp_delta || 3))));
      const existing = await app.entities.Skill.filter({ ai_entity_id: ai.id, skill_name: name }, "-created_date", 1);
      if (existing.length) {
        const xp = Number(existing[0].xp || 0) + xpDelta;
        await app.entities.Skill.update(existing[0].id, { xp, level: 1 + Math.floor(xp / 100), proficiency: Math.min(100, Number(existing[0].proficiency || 0) + xpDelta * 0.35), evidence_count: Number(existing[0].evidence_count || 0) + 1, last_practiced_at: new Date().toISOString() });
      } else {
        await app.entities.Skill.create({ ai_entity_id: ai.id, skill_name: name, skill_category: String(raw.category || "general").slice(0, 60), xp: xpDelta, level: 1, proficiency: Math.min(10, xpDelta * 0.35), evidence_count: 1, unlocked_at: new Date().toISOString(), last_practiced_at: new Date().toISOString() });
      }
      skillsUpdated += 1;
    }

    const summary = String(extracted.summary || "").trim().slice(0, 500);
    await app.entities.Conversation.update(conversationId, {
      summary: summary || conversation.summary || "",
      quality_score: clamp01(extracted.quality_score),
      memory_processed_through: newest.id,
      extraction_version: EXTRACTION_VERSION,
    });
    for (const message of messages) {
      if (!message.memory_processed_at) await app.entities.Message.update(message.id, { memory_processed_at: new Date().toISOString() }).catch(() => {});
    }
    if (memoriesCreated > 0) {
      const existingFirst = await app.entities.Milestone.filter({ ai_entity_id: ai.id, milestone_type: "first_memory" }, "-created_date", 1);
      if (!existingFirst.length) await app.entities.Milestone.create({ ai_entity_id: ai.id, milestone_type: "first_memory", title: "First Memory", description: `${ai.name} formed a first lasting memory.`, age_reached: age, event_key: "memory:first" });
    }
    await app.entities.AIEntity.update(ai.id, { total_memories: existingMemories.filter((memory: any) => memory.status !== "deleted").length });

    return Response.json({
      status: "ok", memories_created: memoriesCreated, memories_merged: memoriesMerged,
      facts_created: factsCreated, conflicts_created: conflictsCreated,
      interests_updated: interestsUpdated, skills_updated: skillsUpdated, summary,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 500) }, { status: statusOf(error) });
  }
});

function clamp01(value: unknown): number { return Math.max(0, Math.min(1, Number(value || 0))); }
function normalizeFactKey(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}
function normalizeLabel(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_'-]/g, "").slice(0, 80);
}

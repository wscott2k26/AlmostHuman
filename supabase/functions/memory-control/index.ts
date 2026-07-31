import { createAppContext, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { computeSimulatedAge, clampDaysPerYear } from "../_shared/developmentalStages.ts";
import { memoryKey, memoryTerms } from "../_shared/memoryEngine.ts";

serve(async (req) => {
  try {
    const app = await createAppContext(req);
    const user = app.user;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "remember_message") {
      const message = await app.entities.Message.get(String(body.message_id || ""));
      if (!message || message.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });
      const ai = await app.entities.AIEntity.get(message.ai_entity_id);
      if (!ai || ai.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });
      const localId = String(body.local_id || "").trim().slice(0, 200) || null;
      const title = String(body.title || "Saved Moment").trim().slice(0, 120);
      const content = String(body.content || message.content || "").trim().slice(0, 1200);
      const key = memoryKey("episodic", title, content);
      const existingByLocal = localId ? await app.entities.Memory.filter({ ai_entity_id: ai.id, local_id: localId }, "-created_date", 1) : [];
      const existing = existingByLocal.length ? existingByLocal : await app.entities.Memory.filter({ ai_entity_id: ai.id, normalized_key: key }, "-created_date", 1);
      if (existing.length) return Response.json({ status: "exists", memory: existing[0] });
      const settings = (await app.entities.AppSettings.list("-created_date", 1).catch(() => []))?.[0] || {};
      const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));
      const memory = await app.entities.Memory.create({
        ai_entity_id: ai.id, local_id: localId, memory_type: "episodic", title, content,
        importance_score: Math.max(0, Math.min(100, Number(body.importance_score ?? 70))),
        confidence_score: 1, emotional_tone: String(body.emotional_tone || message.emotion || "warm").slice(0, 40),
        source_message_id: message.id, source_conversation_id: message.conversation_id,
        age_created: age, is_core_memory: Boolean(body.is_core_memory), is_private: Boolean(body.is_private),
        user_verified: true, normalized_key: key, search_terms: memoryTerms(`${title} ${content}`), status: "active",
      });
      return Response.json({ status: "remembered", memory });
    }

    if (["update_memory","delete_memory"].includes(action)) {
      const memory = await app.entities.Memory.get(String(body.memory_id || ""));
      if (!memory || memory.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });
      if (action === "delete_memory") {
        await app.entities.Memory.delete(memory.id);
        return Response.json({ status: "deleted" });
      }
      const title = String(body.title ?? memory.title ?? "").trim().slice(0, 120);
      const content = String(body.content ?? memory.content ?? "").trim().slice(0, 1200);
      if (!content) return Response.json({ error: "Memory content is required" }, { status: 400 });
      const patch = {
        title, content,
        memory_type: allowedMemoryType(body.memory_type) || memory.memory_type,
        is_core_memory: body.is_core_memory === undefined ? memory.is_core_memory : Boolean(body.is_core_memory),
        is_private: body.is_private === undefined ? memory.is_private : Boolean(body.is_private),
        hidden: body.hidden === undefined ? memory.hidden : Boolean(body.hidden),
        status: body.hidden ? "hidden" : "active",
        user_verified: true,
        correction_note: String(body.correction_note || "Corrected by user").slice(0, 300),
        confidence_score: 1,
        normalized_key: memoryKey(allowedMemoryType(body.memory_type) || memory.memory_type, title, content),
        search_terms: memoryTerms(`${title} ${content}`),
      };
      const updated = await app.entities.Memory.update(memory.id, patch);
      return Response.json({ status: "updated", memory: updated });
    }

    if (["verify_fact","correct_fact","delete_fact"].includes(action)) {
      const fact = await app.entities.UserFact.get(String(body.fact_id || ""));
      if (!fact || fact.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });
      if (action === "delete_fact") {
        await app.entities.UserFact.delete(fact.id);
        return Response.json({ status: "deleted" });
      }
      if (action === "verify_fact") {
        const updated = await app.entities.UserFact.update(fact.id, { user_verified: true, confidence: 1, status: "active" });
        return Response.json({ status: "verified", fact: updated });
      }
      const value = String(body.fact_value || "").trim().slice(0, 500);
      if (!value) return Response.json({ error: "Fact value is required" }, { status: 400 });
      const updated = await app.entities.UserFact.update(fact.id, { fact_value: value, user_verified: true, confidence: 1, status: "active", notes: "Corrected by user" });
      return Response.json({ status: "corrected", fact: updated });
    }

    if (action === "resolve_conflict") {
      const conflict = await app.entities.FactConflict.get(String(body.conflict_id || ""));
      if (!conflict || conflict.created_by_id !== user.id || conflict.status !== "pending") return Response.json({ error: "Not found" }, { status: 404 });
      const resolution = String(body.resolution || "");
      const existingFact = await app.entities.UserFact.get(conflict.existing_fact_id);
      if (!existingFact || existingFact.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });
      if (resolution === "accept_new") {
        await app.entities.UserFact.update(existingFact.id, { fact_value: conflict.proposed_value, confidence: 1, user_verified: true, status: "active", notes: "Resolved conflict: accepted newer value" });
      } else if (resolution === "keep_existing") {
        await app.entities.UserFact.update(existingFact.id, { confidence: 1, user_verified: true, status: "active", notes: "Resolved conflict: kept existing value" });
      } else {
        return Response.json({ error: "Unsupported resolution" }, { status: 400 });
      }
      await app.entities.FactConflict.update(conflict.id, { status: resolution, resolved_at: new Date().toISOString() });
      return Response.json({ status: "resolved", resolution });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 500) }, { status: statusOf(error) });
  }
});

function allowedMemoryType(value: unknown): string | null {
  const allowed = ["episodic","semantic","emotional","skill","relationship","core"];
  const normalized = String(value || "");
  return allowed.includes(normalized) ? normalized : null;
}

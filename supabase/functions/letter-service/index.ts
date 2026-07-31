import { createAppContext, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { computeSimulatedAge, clampDaysPerYear } from "../_shared/developmentalStages.ts";
import { entitlementsForTier, normalizeTier } from "../_shared/entitlements.ts";

serve(async (req) => {
  try {
    const app = await createAppContext(req);
    const user = app.user;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "create");
    const aiEntityId = String(body.ai_entity_id || "").trim();
    const localId = String(body.local_id || "").trim().slice(0, 200) || null;
    if (!aiEntityId) return Response.json({ error: "ai_entity_id required" }, { status: 400 });

    const ai = await app.entities.AIEntity.get(aiEntityId);
    if (!ai || ai.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });
    const settings = (await app.entities.AppSettings.list("-created_date", 1).catch(() => []))?.[0] || {};
    const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));

    if (action === "create") {
      const subscription = (await app.entities.Subscription.list("-created_date", 1).catch(() => []))?.[0];
      const tier = normalizeTier(subscription && ["active","trialing"].includes(subscription.status) ? subscription.tier : "free");
      if (!entitlementsForTier(tier).letters) return Response.json({ error: "Letters Through Time requires Plus or Legacy", code: "UPGRADE_REQUIRED" }, { status: 403 });
      const title = String(body.title || "A Letter Through Time").trim().slice(0, 100);
      const content = String(body.content || "").trim().slice(0, 6000);
      const unlockAge = Number(body.unlock_age);
      if (!content) return Response.json({ error: "Letter content is required" }, { status: 400 });
      if (!Number.isFinite(unlockAge) || unlockAge < age + 0.08 || unlockAge > age + 100) return Response.json({ error: "Choose a future age" }, { status: 400 });
      if (localId) {
        const existing = (await app.entities.Letter.filter({ ai_entity_id: aiEntityId, local_id: localId }, "-created_date", 1))[0];
        if (existing) return Response.json({ status: "sealed", letter_id: existing.id, unlock_age: existing.unlock_age, replayed: true });
      }
      const fromName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || "Your human";
      const letter = await app.entities.Letter.create({ ai_entity_id: aiEntityId, local_id: localId, title, content, unlock_age: unlockAge, from_name: fromName, sealed_at: new Date().toISOString(), delivered: false });
      return Response.json({ status: "sealed", letter_id: letter.id, unlock_age: unlockAge });
    }

    const letterId = String(body.letter_id || "").trim();
    let letter = letterId ? await app.entities.Letter.get(letterId).catch(() => null) : null;
    if (!letter && localId) letter = (await app.entities.Letter.filter({ ai_entity_id: aiEntityId, local_id: localId }, "-created_date", 1))[0] || null;
    if (!letter || letter.created_by_id !== user.id || letter.ai_entity_id !== aiEntityId) return Response.json({ error: "Not found" }, { status: 404 });

    if (action === "open") {
      if (age < Number(letter.unlock_age || Infinity)) return Response.json({ error: "This letter is still sealed", code: "LOCKED", unlock_age: letter.unlock_age }, { status: 403 });
      if (!letter.delivered) await app.entities.Letter.update(letter.id, { delivered: true, unlocked_at: new Date().toISOString(), opened_at: new Date().toISOString() });
      else if (!letter.opened_at) await app.entities.Letter.update(letter.id, { opened_at: new Date().toISOString() });
      return Response.json({ status: "opened", letter_id: letter.id, title: letter.title, content: letter.content, from_name: letter.from_name, unlock_age: letter.unlock_age });
    }
    if (action === "delete") {
      await app.entities.Letter.delete(letter.id);
      return Response.json({ status: "deleted", letter_id: letter.id });
    }
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 500) }, { status: statusOf(error) });
  }
});

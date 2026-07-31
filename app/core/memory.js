import { normalizeText, similarity } from './anti-repetition.js';

export function nowIso(now = Date.now()) { return new Date(now).toISOString(); }
export function makeId(prefix = 'id') { return `${prefix}_${cryptoId()}`; }
function cryptoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function memoryKey(content) {
  return normalizeText(content).replace(/\?/g, '').split(' ').slice(0, 24).join('_');
}

export function addOrMergeMemory(state, memory, now = Date.now()) {
  state.memories ||= [];
  const content = String(memory.content || '').trim();
  if (!content) return null;
  const key = memory.normalizedKey || memoryKey(content);
  const duplicate = state.memories.find((item) => item.normalizedKey === key || similarity(item.content, content) >= 0.82);
  if (duplicate) {
    duplicate.importance = Math.min(100, Math.max(Number(duplicate.importance || 0), Number(memory.importance || 50)) + 2);
    duplicate.confidence = Math.max(Number(duplicate.confidence || 0), Number(memory.confidence || 0.75));
    duplicate.reinforcedAt = nowIso(now);
    duplicate.reinforcementCount = Number(duplicate.reinforcementCount || 0) + 1;
    duplicate.hidden = false;
    return duplicate;
  }
  const record = {
    id: makeId('mem'), type: memory.type || 'episodic', title: memory.title || 'A shared moment', content,
    importance: Number(memory.importance ?? 55), confidence: Number(memory.confidence ?? 0.8), emotionalTone: memory.emotionalTone || 'neutral',
    isCore: Boolean(memory.isCore), isPrivate: Boolean(memory.isPrivate), hidden: false, normalizedKey: key,
    sourceMessageId: memory.sourceMessageId || null, ageCreated: Number(memory.ageCreated || 0), createdAt: nowIso(now), lastRecalledAt: null,
    reinforcementCount: 0, tags: [...new Set(memory.tags || [])]
  };
  state.memories.unshift(record);
  return record;
}

export function upsertFact(state, fact, now = Date.now()) {
  state.facts ||= [];
  state.factConflicts ||= [];
  const category = String(fact.category || 'general');
  const key = normalizeText(fact.key || fact.label || 'fact').replace(/\s+/g, '_');
  const value = String(fact.value || '').trim();
  if (!value) return null;
  const current = state.facts.find((item) => item.category === category && item.key === key && item.status !== 'archived');
  if (current && normalizeText(current.value) !== normalizeText(value)) {
    const conflict = state.factConflicts.find((item) => item.factId === current.id && item.status === 'pending' && normalizeText(item.proposedValue) === normalizeText(value));
    if (!conflict) state.factConflicts.unshift({ id: makeId('conflict'), factId: current.id, category, key, oldValue: current.value, proposedValue: value, status: 'pending', createdAt: nowIso(now) });
    return current;
  }
  if (current) {
    current.confidence = Math.max(current.confidence || 0, fact.confidence || 0.8);
    current.updatedAt = nowIso(now);
    return current;
  }
  const record = { id: makeId('fact'), category, key, label: fact.label || titleCase(key.replaceAll('_', ' ')), value, confidence: Number(fact.confidence || 0.8), verified: Boolean(fact.verified), status: 'active', createdAt: nowIso(now), updatedAt: nowIso(now) };
  state.facts.unshift(record);
  return record;
}

export function extractLearnings(text, { age = 0, sourceMessageId = null, now = Date.now() } = {}) {
  const value = String(text || '').trim();
  const facts = [];
  const memories = [];
  const interests = [];
  const rules = [
    { regex: /\bmy name is\s+([a-z][a-z '-]{1,40})/i, category: 'identity', key: 'name', label: 'Your name' },
    { regex: /\bcall me\s+([a-z][a-z '-]{1,40})/i, category: 'identity', key: 'preferred_name', label: 'What to call you' },
    { regex: /\bmy favorite (food|color|song|movie|book|game|animal) is\s+(.{1,80}?)(?=\s+(?:and\s+)?my\b|[.!?]|$)/i, dynamic: true },
    { regex: /\bi work (?:at|for)\s+(.{2,80})/i, category: 'work', key: 'workplace', label: 'Where you work' },
    { regex: /\bi live in\s+(.{2,80})/i, category: 'location', key: 'home_area', label: 'Where you live' },
    { regex: /\bmy birthday is\s+(.{2,60})/i, category: 'identity', key: 'birthday', label: 'Your birthday' },
    { regex: /\bmy (wife|husband|partner|girlfriend|boyfriend|mom|mother|dad|father|daughter|son|brother|sister) (?:is named|is|name is)\s+([a-z][a-z '-]{1,40})/i, relation: true },
  ];
  for (const rule of rules) {
    const match = value.match(rule.regex);
    if (!match) continue;
    if (rule.dynamic) {
      const kind = normalizeText(match[1]);
      const factValue = trimSentence(match[2]);
      facts.push({ category: 'favorites', key: `favorite_${kind}`, label: `Favorite ${kind}`, value: factValue, confidence: 0.9 });
      interests.push({ name: factValue, category: kind, affinity: 78 });
    } else if (rule.relation) {
      facts.push({ category: 'relationships', key: normalizeText(match[1]), label: titleCase(match[1]), value: trimSentence(match[2]), confidence: 0.88 });
    } else {
      facts.push({ category: rule.category, key: rule.key, label: rule.label, value: trimSentence(match[1]), confidence: 0.88 });
    }
  }
  for (const match of value.matchAll(/\bi (?:really )?(?:like|love|enjoy)\s+([^.!?]{2,70})/gi)) {
    const name = trimSentence(match[1]);
    if (!/^(you|it|that|this)$/i.test(name)) interests.push({ name, category: 'interest', affinity: /love/i.test(match[0]) ? 82 : 68 });
  }
  const emotional = /\b(i feel|felt|made me|i am|i'm)\s+(sad|happy|proud|scared|angry|lonely|excited|grateful|hurt|worried)/i.exec(value);
  const remember = /\bremember (?:that|this)?\s*(.{3,220})/i.exec(value);
  if (remember) memories.push({ type: 'semantic', title: 'You asked me to remember', content: trimSentence(remember[1]), importance: 82, confidence: 0.98, isCore: false, sourceMessageId, ageCreated: age, tags: ['user_requested'] });
  if (emotional) memories.push({ type: 'emotional', title: `A ${emotional[2].toLowerCase()} moment`, content: trimSentence(value), importance: 68, confidence: 0.78, emotionalTone: emotional[2].toLowerCase(), sourceMessageId, ageCreated: age, tags: ['emotion'] });
  return { facts, memories, interests };
}

export function applyLearnings(state, text, context = {}) {
  const extracted = extractLearnings(text, context);
  for (const fact of extracted.facts) upsertFact(state, fact, context.now);
  for (const memory of extracted.memories) addOrMergeMemory(state, memory, context.now);
  state.interests ||= [];
  for (const interest of extracted.interests) {
    const current = state.interests.find((item) => normalizeText(item.name) === normalizeText(interest.name));
    if (current) current.affinity = Math.min(100, Math.max(current.affinity || 0, interest.affinity) + 2);
    else state.interests.push({ id: makeId('interest'), ...interest, affinity: Number(interest.affinity || 60), createdAt: nowIso(context.now) });
  }
  return extracted;
}

export function relevantMemories(state, query, limit = 6) {
  const terms = new Set(normalizeText(query).split(' ').filter((term) => term.length > 2));
  return (state.memories || []).filter((memory) => !memory.hidden).map((memory) => {
    const haystack = normalizeText(`${memory.title} ${memory.content} ${(memory.tags || []).join(' ')}`);
    const overlap = [...terms].filter((term) => haystack.includes(term)).length;
    const recency = Math.max(0, 12 - ((Date.now() - new Date(memory.createdAt).getTime()) / 86_400_000)) / 12;
    const score = overlap * 18 + (memory.importance || 0) * 0.55 + (memory.isCore ? 25 : 0) + recency * 8;
    return { ...memory, _score: score };
  }).sort((a, b) => b._score - a._score).slice(0, limit);
}

export function resolveConflict(state, conflictId, choice) {
  const conflict = (state.factConflicts || []).find((item) => item.id === conflictId);
  if (!conflict) return null;
  const fact = (state.facts || []).find((item) => item.id === conflict.factId);
  if (fact && choice === 'new') { fact.value = conflict.proposedValue; fact.updatedAt = nowIso(); fact.verified = true; }
  if (fact && choice === 'old') fact.verified = true;
  conflict.status = 'resolved'; conflict.resolution = choice; conflict.resolvedAt = nowIso();
  return fact;
}

function trimSentence(value) { return String(value || '').trim().replace(/[.,!?]+$/, '').trim(); }
function titleCase(value) { return String(value || '').replace(/\b\w/g, (c) => c.toUpperCase()); }

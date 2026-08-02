import { getStage } from '../core/stages.js';

const ARCHITECTURE_BY_STAGE = Object.freeze({
  newborn: 'first-nest',
  infant: 'forming-sanctuary',
  toddler: 'forming-sanctuary',
  early_child: 'curiosity-loft',
  child: 'curiosity-loft',
  preteen: 'refined-studio',
  teen: 'refined-studio',
  young_adult: 'living-archive',
  adult: 'living-archive',
});

const LIGHTING_BY_MOOD = Object.freeze({
  wonder: { palette: 'dawn-spectrum', intensity: 0.74, warmth: 0.62 },
  curious: { palette: 'violet-amber', intensity: 0.8, warmth: 0.58 },
  happy: { palette: 'sunlit-coral', intensity: 0.9, warmth: 0.82 },
  playful: { palette: 'prismatic-pop', intensity: 0.94, warmth: 0.72 },
  thoughtful: { palette: 'indigo-lantern', intensity: 0.62, warmth: 0.46 },
  calm: { palette: 'moonlit-sage', intensity: 0.56, warmth: 0.52 },
  sad: { palette: 'rain-blue', intensity: 0.42, warmth: 0.32 },
  worried: { palette: 'storm-amber', intensity: 0.5, warmth: 0.44 },
  confident: { palette: 'gold-obsidian', intensity: 0.82, warmth: 0.68 },
  mysterious: { palette: 'violet-shadow', intensity: 0.58, warmth: 0.38 },
});

export function createHavenEnvironment10(state = {}, selectedId = null) {
  const ai = state.ai || {};
  const stageKey = String(ai.stageKey || ai.developmentalStage || getStage(Number(ai.age || ai.simulatedAge || 0)).key);
  const mood = String(ai.currentMood || 'wonder');
  const items = (Array.isArray(state.roomItems) ? state.roomItems : [])
    .filter((item) => item?.isUnlocked !== false && item?.placed !== false)
    .map((item, index) => normalizeItem(item, index));
  const selected = selectedId ? items.find((item) => item.id === selectedId) || null : null;
  const lighting = LIGHTING_BY_MOOD[mood] || { ...LIGHTING_BY_MOOD.wonder };

  return Object.freeze({
    architecture: ARCHITECTURE_BY_STAGE[stageKey] || 'first-nest',
    stageKey,
    lighting: Object.freeze({ mood, ...lighting }),
    atmosphere: Object.freeze({
      breath: mood === 'calm' || mood === 'thoughtful' ? 'slow' : mood === 'playful' || mood === 'happy' ? 'bright' : 'steady',
      weather: mood === 'sad' ? 'soft-rain' : mood === 'worried' ? 'distant-storm' : 'clear',
      particleDensity: stageKey === 'newborn' ? 0.9 : stageKey === 'adult' ? 0.3 : 0.55,
    }),
    layers: Object.freeze([
      Object.freeze({ key: 'background', depth: 0.08 }),
      Object.freeze({ key: 'architecture', depth: 0.18 }),
      Object.freeze({ key: 'objects', depth: 0.34 }),
      Object.freeze({ key: 'companion', depth: 0.5 }),
      Object.freeze({ key: 'foreground', depth: 0.72 }),
    ]),
    items: Object.freeze(items),
    selected,
    details: Object.freeze({
      interests: visibleNames(state.interests, ['interestName', 'name']).slice(0, 3),
      milestones: visibleNames(state.milestones, ['title']).slice(0, 3),
      memories: (Array.isArray(state.memories) ? state.memories : []).filter((item) => item?.hidden !== true && item?.status !== 'hidden').slice(0, 3).map((item) => String(item.title || item.content || '')).filter(Boolean),
      activities: visibleNames(state.activities, ['title', 'activityType']).slice(0, 3),
    }),
  });
}

function normalizeItem(item, index) {
  const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  return Object.freeze({
    ...item,
    id: String(item.id || item.localId || `haven-item-${index}`),
    name: String(item.name || item.itemName || 'Keepsake'),
    story: factualStory(item, metadata),
    scenePosition: Object.freeze(item.position && typeof item.position === 'object' && Object.keys(item.position).length
      ? { ...item.position }
      : { anchor: index % 8, x: 12 + ((index * 17) % 72), y: 62 + ((index * 11) % 24) }),
  });
}

function factualStory(item, metadata) {
  return String(item.story || metadata.story || metadata.history || item.source || 'No history has been recorded for this object yet.');
}

function visibleNames(value, keys) {
  return (Array.isArray(value) ? value : []).map((item) => {
    for (const key of keys) if (item?.[key]) return String(item[key]);
    return '';
  }).filter(Boolean);
}

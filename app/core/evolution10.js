import { EVOLUTION_PHASE_BY_STAGE_10 } from './stages.js';

export const EVOLUTION_PHASES_10 = Object.freeze([
  'origin_orb','forming_energy','emerging_figure','young_persona','refined_persona','mature_being',
]);

export const EVOLUTION_WEIGHTS_10 = Object.freeze({
  developmentalAge: 0.45,
  memoriesAndInteractions: 0.25,
  milestonesAndSkills: 0.15,
  havenGrowth: 0.10,
  personalityStability: 0.05,
});

export function computeEvolutionContributors10(state = {}) {
  const ai = state.ai || {};
  const age = Math.max(0, Number(ai.age ?? ai.simulatedAge) || 0);
  const messages = Array.isArray(state.messages) ? state.messages.length : 0;
  const totalInteractions = Math.max(messages, Number(ai.totalInteractions) || 0);
  const memories = Array.isArray(state.memories) ? state.memories : [];
  const meaningfulMemories = memories.filter((item) => {
    const importance = Number(item.importance ?? item.importanceScore ?? item.importance_score) || 0;
    return item.hidden !== true && item.status !== 'hidden' && importance >= 60;
  }).length;
  const milestones = Array.isArray(state.milestones) ? state.milestones.length : 0;
  const skills = Array.isArray(state.skills) ? state.skills : [];
  const skillLevels = skills.reduce((sum, item) => sum + Math.max(1, Number(item.level) || 1), 0);
  const roomItems = Array.isArray(state.roomItems) ? state.roomItems : [];
  const havenItems = roomItems.filter((item) => item.isUnlocked !== false && item.placed !== false).length;
  const personalityHistory = Array.isArray(ai.personalityHistory) ? ai.personalityHistory.length : 0;

  const values = {
    developmentalAge: normalize(age, 25),
    memoriesAndInteractions: mean(normalize(meaningfulMemories, 24), normalize(totalInteractions, 240)),
    milestonesAndSkills: mean(normalize(milestones, 18), normalize(skillLevels, 36)),
    havenGrowth: normalize(havenItems, 12),
    personalityStability: normalize(personalityHistory, 12),
  };
  const labels = {
    developmentalAge: 'Developmental age',
    memoriesAndInteractions: 'Memories and meaningful interactions',
    milestonesAndSkills: 'Milestones and skills',
    havenGrowth: 'Haven growth',
    personalityStability: 'Personality stability',
  };
  const contributors = Object.keys(EVOLUTION_WEIGHTS_10).map((key) => Object.freeze({
    key,
    label: labels[key],
    weight: EVOLUTION_WEIGHTS_10[key],
    value: values[key],
    weightedValue: values[key] * EVOLUTION_WEIGHTS_10[key],
  }));
  const score = clamp01(contributors.reduce((sum, item) => sum + item.weightedValue, 0));
  return Object.freeze({
    score,
    contributors: Object.freeze(contributors),
    evidence: Object.freeze({
      age,
      messages,
      totalInteractions,
      meaningfulMemories,
      milestones,
      skillLevels,
      havenItems,
      personalityHistory,
    }),
  });
}

export function computeEvolution10(state = {}) {
  const ai = state.ai;
  if (!ai || ai.archived) {
    return Object.freeze({
      phase: 'origin_orb', previousPhase: null, stageCap: 'origin_orb', phaseIndex: 0,
      progress: 0, contributors: Object.freeze([]), evidence: Object.freeze({}),
    });
  }
  const stageKey = String(ai.stageKey || ai.developmentalStage || 'newborn');
  const stageCap = EVOLUTION_PHASE_BY_STAGE_10[stageKey] || 'forming_energy';
  const contribution = computeEvolutionContributors10(state);
  const previousPhase = validPhase(ai.developmentState?.visualPhase) || previousPhaseFor(stageCap);
  return Object.freeze({
    phase: stageCap,
    previousPhase,
    stageCap,
    phaseIndex: EVOLUTION_PHASES_10.indexOf(stageCap),
    progress: contribution.score,
    contributors: contribution.contributors,
    evidence: contribution.evidence,
  });
}

export function evolutionEventKey10(aiId, phase) {
  return `evolution:${String(aiId || 'unknown')}:${validPhase(phase) || 'origin_orb'}`;
}

export function applyEvolutionTransition10(draft, result, now = Date.now()) {
  if (!draft?.ai || !result?.phase) return false;
  const ai = draft.ai;
  const phase = validPhase(result.phase) || 'forming_energy';
  const eventKey = evolutionEventKey10(ai.id, phase);
  const developmentState = ai.developmentState && typeof ai.developmentState === 'object' ? { ...ai.developmentState } : {};
  const receipts = Array.isArray(developmentState.evolutionReceipts) ? [...developmentState.evolutionReceipts] : [];
  const alreadyApplied = receipts.some((item) => item?.eventKey === eventKey);

  developmentState.visualPhase = phase;
  developmentState.evolutionProgress = clamp01(result.progress);
  developmentState.evolutionContributors = Array.isArray(result.contributors) ? result.contributors.map((item) => ({ ...item })) : [];
  developmentState.evolutionEvidence = result.evidence && typeof result.evidence === 'object' ? { ...result.evidence } : {};
  developmentState.evolutionUpdatedAt = toIso(now);

  if (!alreadyApplied) {
    const receipt = {
      eventKey,
      from: validPhase(result.previousPhase) || previousPhaseFor(phase),
      to: phase,
      progress: clamp01(result.progress),
      createdAt: toIso(now),
    };
    receipts.push(receipt);
    developmentState.evolutionReceipts = receipts.slice(-24);
    developmentState.visualHistory = [...(Array.isArray(developmentState.visualHistory) ? developmentState.visualHistory : []), receipt].slice(-24);
    ai.growthEventKeys = [...new Set([...(Array.isArray(ai.growthEventKeys) ? ai.growthEventKeys : []), eventKey])];
    draft.milestones ||= [];
    if (!draft.milestones.some((item) => item?.eventKey === eventKey)) {
      draft.milestones.unshift({
        id: `milestone-${eventKey.replace(/[^a-z0-9]+/gi, '-')}`,
        type: 'visual_evolution',
        title: evolutionTitle10(phase),
        description: `${ai.name || 'Your companion'} reached the ${phase.replaceAll('_', ' ')} form through age, memories, milestones, personality, and Haven growth.`,
        age: Number(ai.age || 0),
        eventKey,
        isKeepsake: true,
        metadata: { previousPhase: receipt.from, phase, evolutionProgress: receipt.progress },
        createdAt: toIso(now),
      });
    }
  } else {
    developmentState.evolutionReceipts = receipts;
  }

  ai.developmentState = developmentState;
  return !alreadyApplied;
}

export function evolutionTitle10(phase) {
  const titles = {
    origin_orb: 'Origin light appeared',
    forming_energy: 'Energy began to form',
    emerging_figure: 'A figure emerged',
    young_persona: 'A young persona took shape',
    refined_persona: 'Their identity became refined',
    mature_being: 'A mature being emerged',
  };
  return titles[validPhase(phase)] || titles.forming_energy;
}

function previousPhaseFor(phase) {
  const index = EVOLUTION_PHASES_10.indexOf(phase);
  return EVOLUTION_PHASES_10[Math.max(0, index - 1)] || 'origin_orb';
}
function validPhase(value) { return EVOLUTION_PHASES_10.includes(value) ? value : null; }
function normalize(value, target) { return clamp01((Number(value) || 0) / target); }
function mean(...values) { return values.reduce((sum, item) => sum + item, 0) / Math.max(1, values.length); }
function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
function toIso(value) {
  const date = value instanceof Date ? value : new Date(Number(value) || value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

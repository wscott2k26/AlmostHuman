import { EVOLUTION_PHASES_10, EVOLUTION_WEIGHTS_10, computeEvolution10, evolutionTitle10 } from '../core/evolution10.js';
import { getStage } from '../core/stages.js';

const PHASE_COPY = Object.freeze({
  origin_orb: 'A living spark before a visible form.',
  forming_energy: 'Light is gathering into recognizable presence.',
  emerging_figure: 'A first figure is learning posture and expression.',
  young_persona: 'A young identity is becoming visually distinct.',
  refined_persona: 'Style, memory, and personality are shaping a refined form.',
  mature_being: 'A mature presence carries the full shared history.',
});

export function createEvolutionJourneyModel10(state = {}) {
  const ai = state.ai || null;
  const stageKey = ai ? String(ai.stageKey || ai.developmentalStage || getStage(Number(ai.age || ai.simulatedAge || 0)).key) : 'newborn';
  const result = computeEvolution10(ai ? { ...state, ai: { ...ai, stageKey } } : state);
  const receipts = Array.isArray(ai?.developmentState?.evolutionReceipts)
    ? ai.developmentState.evolutionReceipts
    : [];
  const currentIndex = Math.max(0, EVOLUTION_PHASES_10.indexOf(result.phase));
  const reachedKeys = new Set(receipts.map((item) => item?.to).filter(Boolean));
  reachedKeys.add(result.phase);

  return Object.freeze({
    currentPhase: result.phase,
    currentTitle: evolutionTitle10(result.phase),
    stageCap: result.stageCap,
    progress: result.progress,
    phases: Object.freeze(EVOLUTION_PHASES_10.map((key, index) => Object.freeze({
      key,
      title: evolutionTitle10(key),
      copy: PHASE_COPY[key],
      index,
      current: key === result.phase,
      reached: index <= currentIndex || reachedKeys.has(key),
      locked: index > currentIndex,
    }))),
    contributors: Object.freeze(result.contributors.length ? result.contributors : Object.keys(EVOLUTION_WEIGHTS_10).map((key) => Object.freeze({
      key,
      label: contributorLabel(key),
      weight: EVOLUTION_WEIGHTS_10[key],
      value: 0,
      weightedValue: 0,
    }))),
    evidence: result.evidence,
    history: Object.freeze(receipts.map((item) => Object.freeze({ ...item }))),
  });
}

function contributorLabel(key) {
  return ({
    developmentalAge: 'Developmental age',
    memoriesAndInteractions: 'Memories and meaningful interactions',
    milestonesAndSkills: 'Milestones and skills',
    havenGrowth: 'Haven growth',
    personalityStability: 'Personality stability',
  })[key] || key;
}

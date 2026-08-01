import { getStage, nextStage } from '../core/stages.js';
export function growthModel9(state = {}) {
  const age = Number(state.ai?.age || 0);
  const stage = getStage(age);
  const next = nextStage(age);
  return {
    stage: { key: stage.key, label: stage.label, age },
    recentChange: state.milestones?.[0] || null,
    nextAbility: next ? { stage: next.label, startsAt: next.min } : { stage: 'Adult refinement', startsAt: null },
    activities: (state.activities || []).slice(0, 4),
  };
}

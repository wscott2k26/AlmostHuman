const ACTIVITY_STATES = Object.freeze(['idle','listening','thinking','speaking','first-light','evolving']);
const PHASE_SCALE = Object.freeze({
  origin_orb: 0.72, forming_energy: 0.78, emerging_figure: 0.86,
  young_persona: 0.94, refined_persona: 1, mature_being: 1.06,
});
const MOOD_AMPLITUDE = Object.freeze({
  wonder: 1.08, curious: 1.04, happy: 1.12, playful: 1.18, thoughtful: 0.76,
  calm: 0.62, sad: 0.52, worried: 0.68, confident: 0.9, mysterious: 0.7,
});

export function motionModel10({ phase = 'forming_energy', mood = 'wonder', activityState = 'idle', reducedMotion = false } = {}) {
  if (reducedMotion) {
    return Object.freeze({
      state: 'static', motion: 'static', breathMs: 0, driftPx: 0, gazeDegrees: 0,
      expressionAmplitude: 0, transitionMs: 0, particleRate: 0,
    });
  }
  const state = ACTIVITY_STATES.includes(activityState) ? activityState : 'idle';
  const phaseScale = PHASE_SCALE[phase] || 1;
  const moodScale = MOOD_AMPLITUDE[mood] || 0.9;
  const activity = {
    idle: { breath: 4300, drift: 4, gaze: 2, expression: 0.35, transition: 620, particles: 0.35 },
    listening: { breath: 3500, drift: 3, gaze: 5, expression: 0.58, transition: 360, particles: 0.52 },
    thinking: { breath: 3900, drift: 5, gaze: 8, expression: 0.48, transition: 520, particles: 0.45 },
    speaking: { breath: 3100, drift: 4, gaze: 3, expression: 0.82, transition: 260, particles: 0.62 },
    'first-light': { breath: 2200, drift: 8, gaze: 0, expression: 1, transition: 920, particles: 1 },
    evolving: { breath: 2500, drift: 10, gaze: 0, expression: 0.9, transition: 1100, particles: 1 },
  }[state];
  return Object.freeze({
    state,
    motion: `${state}-${phase}`,
    breathMs: Math.round(activity.breath / phaseScale),
    driftPx: round(activity.drift * moodScale * phaseScale),
    gazeDegrees: round(activity.gaze * moodScale),
    expressionAmplitude: round(activity.expression * moodScale),
    transitionMs: activity.transition,
    particleRate: round(activity.particles * phaseScale),
  });
}

function round(value) { return Math.round(value * 100) / 100; }

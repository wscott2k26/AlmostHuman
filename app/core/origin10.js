export const ORIGIN_MATERIALS_10 = Object.freeze(['luminous-resin','crystal','soft-light','polished-metal','warm-stone']);
export const ORIGIN_CORE_COLORS_10 = Object.freeze(['ember','gold','ocean','rose','violet','aurora']);
export const ORIGIN_SPECTRAL_COLORS_10 = Object.freeze(['violet','cyan','rose','gold','emerald','silver']);
export const ORIGIN_PARTICLES_10 = Object.freeze(['drift','orbit','spark','ribbon','mist']);
export const ORIGIN_PULSES_10 = Object.freeze(['breathing','steady','heartbeat','tide']);
export const ORIGIN_TEMPERAMENTS_10 = Object.freeze(['curious','calm','playful','thoughtful','confident','mysterious']);
export const FIRST_LIGHT_PHASES_10 = Object.freeze(['stabilize','ribbons','trace','emerge','awaken','speak','haven']);

const FULL_DURATION_MS = 7200;
const REDUCED_DURATION_MS = 1100;
const PHASE_WEIGHTS = Object.freeze([0.12, 0.16, 0.17, 0.20, 0.12, 0.11, 0.12]);

export function normalizeOrigin10(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    materialFamily: allowed(input.materialFamily, ORIGIN_MATERIALS_10, 'luminous-resin'),
    coreColor: allowed(input.coreColor, ORIGIN_CORE_COLORS_10, 'ember'),
    spectralColor: allowed(input.spectralColor, ORIGIN_SPECTRAL_COLORS_10, 'violet'),
    particleBehavior: allowed(input.particleBehavior, ORIGIN_PARTICLES_10, 'drift'),
    pulseRhythm: allowed(input.pulseRhythm, ORIGIN_PULSES_10, 'breathing'),
    motionTemperament: allowed(input.motionTemperament, ORIGIN_TEMPERAMENTS_10, 'curious'),
    createdAt: validTime(input.createdAt),
    firstLightCompletedAt: validTime(input.firstLightCompletedAt),
  };
}

export function createFirstLightMachine10({ reducedMotion = false, startedAt = Date.now() } = {}) {
  const durationMs = reducedMotion ? REDUCED_DURATION_MS : FULL_DURATION_MS;
  const boundaries = cumulativeBoundaries(durationMs);
  return Object.freeze({
    phases: FIRST_LIGHT_PHASES_10,
    durationMs,
    startedAt: Number(startedAt) || 0,
    reducedMotion: Boolean(reducedMotion),
    phaseAt(elapsedMs = 0) {
      const elapsed = Math.max(0, Number(elapsedMs) || 0);
      if (elapsed >= durationMs) {
        return Object.freeze({ key: 'haven', index: FIRST_LIGHT_PHASES_10.length - 1, progress: 1, phaseProgress: 1, complete: true });
      }
      const index = boundaries.findIndex((boundary) => elapsed < boundary.end);
      const safeIndex = index < 0 ? FIRST_LIGHT_PHASES_10.length - 1 : index;
      const boundary = boundaries[safeIndex];
      const phaseProgress = boundary.end === boundary.start ? 1 : (elapsed - boundary.start) / (boundary.end - boundary.start);
      return Object.freeze({
        key: FIRST_LIGHT_PHASES_10[safeIndex],
        index: safeIndex,
        progress: elapsed / durationMs,
        phaseProgress: Math.max(0, Math.min(1, phaseProgress)),
        complete: false,
      });
    },
  });
}

function cumulativeBoundaries(durationMs) {
  let cursor = 0;
  return PHASE_WEIGHTS.map((weight, index) => {
    const start = cursor;
    cursor = index === PHASE_WEIGHTS.length - 1 ? durationMs : cursor + Math.round(durationMs * weight);
    return Object.freeze({ start, end: cursor });
  });
}

function allowed(value, options, fallback) { return options.includes(value) ? value : fallback; }
function validTime(value) { return typeof value === 'string' && value.trim() ? value : null; }

import { APPEARANCE_FIELDS_10, normalizeAppearance10 } from '../core/appearance10.js';
import { EVOLUTION_PHASES_10 } from '../core/evolution10.js';
import { normalizeOrigin10 } from '../core/origin10.js';
import { materialTokens10 } from './materials10.js';
import { appearanceVisualTokens10 } from './appearanceVisual10.js';
import { motionModel10 } from './motion10.js';

let renderSerial10 = 0;

export function renderOriginOrb10(model = {}) {
  const origin = normalizeOrigin10(model.origin);
  const phase = validPhase(model.evolution?.phase) || 'origin_orb';
  const motion = motionModel10({ phase, mood: model.mood, activityState: model.activityState, reducedMotion: model.reducedMotion });
  const material = materialTokens10(origin, { mood: model.mood, reducedTransparency: model.reducedTransparency });
  const label = escapeAttribute(model.label || `${model.name || 'Companion'} origin light`);
  const particles = Array.from({ length: 8 }, (_, index) => `<i style="--particle:${index}" aria-hidden="true"></i>`).join('');
  return `<div class="v10-origin-orb material-${safeToken(material.material)}" role="img" aria-label="${label}" data-phase="${phase}" data-material="${safeToken(origin.materialFamily)}" data-core-color="${safeToken(origin.coreColor)}" data-spectral-color="${safeToken(origin.spectralColor)}" data-particles="${safeToken(origin.particleBehavior)}" data-pulse="${safeToken(origin.pulseRhythm)}" data-temperament="${safeToken(origin.motionTemperament)}" data-activity="${safeToken(motion.state)}" data-motion="${safeToken(motion.motion)}" style="${styleVariables({ ...material.cssVars, '--v10-breath-ms': `${motion.breathMs}ms`, '--v10-drift-px': `${motion.driftPx}px`, '--v10-particle-rate': motion.particleRate })}"><span class="v10-orb-shadow" aria-hidden="true"></span><span class="v10-orb-shell" aria-hidden="true"><b class="v10-orb-core"></b><em class="v10-orb-spark"></em><span class="v10-orb-rings"><i></i><i></i><i></i></span></span><span class="v10-orb-particles" aria-hidden="true">${particles}</span></div>`;
}

export function renderCompanion10(model = {}) {
  const appearance = normalizeAppearance10(model.appearance);
  const origin = normalizeOrigin10(model.origin);
  const phase = validPhase(model.evolution?.phase) || 'forming_energy';
  const motion = motionModel10({ phase, mood: model.mood, activityState: model.activityState, reducedMotion: model.reducedMotion });
  const material = materialTokens10(origin, { mood: model.mood, reducedTransparency: model.reducedTransparency });
  const appearanceTokens = appearanceVisualTokens10(appearance);
  const name = String(model.name || 'Companion');
  const label = escapeAttribute(model.label || `${name}, ${phase.replaceAll('_', ' ')}`);
  const attributes = APPEARANCE_FIELDS_10.map((field) => `data-${kebab(field)}="${escapeAttribute(appearance[field])}"`).join(' ');
  const style = styleVariables({
    ...material.cssVars,
    ...appearanceTokens,
    '--v10-breath-ms': `${motion.breathMs}ms`,
    '--v10-drift-px': `${motion.driftPx}px`,
    '--v10-gaze-deg': `${motion.gazeDegrees}deg`,
    '--v10-expression': motion.expressionAmplitude,
    '--v10-transition-ms': `${motion.transitionMs}ms`,
    '--v10-particle-rate': motion.particleRate,
  });
  const renderId = nextRenderId10(model.aiEntityId || name);
  const bodyGradientId = `${renderId}-body`;
  const faceGradientId = `${renderId}-face`;
  const glowFilterId = `${renderId}-glow`;
  return `<div class="v10-character material-${safeToken(material.material)} phase-${safeToken(phase)} mood-${safeToken(model.mood || 'wonder')}" role="img" aria-label="${label}" data-name="${escapeAttribute(name)}" data-presentation="${safeToken(model.presentation || 'neutral')}" data-phase="${phase}" data-activity="${safeToken(motion.state)}" data-motion="${safeToken(motion.motion)}" data-transparency="${material.transparencyMode}" ${attributes} style="${style}"><span class="v10-character-shadow" aria-hidden="true"></span><span class="v10-character-aura" aria-hidden="true"></span><svg class="v10-being-svg" viewBox="0 0 360 520" aria-hidden="true" focusable="false"><defs><linearGradient id="${bodyGradientId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--v10-core-light)" stop-opacity=".58"/><stop offset=".48" stop-color="var(--v10-material-body)"/><stop offset="1" stop-color="var(--v10-spectral-light)" stop-opacity=".28"/></linearGradient><radialGradient id="${faceGradientId}" cx="35%" cy="24%"><stop offset="0" stop-color="var(--v10-skin-highlight)"/><stop offset=".48" stop-color="var(--v10-skin)"/><stop offset="1" stop-color="var(--v10-skin-shadow)"/></radialGradient><filter id="${glowFilterId}"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g class="v10-energy-trace" filter="url(#${glowFilterId})"><path d="M180 42 C126 60 96 115 102 174 C75 214 67 287 84 371 C103 455 144 492 180 500 C216 492 257 455 276 371 C293 287 285 214 258 174 C264 115 234 60 180 42Z" fill="none" stroke="var(--v10-spectral-light)" stroke-width="3" stroke-dasharray="8 12"/></g><g class="v10-body-layer"><path class="v10-torso" d="M82 492 C91 396 110 354 145 331 L215 331 C250 354 269 396 278 492Z" fill="url(#${bodyGradientId})"/><path class="v10-outfit-panel" d="M118 482 L137 358 Q180 385 223 358 L242 482Z" fill="var(--v10-outfit)" opacity=".86"/><path class="v10-neck" d="M154 303 Q180 321 206 303 L208 356 Q180 372 152 356Z" fill="url(#${faceGradientId})"/></g><g class="v10-head-layer"><path class="v10-hair-back" d="M102 111 Q118 42 180 37 Q246 43 258 117 L244 263 Q220 312 180 319 Q138 312 114 263Z" fill="var(--v10-hair)"/><path class="v10-face-shape" d="M113 124 Q123 67 180 61 Q237 67 247 124 L240 231 Q230 286 180 309 Q130 286 120 231Z" fill="url(#${faceGradientId})"/><path class="v10-hair-front" d="M108 129 Q112 58 180 48 Q245 58 252 129 Q225 108 207 100 Q174 119 143 91 Q130 111 108 129Z" fill="var(--v10-hair)"/><g class="v10-brows" fill="none" stroke="var(--v10-brow)" stroke-linecap="round"><path d="M137 155 Q151 146 164 154"/><path d="M196 154 Q209 146 223 155"/></g><g class="v10-eyes"><path class="v10-eye v10-eye-left" d="M132 174 Q149 160 167 174 Q150 189 132 174Z" fill="var(--v10-eye-white)"/><path class="v10-eye v10-eye-right" d="M193 174 Q211 160 228 174 Q210 189 193 174Z" fill="var(--v10-eye-white)"/><circle cx="151" cy="174" r="7" fill="var(--v10-eye)"/><circle cx="210" cy="174" r="7" fill="var(--v10-eye)"/><circle cx="153" cy="172" r="2" fill="#fff"/><circle cx="212" cy="172" r="2" fill="#fff"/></g><path class="v10-nose" d="M181 177 Q173 211 181 220 Q188 217 191 220" fill="none" stroke="var(--v10-feature-shadow)" stroke-linecap="round"/><path class="v10-mouth" d="M158 248 Q180 260 202 248" fill="none" stroke="var(--v10-mouth)" stroke-width="4" stroke-linecap="round"/><path class="v10-facial-hair" d="M147 238 Q180 285 213 238 Q207 291 180 302 Q153 291 147 238Z" fill="var(--v10-hair)" opacity=".34"/></g><g class="v10-energy-seams" fill="none" stroke="var(--v10-luminous-border)" stroke-width="2" opacity=".68"><path d="M180 309 L180 480"/><path d="M123 383 Q180 410 237 383"/><path d="M126 126 Q180 92 234 126"/></g></svg><span class="v10-being-particles" aria-hidden="true">${Array.from({ length: 6 }, (_, index) => `<i style="--particle:${index}"></i>`).join('')}</span></div>`;
}

export function renderEvolutionFrame10(model = {}) {
  const phase = validPhase(model.evolution?.phase) || (model.evolution?.phase === 'origin_orb' ? 'origin_orb' : 'forming_energy');
  if (phase === 'origin_orb' || phase === 'forming_energy') return renderOriginOrb10({ ...model, evolution: { ...(model.evolution || {}), phase } });
  return renderCompanion10({ ...model, evolution: { ...(model.evolution || {}), phase } });
}

function nextRenderId10(value) {
  renderSerial10 = (renderSerial10 + 1) % Number.MAX_SAFE_INTEGER;
  return `v10-${safeToken(value)}-${renderSerial10}`;
}
function validPhase(value) { return EVOLUTION_PHASES_10.includes(value) ? value : null; }
function kebab(value) { return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`); }
function safeToken(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'default'; }
function escapeAttribute(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function styleVariables(values) {
  return Object.entries(values).map(([key, value]) => `${key}:${String(value).replace(/[;<>]/g, '')}`).join(';');
}

import { createVisualSnapshot10, normalizeAppearance10 } from '../core/appearance10.js';
import { normalizeOrigin10 } from '../core/origin10.js';
import { normalizeVoiceProfile10 } from '../core/voiceProfile10.js';

const HISTORY_PROMISE = 'Their history will stay exactly where it is.';
const PRESENTATIONS = Object.freeze(['masculine', 'feminine', 'neutral']);

export function createIdentityStudioModel10(state = {}, ui = {}) {
  const ai = state?.ai && !state.ai.archived ? state.ai : null;
  if (!ai) return Object.freeze({ available: false, historyPromise: HISTORY_PROMISE, ai: null });
  return Object.freeze({
    available: true,
    historyPromise: HISTORY_PROMISE,
    ai,
    presentation: ai.presentation || 'neutral',
    originProfile: normalizeOrigin10(ui.originProfile || ai.originProfile),
    appearanceProfile: normalizeAppearance10(ui.appearanceProfile || ai.appearanceProfile),
    voiceProfile: normalizeVoiceProfile10(ui.voiceProfile || ai.voiceProfile, ai.voiceId),
    snapshots: [...(ai.developmentState?.visualRollbackSnapshots || [])],
  });
}

export function createUpgradeMoment10(state = {}) {
  const ai = state?.ai && !state.ai.archived ? state.ai : null;
  const dismissed = Boolean(state?.settings?.tenUpgradeMomentDismissed);
  const eligible = Boolean(ai && Number(ai.rendererVersion || 9) < 10 && !dismissed);
  return Object.freeze({
    eligible,
    title: 'Your companion has learned to take fuller form.',
    body: 'Their memories, personality, age, and Haven remain exactly where they are.',
    primaryAction: 'See the new form',
    secondaryAction: 'Not now',
    ai,
  });
}

export function saveVisualIdentity10(draft, changes = {}, reason = 'user-edit', now = Date.now()) {
  const ai = activeAi(draft);
  const capturedAt = iso(now);
  const snapshot = createVisualSnapshot10(ai, {
    id: `visual-${ai.id}-${Number(now) || Date.now()}`,
    reason,
    capturedAt,
  });
  const developmentState = normalizeDevelopmentState(ai.developmentState);
  developmentState.visualRollbackSnapshots = [...developmentState.visualRollbackSnapshots, snapshot].slice(-12);
  developmentState.visualHistory = [...developmentState.visualHistory, {
    id: `visual-history-${ai.id}-${Number(now) || Date.now()}`,
    type: 'edit', reason: String(reason || 'user-edit'), at: capturedAt,
  }].slice(-40);

  if (PRESENTATIONS.includes(changes.presentation)) ai.presentation = changes.presentation;
  if (changes.originProfile) ai.originProfile = normalizeOrigin10({ ...ai.originProfile, ...changes.originProfile });
  if (changes.appearanceProfile) ai.appearanceProfile = normalizeAppearance10({ ...ai.appearanceProfile, ...changes.appearanceProfile });
  if (changes.voiceProfile) {
    ai.voiceProfile = normalizeVoiceProfile10({ ...ai.voiceProfile, ...changes.voiceProfile }, ai.voiceId);
    ai.voiceId = ai.voiceProfile.voiceId;
  }
  if (changes.appearanceSeed !== undefined) ai.appearanceSeed = String(changes.appearanceSeed || ai.appearanceSeed || 'ember');
  ai.rendererVersion = 10;
  ai.developmentState = developmentState;
  ai.updatedAt = capturedAt;
  return { changed: true, snapshot, ai };
}

export function rollbackVisualIdentity10(draft, snapshotId, now = Date.now()) {
  const ai = activeAi(draft);
  const developmentState = normalizeDevelopmentState(ai.developmentState);
  const snapshot = developmentState.visualRollbackSnapshots.find((item) => item.id === snapshotId);
  if (!snapshot || snapshot.aiEntityId !== ai.id) return false;

  ai.presentation = PRESENTATIONS.includes(snapshot.presentation) ? snapshot.presentation : ai.presentation || 'neutral';
  ai.appearanceSeed = snapshot.appearanceSeed || ai.appearanceSeed || 'ember';
  ai.originProfile = normalizeOrigin10(snapshot.originProfile);
  ai.appearanceProfile = normalizeAppearance10(snapshot.appearanceProfile);
  ai.voiceProfile = normalizeVoiceProfile10(snapshot.voiceProfile, snapshot.voiceProfile?.voiceId || ai.voiceId);
  ai.voiceId = ai.voiceProfile.voiceId;
  ai.rendererVersion = Math.max(9, Number(snapshot.rendererVersion) || 9);
  developmentState.visualHistory = [...developmentState.visualHistory, {
    id: `visual-history-${ai.id}-${Number(now) || Date.now()}`,
    type: 'rollback', snapshotId: snapshot.id, at: iso(now),
  }].slice(-40);
  ai.developmentState = developmentState;
  ai.updatedAt = iso(now);
  return true;
}

function activeAi(draft) {
  const ai = draft?.ai;
  if (!ai || ai.archived) throw new Error('An active companion is required.');
  return ai;
}

function normalizeDevelopmentState(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    ...input,
    evolutionReceipts: Array.isArray(input.evolutionReceipts) ? [...input.evolutionReceipts] : [],
    visualHistory: Array.isArray(input.visualHistory) ? [...input.visualHistory] : [],
    visualRollbackSnapshots: Array.isArray(input.visualRollbackSnapshots) ? [...input.visualRollbackSnapshots] : [],
  };
}
function iso(value) { return new Date(Number(value) || Date.now()).toISOString(); }

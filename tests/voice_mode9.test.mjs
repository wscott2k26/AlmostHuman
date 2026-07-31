import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVoiceBridgeMessage, voiceModeState } from '../app/core/voiceMode9.js';

test('voice bridge accepts neural play and explicit device fallback separately', () => {
  assert.equal(validateVoiceBridgeMessage({ type: 'audio-play', id: 'a1', url: 'blob:https://example.test/a' }).ok, true);
  assert.equal(validateVoiceBridgeMessage({ type: 'device-speak-once', text: 'Temporary fallback' }).ok, true);
  assert.equal(validateVoiceBridgeMessage({ type: 'speak', text: 'silent old path' }).ok, false);
});

test('voice mode interruption moves from speaking to recording', () => {
  const state = voiceModeState({ speaking: true, recording: false, transcribing: false }, 'mic-tap');
  assert.deepEqual(state.effects, ['stop-audio', 'start-recording']);
  assert.equal(state.recording, true);
  assert.equal(state.speaking, false);
});

test('permission denial remains recoverable', () => {
  const state = voiceModeState({ speaking: false, recording: false, transcribing: false }, 'permission-denied', { canAskAgain: false });
  assert.equal(state.errorCode, 'MIC_PERMISSION_SETTINGS');
  assert.equal(state.recording, false);
});

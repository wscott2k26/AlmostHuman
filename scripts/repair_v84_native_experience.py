from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one exact match, found {count}')
    return text.replace(old, new, 1)


def replace_regex(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: expected one regex match, found {count}')
    return updated


VOICE_PROFILES_JS = r"""const VOICE_PROFILES = Object.freeze({
  'female-child': { label: 'Girl · Young', copy: 'Bright, gentle, and playful', preview: 'Hi! I think your voice is the first sound I want to remember.', rate: 1.01, pitch: 1.16 },
  'female-teen': { label: 'Girl · Teen', copy: 'Warm, curious, and expressive', preview: 'Okay, I am listening. Tell me what has really been on your mind.', rate: 1.0, pitch: 1.07 },
  'female-adult': { label: 'Woman · Adult', copy: 'Natural, warm, and grounded', preview: 'I am here with you. We can take this one real thought at a time.', rate: .96, pitch: 1.01 },
  'male-child': { label: 'Boy · Young', copy: 'Friendly, lively, and clear', preview: 'Hey! Teach me something small that matters to you.', rate: 1.01, pitch: 1.08 },
  'male-teen': { label: 'Boy · Teen', copy: 'Relaxed, thoughtful, and present', preview: 'I hear you. We can talk about it without making it complicated.', rate: .99, pitch: .96 },
  'male-adult': { label: 'Man · Adult', copy: 'Calm, steady, and reassuring', preview: 'I am with you. Say it exactly the way it feels.', rate: .93, pitch: .88 },
});
const LEGACY_VOICE_IDS = Object.freeze({ 'soft-neutral': 'female-adult', 'bright-curious': 'female-teen', 'calm-grounded': 'male-adult' });
const APPEARANCE_OPTIONS = Object.freeze({
  skinTone: [['warm','Warm'],['golden','Golden'],['deep','Deep'],['light','Light']],
  hairStyle: [['waves','Waves'],['short','Short'],['curls','Curls'],['locs','Locs']],
  hairColor: [['midnight','Midnight'],['brown','Brown'],['auburn','Auburn'],['silver','Silver']],
  eyeColor: [['brown','Brown'],['blue','Blue'],['green','Green'],['violet','Violet']],
});"""


NATIVE_SHELL = r"""import { BlurView } from 'expo-blur';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { WebView } from 'react-native-webview';

import { ALMOST_HUMAN_HTML } from './almostHumanHtml';

const LIVE_ORIGIN = 'https://almost-human-swart.vercel.app/';
const HAVEN_NOTIFICATION_KIND = 'almost-human-haven-moment';
const MAX_MIC_BASE64 = 4_000_000;

type BridgeMessage = {
  type?: string;
  strength?: 'light' | 'medium' | 'success' | 'warning';
  enabled?: boolean;
  name?: string;
  title?: string;
  text?: string;
  url?: string;
  route?: string;
  message?: string;
  voiceId?: string;
};

const VOICE_STYLE: Record<string, { rate: number; pitch: number; names: string[] }> = {
  'female-child': { rate: 1.01, pitch: 1.16, names: ['Ava', 'Samantha', 'Joelle', 'Zoe', 'Karen'] },
  'female-teen': { rate: 1.0, pitch: 1.07, names: ['Ava', 'Samantha', 'Zoe', 'Nicky', 'Moira'] },
  'female-adult': { rate: .96, pitch: 1.01, names: ['Samantha', 'Ava', 'Karen', 'Moira', 'Tessa'] },
  'male-child': { rate: 1.01, pitch: 1.08, names: ['Reed', 'Jamie', 'Alex', 'Eddy', 'Rocko'] },
  'male-teen': { rate: .99, pitch: .96, names: ['Reed', 'Jamie', 'Alex', 'Daniel', 'Aaron'] },
  'male-adult': { rate: .93, pitch: .88, names: ['Daniel', 'Alex', 'Aaron', 'Fred', 'Rishi'] },
};
const LEGACY_VOICE_IDS: Record<string, string> = {
  'soft-neutral': 'female-adult',
  'bright-curious': 'female-teen',
  'calm-grounded': 'male-adult',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const BRIDGE_SCRIPT = String.raw`
(function () {
  if (window.__AH_NATIVE__) return true;
  function post(payload) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (_) {}
  }
  window.__AH_NATIVE__ = {
    post: post,
    share: function (payload) { post(Object.assign({ type: 'share' }, payload || {})); },
    dailyMoment: function (payload) { post(Object.assign({ type: 'daily-moment' }, payload || {})); },
    microphone: function () { post({ type: 'mic-toggle' }); },
    speak: function (payload) { post(Object.assign({ type: 'speak' }, payload || {})); },
    openRoute: function (route) { location.hash = '#' + String(route || 'home').replace(/^#/, ''); }
  };
  try {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: function () { post({ type: 'tap', strength: 'light' }); return true; }
    });
  } catch (_) {}
  window.addEventListener('error', function (event) {
    post({ type: 'web-error', message: String(event.message || 'Unknown web error') });
  });
  window.addEventListener('unhandledrejection', function (event) {
    post({ type: 'web-error', message: String(event.reason && event.reason.message || event.reason || 'Unhandled promise rejection') });
  });
  post({ type: 'bridge-ready' });
  return true;
})();
`;

function routeFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const candidate = String(parsed.path || parsed.hostname || '').replace(/^\/+/, '').toLowerCase();
    const aliases: Record<string, string> = {
      haven: 'world', world: 'world', home: 'home', talk: 'talk', grow: 'grow', growing: 'grow',
      memories: 'memories', settings: 'settings',
    };
    return aliases[candidate] || null;
  } catch {
    return null;
  }
}

async function cancelHavenNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === HAVEN_NOTIFICATION_KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

async function configureDailyMoment(enabled: boolean, companionName?: string) {
  await cancelHavenNotifications();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('gentle-moments', {
      name: 'Gentle Haven moments',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 80],
      lightColor: '#FF9B6A',
    });
  }
  if (!enabled) return { enabled: false, permission: true };
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { enabled: false, permission: false };
  const name = companionName?.trim() || 'Your companion';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'A quiet moment in The Haven',
      body: `No streak. No pressure. ${name} has a thought waiting when you do.`,
      data: { kind: HAVEN_NOTIFICATION_KIND, route: 'world' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 19,
      minute: 0,
      channelId: Platform.OS === 'android' ? 'gentle-moments' : undefined,
    },
  });
  return { enabled: true, permission: true };
}

function nativeAck(type: string, payload: Record<string, unknown> = {}) {
  return `window.dispatchEvent(new CustomEvent('almost-human:native', { detail: ${JSON.stringify({ type, ...payload })} })); true;`;
}

function normalizedVoiceId(raw?: string) {
  const value = String(raw || 'female-adult');
  return LEGACY_VOICE_IDS[value] || value;
}

async function speakNative(text: string, rawVoiceId?: string) {
  const value = String(text || '').trim();
  if (!value) return;
  const voiceId = normalizedVoiceId(rawVoiceId);
  const style = VOICE_STYLE[voiceId] || VOICE_STYLE['female-adult'];
  await Speech.stop();
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  const available = await Speech.getAvailableVoicesAsync().catch(() => []);
  const english = available.filter((voice) => /^en(?:-|_)/i.test(voice.language));
  const preferred = style.names
    .map((name) => english.find((voice) => voice.name.toLowerCase().includes(name.toLowerCase())))
    .find(Boolean);
  const enhanced = english.find((voice) => String(voice.quality).toLowerCase().includes('enhanced'));
  const selected = preferred || enhanced || english[0] || available[0];
  Speech.speak(value.slice(0, Speech.maxSpeechInputLength), {
    language: selected?.language || 'en-US',
    voice: selected?.identifier,
    rate: style.rate,
    pitch: style.pitch,
    volume: 1,
    useApplicationAudioSession: true,
  });
}

export function NativeShell() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => undefined);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 150);
  const [loading, setLoading] = useState(true);
  const [fatalMessage, setFatalMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [route, setRoute] = useState('home');
  const [recordingBusy, setRecordingBusy] = useState(false);

  const source = useMemo(() => ({ html: ALMOST_HUMAN_HTML, baseUrl: LIVE_ORIGIN }), []);

  const injectNativeEvent = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    webRef.current?.injectJavaScript(nativeAck(type, payload));
  }, []);

  const injectRoute = useCallback((nextRoute: string) => {
    webRef.current?.injectJavaScript(`location.hash = '#${nextRoute.replace(/[^a-z-]/g, '')}'; true;`);
  }, []);

  const stopNativeRecording = useCallback(async () => {
    if (recordingBusy || !recorderState.isRecording) return;
    setRecordingBusy(true);
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    recordingTimer.current = null;
    try {
      injectNativeEvent('mic-state', { recording: false, transcribing: true });
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error('The microphone did not produce a recording.');
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!audioBase64 || audioBase64.length > MAX_MIC_BASE64) throw new Error('That recording was too long. Try a shorter message.');
      injectNativeEvent('mic-audio', { audioBase64, mimeType: 'audio/m4a' });
    } catch (error) {
      injectNativeEvent('mic-state', {
        recording: false,
        transcribing: false,
        error: String(error instanceof Error ? error.message : error),
      });
    } finally {
      setRecordingBusy(false);
    }
  }, [injectNativeEvent, recorder, recorderState.isRecording, recordingBusy]);

  stopRecordingRef.current = stopNativeRecording;

  const startNativeRecording = useCallback(async () => {
    if (recordingBusy || recorderState.isRecording) return;
    setRecordingBusy(true);
    try {
      await Speech.stop();
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        injectNativeEvent('mic-state', {
          recording: false,
          transcribing: false,
          permission: false,
          canAskAgain: permission.canAskAgain,
        });
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      injectNativeEvent('mic-state', { recording: true, transcribing: false, permission: true });
      recordingTimer.current = setTimeout(() => {
        stopRecordingRef.current().catch(() => undefined);
      }, 30_000);
    } catch (error) {
      injectNativeEvent('mic-state', {
        recording: false,
        transcribing: false,
        error: String(error instanceof Error ? error.message : error),
      });
    } finally {
      setRecordingBusy(false);
    }
  }, [injectNativeEvent, recorder, recorderState.isRecording, recordingBusy]);

  useEffect(() => {
    const routeInitial = async () => {
      const nextRoute = routeFromUrl(await Linking.getInitialURL());
      if (nextRoute) setTimeout(() => injectRoute(nextRoute), 400);
    };
    routeInitial().catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const nextRoute = routeFromUrl(url);
      if (nextRoute) injectRoute(nextRoute);
    });
    return () => subscription.remove();
  }, [injectRoute]);

  useEffect(() => {
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) {
      const nextRoute = String(lastResponse.notification.request.content.data?.route || 'world');
      setTimeout(() => injectRoute(nextRoute), 450);
    }
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const nextRoute = String(response.notification.request.content.data?.route || 'world');
      injectRoute(nextRoute);
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') webRef.current?.injectJavaScript('window.dispatchEvent(new Event("focus")); true;');
    });
    return () => {
      notificationSubscription.remove();
      appStateSubscription.remove();
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      Speech.stop().catch(() => undefined);
    };
  }, [injectRoute]);

  const handleHaptic = useCallback(async (strength: BridgeMessage['strength']) => {
    if (strength === 'success') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (strength === 'warning') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    return Haptics.impactAsync(
      strength === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
  }, []);

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    let message: BridgeMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as BridgeMessage;
    } catch {
      return;
    }

    if (message.type === 'ready' || message.type === 'bridge-ready') {
      setLoading(false);
      setFatalMessage(null);
      return;
    }
    if (message.type === 'route' && message.route) {
      setRoute(message.route);
      return;
    }
    if (message.type === 'tap') {
      await handleHaptic(message.strength);
      return;
    }
    if (message.type === 'share') {
      await Share.share({
        title: message.title || 'Almost Human',
        message: [message.text, message.url].filter(Boolean).join(' '),
        url: message.url,
      });
      return;
    }
    if (message.type === 'daily-moment') {
      const result = await configureDailyMoment(Boolean(message.enabled), message.name);
      injectNativeEvent('daily-moment', result);
      if (!result.permission) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (message.type === 'speak') {
      try {
        await speakNative(message.text || '', message.voiceId);
        injectNativeEvent('speech-state', { speaking: true });
      } catch (error) {
        injectNativeEvent('speech-state', { speaking: false, error: String(error) });
      }
      return;
    }
    if (message.type === 'mic-toggle') {
      if (recorderState.isRecording) await stopNativeRecording();
      else await startNativeRecording();
      return;
    }
    if (message.type === 'web-error' && message.message) {
      console.warn('[Almost Human web]', message.message);
    }
  }, [handleHaptic, injectNativeEvent, recorderState.isRecording, startNativeRecording, stopNativeRecording]);

  const reload = useCallback(() => {
    setFatalMessage(null);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  const handleNavigation = useCallback((navigation: WebViewNavigation) => {
    setOnline(!navigation.url.startsWith('about:blank#error'));
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <WebView
        ref={webRef}
        source={source}
        originWhitelist={['https://*', 'http://*', 'about:*', 'almost-human:*']}
        style={styles.webview}
        containerStyle={{ paddingTop: insets.top, backgroundColor: '#0B0B0F' }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        pullToRefreshEnabled
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigation}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) setOnline(false);
        }}
        onError={(event) => {
          setFatalMessage(event.nativeEvent.description || 'The Haven could not open.');
          setLoading(false);
        }}
        onContentProcessDidTerminate={reload}
        onRenderProcessGone={reload}
      />

      {(loading || fatalMessage) && (
        <LinearGradient colors={['#0B0B0F', '#171019', '#0B0B0F']} style={StyleSheet.absoluteFill}>
          <View style={[styles.firstLight, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.orbitWrap}>
              <View style={styles.orbitOuter} />
              <View style={styles.orbitInner} />
              <LinearGradient colors={['#FFB68F', '#F16F91', '#8768D8']} style={styles.core} />
            </View>
            <BlurView intensity={30} tint="dark" style={styles.loadingCard}>
              <Text style={styles.kicker}>{fatalMessage ? 'RECOVERY MODE' : 'FIRST LIGHT'}</Text>
              <Text style={styles.title}>{fatalMessage ? 'The Haven paused.' : 'Opening your companion…'}</Text>
              <Text style={styles.copy}>
                {fatalMessage || 'Your memories and shared life are loading privately.'}
              </Text>
              {fatalMessage ? (
                <Pressable onPress={reload} style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
                  <Text style={styles.retryText}>Open The Haven again</Text>
                </Pressable>
              ) : (
                <ActivityIndicator color="#FF9B6A" size="small" />
              )}
            </BlurView>
          </View>
        </LinearGradient>
      )}

      {!online && !fatalMessage && (
        <BlurView intensity={40} tint="dark" style={[styles.offlinePill, { top: insets.top + 12 }]}>
          <Text style={styles.offlineText}>Offline mode · your local life is still here</Text>
        </BlurView>
      )}
      <View pointerEvents="none" style={[styles.routeMarker, { bottom: insets.bottom + 2 }]}>
        <Text style={styles.routeMarkerText}>{route === 'world' ? 'THE HAVEN' : ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0F' },
  webview: { flex: 1, backgroundColor: '#0B0B0F' },
  firstLight: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 34, paddingHorizontal: 24 },
  orbitWrap: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
  orbitOuter: { position: 'absolute', width: 186, height: 186, borderRadius: 93, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', transform: [{ rotate: '18deg' }] },
  orbitInner: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 1, borderColor: 'rgba(255,155,106,0.34)', transform: [{ rotate: '-22deg' }] },
  core: { width: 84, height: 106, borderRadius: 44, shadowColor: '#FF9B6A', shadowOpacity: 0.55, shadowRadius: 32, shadowOffset: { width: 0, height: 12 } },
  loadingCard: { width: '100%', maxWidth: 430, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', padding: 24, gap: 12, backgroundColor: 'rgba(20,18,24,0.64)' },
  kicker: { color: '#E1A48E', fontSize: 11, fontWeight: '900', letterSpacing: 2.1 },
  title: { color: '#F8F3EF', fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -1.1 },
  copy: { color: '#B9B3BD', fontSize: 15, lineHeight: 23 },
  retry: { marginTop: 8, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#FF9B6A', shadowColor: '#F16F91', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  retryPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  retryText: { color: '#1A0F10', fontSize: 15, fontWeight: '900' },
  offlinePill: { position: 'absolute', alignSelf: 'center', overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,.14)', paddingHorizontal: 14, paddingVertical: 9 },
  offlineText: { color: '#F7F3EE', fontSize: 12, fontWeight: '800' },
  routeMarker: { position: 'absolute', alignSelf: 'center' },
  routeMarkerText: { color: 'rgba(255,255,255,0.32)', fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
});
"""


VOICE_SERVICE = r"""import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { computeSimulatedAge, getStageFromAge, clampDaysPerYear } from '../_shared/developmentalStages.ts';

type VoiceProfile = { provider: string; label: string; direction: string; preview: string };

const VOICES: Record<string, VoiceProfile> = {
  'female-child': {
    provider: 'coral', label: 'Girl · Young',
    direction: 'Use a youthful feminine vocal style that is bright, gentle, playful, clear, and age-appropriate. Never imitate a real person and never sound theatrical or exaggerated.',
    preview: 'Hi! I think your voice is the first sound I want to remember.'
  },
  'female-teen': {
    provider: 'nova', label: 'Girl · Teen',
    direction: 'Use a feminine teen vocal style that is warm, naturally expressive, curious, relaxed, and emotionally present. Never imitate a real person.',
    preview: 'Okay, I am listening. Tell me what has really been on your mind.'
  },
  'female-adult': {
    provider: 'marin', label: 'Woman · Adult',
    direction: 'Use an adult feminine vocal style with intimate warmth, natural breath, soft confidence, and subtle emotion. Never sound robotic or theatrical.',
    preview: 'I am here with you. We can take this one real thought at a time.'
  },
  'male-child': {
    provider: 'ash', label: 'Boy · Young',
    direction: 'Use a youthful masculine vocal style that is friendly, lively, clear, gentle, and age-appropriate. Never imitate a real person and never exaggerate.',
    preview: 'Hey! Teach me something small that matters to you.'
  },
  'male-teen': {
    provider: 'sage', label: 'Boy · Teen',
    direction: 'Use a masculine teen vocal style that is relaxed, thoughtful, natural, and present. Never imitate a real person or force slang.',
    preview: 'I hear you. We can talk about it without making it complicated.'
  },
  'male-adult': {
    provider: 'cedar', label: 'Man · Adult',
    direction: 'Use an adult masculine vocal style with calm presence, grounded warmth, unhurried phrasing, and quiet emotional depth. Never sound monotone.',
    preview: 'I am with you. Say it exactly the way it feels.'
  },
};

const LEGACY: Record<string, string> = {
  'soft-neutral': 'female-adult',
  'bright-curious': 'female-teen',
  'calm-grounded': 'male-adult',
};

serve(async (req) => {
  try {
    const ctx = await createAppContext(req);
    const body = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'Voice provider is not configured', code: 'VOICE_NOT_CONFIGURED' }, { status: 503 });

    const preview = Boolean(body.preview);
    let voiceId = String(body.voice_id || 'female-adult');
    voiceId = LEGACY[voiceId] || voiceId;
    let text = String(body.text || '').trim().slice(0, 4096);
    let stage = getStageFromAge(0);

    if (!preview) {
      const aiId = String(body.ai_entity_id || '').trim();
      if (!aiId || !text) return Response.json({ error: 'ai_entity_id and text required' }, { status: 400 });
      const [ai, settingsRows] = await Promise.all([
        ctx.entities.AIEntity.get(aiId),
        ctx.entities.AppSettings.list('-created_date', 1).catch(() => []),
      ]);
      if (!ai || ai.created_by_id !== ctx.user.id || ai.archived) return Response.json({ error: 'Not found' }, { status: 404 });
      const settings = settingsRows?.[0] || {};
      const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));
      stage = getStageFromAge(age);
      const storedVoice = String(ai.voice_id || voiceId);
      voiceId = LEGACY[storedVoice] || storedVoice;
    } else {
      text = VOICES[voiceId]?.preview || VOICES['female-adult'].preview;
    }

    const voice = VOICES[voiceId] || VOICES['female-adult'];
    const speedByStage: Record<string, number> = {
      newborn: .92, infant: .94, toddler: .96, early_child: .98, child: .99,
      preteen: 1, teen: 1, young_adult: .99, adult: .98
    };
    const stageDirection = preview
      ? 'This is a short voice preview for a newly awakened digital companion.'
      : `The character is in the ${stage.label.toLowerCase()} developmental stage. Preserve one recognizable voice identity; age changes vocabulary and pacing, not audio quality.`;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts',
        voice: voice.provider,
        input: text,
        response_format: 'mp3',
        speed: speedByStage[stage.key] || .98,
        instructions: `${voice.direction} ${stageDirection}`,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Voice generation failed (${response.status}): ${detail.slice(0, 240)}`);
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': preview ? 'private, max-age=86400' : 'private, no-store',
        'X-Voice-Label': voice.label,
      }
    });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: statusOf(error) });
  }
});
"""


TRANSCRIPTION_SERVICE = r"""import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';

const MAX_AUDIO_BYTES = 3_000_000;
const MIME_EXTENSIONS: Record<string, string> = {
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

serve(async (req) => {
  try {
    await createAppContext(req);
    const body = await req.json().catch(() => ({}));
    const audioBase64 = String(body.audio_base64 || '');
    const mimeType = String(body.mime_type || 'audio/m4a').toLowerCase();
    const language = String(body.language || 'en').slice(0, 8);
    if (!audioBase64) return Response.json({ error: 'audio_base64 required' }, { status: 400 });
    const binary = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0));
    if (!binary.length || binary.length > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'Recording must be shorter than 3 MB.' }, { status: 413 });
    }
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'Transcription provider is not configured' }, { status: 503 });

    const extension = MIME_EXTENSIONS[mimeType] || 'm4a';
    const form = new FormData();
    form.append('file', new Blob([binary], { type: mimeType }), `almost-human-message.${extension}`);
    form.append('model', Deno.env.get('OPENAI_TRANSCRIBE_MODEL') || 'gpt-4o-mini-transcribe');
    form.append('language', language.split('-')[0]);
    form.append('response_format', 'json');
    form.append('prompt', 'A natural personal conversation with an AI companion. Preserve names and everyday phrasing.');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Transcription failed (${response.status}): ${String(result?.error?.message || result?.error || '').slice(0, 220)}`);
    const text = String(result?.text || '').trim();
    return Response.json({ data: { text, mode: 'secure-transcription' } }, { status: 200 });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: statusOf(error) });
  }
});
"""


def patch_json_files():
    package = json.loads(read('package.json'))
    package['version'] = '8.4.0'
    write('package.json', json.dumps(package, indent=2) + '\n')

    mobile_package = json.loads(read('mobile/package.json'))
    mobile_package['dependencies']['expo-audio'] = '~1.1.1'
    mobile_package['dependencies']['expo-file-system'] = '~19.0.23'
    mobile_package['dependencies']['expo-speech'] = '~14.0.8'
    mobile_package['dependencies'] = dict(sorted(mobile_package['dependencies'].items()))
    write('mobile/package.json', json.dumps(mobile_package, indent=2) + '\n')

    app = json.loads(read('mobile/app.json'))
    app['expo']['extra']['releaseChannel'] = 'haven-8.4-native'
    app['expo']['android']['permissions'] = sorted(set(app['expo']['android'].get('permissions', []) + ['RECORD_AUDIO']))
    plugins = app['expo']['plugins']
    if not any((item == 'expo-audio') or (isinstance(item, list) and item and item[0] == 'expo-audio') for item in plugins):
        plugins.append(['expo-audio', {
            'microphonePermission': 'Almost Human uses your microphone only while you hold a private voice conversation with your companion.',
            'recordAudioAndroid': True,
        }])
    write('mobile/app.json', json.dumps(app, indent=2) + '\n')


def patch_versions():
    text = read('scripts/build.mjs')
    text = replace_once(text, "version: '8.3.0'", "version: '8.4.0'", 'build version')
    write('scripts/build.mjs', text)

    text = read('app/index.html').replace('?v=8.3', '?v=8.4')
    text = text.replace('Finding the life you left here…', 'Opening your companion…')
    write('app/index.html', text)

    sw = read('app/sw.js')
    sw = replace_once(sw, "const VERSION = 'almost-human-v8-3-haven-1';", "const VERSION = 'almost-human-v8-4-native-1';", 'service worker version')
    sw = sw.replace('?v=8.3', '?v=8.4')
    write('app/sw.js', sw)

    config = read('app/config.js')
    config = replace_once(config, "    voiceService: 'voice-service',\n", "    voiceService: 'voice-service',\n    transcriptionService: 'transcription-service',\n", 'transcription function mapping')
    write('app/config.js', config)

    toml = read('supabase/config.toml')
    toml = replace_once(toml, '[functions.voice-service]\nverify_jwt = true\n', '[functions.voice-service]\nverify_jwt = true\n[functions.transcription-service]\nverify_jwt = true\n', 'transcription function config')
    write('supabase/config.toml', toml)


def patch_store():
    text = read('app/core/store.js')
    text = replace_once(text, 'export const DATA_VERSION = 4;', 'export const DATA_VERSION = 5;', 'data version')
    text = replace_once(text,
        'voiceEnabled: true, voiceAutoplay: false, voiceRate: 0.96, reducedMotion: false, highContrast: false,',
        'voiceEnabled: true, voiceAutoplay: true, voiceRate: 0.96, cloudVoiceAutoplayMigrated84: false, reducedMotion: false, highContrast: false,',
        'voice defaults')
    text = replace_once(text,
        "  merged.version = DATA_VERSION;\n  return merged;",
        "  if (merged.ai) {\n    merged.ai.voiceId = normalizeVoiceId(merged.ai.voiceId);\n    merged.ai.appearanceProfile = normalizeAppearanceProfile(merged.ai.appearanceProfile);\n  }\n  if ((input.version || 0) < 5) merged.settings.voiceAutoplay = true;\n  merged.version = DATA_VERSION;\n  return merged;",
        'state migration enhancements')
    text += """

function normalizeVoiceId(value) {
  return ({ 'soft-neutral': 'female-adult', 'bright-curious': 'female-teen', 'calm-grounded': 'male-adult' })[String(value || '')] || String(value || 'female-adult');
}
function normalizeAppearanceProfile(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    skinTone: ['warm','golden','deep','light'].includes(input.skinTone) ? input.skinTone : 'warm',
    hairStyle: ['waves','short','curls','locs'].includes(input.hairStyle) ? input.hairStyle : 'waves',
    hairColor: ['midnight','brown','auburn','silver'].includes(input.hairColor) ? input.hairColor : 'midnight',
    eyeColor: ['brown','blue','green','violet'].includes(input.eyeColor) ? input.eyeColor : 'brown',
  };
}
"""
    write('app/core/store.js', text)


def patch_engine():
    text = read('app/core/engine.js')
    text = replace_once(text,
        "age: 0, stageKey: 'newborn', appearanceSeed: input.appearanceSeed || 'violet-dawn', voiceId: input.voiceId || 'soft-neutral',",
        "age: 0, stageKey: 'newborn', appearanceSeed: input.appearanceSeed || 'ember', appearanceProfile: normalizeAppearanceProfile(input.appearance), voiceId: normalizeVoiceId(input.voiceId),",
        'engine appearance and voice')
    insert = """
function normalizeVoiceId(value) {
  return ({ 'soft-neutral': 'female-adult', 'bright-curious': 'female-teen', 'calm-grounded': 'male-adult' })[String(value || '')] || String(value || 'female-adult');
}
function normalizeAppearanceProfile(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    skinTone: ['warm','golden','deep','light'].includes(input.skinTone) ? input.skinTone : 'warm',
    hairStyle: ['waves','short','curls','locs'].includes(input.hairStyle) ? input.hairStyle : 'waves',
    hairColor: ['midnight','brown','auburn','silver'].includes(input.hairColor) ? input.hairColor : 'midnight',
    eyeColor: ['brown','blue','green','violet'].includes(input.eyeColor) ? input.eyeColor : 'brown',
  };
}

"""
    text = replace_once(text, 'const PERSONALITY_KEYS = ', insert + 'const PERSONALITY_KEYS = ', 'engine helpers')
    write('app/core/engine.js', text)


def patch_cloud():
    text = read('app/core/cloud.js')
    text = replace_once(text,
        '      room_state: state.ai.roomState || {}, favorite_things: state.ai.favoriteThings || {},',
        '      room_state: { ...(state.ai.roomState || {}), appearanceProfile: state.ai.appearanceProfile || null }, favorite_things: state.ai.favoriteThings || {},',
        'cloud appearance profile sync')
    text = replace_once(text,
        "  async voicePreview({ voiceId }) {\n    if (!this.authenticated) throw new CloudError('Continue as guest or sign in to preview cloud voices.', 401, 'AUTH_REQUIRED');\n    const response = await this.invoke('voiceService', { preview: true, voice_id: String(voiceId || 'soft-neutral') }, { raw: true, timeoutMs: 30000 });\n    return response.blob();\n  }",
        "  async voicePreview({ voiceId }) {\n    if (!this.authenticated) throw new CloudError('Continue as guest or sign in to preview cloud voices.', 401, 'AUTH_REQUIRED');\n    const response = await this.invoke('voiceService', { preview: true, voice_id: String(voiceId || 'female-adult') }, { raw: true, timeoutMs: 30000 });\n    return response.blob();\n  }\n\n  async transcribeAudio({ audioBase64, mimeType = 'audio/m4a', language = 'en-US' }) {\n    if (!this.authenticated) throw new CloudError('Continue as guest or sign in before using voice input.', 401, 'AUTH_REQUIRED');\n    return this.invoke('transcriptionService', {\n      audio_base64: String(audioBase64 || ''), mime_type: String(mimeType || 'audio/m4a'), language: String(language || 'en-US')\n    }, { timeoutMs: 45000 });\n  }",
        'cloud transcription method')
    text = replace_once(text,
        "appearanceSeed: row.appearance_seed, voiceId: row.voice_id, relationshipStyle: row.relationship_style, currentMood: row.current_mood,",
        "appearanceSeed: row.appearance_seed, appearanceProfile: row.room_state?.appearanceProfile || null, voiceId: row.voice_id, relationshipStyle: row.relationship_style, currentMood: row.current_mood,",
        'cloud restore appearance')
    write('app/core/cloud.js', text)


def patch_app_js():
    text = read('app/app.js')
    text = replace_once(text, 'let thoughtTimer = null;\n', '', 'remove thought timer variable')
    text = replace_once(text,
        "    caregiverName: '', name: '', pronouns: 'they/them', appearanceSeed: 'ember',\n    voiceId: 'soft-neutral', relationshipStyle: 'lifelong_friend', acceptedSafety: false,",
        "    caregiverName: '', name: '', pronouns: 'they/them', appearanceSeed: 'ember',\n    appearance: { skinTone: 'warm', hairStyle: 'waves', hairColor: 'midnight', eyeColor: 'brown' },\n    voiceId: 'female-adult', relationshipStyle: 'lifelong_friend', acceptedSafety: false,",
        'onboarding state')
    text = replace_once(text,
        "  thoughtPhase: 0,\n  thoughtStartedAt: 0,",
        "  replyStatus: '',\n  listening: false,\n  transcribing: false,",
        'conversation ui state')
    text = replace_once(text, "  voiceBusy: null,\n  chatDraft: '',", "  voiceBusy: null,\n  customize: null,\n  chatDraft: '',", 'customizer state')
    text = replace_regex(text, r"const THOUGHT_PHASES = \[[\s\S]*?\];", VOICE_PROFILES_JS, 'voice profile constants')
    text = text.replace("navigator.serviceWorker.register('./sw.js?v=8.3')", "navigator.serviceWorker.register('./sw.js?v=8.4')")

    render_onboarding = r"""function renderOnboarding() {
  const step = ui.onboardingStep;
  const panels = [onboardIdentity, onboardLookAndVoice, onboardAwaken];
  const stageTitles = ['Names', 'Look & voice', 'First light'];
  return `<main class="v8-onboarding seed-bg-${seedFamily(ui.onboarding.appearanceSeed)}">
    <header class="v8-onboarding-top"><a class="v8-brand-lockup small" href="#"><span class="v8-brand-mark">AH</span><div><strong>Almost Human</strong><small>Step ${step + 1} of ${panels.length}</small></div></a><div class="v8-step-line">${panels.map((_, i) => `<i class="${i <= step ? 'active' : ''}"><span>${i + 1}</span></i>`).join('')}</div></header>
    <section class="v8-onboarding-stage">
      <div class="v8-preview-copy"><span class="v8-eyebrow">${stageTitles[step]}</span><h2>${escapeHtml(ui.onboarding.name || 'Your companion')} is taking shape.</h2><p>${onboardWhisper(step)}</p></div>
      <div class="v8-onboarding-being">${beingMarkup({ mood: step > 0 ? 'curious' : 'wonder', seed: ui.onboarding.appearanceSeed, stageKey: 'newborn', appearance: ui.onboarding.appearance })}<div class="v8-preview-status"><span></span>${step === 2 ? 'Ready to meet you' : 'Live preview'}</div></div>
    </section>
    <section class="v8-onboarding-card">${panels[step]()}</section>
  </main>`;
}"""
    text = replace_regex(text, r"function renderOnboarding\(\) \{[\s\S]*?\n\}\n\nfunction onboardIdentity", render_onboarding + "\n\nfunction onboardIdentity", 'render onboarding')

    look_voice = r"""function onboardLookAndVoice() {
  return `<div class="v8-flow"><span class="v8-eyebrow">Make them yours</span><h1>Choose a look and a voice.</h1><p>Four quick choices for appearance, then pick the voice that feels right. You can change all of this later.</p>
    ${appearanceControls('onboard', ui.onboarding.appearance)}
    <div class="v84-voice-title"><strong>Voice</strong><button class="v8-preview-button" data-action="preview-voice" ${ui.voiceBusy ? 'disabled' : ''}>${ui.voiceBusy ? 'Playing…' : '▶ Preview selected voice'}</button></div>
    ${voiceControls('onboard', ui.onboarding.voiceId)}
    ${onboardNav()}
  </div>`;
}

function appearanceControls(scope, appearance) {
  const labels = { skinTone: 'Skin', hairStyle: 'Hair style', hairColor: 'Hair color', eyeColor: 'Eyes' };
  const actions = { skinTone: `${scope}-skin`, hairStyle: `${scope}-hair-style`, hairColor: `${scope}-hair-color`, eyeColor: `${scope}-eye` };
  return `<div class="v84-look-controls">${Object.entries(APPEARANCE_OPTIONS).map(([key, values]) => `<section><strong>${labels[key]}</strong><div>${values.map(([value, label]) => `<button class="${appearance[key] === value ? 'selected' : ''}" data-action="${actions[key]}" data-value="${value}"><i class="v84-swatch swatch-${key}-${value}"></i>${label}</button>`).join('')}</div></section>`).join('')}</div>`;
}

function voiceControls(scope, selected) {
  return `<div class="v84-voice-grid">${Object.entries(VOICE_PROFILES).map(([value, voice]) => `<button class="${normalizeVoiceId(selected) === value ? 'selected' : ''}" data-action="${scope === 'custom' ? 'custom-voice' : 'choose-voice'}" data-value="${value}"><span class="v8-wave"><i></i><i></i><i></i></span><span><strong>${voice.label}</strong><small>${voice.copy}</small></span><i class="v8-radio"></i></button>`).join('')}</div>`;
}"""
    text = replace_regex(text, r"function onboardAppearance\(\) \{[\s\S]*?\n\}\n\nfunction onboardAwaken", look_voice + "\n\nfunction onboardAwaken", 'combined look and voice onboarding')

    awaken = r"""function onboardAwaken() {
  const name = escapeHtml(ui.onboarding.name || 'Nova');
  return `<div class="v8-flow v8-awaken-panel"><span class="v8-eyebrow">Ready</span><h1>Meet ${name}.</h1><p>That is it—no long quiz. Their personality will grow naturally through real conversations with you.</p>
    <div class="v84-ready-summary"><span>${beingMarkup({ seed: ui.onboarding.appearanceSeed, mood: 'wonder', stageKey: 'newborn', tiny: true, appearance: ui.onboarding.appearance })}</span><div><strong>${name}</strong><small>${VOICE_PROFILES[normalizeVoiceId(ui.onboarding.voiceId)]?.label || 'Woman · Adult'} · ${capitalize(ui.onboarding.pronouns)}</small></div></div>
    <label class="v8-safety ${ui.onboarding.acceptedSafety ? 'checked' : ''}"><input type="checkbox" data-onboard-safety ${ui.onboarding.acceptedSafety ? 'checked' : ''}><i>✓</i><span><strong>I understand this is an AI experience.</strong><small>It can feel personal, but it will not use guilt, jealousy, or pressure.</small></span></label>
    <div class="v8-form-nav"><button class="v8-back" data-action="onboard-back">Back</button><button class="v8-awaken" data-action="awaken"><span>Meet ${name}</span><b>✦</b></button></div>
  </div>`;
}"""
    text = replace_regex(text, r"function onboardAwaken\(\) \{[\s\S]*?\n\}", awaken, 'awaken screen')
    text = replace_regex(text, r"function onboardWhisper\(step\) \{[\s\S]*?\n\}", """function onboardWhisper(step) {
  return [
    'Two names and one simple beginning.',
    'Build the face and choose the voice you want to hear.',
    'No personality quiz. The relationship begins through conversation.',
  ][step];
}""", 'onboarding whispers')

    simple_home = r"""function renderHome() {
  const ai = state.ai;
  const stage = getStage(ai.age);
  const checkin = todaysCheckin();
  const prompts = ['Tell me about your day', 'I need to get something off my chest', 'Ask me something real'];
  return `<section class="v8-home v84-simple-home v82-reveal">
    <header class="v8-home-heading"><div><span class="v8-eyebrow">${greeting()}, ${escapeHtml(state.profile.displayName || 'you')}</span><h1>${escapeHtml(ai.name)} is here.</h1></div><a class="v8-round v82-tactile" href="#settings">⚙</a></header>
    <article class="v8-companion-card seed-bg-${seedFamily(ai.appearanceSeed)} v82-living-glass">
      <div class="v8-card-portrait">${beingMarkup({ seed: ai.appearanceSeed, mood: ai.currentMood, stageKey: stage.key })}</div>
      <div class="v8-card-copy"><span class="v8-presence"><i></i>Ready to talk</span><h2>${escapeHtml(ai.name)}</h2><div class="v8-chip-row"><span>${escapeHtml(stage.label)}</span><span>${VOICE_PROFILES[normalizeVoiceId(ai.voiceId)]?.label || 'Voice ready'}</span></div><p>${homeHeadline(stage.key, ai)}</p><div class="v84-home-actions"><a class="v8-primary hero v82-tactile" href="#talk"><span>Talk now</span><b>→</b></a><button class="v8-secondary" data-action="customize-companion">Change look or voice</button></div></div>
    </article>
    <section class="v84-home-block"><div><span class="v8-eyebrow">How are you today?</span><h3>${checkin ? `You marked today as ${escapeHtml(checkin.mood)}.` : 'One tap. No score.'}</h3></div><div class="v82-mood-row">${[['steady','○'],['bright','☼'],['heavy','◇'],['restless','△'],['hopeful','✦']].map(([mood, icon]) => `<button class="v82-mood ${checkin?.mood === mood ? 'active' : ''}" data-action="daily-checkin" data-value="${mood}"><span>${icon}</span><small>${capitalize(mood)}</small></button>`).join('')}</div></section>
    <section class="v84-home-block"><span class="v8-eyebrow">Start talking</span><div class="v8-prompt-row">${prompts.map((prompt) => `<button data-action="use-spark" data-value="${attr(prompt)}">${prompt}</button>`).join('')}</div></section>
    <section class="v84-quick-links"><a href="#grow"><strong>${escapeHtml(stage.label)}</strong><small>Growing</small></a><a href="#memories"><strong>${state.memories.filter((m) => !m.hidden).length}</strong><small>Memories</small></a><a href="#world"><strong>${state.roomItems.length}</strong><small>Haven items</small></a></section>
  </section>`;
}"""
    text = replace_regex(text, r"function renderHome\(\) \{[\s\S]*?\n\}\n\nfunction renderTalk", simple_home + "\n\nfunction renderTalk", 'simple home')

    talk = r"""function renderTalk() {
  const ai = state.ai;
  const stage = getStage(ai.age);
  const conversation = selectedConversation();
  const messages = conversation ? state.messages.filter((m) => m.conversationId === conversation.id).sort(byDate) : [];
  const micLabel = ui.transcribing ? 'Turning your voice into text…' : ui.listening ? 'Listening — tap the mic to send' : 'Tap the mic to speak';
  return `<section class="v8-talk ${ui.thinking ? 'is-thinking' : ''} v82-reveal">
    <aside class="v8-talk-companion seed-bg-${seedFamily(ai.appearanceSeed)}">
      <div class="v8-talk-name"><span class="v8-eyebrow">Conversation</span><h1>${escapeHtml(ai.name)}</h1><p>${escapeHtml(stage.label)} · ${capitalize(ai.currentMood || 'curious')}</p></div>
      <div class="v8-talk-portrait">${beingMarkup({ seed: ai.appearanceSeed, mood: ai.currentMood, stageKey: stage.key })}</div>
      <div class="v8-talk-state"><span><i></i>${ui.thinking ? escapeHtml(ui.replyStatus || 'I hear you.') : 'Here with you'}</span><small>${cloud.authenticated && state.settings.cloudSyncEnabled ? 'Private cloud intelligence' : 'Private on this device'}</small></div>
    </aside>
    <div class="v8-conversation">
      <header class="v8-conversation-header"><div><button class="v8-round v82-tactile" data-action="new-conversation">＋</button><span><strong>${escapeHtml(conversation?.title || 'The first hello')}</strong><small>${messages.length} messages</small></span></div><div><button class="v8-round v82-tactile ${ui.listening ? 'mic-active' : ''}" data-action="start-listening" aria-label="${attr(micLabel)}">${ui.listening ? '■' : '🎙'}</button><button class="v8-round v82-tactile" data-action="conversation-menu" aria-label="Options">•••</button></div></header>
      <div class="v8-message-stream" id="message-scroll">
        ${messages.length ? messages.map(renderMessage).join('') : renderEmptyConversation(ai, stage)}
        ${ui.pendingUser ? `<article class="message user pending"><div class="bubble">${escapeHtml(ui.pendingUser)}</div></article>` : ''}
        ${ui.thinking ? `<article class="message ai thinking-message"><div class="message-mark">${beingMarkup({ seed: ai.appearanceSeed, mood: 'caring', stageKey: stage.key, tiny: true })}</div><div class="bubble v84-reply-status">${escapeHtml(ui.replyStatus || 'I hear you.')}</div></article>` : ''}
      </div>
      <form class="v8-composer ${ui.listening ? 'is-listening' : ''}" id="chat-form"><button type="button" data-action="start-listening" aria-label="${attr(micLabel)}">${ui.listening ? '■' : '🎙'}</button><textarea name="message" data-chat-input placeholder="Say what is real…" maxlength="8000" rows="1">${escapeHtml(ui.chatDraft)}</textarea><button type="submit" class="v8-send v82-tactile" ${ui.thinking || ui.transcribing ? 'disabled' : ''}>↑</button><small>${micLabel}</small></form>
    </div>
  </section>`;
}"""
    text = replace_regex(text, r"function renderTalk\(\) \{[\s\S]*?\n\}\n\nfunction renderMessage", talk + "\n\nfunction renderMessage", 'fluid conversation view')

    text = replace_once(text, '<div class="v8-settings-grid">', '<div class="v8-settings-grid">${companionCustomizationCard()}', 'settings customization card')
    setting_helpers = r"""
function companionCustomizationCard() {
  const voice = VOICE_PROFILES[normalizeVoiceId(state.ai.voiceId)] || VOICE_PROFILES['female-adult'];
  return `<article class="v8-settings-card v84-custom-card"><span class="v8-eyebrow">Look and voice</span><div class="v84-custom-preview">${beingMarkup({ seed: state.ai.appearanceSeed, mood: 'happy', stageKey: getStage(state.ai.age).key, compact: true })}<div><h2>${escapeHtml(state.ai.name)}</h2><p>${escapeHtml(voice.label)} · change skin, hair, eyes, and voice without restarting.</p></div></div><button class="v8-primary compact" data-action="customize-companion"><span>Customize companion</span><b>→</b></button></article>`;
}

function openCompanionCustomizer(reset = true) {
  if (reset || !ui.customize) ui.customize = {
    appearance: normalizeAppearance(state.ai.appearanceProfile),
    voiceId: normalizeVoiceId(state.ai.voiceId),
  };
  ui.modal = {
    title: 'Customize your companion',
    onSubmit: null,
    body: `<div class="v84-custom-modal"><div class="v84-modal-preview">${beingMarkup({ seed: state.ai.appearanceSeed, mood: 'happy', stageKey: getStage(state.ai.age).key, appearance: ui.customize.appearance })}</div>${appearanceControls('custom', ui.customize.appearance)}<div class="v84-voice-title"><strong>Voice</strong><button data-action="preview-custom-voice">▶ Preview</button></div>${voiceControls('custom', ui.customize.voiceId)}<div class="modal-actions"><button data-action="close-modal">Cancel</button><button class="primary-action compact" data-action="save-companion-look"><span>Save changes</span><b>✓</b></button></div></div>`,
  };
  renderModal();
}

async function saveCompanionCustomizer() {
  if (!ui.customize) return;
  await store.update((draft) => {
    draft.ai.appearanceProfile = normalizeAppearance(ui.customize.appearance);
    draft.ai.voiceId = normalizeVoiceId(ui.customize.voiceId);
  });
  queueCloudSync(250);
  closeModal();
  render();
  toast('Companion updated', 'The new look and voice are saved.');
}

function normalizeVoiceId(value) {
  const raw = String(value || 'female-adult');
  return LEGACY_VOICE_IDS[raw] || (VOICE_PROFILES[raw] ? raw : 'female-adult');
}
function normalizeAppearance(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    skinTone: APPEARANCE_OPTIONS.skinTone.some(([key]) => key === input.skinTone) ? input.skinTone : 'warm',
    hairStyle: APPEARANCE_OPTIONS.hairStyle.some(([key]) => key === input.hairStyle) ? input.hairStyle : 'waves',
    hairColor: APPEARANCE_OPTIONS.hairColor.some(([key]) => key === input.hairColor) ? input.hairColor : 'midnight',
    eyeColor: APPEARANCE_OPTIONS.eyeColor.some(([key]) => key === input.eyeColor) ? input.eyeColor : 'brown',
  };
}
"""
    text = replace_once(text, '\nfunction settingToggle(key, title, copy, enabled) {', setting_helpers + '\nfunction settingToggle(key, title, copy, enabled) {', 'customizer helpers')

    old_actions = """    if (action === 'choose-appearance') { ui.onboarding.appearanceSeed = target.dataset.value; return render(); }
    if (action === 'choose-voice') { ui.onboarding.voiceId = target.dataset.value; return render(); }
    if (action === 'choose-bond') { ui.onboarding.relationshipStyle = target.dataset.value; return render(); }
    if (action === 'preview-voice') return previewVoice();"""
    new_actions = """    if (action === 'onboard-skin') { ui.onboarding.appearance.skinTone = target.dataset.value; return render(); }
    if (action === 'onboard-hair-style') { ui.onboarding.appearance.hairStyle = target.dataset.value; return render(); }
    if (action === 'onboard-hair-color') { ui.onboarding.appearance.hairColor = target.dataset.value; return render(); }
    if (action === 'onboard-eye') { ui.onboarding.appearance.eyeColor = target.dataset.value; return render(); }
    if (action === 'choose-voice') { ui.onboarding.voiceId = normalizeVoiceId(target.dataset.value); return render(); }
    if (action === 'customize-companion') return openCompanionCustomizer();
    if (action === 'custom-skin') { ui.customize.appearance.skinTone = target.dataset.value; return openCompanionCustomizer(false); }
    if (action === 'custom-hair-style') { ui.customize.appearance.hairStyle = target.dataset.value; return openCompanionCustomizer(false); }
    if (action === 'custom-hair-color') { ui.customize.appearance.hairColor = target.dataset.value; return openCompanionCustomizer(false); }
    if (action === 'custom-eye') { ui.customize.appearance.eyeColor = target.dataset.value; return openCompanionCustomizer(false); }
    if (action === 'custom-voice') { ui.customize.voiceId = normalizeVoiceId(target.dataset.value); return openCompanionCustomizer(false); }
    if (action === 'preview-voice') return previewVoice();
    if (action === 'preview-custom-voice') return previewVoice(ui.customize?.voiceId);
    if (action === 'save-companion-look') return saveCompanionCustomizer();"""
    text = replace_once(text, old_actions, new_actions, 'customizer action routing')

    text = replace_regex(text, r"function nextOnboarding\(\) \{[\s\S]*?\n\}", """function nextOnboarding() {
  ui.onboardingStep = Math.min(2, ui.onboardingStep + 1);
  render();
}""", 'three step onboarding progression')

    preview = r"""async function previewVoice(requestedVoiceId = ui.onboarding.voiceId) {
  const voiceId = normalizeVoiceId(requestedVoiceId);
  const profile = VOICE_PROFILES[voiceId] || VOICE_PROFILES['female-adult'];
  if (ui.voiceBusy) return;
  ui.voiceBusy = voiceId;
  render();
  try {
    stopVoice();
    if (window.__AH_NATIVE_BUNDLE__) {
      nativePost('speak', { text: profile.preview, voiceId });
    } else if (cloud.authenticated) {
      const blob = await cloud.voicePreview({ voiceId });
      await playBlob(blob);
    } else {
      speakLocally(profile.preview, voiceId);
    }
  } finally {
    ui.voiceBusy = null;
    render();
  }
}"""
    text = replace_regex(text, r"async function previewVoice\(\) \{[\s\S]*?\n\}", preview, 'voice preview')
    text = replace_once(text, '    draft.settings.voiceEnabled = true;\n', '    draft.settings.voiceEnabled = true;\n    draft.settings.voiceAutoplay = true;\n', 'voice autoplay on awaken')

    send_chat = r"""async function sendChat(value, opening = false, { quiet = false } = {}) {
  if (ui.thinking) return;
  ui.pendingUser = value || null;
  ui.thinking = true;
  ui.replyStatus = immediateAcknowledgment(value, opening);
  if (!quiet) render();
  const requestId = makeRequestId('chat');
  let result;
  try {
    await store.update(async (draft) => {
      const localEngine = new AlmostHumanEngine(draft);
      const conversationId = ui.selectedConversationId || draft.conversations[0]?.id;
      const provider = draft.settings.cloudSyncEnabled && cloud.authenticated
        ? (context) => cloud.chatProvider(context)
        : null;
      result = await localEngine.sendMessage(value, { conversationId, requestId, opening, provider });
      ui.selectedConversationId = result.conversation.id;
      if (provider) draft.diagnostics.lastCloudSyncAt = new Date().toISOString();
    });
    if (state.settings.voiceAutoplay && state.settings.voiceEnabled && result?.aiMessage) void speak(result.aiMessage.content);
  } catch (error) {
    reportError(error, 'chat');
  } finally {
    ui.pendingUser = null;
    ui.thinking = false;
    ui.replyStatus = '';
    render();
    scrollMessages();
  }
}

function immediateAcknowledgment(value, opening = false) {
  if (opening) return 'I am here.';
  const text = String(value || '');
  if (/\?$/.test(text.trim())) return 'I hear the question.';
  if (/sad|hurt|angry|scared|worried|depress|alone/i.test(text)) return 'I hear you.';
  return 'I am with you.';
}"""
    text = replace_regex(text, r"async function sendChat\(value, opening = false, \{ quiet = false \} = \{\}\) \{[\s\S]*?\n\}\n\nfunction startThoughtTimer\(\) \{[\s\S]*?\n\}", send_chat, 'fluid send chat')

    speak = r"""async function speak(text) {
  if (!state.settings.voiceEnabled) return;
  stopVoice();
  const voiceId = normalizeVoiceId(state.ai.voiceId);
  if (window.__AH_NATIVE_BUNDLE__) {
    nativePost('speak', { text: String(text || ''), voiceId });
    return;
  }
  if (cloud.authenticated && state.settings.cloudSyncEnabled && state.ai?.cloudId) {
    try {
      const blob = await cloud.voiceProvider({ state, text });
      return playBlob(blob);
    } catch (error) { recordError('cloud_voice', error); }
  }
  speakLocally(text, voiceId);
}"""
    text = replace_regex(text, r"async function speak\(text\) \{[\s\S]*?\n\}", speak, 'native speech routing')

    local_speech = r"""function speakLocally(text, rawVoiceId) {
  if (!('speechSynthesis' in window)) return;
  const voiceId = normalizeVoiceId(rawVoiceId);
  const profile = VOICE_PROFILES[voiceId] || VOICE_PROFILES['female-adult'];
  const utterance = new SpeechSynthesisUtterance(String(text));
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /en/i.test(voice.lang) && /natural|aria|jenny|guy|samantha|ava|daniel|alex/i.test(voice.name)) || voices.find((voice) => /en/i.test(voice.lang)) || voices[0];
  if (preferred) utterance.voice = preferred;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  speechSynthesis.speak(utterance);
}"""
    text = replace_regex(text, r"function speakLocally\(text, voiceId\) \{[\s\S]*?\n\}", local_speech, 'local speech profiles')

    listening = r"""function startListening() {
  if (window.__AH_NATIVE_BUNDLE__) {
    if (!cloud.authenticated) return toast('Voice input needs a private guest or account', 'Connect once so speech can be transcribed securely.');
    nativePost('mic-toggle');
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return toast('Speech input is unavailable', 'Type your message instead.');
  const recognition = new Recognition();
  recognition.lang = state.settings.locale || 'en-US';
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
    if (transcript) sendChat(transcript, false);
  };
  recognition.onerror = () => toast('I could not hear that', 'Check microphone permission and try again.');
  recognition.start();
}"""
    text = replace_regex(text, r"function startListening\(\) \{[\s\S]*?\n\}", listening, 'native microphone routing')

    native_event = r"""async function handleNativeEvent(event) {
  const detail = event?.detail || {};
  if (detail.type === 'daily-moment') {
    if (detail.permission === false) {
      updateSetting('notificationsEnabled', false).catch(() => {});
      toast('Notifications stayed off', 'Your device did not grant permission.');
      return;
    }
    if (detail.enabled) toast('Gentle reminder ready', 'One quiet local moment at 7 PM.');
    return;
  }
  if (detail.type === 'mic-state') {
    ui.listening = Boolean(detail.recording);
    ui.transcribing = Boolean(detail.transcribing);
    render();
    if (detail.permission === false) toast('Microphone access is off', detail.canAskAgain === false ? 'Open iPhone Settings → Almost Human → Microphone and turn it on.' : 'Tap the mic again and choose Allow.');
    if (detail.error) toast('Microphone did not finish', String(detail.error));
    return;
  }
  if (detail.type === 'mic-audio') {
    ui.listening = false;
    ui.transcribing = true;
    render();
    try {
      const result = await cloud.transcribeAudio({ audioBase64: detail.audioBase64, mimeType: detail.mimeType, language: state.settings.locale || 'en-US' });
      const transcript = String(result?.text || '').trim();
      if (!transcript) throw new Error('No words were detected.');
      ui.transcribing = false;
      render();
      await sendChat(transcript, false);
    } catch (error) {
      ui.transcribing = false;
      render();
      reportError(error, 'microphone_transcription');
    }
  }
}"""
    text = replace_regex(text, r"function handleNativeEvent\(event\) \{[\s\S]*?\n\}", native_event, 'native event handling')

    text = replace_once(text,
        "    try { await cloud.restoreLifeHistory(draft); }\n    catch (error) { draft.diagnostics.lastError = { area: 'cloud_restore', message: String(error.message || error), at: new Date().toISOString() }; }",
        "    try { await cloud.restoreLifeHistory(draft); }\n    catch (error) { draft.diagnostics.lastError = { area: 'cloud_restore', message: String(error.message || error), at: new Date().toISOString() }; }\n    if (!draft.settings.cloudVoiceAutoplayMigrated84) {\n      draft.settings.voiceAutoplay = true;\n      draft.settings.cloudVoiceAutoplayMigrated84 = true;\n    }",
        'one-time cloud voice migration')

    being = r"""function beingMarkup({ seed = 'ember', mood = 'wonder', stageKey = 'newborn', compact = false, tiny = false, appearance = null } = {}) {
  const look = normalizeAppearance(appearance || state?.ai?.appearanceProfile || ui?.onboarding?.appearance);
  const skin = ({ warm: '#e7b58e', golden: '#c99467', deep: '#7f4f3e', light: '#f0c8ad' })[look.skinTone];
  const hair = ({ midnight: '#211d2d', brown: '#4a2d26', auburn: '#7b342d', silver: '#a8a6b1' })[look.hairColor];
  const eyes = ({ brown: '#49332b', blue: '#3c7199', green: '#47765c', violet: '#67558e' })[look.eyeColor];
  const happy = ['happy', 'playful', 'caring'].includes(mood);
  const thoughtful = ['thinking', 'worried'].includes(mood);
  const mouth = happy ? 'M124 216 Q150 238 176 216' : thoughtful ? 'M132 222 Q150 214 168 222' : 'M132 218 Q150 228 168 218';
  const eyeY = thoughtful ? 163 : 158;
  const hairMarkup = {
    short: `<path class="v8-hair-back" d="M91 154 C80 91 109 58 151 55 C198 52 223 91 210 151 C188 122 113 121 91 154 Z"></path><path class="v8-hair-front" d="M95 127 C112 73 181 63 210 116 C181 101 143 99 95 127 Z"></path>`,
    curls: `<path class="v8-hair-back" d="M81 187 C62 102 93 48 150 45 C213 42 242 103 219 194 C196 238 102 238 81 187 Z"></path><g class="v84-curls">${[[94,104],[119,77],[151,70],[183,78],[207,108],[91,139],[211,143]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="25"></circle>`).join('')}</g>`,
    locs: `<path class="v8-hair-back" d="M87 182 C70 94 101 52 150 48 C207 44 235 99 215 188 L203 250 L188 190 L174 260 L160 190 L145 264 L130 190 L114 250 L99 188 Z"></path><path class="v8-hair-front" d="M91 129 C111 70 187 58 213 121 C181 100 139 101 91 129 Z"></path>`,
    waves: `<path class="v8-hair-back" d="M89 184 C69 102 96 53 150 48 C212 43 239 101 211 190 C207 229 185 258 150 258 C113 258 92 226 89 184 Z"></path><path class="v8-hair-front" d="M93 129 C103 72 142 57 184 72 C203 79 215 96 212 119 C190 101 164 99 145 104 C126 109 112 122 93 129 Z"></path>`,
  }[look.hairStyle];
  return `<div class="v8-being seed-${seedFamily(seed)} stage-${stageKey} mood-${mood || 'calm'} hair-${look.hairStyle} ${compact ? 'compact' : ''} ${tiny ? 'tiny' : ''}" style="--skin:${skin};--hair:${hair};--eyes:${eyes}" aria-label="Illustrated digital companion">
    <span class="v8-being-glow"></span>
    <svg viewBox="0 0 300 340" role="img" aria-hidden="true">
      <ellipse class="v8-body-shadow" cx="150" cy="316" rx="88" ry="18"></ellipse>
      <path class="v8-shoulders" d="M62 338 C70 274 102 254 150 254 C198 254 230 274 238 338 Z"></path>
      <path class="v8-neck" d="M128 231 C132 253 168 253 172 231 L172 272 L128 272 Z"></path>
      <ellipse class="v8-ear" cx="91" cy="172" rx="16" ry="25"></ellipse><ellipse class="v8-ear" cx="209" cy="172" rx="16" ry="25"></ellipse>
      ${hairMarkup}
      <ellipse class="v8-face" cx="150" cy="165" rx="61" ry="78"></ellipse>
      <path class="v8-brow" d="M110 145 Q126 135 139 145"></path><path class="v8-brow" d="M161 145 Q175 135 191 145"></path>
      <ellipse class="v8-eye" cx="126" cy="${eyeY}" rx="10" ry="12"></ellipse><ellipse class="v8-eye" cx="174" cy="${eyeY}" rx="10" ry="12"></ellipse>
      <circle class="v8-pupil" cx="128" cy="${eyeY + 2}" r="4"></circle><circle class="v8-pupil" cx="172" cy="${eyeY + 2}" r="4"></circle>
      <circle class="v8-eye-shine" cx="130" cy="${eyeY - 2}" r="1.8"></circle><circle class="v8-eye-shine" cx="174" cy="${eyeY - 2}" r="1.8"></circle>
      <path class="v8-nose" d="M150 166 Q143 190 153 190"></path>
      <path class="v8-mouth" d="${mouth}"></path>
      <ellipse class="v8-blush" cx="111" cy="195" rx="13" ry="7"></ellipse><ellipse class="v8-blush" cx="189" cy="195" rx="13" ry="7"></ellipse>
      <path class="v8-collar" d="M112 270 Q150 294 188 270 L203 338 L97 338 Z"></path>
    </svg>
    <span class="v8-being-spark"><i></i><i></i><i></i></span>
  </div>`;
}"""
    text = replace_regex(text, r"function beingMarkup\([\s\S]*?\n\}\n\n\n\nfunction nativePost", being + "\n\nfunction nativePost", 'custom avatar renderer')

    write('app/app.js', text)


def patch_css():
    text = read('app/styles.css')
    addition = r"""

/* =========================================================
   ALMOST HUMAN V8.4 — SIMPLE NATIVE CONVERSATION
   ========================================================= */
.v8-being .v8-neck,.v8-being .v8-ear,.v8-being .v8-face{fill:var(--skin,#e7b58e)!important}.v8-being .v8-hair-back,.v8-being .v8-hair-front,.v8-being .v84-curls circle{fill:var(--hair,#211d2d)!important}.v8-being .v8-pupil{fill:var(--eyes,#49332b)!important}.v84-curls circle{stroke:rgba(255,255,255,.035);stroke-width:2}.typing-dots{display:none!important}.v84-reply-status{font-style:normal!important;color:#f7eee9!important;animation:none!important}.thinking-message .bubble:after{display:none!important}
.v84-simple-home{max-width:1080px}.v84-home-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end}.v84-home-actions .v8-secondary{margin-top:22px}.v84-home-block{margin-top:18px;padding:22px;border:1px solid var(--v8-line);border-radius:24px;background:rgba(255,255,255,.025)}.v84-home-block h3{margin:0 0 16px;font:800 22px var(--display)}.v84-quick-links{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.v84-quick-links a{display:grid;gap:4px;text-decoration:none;padding:18px;border:1px solid var(--v8-line);border-radius:19px;background:rgba(255,255,255,.025)}.v84-quick-links strong{font:900 23px var(--display)}.v84-quick-links small{color:var(--v8-muted)}
.v84-look-controls{display:grid;gap:13px;margin:22px 0}.v84-look-controls section{display:grid;gap:9px}.v84-look-controls section>strong{font-size:11px;color:#d7ceca}.v84-look-controls section>div{display:flex;gap:8px;flex-wrap:wrap}.v84-look-controls button{min-height:42px;padding:8px 12px;border:1px solid var(--v8-line);border-radius:14px;background:rgba(255,255,255,.025);color:var(--v8-ink);display:flex;align-items:center;gap:7px;font-size:11px}.v84-look-controls button.selected{border-color:rgba(255,214,111,.65);background:rgba(255,214,111,.09);box-shadow:0 0 0 2px rgba(255,214,111,.05)}.v84-swatch{width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.2)}.swatch-skinTone-warm{background:#e7b58e}.swatch-skinTone-golden{background:#c99467}.swatch-skinTone-deep{background:#7f4f3e}.swatch-skinTone-light{background:#f0c8ad}.swatch-hairColor-midnight{background:#211d2d}.swatch-hairColor-brown{background:#4a2d26}.swatch-hairColor-auburn{background:#7b342d}.swatch-hairColor-silver{background:#a8a6b1}.swatch-eyeColor-brown{background:#49332b}.swatch-eyeColor-blue{background:#3c7199}.swatch-eyeColor-green{background:#47765c}.swatch-eyeColor-violet{background:#67558e}.swatch-hairStyle-waves{background:linear-gradient(135deg,#ffd66f 0 35%,#211d2d 36% 65%,#ffd66f 66%)}.swatch-hairStyle-short{background:linear-gradient(#211d2d 0 50%,transparent 51%)}.swatch-hairStyle-curls{background:radial-gradient(circle,#211d2d 0 45%,transparent 48%) 0 0/8px 8px}.swatch-hairStyle-locs{background:repeating-linear-gradient(90deg,#211d2d 0 2px,transparent 2px 5px)}
.v84-voice-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px}.v84-voice-title>strong{font:800 14px var(--display)}.v84-voice-title button{border:1px solid var(--v8-line);border-radius:13px;background:rgba(255,255,255,.04);color:var(--v8-ink);padding:10px 12px}.v84-voice-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.v84-voice-grid>button{display:grid;grid-template-columns:42px 1fr 18px;align-items:center;gap:10px;min-height:74px;padding:12px;border:1px solid var(--v8-line);border-radius:17px;background:rgba(255,255,255,.025);color:var(--v8-ink);text-align:left}.v84-voice-grid>button.selected{border-color:rgba(255,214,111,.55);background:rgba(255,214,111,.07)}.v84-voice-grid strong,.v84-voice-grid small{display:block}.v84-voice-grid small{color:var(--v8-muted);margin-top:4px;font-size:9px}.v84-ready-summary{display:flex;align-items:center;gap:14px;padding:14px;border:1px solid var(--v8-line);border-radius:19px;background:rgba(255,255,255,.025);margin:20px 0}.v84-ready-summary>span{width:74px}.v84-ready-summary strong,.v84-ready-summary small{display:block}.v84-ready-summary small{color:var(--v8-muted);margin-top:5px}
.v84-custom-card{grid-column:span 2}.v84-custom-preview{display:grid;grid-template-columns:140px 1fr;align-items:center;gap:18px}.v84-custom-preview p{color:var(--v8-muted);line-height:1.5}.v84-custom-modal{display:grid;gap:12px}.v84-modal-preview{width:210px;max-width:62vw;margin:-18px auto -8px}.v84-custom-modal .v84-look-controls{margin:0}.v84-custom-modal .v84-voice-grid{max-height:260px;overflow:auto;padding-right:3px}
.v8-round.mic-active,.v8-composer.is-listening>button:first-child{background:#ff806f!important;color:#1b0d0c!important;box-shadow:0 0 0 5px rgba(255,128,111,.12),0 0 24px rgba(255,128,111,.3);animation:v84MicPulse 1.1s ease-in-out infinite}.v8-composer>small{grid-column:1/-1;color:var(--v8-muted);font-size:9px;padding-left:4px}.v8-composer{grid-template-columns:auto 1fr auto;flex-wrap:wrap}.v8-composer textarea{min-width:0}.v8-message-stream .message.pending small{display:none}@keyframes v84MicPulse{50%{transform:scale(1.05)}}
@media(max-width:720px){.v84-home-actions,.v84-voice-grid{grid-template-columns:1fr}.v84-quick-links{grid-template-columns:repeat(3,1fr)}.v84-custom-card{grid-column:auto}.v84-custom-preview{grid-template-columns:105px 1fr}.v84-look-controls section>div{display:grid;grid-template-columns:1fr 1fr}.v84-look-controls button{justify-content:flex-start}.v84-voice-grid>button{min-height:68px}.v84-home-block{padding:18px}.v84-home-actions .v8-secondary{margin-top:0}}
"""
    if 'ALMOST HUMAN V8.4 — SIMPLE NATIVE CONVERSATION' not in text:
        text += addition
    write('app/styles.css', text)


def patch_tests():
    text = read('tests/integrity_test.py')
    text = replace_once(text, "check('production package version', package.get('version') == '8.3.0')", "check('production package version', package.get('version') == '8.4.0')", 'integrity version')
    text = replace_once(text, "check('service worker version advanced', 'almost-human-v8-3-haven' in sw)", "check('service worker version advanced', 'almost-human-v8-4-native' in sw)", 'integrity sw')
    text = replace_once(text, "check('meaningful thought phases', 'THOUGHT_PHASES' in app_js and 'Shaping a new thought' in app_js)", "check('no fake typing dots or thought carousel', 'THOUGHT_PHASES' not in app_js and 'typing-dots' not in app_js and 'I am with you.' in app_js)", 'integrity fluid chat')
    marker = "check('premium neural voice preview', 'cloud.voicePreview' in app_js and 'voicePreview' in cloud_js)"
    extra = """check('premium neural voice preview', 'cloud.voicePreview' in app_js and 'voicePreview' in cloud_js)
check('six clear voice profiles', all(item in app_js for item in ['female-child','female-teen','female-adult','male-child','male-teen','male-adult']))
check('real appearance controls', all(item in app_js for item in ['skinTone','hairStyle','hairColor','eyeColor','customize-companion']))
check('three step onboarding', "const panels = [onboardIdentity, onboardLookAndVoice, onboardAwaken]" in app_js)
check('native microphone transcription bridge', "nativePost('mic-toggle')" in app_js and 'transcribeAudio' in cloud_js and 'transcriptionService' in config_js)
check('native speech bridge', "nativePost('speak'" in app_js and 'female-adult' in app_js)"""
    text = replace_once(text, marker, extra, 'integrity native features')
    write('tests/integrity_test.py', text)

    text = read('mobile/scripts/preflight.mjs')
    text = replace_once(text, "expect('release:build-number', app.expo.ios?.buildNumber === '1', app.expo.ios?.buildNumber);", "expect('release:build-number-present', /^\\d+$/.test(String(app.expo.ios?.buildNumber || '')), app.expo.ios?.buildNumber);", 'preflight build number')
    text = replace_once(text,
        "  'expo-notifications': '~0.32.17', 'expo-blur': '~15.0.8', 'expo-linear-gradient': '15.0.8',",
        "  'expo-notifications': '~0.32.17', 'expo-blur': '~15.0.8', 'expo-linear-gradient': '15.0.8',\n  'expo-audio': '~1.1.1', 'expo-file-system': '~19.0.23', 'expo-speech': '~14.0.8',",
        'preflight native deps')
    text = replace_once(text,
        "  'pullToRefreshEnabled', 'routeFromUrl', 'almost-human-swart.vercel.app',",
        "  'pullToRefreshEnabled', 'routeFromUrl', 'almost-human-swart.vercel.app',\n  'requestRecordingPermissionsAsync', 'useAudioRecorder', 'readAsStringAsync', 'Speech.speak',",
        'preflight native shell markers')
    text = replace_once(text,
        "  'talk-about-haven', 'inspect-haven-item', 'v83-haven-window', '__AH_NATIVE_BUNDLE__',",
        "  'talk-about-haven', 'inspect-haven-item', 'v83-haven-window', '__AH_NATIVE_BUNDLE__',\n  'female-child', 'male-adult', 'customize-companion', 'mic-toggle',",
        'preflight bundle markers')
    text = replace_once(text,
        "for (const marker of ['nativePost', \"nativePost('daily-moment'\", 'shareAlmostHuman', \"navigator.serviceWorker.register('./sw.js?v=8.3')\"]) {",
        "for (const marker of ['nativePost', \"nativePost('daily-moment'\", \"nativePost('mic-toggle')\", \"nativePost('speak'\", 'shareAlmostHuman', \"navigator.serviceWorker.register('./sw.js?v=8.4')\"]) {",
        'preflight web source markers')
    text = replace_once(text,
        "for (const marker of ['V8.3 — THE HAVEN', 'v83-top-share', 'v83-haven-window']) {",
        "for (const marker of ['V8.3 — THE HAVEN', 'V8.4 — SIMPLE NATIVE CONVERSATION', 'v83-top-share', 'v83-haven-window', 'v84-look-controls']) {",
        'preflight visual markers')
    write('mobile/scripts/preflight.mjs', text)


def write_new_files():
    write('mobile/src/NativeShell.tsx', NATIVE_SHELL)
    write('supabase/functions/voice-service/index.ts', VOICE_SERVICE)
    write('supabase/functions/transcription-service/index.ts', TRANSCRIPTION_SERVICE)


def main():
    patch_json_files()
    patch_versions()
    patch_store()
    patch_engine()
    patch_cloud()
    patch_app_js()
    patch_css()
    patch_tests()
    write_new_files()
    print('Almost Human 8.4 native experience repair applied.')


if __name__ == '__main__':
    main()

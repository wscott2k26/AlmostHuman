import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
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
      haven: 'world',
      world: 'world',
      home: 'home',
      talk: 'talk',
      grow: 'grow',
      growing: 'grow',
      memories: 'memories',
      settings: 'settings',
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

export function NativeShell() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [fatalMessage, setFatalMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [route, setRoute] = useState('home');

  const source = useMemo(() => ({ html: ALMOST_HUMAN_HTML, baseUrl: LIVE_ORIGIN }), []);

  const injectRoute = useCallback((nextRoute: string) => {
    webRef.current?.injectJavaScript(`location.hash = '#${nextRoute.replace(/[^a-z-]/g, '')}'; true;`);
  }, []);

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
      webRef.current?.injectJavaScript(nativeAck('daily-moment', result));
      if (!result.permission) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (message.type === 'web-error' && message.message) {
      console.warn('[Almost Human web]', message.message);
    }
  }, [handleHaptic]);

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
              <Text style={styles.title}>{fatalMessage ? 'The Haven paused.' : 'Finding the life you left here…'}</Text>
              <Text style={styles.copy}>
                {fatalMessage || 'Memories, growth, and the room they built are being restored privately.'}
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

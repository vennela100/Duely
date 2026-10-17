import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { verifyPin } from '@/services/localAuth';
import { canUseBiometric, isBiometricPromptActive, promptBiometric } from '@/services/biometric';
import { useUIStore } from '@/store/ui.store';
import { useT } from '@/utils/i18n';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];
const PIN_LENGTH = 4;

// Re-lock the app when it comes back from the background (e.g. reopened from
// recent apps). Drawn on top of the current screen so nothing underneath is lost.
export function AppLock() {
  const t = useT();
  const unlocked = useUIStore((s) => s.unlocked);
  const ownerName = useUIStore((s) => s.ownerName);

  const [locked, setLocked] = useState(false);
  const [entry, setEntry] = useState('');
  const [bioAvail, setBioAvail] = useState(false);

  const wentToBackground = useRef(false);

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const tryBiometric = useCallback(async () => {
    if (isBiometricPromptActive()) return;
    const ok = await promptBiometric();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEntry('');
      setLocked(false);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // Ignore the background/active flicker caused by the app's own fingerprint prompt.
      if (!useUIStore.getState().unlocked || isBiometricPromptActive()) return;
      if (state === 'background') {
        wentToBackground.current = true;
      } else if (state === 'active' && wentToBackground.current) {
        wentToBackground.current = false;
        setEntry('');
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  // Signing out (unlocked → false) hands over to the login screen instead.
  useEffect(() => {
    if (!unlocked) setLocked(false);
  }, [unlocked]);

  // While locked, the back button must not navigate the screens underneath.
  useEffect(() => {
    if (!locked) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [locked]);

  useEffect(() => {
    if (!locked) return;
    let cancelled = false;
    canUseBiometric().then((bio) => {
      if (cancelled) return;
      setBioAvail(bio);
      if (bio) setTimeout(tryBiometric, 300);
    });
    return () => {
      cancelled = true;
    };
  }, [locked, tryBiometric]);

  const fail = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-7, { duration: 50 }),
      withTiming(7, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
    setEntry('');
  };

  const commit = async (pin: string) => {
    if (await verifyPin(pin)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEntry('');
      setLocked(false);
    } else {
      fail();
    }
  };

  const press = (k: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (k === 'del') {
      setEntry((e) => e.slice(0, -1));
      return;
    }
    setEntry((e) => {
      if (e.length >= PIN_LENGTH) return e;
      const next = e + k;
      if (next.length === PIN_LENGTH) setTimeout(() => commit(next), 120);
      return next;
    });
  };

  if (!unlocked || !locked) return null;

  return (
    <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Text style={styles.title}>
            {ownerName ? t('auth.welcomeBack').replace('{name}', ownerName) : t('auth.enterPin')}
          </Text>
          <Text style={styles.subtitle}>{t('auth.unlockHint')}</Text>
          <Animated.View style={[styles.dots, shakeStyle]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.dot, i < entry.length && styles.dotFilled]} />
            ))}
          </Animated.View>
        </View>

        <View style={styles.keypad}>
          {KEYS.map((k) => {
            if (k === 'bio') {
              return bioAvail ? (
                <Pressable
                  key="bio"
                  onPress={tryBiometric}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                >
                  <Text style={styles.keyBio}>☝</Text>
                </Pressable>
              ) : (
                <View key="bio" style={styles.key} />
              );
            }
            return (
              <Pressable
                key={k}
                onPress={() => press(k)}
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              >
                <Text style={k === 'del' ? styles.keyDel : styles.keyText}>{k === 'del' ? '⌫' : k}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: Spacing.xxl * 2 },
  title: {
    fontFamily: Typography.display,
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  dots: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  key: { width: '33.333%', height: 72, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { opacity: 0.5 },
  keyText: { fontFamily: Typography.display, fontSize: 28, color: Colors.textPrimary },
  keyDel: { fontSize: 26, color: Colors.textSecondary },
  keyBio: { fontSize: 26, color: Colors.primary },
});

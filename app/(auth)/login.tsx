import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import {
  hasPin,
  setPin as savePin,
  verifyPin,
  setOwnerName as saveOwnerName,
  getOwnerName,
  isSignedOut,
  clearSignedOut,
} from '@/services/localAuth';
import { canUseBiometric, promptBiometric } from '@/services/biometric';
import { currentUid } from '@/services/cloudAuth';
import { useUIStore } from '@/store/ui.store';
import { useCloudStore } from '@/store/cloud.store';

type Phase = 'loading' | 'signin' | 'name' | 'create' | 'confirm' | 'enter';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];
const PIN_LENGTH = 4;

export default function LockScreen() {
  const setUnlocked = useUIStore((s) => s.setUnlocked);
  const setOwnerNameStore = useUIStore((s) => s.setOwnerName);

  const cloudConnect = useCloudStore((s) => s.connect);

  const [phase, setPhase] = useState<Phase>('loading');
  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [owner, setOwner] = useState('');
  const [bioAvail, setBioAvail] = useState(false);

  // Sign-in (first run) — Firebase identity that also links cloud sync.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [signinBusy, setSigninBusy] = useState(false);
  const [signinError, setSigninError] = useState<string | null>(null);

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const tryBiometric = async () => {
    const ok = await promptBiometric();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setOwnerNameStore(owner || 'Owner');
      setUnlocked(true);
    }
  };

  useEffect(() => {
    (async () => {
      const exists = await hasPin();
      const signedOut = await isSignedOut();
      setOwner(await getOwnerName());
      const bio = exists ? await canUseBiometric() : false;
      setBioAvail(bio);
      if (signedOut) {
        // Signed out → must sign in again first (PIN is kept for after).
        setPhase('signin');
      } else if (exists) {
        // Returning user → unlock with stored PIN / fingerprint.
        setPhase('enter');
        if (bio) setTimeout(tryBiometric, 400);
      } else {
        // First ever launch (or signed-in but no PIN yet).
        setPhase(currentUid() ? 'create' : 'signin');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitSignin = async () => {
    if (!email.trim() || password.length < 6) {
      setSigninError('Enter your email and a password (min 6 characters).');
      return;
    }
    setSigninBusy(true);
    setSigninError(null);
    try {
      await cloudConnect(email, password); // Firebase sign-in/create + start sync
      await clearSignedOut();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Returning user keeps their PIN → ask it. New user → ask name, then PIN.
      const exists = await hasPin();
      if (exists) {
        const who = (await getOwnerName()) || email.trim().split('@')[0] || 'Owner';
        setOwner(who);
        const bio = await canUseBiometric();
        setBioAvail(bio);
        setPhase('enter');
        if (bio) setTimeout(tryBiometric, 400);
      } else {
        setNameInput('');
        setPhase('name');
      }
    } catch (e) {
      setSigninError((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSigninBusy(false);
    }
  };

  const submitName = async () => {
    const who = nameInput.trim();
    if (who.length < 2) {
      setSigninError('Please enter your name.');
      return;
    }
    setSigninError(null);
    setOwner(who);
    await saveOwnerName(who);
    setOwnerNameStore(who);
    Haptics.selectionAsync().catch(() => {});
    setPhase('create'); // now set the PIN
  };

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
    if (phase === 'create') {
      setFirstPin(pin);
      setEntry('');
      setPhase('confirm');
      return;
    }
    if (phase === 'confirm') {
      if (pin === firstPin) {
        await savePin(pin);
        await saveOwnerName(owner || 'Owner');
        setOwnerNameStore(owner || 'Owner');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setUnlocked(true);
      } else {
        setFirstPin('');
        setPhase('create');
        fail();
      }
      return;
    }
    // enter
    if (await verifyPin(pin)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setOwnerNameStore(owner || 'Owner');
      setUnlocked(true);
    } else {
      fail();
    }
  };

  const press = (k: string) => {
    if (k === 'bio') return;
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

  const title = useMemo(() => {
    switch (phase) {
      case 'signin':
        return 'Sign in to Duely';
      case 'name':
        return "What's your name?";
      case 'create':
        return owner ? `Set a PIN, ${owner}` : 'Create your PIN';
      case 'confirm':
        return 'Confirm your PIN';
      case 'enter':
        return owner ? `Welcome back, ${owner}` : 'Enter your PIN';
      default:
        return '';
    }
  }, [phase, owner]);

  const subtitle =
    phase === 'signin'
      ? 'Your account keeps data backed up & synced. New here? Just pick a password — the account is created for you.'
      : phase === 'name'
        ? 'This shows on your profile.'
      : phase === 'create'
        ? 'A 4-digit PIN unlocks the app quickly each day.'
        : phase === 'confirm'
          ? 'Re-enter to confirm.'
          : 'Unlock to continue.';

  if (phase === 'loading') {
    return <View style={styles.loading} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.brandWrap}>
          <Image
            source={require('../../assets/splash-icon.png')}
            style={styles.brandImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.Text
          key={title}
          entering={FadeInDown.duration(300)}
          style={styles.title}
        >
          {title}
        </Animated.Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {phase === 'signin' ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
            />
            {signinError ? <Text style={styles.error}>{signinError}</Text> : null}
            <Pressable
              style={[styles.cta, signinBusy && { opacity: 0.6 }]}
              disabled={signinBusy}
              onPress={submitSignin}
            >
              <Text style={styles.ctaText}>{signinBusy ? 'Signing in…' : 'Continue'}</Text>
            </Pressable>
          </View>
        ) : phase === 'name' ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              autoFocus
            />
            {signinError ? <Text style={styles.error}>{signinError}</Text> : null}
            <Pressable style={styles.cta} onPress={submitName}>
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          </View>
        ) : (
          <Animated.View style={[styles.dots, shakeStyle]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < entry.length && styles.dotFilled]}
              />
            ))}
          </Animated.View>
        )}
      </View>

      {phase === 'signin' || phase === 'name' ? null : (
      <View style={styles.keypad}>
        {KEYS.map((k) => {
          if (k === 'bio') {
            if (phase === 'enter' && bioAvail) {
              return (
                <Pressable
                  key="bio"
                  onPress={tryBiometric}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                  android_ripple={{ color: Colors.primarySurface, borderless: true }}
                >
                  <Text style={styles.keyBio}>☝</Text>
                </Pressable>
              );
            }
            return <View key="bio" style={styles.key} />;
          }
          if (k === 'del') {
            return (
              <Pressable
                key="del"
                onPress={() => press('del')}
                style={styles.key}
                android_ripple={{ color: Colors.borderLight, borderless: true }}
              >
                <Text style={styles.keyDel}>⌫</Text>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={k}
              onPress={() => press(k)}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              android_ripple={{ color: Colors.primarySurface, borderless: true }}
            >
              <Text style={styles.keyText}>{k}</Text>
            </Pressable>
          );
        })}
      </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1, backgroundColor: Colors.background, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: Spacing.xxl },
  brandWrap: { alignItems: 'center', marginBottom: Spacing.xxl },
  brandImage: { width: 200, height: 64 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  logoMark: {
    fontFamily: Typography.display,
    fontSize: 34,
    color: Colors.accent,
  },
  brand: {
    fontFamily: Typography.heading,
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    letterSpacing: 0.3,
  },
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
    paddingHorizontal: Spacing.xl,
  },
  dots: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  key: {
    width: '33.333%',
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { opacity: 0.5 },
  keyText: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.textPrimary,
  },
  keyDel: { fontSize: 26, color: Colors.textSecondary },
  keyBio: { fontSize: 26, color: Colors.primary },

  form: { width: '100%', paddingHorizontal: Spacing.xl, marginTop: Spacing.xl, gap: Spacing.sm },
  input: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    fontFamily: Typography.body,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  error: { fontFamily: Typography.body, fontSize: 13, color: Colors.danger, paddingHorizontal: Spacing.xs },
  cta: {
    marginTop: Spacing.sm,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 16, color: Colors.textInverse },
});

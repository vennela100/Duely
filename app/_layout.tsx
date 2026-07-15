import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
} from '@expo-google-fonts/geist';
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
  GeistMono_700Bold,
} from '@expo-google-fonts/geist-mono';

import { Colors } from '@/constants/theme';
import { type User } from '@/services/auth.service';
import { getOwnerName } from '@/services/localAuth';
import { maybeDailyBackup } from '@/services/backup';
import { maybeDailyDriveBackup } from '@/services/drive';
import { onCloudAuth } from '@/services/cloudAuth';
import { useUIStore } from '@/store/ui.store';
import { useCloudStore } from '@/store/cloud.store';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Toast } from '@/components/ui/Toast';

// Auth is a device-local PIN (services/localAuth) — no Firebase / network / console.
// A fixed local user keeps the data layer (which is local AsyncStorage) happy.
const LOCAL_USER = { uid: 'local', email: 'owner@device' } as unknown as User;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
    GeistMono_700Bold,
  });

  const unlocked = useUIStore((s) => s.unlocked);
  const authLoading = useUIStore((s) => s.authLoading);
  const setUser = useUIStore((s) => s.setUser);
  const setAuthLoading = useUIStore((s) => s.setAuthLoading);
  const setOwnerNameStore = useUIStore((s) => s.setOwnerName);

  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();

  const loadLang = useUIStore((s) => s.loadLang);

  useEffect(() => {
    setUser(LOCAL_USER);
    loadLang();
    getOwnerName().then((n) => {
      if (n) setOwnerNameStore(n);
      setAuthLoading(false);
    });
    // Daily backups (once per calendar day, non-blocking): on-device + Drive.
    maybeDailyBackup();
    maybeDailyDriveBackup();
    // Restore the persisted email + wire cloud sync to Firebase auth state.
    useCloudStore.getState().loadEmail();
    const unsubCloud = onCloudAuth((user) => {
      useCloudStore.getState().bind(user);
    });
    return unsubCloud;
  }, [setUser, setAuthLoading, setOwnerNameStore, loadLang]);

  useEffect(() => {
    if (!navState?.key || !fontsLoaded || authLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!unlocked && !inAuthGroup) {
      router.replace('/login');
    } else if (unlocked && inAuthGroup) {
      router.replace('/(tabs)/customers');
    }
  }, [navState?.key, fontsLoaded, authLoading, unlocked, segments, router]);

  if (!fontsLoaded || authLoading) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <LoadingScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.container}>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="customer/add"
              options={{ presentation: 'modal', title: 'Add Customer' }}
            />
            <Stack.Screen name="customer/[id]" options={{ headerShown: false }} />
            <Stack.Screen
              name="customer/edit/[id]"
              options={{ title: 'Edit Customer' }}
            />
            <Stack.Screen name="customer/txn/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="customer/profile/[id]" options={{ headerShown: false }} />
          </Stack>
          <Toast />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
});

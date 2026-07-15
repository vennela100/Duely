import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-expect-error — getReactNativePersistence is exported but not typed in firebase/auth
import { getReactNativePersistence, initializeAuth, getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDJMCQ7n5ResZ5WylFjRwCHZOzX_59oCuk',
  authDomain: 'duely-d2e9d.firebaseapp.com',
  projectId: 'duely-d2e9d',
  storageBucket: 'duely-d2e9d.firebasestorage.app',
  messagingSenderId: '563456704724',
  appId: '1:563456704724:web:3b329d403af69ac20ebb41',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

// React Native networking needs long-polling (WebChannel/streaming is flaky on
// some devices). Auto-detect avoids "could not reach Cloud Firestore backend".
export const db = (() => {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
})();
export { app };

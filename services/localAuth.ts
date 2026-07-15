import AsyncStorage from '@react-native-async-storage/async-storage';

// Device-local PIN auth. No Firebase / network / console needed. The PIN is the
// app lock (single user, single device) — same model as banking app lock screens.

const PIN_KEY = 'fl:pin';
const NAME_KEY = 'fl:ownerName';
const SIGNED_OUT_KEY = 'fl:signedOut';

// "Signed out" flag — set on Sign out so the next launch shows the sign-in page
// even though the PIN is kept (IRCTC-style: log in again, then your stored PIN).
export const setSignedOut = (): Promise<void> => AsyncStorage.setItem(SIGNED_OUT_KEY, '1');
export const clearSignedOut = (): Promise<void> => AsyncStorage.removeItem(SIGNED_OUT_KEY);
export const isSignedOut = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(SIGNED_OUT_KEY)) === '1';

export const hasPin = async (): Promise<boolean> => {
  const v = await AsyncStorage.getItem(PIN_KEY);
  return !!v && v.length > 0;
};

export const setPin = async (pin: string): Promise<void> => {
  await AsyncStorage.setItem(PIN_KEY, pin);
};

export const verifyPin = async (pin: string): Promise<boolean> => {
  const stored = await AsyncStorage.getItem(PIN_KEY);
  return stored === pin;
};

export const clearPin = async (): Promise<void> => {
  await AsyncStorage.removeItem(PIN_KEY);
};

export const getOwnerName = async (): Promise<string> => {
  return (await AsyncStorage.getItem(NAME_KEY)) ?? '';
};

export const setOwnerName = async (name: string): Promise<void> => {
  await AsyncStorage.setItem(NAME_KEY, name.trim());
};

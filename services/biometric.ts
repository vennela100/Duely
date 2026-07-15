import * as LocalAuthentication from 'expo-local-authentication';

// Face/fingerprint unlock. Present in dev/standalone builds and Expo Go.
export const canUseBiometric = async (): Promise<boolean> => {
  try {
    const hw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hw && enrolled;
  } catch {
    return false;
  }
};

export const promptBiometric = async (): Promise<boolean> => {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Duely',
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
    });
    return r.success;
  } catch {
    return false;
  }
};

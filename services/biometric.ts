import * as LocalAuthentication from 'expo-local-authentication';
import { useUIStore } from '@/store/ui.store';
import { translate } from '@/utils/i18n';

// The system fingerprint prompt can briefly send the app to the background.
// AppLock checks this so a prompt opened by the app doesn't re-lock it.
let promptActive = false;
export const isBiometricPromptActive = (): boolean => promptActive;

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
  promptActive = true;
  try {
    const lang = useUIStore.getState().lang;
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: translate(lang, 'auth.unlockDuely'),
      fallbackLabel: translate(lang, 'auth.usePin'),
      cancelLabel: translate(lang, 'common.cancel'),
    });
    return r.success;
  } catch {
    return false;
  } finally {
    // Let the AppState 'active' event from closing the prompt pass first.
    setTimeout(() => {
      promptActive = false;
    }, 800);
  }
};

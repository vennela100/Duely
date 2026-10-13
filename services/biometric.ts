import * as LocalAuthentication from 'expo-local-authentication';
import { useUIStore } from '@/store/ui.store';
import { translate } from '@/utils/i18n';

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
    const lang = useUIStore.getState().lang;
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: translate(lang, 'auth.unlockDuely'),
      fallbackLabel: translate(lang, 'auth.usePin'),
      cancelLabel: translate(lang, 'common.cancel'),
    });
    return r.success;
  } catch {
    return false;
  }
};

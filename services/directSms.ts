import { PermissionsAndroid, Platform } from 'react-native';
import { requireNativeModule } from 'expo';

// Direct device SMS via our local Expo native module (modules/smsdirect → Android
// SmsManager). Sends from the SIM with no composer. Android only; the native module
// exists only in a dev/standalone build (NOT Expo Go). Everything degrades to
// "unavailable" when the module is absent so Expo Go / iOS never crash.

let nativeModule: { sendSms: (p: string, m: string) => Promise<boolean> } | null = null;
try {
  if (Platform.OS === 'android') {
    nativeModule = requireNativeModule('Smsdirect');
  }
} catch {
  nativeModule = null;
}

export const isDirectSmsAvailable = (): boolean =>
  Platform.OS === 'android' && !!nativeModule;

const requestPermission = async (): Promise<boolean> => {
  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'Send SMS',
        message: 'Duely sends payment confirmations to customers via SMS.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

export const sendDirectSms = async (
  phone: string,
  message: string,
): Promise<{ ok: boolean; reason?: string }> => {
  if (!isDirectSmsAvailable() || !nativeModule) {
    return { ok: false, reason: 'Device SMS unavailable (needs Android dev build)' };
  }
  const number = phone.replace(/[^\d]/g, '').slice(-10);
  if (number.length < 10) return { ok: false, reason: 'Invalid number' };

  const granted = await requestPermission();
  if (!granted) return { ok: false, reason: 'SMS permission denied' };

  try {
    await nativeModule.sendSms(number, message);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.message ?? 'SMS failed' };
  }
};

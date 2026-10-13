import { PermissionsAndroid, Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUIStore } from '@/store/ui.store';
import { translate } from '@/utils/i18n';

// Direct device SMS via our local Expo native module (modules/smsdirect → Android
// SmsManager). Sends from the SIM with no composer. Android only; the native module
// exists only in a dev/standalone build (NOT Expo Go). Everything degrades to
// "unavailable" when the module is absent so Expo Go / iOS never crash.

export interface SmsSubscription {
  subscriptionId: number;
  slotIndex: number;
  label: string;
  carrierName: string;
  isDefault: boolean;
}

const PREFERRED_SMS_SUBSCRIPTION_KEY = 'duely:preferredSmsSubscriptionId:v2';

export const getPreferredSmsSubscriptionId = async (): Promise<number | null> => {
  try {
    const value = await AsyncStorage.getItem(PREFERRED_SMS_SUBSCRIPTION_KEY);
    if (value === null) return null;
    const subscriptionId = Number(value);
    return Number.isInteger(subscriptionId) && subscriptionId >= 0 ? subscriptionId : null;
  } catch {
    return null;
  }
};

export const setPreferredSmsSubscriptionId = async (subscriptionId: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(PREFERRED_SMS_SUBSCRIPTION_KEY, String(subscriptionId));
  } catch {
    // Sending still works when the device cannot persist this preference.
  }
};

let nativeModule: {
  sendSms: (p: string, m: string, subscriptionId: number | null) => Promise<boolean>;
  getSubscriptions: () => SmsSubscription[];
} | null = null;
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
    const t = (key: string) => translate(useUIStore.getState().lang, key);
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: t('sms.permissionTitle'),
        message: t('sms.permissionMessage'),
        buttonPositive: t('sms.allow'),
        buttonNegative: t('sms.deny'),
      },
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

export const getSmsSubscriptions = async (): Promise<SmsSubscription[]> => {
  if (!isDirectSmsAvailable() || !nativeModule) return [];
  try {
    const t = (key: string) => translate(useUIStore.getState().lang, key);
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      {
        title: t('sms.chooseSimTitle'),
        message: t('sms.chooseSimMessage'),
        buttonPositive: t('common.continue'),
        buttonNegative: t('common.cancel'),
      },
    );
    if (res !== PermissionsAndroid.RESULTS.GRANTED) return [];
    return nativeModule.getSubscriptions();
  } catch {
    return [];
  }
};

export const sendDirectSms = async (
  phone: string,
  message: string,
  subscriptionId: number | null = null,
): Promise<{ ok: boolean; reason?: string }> => {
  if (!isDirectSmsAvailable() || !nativeModule) {
    return { ok: false, reason: 'Device SMS unavailable (needs Android dev build)' };
  }
  const number = phone.replace(/[^\d]/g, '').slice(-10);
  if (number.length < 10) return { ok: false, reason: 'Invalid number' };

  const granted = await requestPermission();
  if (!granted) return { ok: false, reason: 'SMS permission denied' };

  try {
    await nativeModule.sendSms(number, message, subscriptionId);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.message ?? 'SMS failed' };
  }
};

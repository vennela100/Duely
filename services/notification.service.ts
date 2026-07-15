import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const ensurePermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
};

export const notifyLocal = async (title: string, body: string): Promise<void> => {
  const ok = await ensurePermission();
  if (!ok) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
};

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { BackupFile } from '@/services/backup';
import { useCloudStore } from '@/store/cloud.store';
import { listCloudBackups, restoreCloudBackup, restoreLatestCloud } from '@/services/cloudSync';
import {
  connectDrive,
  disconnectDrive,
  isDriveLinked,
  uploadDriveBackup,
  listDriveBackups,
  restoreDriveBackup,
  restoreLatestDrive,
} from '@/services/drive';

import { Colors, Glass, Radius, Spacing, Typography } from '@/constants/theme';
import { useCustomers } from '@/hooks/useCustomers';
import { useDashboardStats } from '@/hooks/useAnalytics';
import { useUIStore } from '@/store/ui.store';
import { clearPin, setOwnerName as persistOwnerName, setSignedOut } from '@/services/localAuth';
import { createBackup, exportBackup, listBackups, restoreBackup } from '@/services/backup';
import { clearAll } from '@/services/localdb';
import { seedDemoData } from '@/services/seed';
import { initialsOf, formatINR } from '@/utils/format';
import { useT, LANGUAGES } from '@/utils/i18n';
import { BrandBar } from '@/components/ui/BrandBar';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

// Premium avatar gradient-ish color picked deterministically from the name.
const AVATAR_COLORS = ['#1D8A3F', '#0A84FF', '#5E5CE6', '#FF9F0A', '#FF375F', '#30B0C7'];
const hashName = (n: string) => {
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h << 5) - h + n.charCodeAt(i);
  return Math.abs(h);
};

function Row({
  icon,
  label,
  value,
  danger,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.rowIcon, danger && { backgroundColor: Colors.dangerLight }]}>
        <Feather name={icon} size={17} color={danger ? Colors.danger : Colors.textPrimary} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: Colors.danger }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={18} color={Colors.textTertiary} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const ownerName = useUIStore((s) => s.ownerName);
  const setOwnerNameStore = useUIStore((s) => s.setOwnerName);
  const setUnlocked = useUIStore((s) => s.setUnlocked);
  const lang = useUIStore((s) => s.lang);
  const setLang = useUIStore((s) => s.setLang);
  const msgLang = useUIStore((s) => s.msgLang);
  const setMsgLang = useUIStore((s) => s.setMsgLang);
  const t = useT();
  const { customers } = useCustomers();
  const stats = useDashboardStats();

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [ownerNameOpen, setOwnerNameOpen] = useState(false);
  const [ownerNameDraft, setOwnerNameDraft] = useState('');

  // Wrap a heavy async action with a loading overlay so the UI never feels frozen.
  // Yields a frame first so the spinner paints before the blocking JSON work runs.
  const runBusy = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    await new Promise((r) => setTimeout(r, 16));
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  // Cloud (Firebase) sync
  const cloud = useCloudStore();
  const [cloudOpen, setCloudOpen] = useState(false);
  const [cloudEmail, setCloudEmail] = useState(cloud.email ?? '');
  const [cloudPw, setCloudPw] = useState('');
  const [cloudRestoreOpen, setCloudRestoreOpen] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<{ date: string }[]>([]);

  const connectCloud = async () => {
    if (!cloudEmail.trim() || cloudPw.length < 6) {
      Alert.alert(t('profile.checkDetails'), t('profile.enterEmailPassword'));
      return;
    }
    try {
      await cloud.connect(cloudEmail, cloudPw);
      setCloudPw('');
      setCloudOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert(t('profile.cloudConnectFailed'), t('common.error'));
    }
  };

  const restoreLatest = () => {
    if (!cloud.uid) return;
    Alert.alert(t('profile.restoreLatest'), t('profile.restoreLatestConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.restore'),
        style: 'destructive',
        onPress: () => runBusy(t('common.loading'), async () => {
          const res = await restoreLatestCloud(cloud.uid!);
          if (res.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert(t('profile.restored'), t('profile.latestCloudRestored'));
          } else {
            Alert.alert(t('profile.nothingToRestore'), t('common.error'));
          }
        }),
      },
    ]);
  };

  const openCloudRestore = () => {
    if (!cloud.uid) return;
    return runBusy(t('common.loading'), async () => {
      try {
        const list = await listCloudBackups(cloud.uid!);
        if (list.length === 0) {
          Alert.alert(t('profile.noCloudBackups'));
          return;
        }
        setCloudBackups(list);
        setCloudRestoreOpen(true);
      } catch (e) {
        Alert.alert(t('profile.couldNotLoad'), t('common.error'));
      }
    });
  };

  const doCloudRestore = (date: string) => {
    if (!cloud.uid) return;
    Alert.alert(t('profile.cloudRestore'), t('profile.restoreCloudConfirm').replace('{date}', date), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.restore'),
        style: 'destructive',
        onPress: () => runBusy(t('common.loading'), async () => {
          const res = await restoreCloudBackup(cloud.uid!, date);
          setCloudRestoreOpen(false);
          if (res.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert(t('profile.restored'), t('profile.restoredCloudSummary').replace('{date}', date));
          } else {
            Alert.alert(t('profile.restoreFailed'), t('common.error'));
          }
        }),
      },
    ]);
  };

  const disconnectCloud = () => {
    Alert.alert(
      t('profile.disconnect'),
      t('profile.disconnectCloudConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.disconnect'), style: 'destructive', onPress: () => cloud.disconnect() },
      ],
    );
  };

  const signOut = () => {
    Alert.alert(
      t('profile.signOut'),
      t('profile.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: async () => {
            await setSignedOut(); // next launch → sign-in page (PIN + data kept)
            await cloud.disconnect(); // stop sync + Firebase sign out
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            setUnlocked(false); // → login → sign-in page
          },
        },
      ],
    );
  };

  // Google Drive (each user's own Drive)
  const [driveLinked, setDriveLinked] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveRestoreOpen, setDriveRestoreOpen] = useState(false);
  const [driveBackups, setDriveBackups] = useState<{ id: string; date: string }[]>([]);

  useEffect(() => {
    isDriveLinked().then(setDriveLinked);
  }, []);

  const linkDrive = async () => {
    setDriveBusy(true);
    try {
      await connectDrive();
      await uploadDriveBackup();
      setDriveLinked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(t('profile.driveConnected'), t('profile.driveConnectedMessage'));
    } catch (e) {
      Alert.alert(t('profile.driveConnectFailed'), t('common.error'));
    } finally {
      setDriveBusy(false);
    }
  };

  const driveBackupNow = async () => {
    setDriveBusy(true);
    try {
      await uploadDriveBackup();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(t('profile.backupNow'), t('profile.driveBackupComplete'));
    } catch (e) {
      Alert.alert(t('profile.backupFailed'), t('common.error'));
    } finally {
      setDriveBusy(false);
    }
  };

  const driveRestoreLatest = () => {
    Alert.alert(t('profile.restoreLatest'), t('profile.driveRestoreLatestConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.restore'),
        style: 'destructive',
        onPress: () => runBusy(t('common.loading'), async () => {
          const res = await restoreLatestDrive();
          if (res.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert(t('profile.restored'), t('profile.latestDriveRestored'));
          } else {
            Alert.alert(t('profile.nothingToRestore'), t('common.error'));
          }
        }),
      },
    ]);
  };

  const openDriveRestore = () => runBusy(t('common.loading'), async () => {
    try {
      const list = await listDriveBackups();
      if (list.length === 0) {
        Alert.alert(t('profile.noDriveBackups'));
        return;
      }
      setDriveBackups(list);
      setDriveRestoreOpen(true);
    } catch (e) {
      Alert.alert(t('profile.couldNotLoad'), t('common.error'));
    }
  });

  const doDriveRestore = (b: { id: string; date: string }) => {
    Alert.alert(t('profile.cloudRestore'), t('profile.restoreDriveConfirm').replace('{date}', b.date), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.restore'),
        style: 'destructive',
        onPress: () => runBusy(t('common.loading'), async () => {
          const res = await restoreDriveBackup(b.id);
          setDriveRestoreOpen(false);
          if (res.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert(t('profile.restored'), t('profile.restoredDriveSummary').replace('{date}', b.date));
          } else {
            Alert.alert(t('profile.restoreFailed'), t('common.error'));
          }
        }),
      },
    ]);
  };

  const unlinkDrive = () => {
    Alert.alert(t('profile.disconnectDrive'), t('profile.disconnectDriveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.disconnect'),
        style: 'destructive',
        onPress: async () => {
          await disconnectDrive();
          setDriveLinked(false);
        },
      },
    ]);
  };

  const loadDemo = () => {
    Alert.alert(t('profile.loadDemo'), t('profile.demoConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.load'),
        onPress: () => runBusy(t('profile.working'), async () => {
          const res = await seedDemoData(55);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Alert.alert(t('common.completed'), `${res.customers} ${t('profile.customers')}, ${res.entries} ${t('profile.entries')}`);
        }),
      },
    ]);
  };

  const backupAll = () => runBusy(t('profile.working'), async () => {
    const results: string[] = [];
    try { await createBackup(); results.push(`${t('profile.onDevice')} ✓`); } catch { results.push(`${t('profile.onDevice')} ✗`); }
    try { await cloud.backupNow(); results.push(`Firebase ✓`); } catch { results.push(`Firebase ✗`); }
    try { await uploadDriveBackup(); results.push(`${t('profile.drive')} ✓`); } catch { results.push(`${t('profile.drive')} ✗`); }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(t('profile.backupAll'), results.join('\n'));
  });

  const clearDataDev = () => {
    Alert.alert(t('profile.clearTestData'), t('profile.clearDataConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.clear'),
        style: 'destructive',
        onPress: () => runBusy(t('profile.working'), async () => {
          await clearAll();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          Alert.alert(t('common.completed'), t('profile.allDataCleared'));
        }),
      },
    ]);
  };

  const name = ownerName || t('auth.owner');
  const avatarColor = AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];

  const editOwnerName = () => {
    setOwnerNameDraft(ownerName);
    setOwnerNameOpen(true);
  };

  const saveOwnerName = async () => {
    const nextName = ownerNameDraft.trim();
    if (!nextName) {
      Alert.alert(t('profile.ownerNameRequired'));
      return;
    }
    try {
      await persistOwnerName(nextName);
      setOwnerNameStore(nextName);
      setOwnerNameOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const lock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setUnlocked(false);
  };

  const backupNow = () => runBusy(t('profile.working'), async () => {
    try {
      const f = await createBackup();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(t('profile.backupSaved'), t('profile.backupSavedMessage').replace('{date}', f.date));
    } catch (e) {
      Alert.alert(t('profile.backupFailed'), t('common.error'));
    }
  });

  const exportNow = () => runBusy(t('profile.working'), async () => {
    const res = await exportBackup();
    if (!res.ok) Alert.alert(t('profile.exportFailed'), t('common.error'));
  });

  const openRestore = async () => {
    const files = await listBackups();
    if (files.length === 0) {
      Alert.alert(t('profile.noBackupsMessage'));
      return;
    }
    setBackups(files);
    setRestoreOpen(true);
  };

  const doRestore = (f: BackupFile) => {
    Alert.alert(t('profile.restore'), t('profile.restoreBackupConfirm').replace('{date}', f.date), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.restore'),
        style: 'destructive',
        onPress: () => runBusy(t('profile.working'), async () => {
          const res = await restoreBackup(f.uri);
          setRestoreOpen(false);
          if (res.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert(t('profile.restored'), t('profile.restoredDeviceSummary').replace('{date}', f.date));
          } else {
            Alert.alert(t('profile.restoreFailed'), t('common.error'));
          }
        }),
      },
    ]);
  };

  const clearData = () => {
    Alert.alert(t('profile.clearData'), t('profile.clearDataConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => runBusy(t('profile.working'), async () => {
          await createBackup().catch(() => {});
          await clearAll();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          Alert.alert(t('common.completed'), t('profile.allDataCleared'));
        }),
      },
    ]);
  };

  const resetPin = () => {
    Alert.alert(t('profile.resetPin'), t('profile.resetPinConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.reset'),
        style: 'destructive',
        onPress: async () => {
          await clearPin();
          setUnlocked(false);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandBar title={t('tab.profile')} />

        {/* Identity */}
        <View style={[styles.identity, { marginTop: Spacing.lg }]}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          </View>
          <View style={styles.identityNameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Pressable
              onPress={editOwnerName}
              accessibilityRole="button"
              accessibilityLabel={t('profile.editName')}
              hitSlop={8}
              style={styles.editNameButton}
            >
              <Feather name="edit-2" size={15} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.tag}>Duely · {t('profile.tagline')}</Text>
        </View>

        {/* Stat strip */}
        <View style={styles.statStrip}>
          <Stat value={String(customers.length)} label={t('profile.customers')} />
          <View style={styles.vline} />
          <Stat value={formatINR(stats.totalCollectedAll)} label={t('common.collected')} small />
          <View style={styles.vline} />
          <Stat value={formatINR(stats.netProfit)} label={t('profile.profit')} small accent />
        </View>

        {/* Language */}
        <Text style={styles.sectionLabel}>{t('profile.language').toUpperCase()}</Text>
        <View style={styles.group}>
          {LANGUAGES.map((l, i) => (
            <View key={l.code}>
              <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={() => setLang(l.code)}>
                <View style={styles.rowIcon}>
                  <Feather name="globe" size={17} color={Colors.textPrimary} />
                </View>
                <Text style={styles.rowLabel}>{l.native}</Text>
                {lang === l.code ? <Feather name="check" size={18} color={Colors.success} /> : null}
              </Pressable>
              {i < LANGUAGES.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>

        {/* Collection receipt language */}
        <Text style={styles.sectionLabel}>{t('profile.msgLanguage').toUpperCase()}</Text>
        <View style={styles.group}>
          {LANGUAGES.map((l, i) => (
            <View key={l.code}>
              <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={() => setMsgLang(l.code)}>
                <View style={styles.rowIcon}>
                  <Feather name="message-circle" size={17} color={Colors.textPrimary} />
                </View>
                <Text style={styles.rowLabel}>{l.native}</Text>
                {msgLang === l.code ? <Feather name="check" size={18} color={Colors.success} /> : null}
              </Pressable>
              {i < LANGUAGES.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
        <Text style={styles.hint}>{t('profile.msgLanguageHint')}</Text>

        {/* Settings */}
        <Text style={styles.sectionLabel}>{t('profile.security').toUpperCase()}</Text>
        <View style={styles.group}>
          <Row icon="lock" label={t('profile.lockNow')} onPress={lock} />
          <View style={styles.divider} />
          <Row icon="key" label={t('profile.resetPin')} onPress={resetPin} />
          <View style={styles.divider} />
          <Row icon="log-out" label={t('profile.signOut')} danger onPress={signOut} />
        </View>

        <Text style={styles.sectionLabel}>{t('profile.about').toUpperCase()}</Text>
        <View style={styles.group}>
          <Row icon="shield" label={t('profile.data')} value={t('profile.onDevice')} />
          <View style={styles.divider} />
          <Row icon="info" label={t('profile.version')} value="1.0.2" />
        </View>

        {/* Data & backup — fully on-device, no cloud / Firebase */}
        <Text style={styles.sectionLabel}>{t('profile.dataBackup').toUpperCase()}</Text>
        <View style={styles.group}>
          <Row icon="save" label={t('profile.backupNow')} onPress={backupNow} />
          <View style={styles.divider} />
          <Row icon="share" label={t('profile.exportBackup')} onPress={exportNow} />
          <View style={styles.divider} />
          <Row icon="rotate-ccw" label={t('profile.restore')} onPress={openRestore} />
          <View style={styles.divider} />
          <Row icon="trash-2" label={t('profile.clearData')} danger onPress={clearData} />
        </View>
        <Text style={styles.hint}>{t('profile.backupHint')}</Text>

        {/* Cloud sync — Firebase (live + dated backups) */}
        <Text style={styles.sectionLabel}>{t('profile.cloud').toUpperCase()}</Text>
        {cloud.status === 'off' ? (
          <>
            <View style={styles.warning}>
              <Feather name="alert-triangle" size={16} color={Colors.warning} />
              <Text style={styles.warningText}>{t('profile.uninstallWarning')}</Text>
            </View>
            <View style={styles.group}>
              <Row icon="cloud" label={t('profile.connectCloud')} onPress={() => { setCloudEmail(cloud.email ?? ''); setCloudOpen(true); }} />
            </View>
          </>
        ) : (
          <View style={styles.group}>
            <Row icon="cloud" label={cloud.email ?? t('profile.cloud')} value={cloudStatusText(cloud.status, t)} />
            <View style={styles.divider} />
            <Row icon="refresh-cw" label={t('profile.syncNow')} onPress={() => runBusy(t('profile.cloudSyncing'), () => cloud.syncNow())} />
            <View style={styles.divider} />
            <Row icon="download-cloud" label={t('profile.restoreLatest')} onPress={restoreLatest} />
            <View style={styles.divider} />
            <Row icon="cloud-lightning" label={t('profile.cloudRestore')} onPress={openCloudRestore} />
            <View style={styles.divider} />
            <Row icon="cloud-off" label={t('profile.disconnect')} onPress={disconnectCloud} />
          </View>
        )}
        <Text style={styles.hint}>{t('profile.cloudHint')}</Text>

        {/* Google Drive — each user's own Drive (2nd backup copy) */}
        <Text style={styles.sectionLabel}>{t('profile.drive').toUpperCase()}</Text>
        {!driveLinked ? (
          <View style={styles.group}>
            <Row icon="hard-drive" label={driveBusy ? t('profile.cloudConnecting') : t('profile.connectDrive')} onPress={driveBusy ? undefined : linkDrive} />
          </View>
        ) : (
          <View style={styles.group}>
            <Row icon="hard-drive" label={t('profile.driveConnected')} value={driveBusy ? '…' : undefined} />
            <View style={styles.divider} />
            <Row icon="upload-cloud" label={t('profile.backupNow')} onPress={driveBusy ? undefined : driveBackupNow} />
            <View style={styles.divider} />
            <Row icon="download-cloud" label={t('profile.restoreLatest')} onPress={driveRestoreLatest} />
            <View style={styles.divider} />
            <Row icon="rotate-ccw" label={t('profile.cloudRestore')} onPress={openDriveRestore} />
            <View style={styles.divider} />
            <Row icon="log-out" label={t('profile.disconnect')} danger onPress={unlinkDrive} />
          </View>
        )}
        <Text style={styles.hint}>{t('profile.driveHint')}</Text>

        {__DEV__ ? (
          <>
            <Text style={styles.sectionLabel}>{t('profile.developerTest').toUpperCase()}</Text>
            <View style={styles.group}>
              <Row icon="database" label={t('profile.loadDemo')} onPress={loadDemo} />
              <View style={styles.divider} />
              <Row icon="upload-cloud" label={t('profile.backupAll')} onPress={backupAll} />
              <View style={styles.divider} />
              <Row icon="trash-2" label={t('profile.clearTestData')} danger onPress={clearDataDev} />
            </View>
          </>
        ) : null}

        <View style={[styles.group, { marginTop: Spacing.xl }]}>
          <Row icon="log-out" label={t('profile.lockExit')} danger onPress={lock} />
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Loading overlay for heavy backup / sync / restore actions */}
      <Modal visible={!!busy} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.busyOverlay}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.busyText}>{busy}</Text>
          </View>
        </View>
      </Modal>

      {/* Owner name stays in the script and spelling the user enters. */}
      <Modal visible={ownerNameOpen} transparent animationType="slide" onRequestClose={() => setOwnerNameOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOwnerNameOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('profile.editName')}</Text>
            <TextInput
              style={styles.input}
              value={ownerNameDraft}
              onChangeText={setOwnerNameDraft}
              placeholder={t('profile.ownerName')}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveOwnerName}
            />
            <Pressable style={styles.primaryBtn} onPress={saveOwnerName}>
              <Text style={styles.primaryBtnText}>{t('common.save')}</Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setOwnerNameOpen(false)}>
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Restore picker — full date-wise history, newest first */}
      <Modal visible={restoreOpen} transparent animationType="slide" onRequestClose={() => setRestoreOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRestoreOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('profile.restore')}</Text>
            <Text style={styles.sheetSub}>{t('profile.backupCount').replace('{count}', String(backups.length))}</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {backups.map((f, i) => (
                <View key={f.name}>
                  <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={() => doRestore(f)}>
                    <View style={styles.rowIcon}>
                      <Feather name="clock" size={17} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.rowLabel}>{f.date}</Text>
                    <Text style={styles.rowValue}>{Math.max(1, Math.round(f.size / 1024))} KB</Text>
                    <Feather name="rotate-ccw" size={16} color={Colors.textTertiary} />
                  </Pressable>
                  {i < backups.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.sheetCancel} onPress={() => setRestoreOpen(false)}>
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Connect cloud — email + password */}
      <Modal visible={cloudOpen} transparent animationType="slide" onRequestClose={() => setCloudOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCloudOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('profile.connectCloud')}</Text>
            <Text style={styles.sheetSub}>{t('profile.cloudHint')}</Text>
            <TextInput
              style={styles.input}
              value={cloudEmail}
              onChangeText={setCloudEmail}
              placeholder={t('profile.email')}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              value={cloudPw}
              onChangeText={setCloudPw}
              placeholder={t('auth.password')}
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
            />
            <Pressable
              style={[styles.primaryBtn, cloud.status === 'connecting' && { opacity: 0.6 }]}
              disabled={cloud.status === 'connecting'}
              onPress={connectCloud}
            >
              <Text style={styles.primaryBtnText}>
                {cloud.status === 'connecting' ? t('profile.cloudConnecting') : t('profile.connectCloud')}
              </Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setCloudOpen(false)}>
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Restore from cloud — dated backups in Firebase */}
      <Modal visible={cloudRestoreOpen} transparent animationType="slide" onRequestClose={() => setCloudRestoreOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCloudRestoreOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('profile.cloudRestore')}</Text>
            <Text style={styles.sheetSub}>{t('profile.cloudBackupCount').replace('{count}', String(cloudBackups.length))}</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {cloudBackups.map((b, i) => (
                <View key={b.date}>
                  <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={() => doCloudRestore(b.date)}>
                    <View style={styles.rowIcon}>
                      <Feather name="cloud" size={17} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.rowLabel}>{b.date}</Text>
                    <Feather name="rotate-ccw" size={16} color={Colors.textTertiary} />
                  </Pressable>
                  {i < cloudBackups.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.sheetCancel} onPress={() => setCloudRestoreOpen(false)}>
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Restore from Google Drive — dated backups in the user's Drive */}
      <Modal visible={driveRestoreOpen} transparent animationType="slide" onRequestClose={() => setDriveRestoreOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDriveRestoreOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('profile.cloudRestore')}</Text>
            <Text style={styles.sheetSub}>{t('profile.driveBackupCount').replace('{count}', String(driveBackups.length))}</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {driveBackups.map((b, i) => (
                <View key={b.id}>
                  <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={() => doDriveRestore(b)}>
                    <View style={styles.rowIcon}>
                      <Feather name="hard-drive" size={17} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.rowLabel}>{b.date}</Text>
                    <Feather name="rotate-ccw" size={16} color={Colors.textTertiary} />
                  </Pressable>
                  {i < driveBackups.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.sheetCancel} onPress={() => setDriveRestoreOpen(false)}>
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function cloudStatusText(status: string, t: (k: string) => string): string {
  switch (status) {
    case 'connecting': return t('profile.cloudConnecting');
    case 'syncing': return t('profile.cloudSyncing');
    case 'synced': return t('profile.cloudSynced');
    case 'error': return t('profile.cloudError');
    default: return '';
  }
}

function Stat({ value, label, small, accent }: { value: string; label: string; small?: boolean; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text
        style={[styles.statValue, small && { fontSize: 16 }, accent && { color: Colors.amountPositive }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  title: { fontFamily: Typography.display, fontSize: 32, color: Colors.textPrimary, letterSpacing: -0.8, marginTop: Spacing.sm },

  identity: { alignItems: 'center', marginTop: Spacing.xl },
  identityNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' },
  editNameButton: { marginTop: Spacing.md, marginLeft: Spacing.xs, padding: 6 },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Typography.display, fontSize: 32, color: Colors.textInverse },
  name: { flexShrink: 1, maxWidth: '88%', textAlign: 'center', fontFamily: Typography.display, fontSize: 22, color: Colors.textPrimary, marginTop: Spacing.md, letterSpacing: -0.5 },
  tag: { fontFamily: Typography.body, fontSize: 13, color: Colors.textTertiary, marginTop: 4 },

  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    ...Glass,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  vline: { width: 1, height: 30, backgroundColor: Colors.border },
  statValue: { fontFamily: Typography.display, fontSize: 18, color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontFamily: Typography.body, fontSize: 11, color: Colors.textTertiary, marginTop: 4 },

  sectionLabel: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textTertiary, letterSpacing: 1, marginTop: Spacing.xl, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  hint: { fontFamily: Typography.body, fontSize: 12, color: Colors.textTertiary, marginTop: Spacing.sm, marginLeft: Spacing.xs, lineHeight: 17 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  warningText: { flex: 1, fontFamily: Typography.body, fontSize: 12.5, color: Colors.textSecondary, lineHeight: 18 },
  group: { borderRadius: Radius.lg, ...Glass, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textPrimary },
  rowValue: { fontFamily: Typography.body, fontSize: 13, color: Colors.textTertiary, marginRight: 6 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 62 },

  backdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xl },
  sheetTitle: { fontFamily: Typography.display, fontSize: 20, color: Colors.textPrimary, letterSpacing: -0.4 },
  sheetSub: { fontFamily: Typography.body, fontSize: 12, color: Colors.textTertiary, marginTop: 2, marginBottom: Spacing.sm },
  sheetCancel: { marginTop: Spacing.md, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: Radius.lg, backgroundColor: Colors.surfaceElevated },
  sheetCancelText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textPrimary },
  input: { height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, marginTop: Spacing.sm, fontFamily: Typography.body, fontSize: 15, color: Colors.textPrimary },
  primaryBtn: { marginTop: Spacing.md, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: Radius.lg, backgroundColor: Colors.primary },
  primaryBtnText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textInverse },
  busyOverlay: { flex: 1, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center' },
  busyCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.xxl, alignItems: 'center', gap: Spacing.md, minWidth: 180 },
  busyText: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.textPrimary },
});

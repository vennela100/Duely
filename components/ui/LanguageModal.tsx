import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useUIStore } from '@/store/ui.store';
import { LANGUAGES, useT } from '@/utils/i18n';

export function LanguageModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const lang = useUIStore((s) => s.lang);
  const setLang = useUIStore((s) => s.setLang);
  const t = useT();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{t('profile.language')}</Text>
          {LANGUAGES.map((l, i) => (
            <View key={l.code}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  setLang(l.code);
                  onClose();
                }}
              >
                <Text style={styles.native}>{l.native}</Text>
                <Text style={styles.label}>{l.label}</Text>
                {lang === l.code ? <Feather name="check" size={18} color={Colors.success} /> : <View style={{ width: 18 }} />}
              </Pressable>
              {i < LANGUAGES.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg },
  title: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textPrimary, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  native: { fontFamily: Typography.heading, fontSize: 17, color: Colors.textPrimary },
  label: { flex: 1, fontFamily: Typography.body, fontSize: 13, color: Colors.textTertiary },
  divider: { height: 1, backgroundColor: Colors.borderLight },
});

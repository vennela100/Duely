import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

import { Calendar } from '@/components/ui/Calendar';
import { Avatar } from '@/components/ui/Avatar';
import { LineChart } from '@/components/charts/LineChart';
import { useDashboardStats, useRangeAnalytics } from '@/hooks/useAnalytics';
import { useEntriesInRange } from '@/hooks/useCollection';
import { useCustomers } from '@/hooks/useCustomers';
import { useUIStore } from '@/store/ui.store';
import { Colors, Glass, Radius, Spacing, Typography } from '@/constants/theme';
import { remainingAmount, calcProfit } from '@/utils/calc';
import { formatINR } from '@/utils/format';
import { today, addDaysISO, formatDisplay } from '@/utils/date';
import { useT } from '@/utils/i18n';
import { BrandBar } from '@/components/ui/BrandBar';
import type { CollectionEntry } from '@/types';

type PresetKey = 'today' | 'yesterday' | '1M' | '3M' | '6M' | '1Y';
const PRESETS: { key: PresetKey; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'yesterday', label: 'Yesterday', days: -1 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
];

type SheetType = null | 'outstanding' | 'net' | 'collected' | 'lent' | 'netcalc';

export default function ReportsScreen() {
  const stats = useDashboardStats();
  const { customers } = useCustomers();
  const showToast = useUIStore((s) => s.showToast);
  const t = useT();

  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [preset, setPreset] = useState<PresetKey | 'custom'>('today');
  const [picking, setPicking] = useState<null | 'from' | 'to'>(null);
  const [sheet, setSheet] = useState<SheetType>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const analytics = useRangeAnalytics(from, to);
  const { entries } = useEntriesInRange(from, to);

  const rangeEntries = useMemo(
    () => [...entries].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)),
    [entries],
  );
  const collectedTxns = useMemo(() => rangeEntries.filter((e) => (e.kind ?? 'received') === 'received'), [rangeEntries]);
  const lentTxns = useMemo(() => rangeEntries.filter((e) => e.kind === 'given'), [rangeEntries]);
  const rangeNet = analytics.receivedTotal - analytics.givenTotal;

  const chartData = useMemo(() => analytics.series.map((s) => ({ label: s.label, value: s.total })), [analytics.series]);

  const outstandingList = useMemo(
    () =>
      customers
        .filter((c) => c.status === 'active' && remainingAmount(c) > 0)
        .map((c) => ({ id: c.id, name: c.name, photo: c.photo, amount: remainingAmount(c) }))
        .sort((a, b) => b.amount - a.amount),
    [customers],
  );
  // Net profit detail = profit earned per customer (deal − given), opposite of outstanding.
  const profitByCustomer = useMemo(
    () =>
      customers
        .map((c) => ({ id: c.id, name: c.name, photo: c.photo, amount: calcProfit(c.dealAmount, c.givenAmount) }))
        .filter((c) => c.amount !== 0)
        .sort((a, b) => b.amount - a.amount),
    [customers],
  );

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setPreset(p.key);
    setSwitching(true);
    // Paint the spinner first, then change the range. The spinner clears as soon
    // as the new range's data lands (see effect on `entries` below).
    requestAnimationFrame(() => {
      if (p.key === 'today') {
        setFrom(today());
        setTo(today());
      } else if (p.key === 'yesterday') {
        const y = addDaysISO(today(), -1);
        setFrom(y);
        setTo(y);
      } else {
        setTo(today());
        setFrom(addDaysISO(today(), -(p.days - 1)));
      }
      // Safety net: clear the spinner even if the range (and data) didn't change.
      setTimeout(() => setSwitching(false), 1200);
    });
  };

  // Clear the period-switch spinner once the new range's entries have loaded.
  useEffect(() => {
    if (switching) setSwitching(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // ---- export ----
  const csvText = () => {
    const head = 'Date,Type,Amount,Customer';
    const rows = rangeEntries.map(
      (e) => `${e.date},${(e.kind ?? 'received') === 'given' ? 'Given' : 'Received'},${e.amount},"${e.customerName.replace(/"/g, "'")}"`,
    );
    return ['Duely Report', `${formatDisplay(from)} to ${formatDisplay(to)}`, `Collected,${analytics.receivedTotal}`, `Lent out,${analytics.givenTotal}`, '', head, ...rows].join('\n');
  };
  const htmlText = () => {
    const rows = rangeEntries
      .map((e) => `<tr><td>${formatDisplay(e.date)}</td><td style="color:${(e.kind ?? 'received') === 'given' ? '#D71920' : '#067A3D'}">${(e.kind ?? 'received') === 'given' ? 'Given' : 'Received'}</td><td style="text-align:right">${formatINR(e.amount)}</td><td>${e.customerName}</td></tr>`)
      .join('');
    return `<html><head><meta name="viewport" content="width=device-width"/><style>body{font-family:-apple-system,Helvetica,Arial;padding:28px;color:#111}h1{font-size:24px;margin:0}.sub{color:#888;margin:4px 0 20px}.cards{display:flex;gap:12px;margin-bottom:20px}.card{flex:1;border:1px solid #ECECEC;border-radius:14px;padding:14px}.lbl{color:#888;font-size:12px}.val{font-size:20px;font-weight:800;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px 6px;border-bottom:1px solid #EEE;text-align:left}th{color:#888}</style></head><body><h1>Duely Report</h1><div class="sub">${formatDisplay(from)} to ${formatDisplay(to)}</div><div class="cards"><div class="card"><div class="lbl">Collected</div><div class="val" style="color:#067A3D">${formatINR(analytics.receivedTotal)}</div></div><div class="card"><div class="lbl">Lent out</div><div class="val" style="color:#D71920">${formatINR(analytics.givenTotal)}</div></div><div class="card"><div class="lbl">Outstanding</div><div class="val">${formatINR(stats.outstandingTotal)}</div></div></div><table><tr><th>Date</th><th>Type</th><th style="text-align:right">Amount</th><th>Customer</th></tr>${rows}</table></body></html>`;
  };
  const fileName = (ext: string) => `Duely_${from}_to_${to}.${ext}`;

  const doShare = async (kind: 'pdf' | 'csv') => {
    setExportOpen(false);
    try {
      if (kind === 'pdf') {
        const { uri } = await Print.printToFileAsync({ html: htmlText() });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Report' });
      } else {
        const uri = `${FileSystem.cacheDirectory}${fileName('csv')}`;
        await FileSystem.writeAsStringAsync(uri, csvText());
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Report' });
      }
    } catch {
      showToast('Share failed', 'error');
    }
  };

  const doDownload = async (kind: 'pdf' | 'csv') => {
    setExportOpen(false);
    try {
      const SAF = FileSystem.StorageAccessFramework;
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;
      if (kind === 'pdf') {
        const { uri } = await Print.printToFileAsync({ html: htmlText() });
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const dest = await SAF.createFileAsync(perm.directoryUri, fileName('pdf'), 'application/pdf');
        await FileSystem.writeAsStringAsync(dest, b64, { encoding: 'base64' });
      } else {
        const dest = await SAF.createFileAsync(perm.directoryUri, fileName('csv'), 'text/csv');
        await FileSystem.writeAsStringAsync(dest, csvText());
      }
      showToast('Saved to device', 'success');
    } catch {
      showToast('Download failed', 'error');
    }
  };

  const sheetData: { title: string; sub: string; people?: typeof outstandingList; txns?: CollectionEntry[] } = useMemo(() => {
    switch (sheet) {
      case 'outstanding':
        return { title: t('common.totalOutstanding'), sub: `${outstandingList.length} · ${formatINR(stats.outstandingTotal)}`, people: outstandingList };
      case 'net':
        return { title: t('common.netProfit'), sub: `${profitByCustomer.length} · ${formatINR(stats.netProfit)}`, people: profitByCustomer };
      case 'netcalc':
        return { title: t('common.net'), sub: `${formatDisplay(from)} – ${formatDisplay(to)}` };
      case 'collected':
        return { title: t('common.collected'), sub: `${collectedTxns.length} ${t('common.payments')} · ${formatINR(analytics.receivedTotal)}`, txns: collectedTxns };
      case 'lent':
        return { title: t('common.lentOut'), sub: `${lentTxns.length} · ${formatINR(analytics.givenTotal)}`, txns: lentTxns };
      default:
        return { title: '', sub: '' };
    }
  }, [sheet, outstandingList, profitByCustomer, collectedTxns, lentTxns, stats, analytics, from, to, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandBar title={t('tab.reports')} />
        <View style={[styles.header, { marginTop: Spacing.sm }]}>
          <View />
          <Pressable style={styles.exportPill} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setExportOpen(true); }}>
            <Feather name="download" size={15} color={Colors.textPrimary} />
            <Text style={styles.exportPillText}>{t('reports.export')}</Text>
          </Pressable>
        </View>

        {/* Headline */}
        <View style={styles.headline}>
          <Pressable style={styles.hl} onPress={() => setSheet('outstanding')}>
            <View style={styles.hlLabelRow}><Text style={styles.hlLabel}>{t('common.totalOutstanding')}</Text><Feather name="chevron-right" size={14} color={Colors.textTertiary} /></View>
            <Text style={[styles.hlValue, { color: Colors.amountNegative }]} numberOfLines={1} adjustsFontSizeToFit>{formatINR(stats.outstandingTotal)}</Text>
            <Text style={styles.hlHint}>{t('common.tapDetails')}</Text>
          </Pressable>
          <View style={styles.hlSep} />
          <Pressable style={styles.hl} onPress={() => setSheet('net')}>
            <View style={styles.hlLabelRow}><Text style={styles.hlLabel}>{t('common.netProfit')}</Text><Feather name="chevron-right" size={14} color={Colors.textTertiary} /></View>
            <Text style={[styles.hlValue, { color: Colors.amountPositive }]} numberOfLines={1} adjustsFontSizeToFit>{formatINR(stats.netProfit)}</Text>
            <Text style={styles.hlHint}>{t('common.allTime')}</Text>
          </Pressable>
        </View>

        {/* Period */}
        <Text style={styles.sectionLabel}>{t('reports.period').toUpperCase()}</Text>
        <View style={styles.rangePills}>
          <Pressable style={styles.rangePill} onPress={() => setPicking('from')}>
            <Text style={styles.rangePillLabel}>{t('reports.from')}</Text>
            <Text style={styles.rangePillValue}>{formatDisplay(from)}</Text>
          </Pressable>
          <Feather name="arrow-right" size={16} color={Colors.textTertiary} />
          <Pressable style={styles.rangePill} onPress={() => setPicking('to')}>
            <Text style={styles.rangePillLabel}>{t('reports.to')}</Text>
            <Text style={styles.rangePillValue}>{formatDisplay(to)}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {PRESETS.map((p) => (
            <Pressable key={p.key} onPress={() => applyPreset(p)} style={[styles.preset, preset === p.key && styles.presetActive]}>
              <Text style={[styles.presetText, preset === p.key && styles.presetTextActive]}>
                {p.key === 'today' ? t('common.today') : p.key === 'yesterday' ? t('common.yesterday') : p.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Stats card — tappable */}
        <View style={styles.statsCard}>
          <Pressable style={styles.cs} onPress={() => setSheet('collected')}>
            <Text style={styles.csLabel}>{t('common.collected')}</Text>
            <Text style={[styles.csValue, { color: Colors.amountPositive }]} numberOfLines={1} adjustsFontSizeToFit>{formatINR(analytics.receivedTotal)}</Text>
          </Pressable>
          <View style={styles.csSep} />
          <Pressable style={styles.cs} onPress={() => setSheet('lent')}>
            <Text style={styles.csLabel}>{t('common.lentOut')}</Text>
            <Text style={[styles.csValue, { color: Colors.amountNegative }]} numberOfLines={1} adjustsFontSizeToFit>{formatINR(analytics.givenTotal)}</Text>
          </Pressable>
          <View style={styles.csSep} />
          <Pressable style={styles.cs} onPress={() => setSheet('netcalc')}>
            <Text style={styles.csLabel}>{t('common.net')}</Text>
            <Text style={[styles.csValue, { color: rangeNet >= 0 ? Colors.amountPositive : Colors.amountNegative }]} numberOfLines={1} adjustsFontSizeToFit>{formatINR(rangeNet)}</Text>
          </Pressable>
        </View>

        {/* Chart card */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{t('reports.cashFlow')}</Text>
          <Text style={styles.chartSub}>{formatDisplay(from)} – {formatDisplay(to)}</Text>
          <View style={{ height: Spacing.md }} />
          <LineChart data={chartData} height={190} />
        </View>

        {/* Transactions */}
        <View style={styles.txnHead}>
          <Text style={styles.sectionTitle}>{t('reports.transactions')}</Text>
          <Text style={styles.txnCount}>{rangeEntries.length}</Text>
        </View>
        {rangeEntries.length === 0 ? (
          <Text style={styles.empty}>{t('reports.noTxns')}</Text>
        ) : (
          rangeEntries.slice(0, 60).map((e, i) => <TxnRow key={e.id} e={e} last={i === Math.min(rangeEntries.length, 60) - 1} delay={i * 28} animate={i < 12} />)
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Detail sheet (outstanding / net / collected / lent) */}
      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrab} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{sheetData.title}</Text>
                <Text style={styles.sheetSub}>{sheetData.sub}</Text>
              </View>
              <Pressable onPress={() => setSheet(null)} hitSlop={10} style={styles.sheetClose}><Feather name="x" size={18} color={Colors.textSecondary} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {sheet === 'netcalc' ? (
                <View style={styles.calcBox}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>{t('common.collected')}</Text>
                    <Text style={[styles.calcVal, { color: Colors.amountPositive }]}>+{formatINR(analytics.receivedTotal)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>{t('common.lentOut')}</Text>
                    <Text style={[styles.calcVal, { color: Colors.amountNegative }]}>−{formatINR(analytics.givenTotal)}</Text>
                  </View>
                  <View style={styles.calcLine} />
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { color: Colors.textPrimary, fontFamily: Typography.heading }]}>{t('common.net')}</Text>
                    <Text style={[styles.calcVal, styles.calcNet, { color: rangeNet >= 0 ? Colors.amountPositive : Colors.amountNegative }]}>{formatINR(rangeNet)}</Text>
                  </View>
                </View>
              ) : null}
              {sheetData.people?.map((o, i) => {
                const negative = sheet === 'outstanding';
                return (
                  <View key={o.id}>
                    <View style={styles.osRow}>
                      <Avatar name={o.name} photo={o.photo} size={40} />
                      <Text style={styles.osName} numberOfLines={1}>{o.name}</Text>
                      <Text style={[styles.osDue, { color: negative ? Colors.amountNegative : Colors.amountPositive }]}>{formatINR(o.amount)}</Text>
                    </View>
                    {i < (sheetData.people?.length ?? 0) - 1 ? <View style={styles.divider} /> : null}
                  </View>
                );
              })}
              {sheetData.txns?.slice(0, 100).map((e, i) => <TxnRow key={e.id} e={e} last={i === Math.min(sheetData.txns?.length ?? 0, 100) - 1} delay={0} animate={false} />)}
              {(sheet !== 'netcalc' && (sheetData.people?.length ?? 0) === 0 && (sheetData.txns?.length ?? 0) === 0) ? (
                <Text style={styles.empty}>{t('reports.noTxns')}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export popup */}
      <Modal visible={exportOpen} transparent animationType="fade" onRequestClose={() => setExportOpen(false)}>
        <Pressable style={styles.exportBackdrop} onPress={() => setExportOpen(false)}>
          <Pressable style={styles.exportCard} onPress={() => {}}>
            <Text style={styles.exportTitle}>{t('reports.export')}</Text>
            <Text style={styles.exportSub}>{formatDisplay(from)} → {formatDisplay(to)}</Text>
            <View style={styles.exportGrid}>
              <ExportBtn icon="share-2" label={t('reports.sharePdf')} onPress={() => doShare('pdf')} />
              <ExportBtn icon="share-2" label={t('reports.shareCsv')} onPress={() => doShare('csv')} />
              <ExportBtn icon="download" label={t('reports.savePdf')} onPress={() => doDownload('pdf')} />
              <ExportBtn icon="download" label={t('reports.saveCsv')} onPress={() => doDownload('csv')} />
            </View>
            <Pressable style={styles.exportCancel} onPress={() => setExportOpen(false)}>
              <Text style={styles.exportCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Calendar */}
      <Modal visible={picking !== null} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.calBackdrop} onPress={() => setPicking(null)}>
          <Pressable style={styles.calSheet} onPress={() => {}}>
            <Text style={styles.calTitle}>{picking === 'from' ? 'From date' : 'To date'}</Text>
            <Calendar
              value={picking === 'from' ? from : to}
              onSelect={(iso) => {
                if (picking === 'from') { setFrom(iso); if (iso > to) setTo(iso); }
                else { setTo(iso); if (iso < from) setFrom(iso); }
                setPreset('custom');
                setPicking(null);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {switching ? (
        <View style={styles.switchOverlay} pointerEvents="none">
          <View style={styles.switchCard}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.switchText}>{t('common.loading')}</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const TxnRow = React.memo(function TxnRow({ e, last, delay, animate }: { e: CollectionEntry; last: boolean; delay: number; animate: boolean }) {
  const given = (e.kind ?? 'received') === 'given';
  const inner = (
    <>
      <View style={styles.txnRow}>
        <View style={[styles.txnIcon, { backgroundColor: given ? Colors.dangerLight : Colors.successLight }]}>
          <Feather name={given ? 'arrow-up-right' : 'arrow-down-left'} size={15} color={given ? Colors.amountNegative : Colors.amountPositive} />
        </View>
        <View style={styles.txnMid}>
          <Text style={styles.txnName} numberOfLines={1}>{e.customerName}</Text>
          <Text style={styles.txnDate}>{formatDisplay(e.date)} · {given ? 'Given' : 'Received'}</Text>
        </View>
        <Text style={[styles.txnAmount, { color: given ? Colors.amountNegative : Colors.amountPositive }]}>{given ? '−' : '+'}{formatINR(e.amount)}</Text>
      </View>
      {!last ? <View style={styles.divider} /> : null}
    </>
  );
  // Only the first few rows animate — animating dozens of rows on every period
  // change is what janked the screen.
  return animate ? <Animated.View entering={FadeInDown.delay(delay).duration(240)}>{inner}</Animated.View> : <View>{inner}</View>;
});

function ExportBtn({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <Feather name={icon} size={20} color={Colors.textPrimary} />
      <Text style={styles.exportBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  switchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  switchCard: { ...Glass, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  switchText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  title: { fontFamily: Typography.display, fontSize: 32, color: Colors.textPrimary, letterSpacing: -0.8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  exportPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  exportPillText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textPrimary },

  headline: { flexDirection: 'row', alignItems: 'flex-start', marginTop: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.xl, ...Glass },
  hl: { flex: 1 },
  hlLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hlSep: { width: 1, height: 52, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  hlLabel: { fontFamily: Typography.body, fontSize: 12, color: Colors.textTertiary },
  hlValue: { fontFamily: Typography.display, fontSize: 25, letterSpacing: -1, marginTop: 4 },
  hlHint: { fontFamily: Typography.body, fontSize: 11, color: Colors.textTertiary, marginTop: 4 },

  sectionLabel: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textTertiary, letterSpacing: 1, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  rangePills: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rangePill: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, ...Glass },
  rangePillLabel: { fontFamily: Typography.body, fontSize: 11, color: Colors.textTertiary },
  rangePillValue: { fontFamily: Typography.heading, fontSize: 14, color: Colors.textPrimary, marginTop: 2 },
  presetRow: { gap: Spacing.xs, marginTop: Spacing.sm, paddingRight: Spacing.lg },
  preset: { paddingVertical: 7, paddingHorizontal: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated },
  presetActive: { backgroundColor: Colors.primary },
  presetText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  presetTextActive: { color: Colors.textInverse },

  statsCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.xl, padding: Spacing.lg, marginTop: Spacing.md, ...Glass },
  csSep: { width: 1, height: 38, backgroundColor: Colors.border, marginHorizontal: Spacing.sm },
  cs: { flex: 1 },
  csLabel: { fontFamily: Typography.body, fontSize: 12, color: Colors.textTertiary },
  csValue: { fontFamily: Typography.display, fontSize: 19, letterSpacing: -0.5, marginTop: 4 },
  chartCard: { borderRadius: Radius.xl, padding: Spacing.lg, marginTop: Spacing.md, ...Glass },
  chartTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.3 },
  chartSub: { fontFamily: Typography.body, fontSize: 12, color: Colors.textTertiary, marginTop: 2 },

  txnHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xl, marginBottom: Spacing.sm },
  sectionTitle: { fontFamily: Typography.display, fontSize: 20, color: Colors.textPrimary, letterSpacing: -0.5 },
  txnCount: { fontFamily: Typography.heading, fontSize: 14, color: Colors.textTertiary },
  empty: { fontFamily: Typography.body, fontSize: 14, color: Colors.textTertiary, textAlign: 'center', marginVertical: Spacing.lg },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  txnIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  txnMid: { flex: 1, minWidth: 0 },
  txnName: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textPrimary },
  txnDate: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  txnAmount: { fontFamily: Typography.heading, fontSize: 16, letterSpacing: -0.3 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 50 },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: Colors.overlay },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sheetGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: Spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sheetTitle: { fontFamily: Typography.display, fontSize: 22, color: Colors.textPrimary, letterSpacing: -0.5 },
  sheetSub: { fontFamily: Typography.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  sheetClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  osRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  osName: { flex: 1, fontFamily: Typography.heading, fontSize: 15, color: Colors.textPrimary },
  osDue: { fontFamily: Typography.heading, fontSize: 16, letterSpacing: -0.3 },
  calcBox: { paddingVertical: Spacing.sm },
  calcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  calcLabel: { fontFamily: Typography.body, fontSize: 15, color: Colors.textSecondary },
  calcVal: { fontFamily: Typography.heading, fontSize: 17, letterSpacing: -0.3 },
  calcNet: { fontFamily: Typography.display, fontSize: 22 },
  calcLine: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },

  exportBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  exportCard: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  exportTitle: { fontFamily: Typography.display, fontSize: 20, color: Colors.textPrimary, letterSpacing: -0.5 },
  exportSub: { fontFamily: Typography.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.lg },
  exportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  exportBtn: { width: '47.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  exportBtnText: { fontFamily: Typography.heading, fontSize: 14, color: Colors.textPrimary },
  exportCancel: { marginTop: Spacing.md, paddingVertical: Spacing.md, alignItems: 'center' },
  exportCancelText: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textSecondary },

  calBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  calSheet: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg },
  calTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
});

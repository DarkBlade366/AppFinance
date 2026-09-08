import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAppColors } from '@/hooks/use-app-colors';
import * as db from '@/lib/db';
import { useRefresh } from '@/lib/refresh-context';
import { currentMonth } from '@/lib/utils';

export default function HomeScreen() {
  const sqlite = useSQLiteContext();
  const colors = useAppColors();
  const { version, refresh } = useRefresh();
  const [settings, setSettings] = useState<db.Settings | null>(null);
  const [capital, setCapital] = useState<{ CUP: number; USD: number } | null>(null);
  const [monthTotals, setMonthTotals] = useState<
    { CUP: { expense: number; income: number }; USD: { expense: number; income: number } } | null
  >(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const s = await db.getSettings(sqlite);
    setSettings(s);
    if (s.initialized) {
      const cap = await db.getCurrentCapital(sqlite);
      const { month, year } = currentMonth();
      const totals = await db.totalsInMonthByCurrency(sqlite, month, year);
      setCapital(cap);
      setMonthTotals(totals);
    }
  }, [sqlite]);

  useEffect(() => {
    load();
  }, [load, version]);

  if (!settings) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Cargando...</ThemedText>
      </ThemedView>
    );
  }

  if (!settings.initialized) {
    return <SettingsForm mode="setup" onDone={refresh} />;
  }

  if (editing) {
    return <SettingsForm mode="edit" initial={settings} onDone={() => setEditing(false)} />;
  }

  const rate = settings.exchangeRate;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Mi Capital</ThemedText>
        <ThemedText style={styles.subtitle}>
          Capital base: {db.formatMoney(settings.baseCUP, 'CUP')} ·{' '}
          {db.formatMoney(settings.baseUSD, 'USD')}
        </ThemedText>
      </ThemedView>

      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText type="subtitle">Capital actual</ThemedText>
        {capital && (
          <>
            <ThemedText style={[styles.capitalCup, { color: colors.success }]}>
              {db.formatMoney(capital.CUP, 'CUP')}
            </ThemedText>
            <ThemedText style={[styles.capitalUsd, { color: colors.tint }]}>
              {db.formatMoney(capital.USD, 'USD')}
            </ThemedText>
          </>
        )}
      </ThemedView>

      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText type="subtitle">Conversión según el toque</ThemedText>
        <ThemedText style={styles.rateText}>Toque: 1 USD = {rate} CUP</ThemedText>
        {capital && (
          <ThemedView style={styles.conversionRow}>
            <ThemedView style={[styles.conversionBox, { backgroundColor: colors.surface }]}>
              <ThemedText style={styles.conversionLabel}>Todo en USD</ThemedText>
              <ThemedText style={styles.conversionValue}>
                {db.formatMoney(capital.USD + capital.CUP / rate, 'USD')}
              </ThemedText>
            </ThemedView>
            <ThemedView style={[styles.conversionBox, { backgroundColor: colors.surface }]}>
              <ThemedText style={styles.conversionLabel}>Todo en CUP</ThemedText>
              <ThemedText style={styles.conversionValue}>
                {db.formatMoney(capital.CUP + capital.USD * rate, 'CUP')}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        )}
        <Pressable style={styles.linkButton} onPress={() => setEditing(true)}>
          <IconSymbol name="gearshape.fill" size={16} color={colors.tint} />
          <ThemedText style={[styles.linkText, { color: colors.tint }]}>
            Cambiar toque y capital base
          </ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText type="subtitle">Resumen del mes</ThemedText>
        {monthTotals && (
          <>
            <SummaryRow
              label="Ingresos"
              cup={monthTotals.CUP.income}
              usd={monthTotals.USD.income}
              colors={colors}
              positive
            />
            <SummaryRow
              label="Gastos"
              cup={monthTotals.CUP.expense}
              usd={monthTotals.USD.expense}
              colors={colors}
            />
          </>
        )}
      </ThemedView>
    </ScrollView>
  );
}

function SummaryRow({
  label,
  cup,
  usd,
  colors,
  positive,
}: {
  label: string;
  cup: number;
  usd: number;
  colors: (typeof Colors)['light'];
  positive?: boolean;
}) {
  const color = positive ? colors.success : colors.danger;
  return (
    <ThemedView style={styles.summaryRow}>
      <ThemedText style={styles.summaryLabel}>{label}</ThemedText>
      <ThemedView style={styles.summaryValues}>
        <ThemedText style={[styles.summaryAmount, { color }]}>
          {db.formatMoney(cup, 'CUP')}
        </ThemedText>
        <ThemedText style={[styles.summaryAmount, { color }]}>
          {db.formatMoney(usd, 'USD')}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

function SettingsForm({
  mode,
  initial,
  onDone,
}: {
  mode: 'setup' | 'edit';
  initial?: db.Settings;
  onDone: () => void;
}) {
  const sqlite = useSQLiteContext();
  const colors = useAppColors();
  const [cup, setCup] = useState(initial ? String(initial.baseCUP) : '');
  const [usd, setUsd] = useState(initial ? String(initial.baseUSD) : '');
  const [rate, setRate] = useState(initial ? String(initial.exchangeRate) : '');

  async function save() {
    const baseCUP = Number(cup) || 0;
    const baseUSD = Number(usd) || 0;
    const exchangeRate = Number(rate) || 0;
    if (exchangeRate <= 0) {
      Alert.alert('Error', 'Introduce un toque (tasa de cambio) válido.');
      return;
    }
    await db.saveSettings(sqlite, {
      baseCUP,
      baseUSD,
      exchangeRate,
      initialized: true,
    });
    onDone();
  }

  const title = mode === 'setup' ? 'Bienvenido' : 'Cambiar configuración';
  const subtitle =
    mode === 'setup'
      ? 'Configura tu capital base y el toque (tasa de cambio) para comenzar.'
      : 'Actualiza tu capital base y el toque. El capital actual se recalculará.';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">{title}</ThemedText>
        <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.label}>Capital base en CUP</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor={colors.icon}
          value={cup}
          onChangeText={setCup}
        />
      </ThemedView>

      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.label}>Capital base en USD</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor={colors.icon}
          value={usd}
          onChangeText={setUsd}
        />
      </ThemedView>

      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.label}>Toque: CUP por 1 USD (ej. 680)</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          keyboardType="numeric"
          placeholder="680"
          placeholderTextColor={colors.icon}
          value={rate}
          onChangeText={setRate}
        />
      </ThemedView>

      <Pressable style={[styles.primaryButton, { backgroundColor: colors.tint }]} onPress={save}>
        <ThemedText style={[styles.primaryButtonText, { color: colors.background }]}>
          {mode === 'setup' ? 'Guardar y empezar' : 'Guardar cambios'}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  header: { gap: 4, marginBottom: 4 },
  subtitle: { opacity: 0.7 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  capitalCup: { fontSize: 28, fontWeight: 'bold' },
  capitalUsd: { fontSize: 28, fontWeight: 'bold' },
  rateText: { opacity: 0.7 },
  conversionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  conversionBox: { flex: 1, borderRadius: 12, padding: 12, gap: 4 },
  conversionLabel: { opacity: 0.7, fontSize: 13 },
  conversionValue: { fontSize: 18, fontWeight: 'bold' },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  linkText: { fontWeight: '600' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontWeight: '600' },
  summaryValues: { flexDirection: 'row', gap: 16 },
  summaryAmount: { fontWeight: '600' },
  formGroup: { gap: 6 },
  label: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  primaryButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { fontWeight: 'bold', fontSize: 16 },
});
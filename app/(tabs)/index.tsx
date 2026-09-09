import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppLogo } from '@/components/ui/logo';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { useToast } from '@/components/toast';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { useRefresh } from '@/lib/refresh-context';
import { currentMonth, MONTH_NAMES } from '@/lib/utils';

type MonthTotals = {
  CUP: {
    expense: number;
    income: number;
    expenseCash: number;
    expenseTransfer: number;
    incomeCash: number;
    incomeTransfer: number;
  };
  USD: { expense: number; income: number };
};

type Capital = { CUP: { cash: number; transfer: number; total: number }; USD: number };

type EditTarget = 'capital' | 'rate' | null;

export default function HomeScreen() {
  const sqlite = useSQLiteContext();
  const { version, refresh } = useRefresh();
  const [settings, setSettings] = useState<db.Settings | null>(null);
  const [capital, setCapital] = useState<Capital | null>(null);
  const [monthTotals, setMonthTotals] = useState<MonthTotals | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  const load = useCallback(async () => {
    const s = await db.getSettings(sqlite);
    setSettings(s);
    if (s.initialized) {
      setCapital(await db.getCurrentCapital(sqlite));
      const { month, year } = currentMonth();
      setMonthTotals(await db.totalsInMonthByCurrency(sqlite, month, year));
    }
  }, [sqlite]);

  useEffect(() => {
    load();
  }, [load, version]);

  if (!settings) {
    return <LoadingScreen />;
  }
  if (!settings.initialized) {
    return <SettingsForm mode="setup" fields="all" onDone={refresh} />;
  }
  if (editTarget) {
    return (
      <SettingsForm
        mode="edit"
        fields={editTarget}
        initial={settings}
        onDone={() => {
          setEditTarget(null);
          refresh();
        }}
      />
    );
  }
  if (!capital) {
    return <LoadingScreen />;
  }

  const rate = settings.exchangeRate || 1;
  const now = currentMonth();
  const monthName = MONTH_NAMES[Number(now.month) - 1];
  const convertedCup = capital.CUP.total + capital.USD * rate;
  const convertedUsd = capital.USD + capital.CUP.total / rate;

  return (
    <Screen scroll>
      <ScreenHeader
        title="Mi capital"
        subtitle={`Capital base · ${monthName} ${now.year}`}
        right={<AppLogo />}
      />

      <Card style={styles.balanceCard}>
        <ThemedText style={styles.balanceLabel}>Capital total en CUP</ThemedText>
        <ThemedText style={[styles.balanceValue, { color: Colors.cup }]}>
          {db.formatMoney(capital.CUP.total, 'CUP')}
        </ThemedText>
        <ThemedText style={styles.cupBreakdown}>
          Efectivo: {db.formatMoney(capital.CUP.cash, 'CUP')}
        </ThemedText>
        <ThemedText style={styles.cupBreakdown}>
          Transferencia: {db.formatMoney(capital.CUP.transfer, 'CUP')}
        </ThemedText>
        <View style={styles.divider} />
        <ThemedText style={styles.balanceLabel}>Capital en USD</ThemedText>
        <ThemedText style={[styles.balanceValueUsd, { color: Colors.usd }]}>
          {db.formatMoney(capital.USD, 'USD')}
        </ThemedText>
        <Pressable style={styles.editLink} onPress={() => setEditTarget('capital')} hitSlop={8}>
          <ThemedText style={styles.editLinkText}>Ajustar capital</ThemedText>
          <IconSymbol name="chevron.right" size={16} color={Colors.tint} />
        </Pressable>
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Conversión al toque</ThemedText>
        <View style={styles.conversionRow}>
          <ThemedText style={styles.summaryLabel}>Total en CUP</ThemedText>
          <ThemedText style={[styles.summaryAmount, { color: Colors.cup }]}>
            {db.formatMoney(convertedCup, 'CUP')}
          </ThemedText>
        </View>
        <View style={styles.conversionRow}>
          <ThemedText style={styles.summaryLabel}>Total en USD</ThemedText>
          <ThemedText style={[styles.summaryAmount, { color: Colors.usd }]}>
            {db.formatMoney(convertedUsd, 'USD')}
          </ThemedText>
        </View>
        <View style={styles.divider} />
        <View style={styles.conversionBottom}>
          <View style={styles.badge}>
            <ThemedText style={[styles.badgeText, { color: Colors.tint }]}>
              Toque {rate}
            </ThemedText>
          </View>
          <Pressable onPress={() => setEditTarget('rate')} hitSlop={8} style={styles.editLink}>
            <ThemedText style={styles.editLinkText}>Ajustar toque</ThemedText>
            <IconSymbol name="chevron.right" size={16} color={Colors.tint} />
          </Pressable>
        </View>
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Resumen · {monthName}</ThemedText>
        {monthTotals && (
          <>
            <SummaryRow
              label="Ingresos"
              cup={monthTotals.CUP.income}
              usd={monthTotals.USD.income}
              cupCash={monthTotals.CUP.incomeCash}
              cupTransfer={monthTotals.CUP.incomeTransfer}
              positive
            />
            <SummaryRow
              label="Gastos"
              cup={monthTotals.CUP.expense}
              usd={monthTotals.USD.expense}
              cupCash={monthTotals.CUP.expenseCash}
              cupTransfer={monthTotals.CUP.expenseTransfer}
            />
            <View style={styles.divider} />
            <SummaryRow
              label="Balance"
              cup={monthTotals.CUP.income - monthTotals.CUP.expense}
              usd={monthTotals.USD.income - monthTotals.USD.expense}
              balance
            />
          </>
        )}
      </Card>
    </Screen>
  );
}

function SummaryRow({
  label,
  cup,
  usd,
  cupCash,
  cupTransfer,
  positive,
  balance,
}: {
  label: string;
  cup: number;
  usd: number;
  cupCash?: number;
  cupTransfer?: number;
  positive?: boolean;
  balance?: boolean;
}) {
  const color =
    balance || positive
      ? cup >= 0 && usd >= 0
        ? Colors.success
        : Colors.danger
      : Colors.danger;
  const sign = (positive || balance) && (cup > 0 || usd > 0) ? '+' : '';
  const showSplit = !balance && (cupCash ?? 0) + (cupTransfer ?? 0) > 0;
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryLeft}>
        <ThemedText style={[styles.summaryLabel, balance && styles.balanceLabelBig]}>
          {label}
        </ThemedText>
        {showSplit && (
          <>
            <ThemedText style={styles.summarySplit}>
              Efectivo {db.formatMoney(cupCash ?? 0, 'CUP')}
            </ThemedText>
            <ThemedText style={styles.summarySplit}>
              Transferencia {db.formatMoney(cupTransfer ?? 0, 'CUP')}
            </ThemedText>
          </>
        )}
      </View>
      <View style={styles.summaryValues}>
        <ThemedText style={[styles.summaryAmount, { color }]}>
          {sign}
          {db.formatMoney(cup, 'CUP')}
        </ThemedText>
        <ThemedText style={[styles.summaryAmount, { color }]}>
          {sign}
          {db.formatMoney(usd, 'USD')}
        </ThemedText>
      </View>
    </View>
  );
}

function LoadingScreen() {
  return (
    <Screen>
      <ThemedText style={styles.loading}>Cargando…</ThemedText>
    </Screen>
  );
}

function SettingsForm({
  mode,
  fields,
  initial,
  onDone,
}: {
  mode: 'setup' | 'edit';
  fields: 'all' | 'capital' | 'rate';
  initial?: db.Settings;
  onDone: () => void;
}) {
  const sqlite = useSQLiteContext();
  const toast = useToast();
  const [cupCash, setCupCash] = useState(initial ? String(initial.baseCUPcash) : '');
  const [cupTransfer, setCupTransfer] = useState(initial ? String(initial.baseCUPtransfer) : '');
  const [usd, setUsd] = useState(initial ? String(initial.baseUSD) : '');
  const [rate, setRate] = useState(initial ? String(initial.exchangeRate) : '');

  const showCapital = fields !== 'rate';
  const showRate = fields !== 'capital';

  async function save() {
    const baseCUPcash = Number(cupCash) || 0;
    const baseCUPtransfer = Number(cupTransfer) || 0;
    const baseUSD = Number(usd) || 0;
    const exchangeRate = Number(rate) || 0;
    if (showRate && exchangeRate <= 0) {
      Alert.alert('Toque inválido', 'Introduce un toque mayor que cero.');
      return;
    }
    await db.saveSettings(sqlite, {
      baseCUPcash,
      baseCUPtransfer,
      baseUSD,
      exchangeRate,
      initialized: true,
    });
    toast.show(mode === 'setup' ? 'Tu capital está listo' : 'Cambios guardados');
    onDone();
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title={
          fields === 'capital'
            ? 'Ajustar capital'
            : fields === 'rate'
              ? 'Ajustar toque'
              : mode === 'setup'
                ? 'Bienvenido a Cuentas Claras'
                : 'Configuración'
        }
        subtitle={
          fields === 'capital'
            ? 'Actualiza tu capital base actual (efectivo, transferencia y USD).'
            : fields === 'rate'
              ? 'Actualiza el toque de conversión (CUP por 1 USD).'
              : mode === 'setup'
                ? 'Define tu capital base (efectivo y transferencia), el capital en USD y el toque (tasa informal) para empezar.'
                : 'Actualiza el capital base y el toque.'
        }
      />

      <Card>
        {showCapital && (
          <>
            <Field
              label="Capital base en CUP · efectivo"
              value={cupCash}
              onChange={setCupCash}
              placeholder="0.00"
            />
            <Field
              label="Capital base en CUP · transferencia"
              value={cupTransfer}
              onChange={setCupTransfer}
              placeholder="0.00"
            />
            <Field label="Capital base en USD" value={usd} onChange={setUsd} placeholder="0.00" />
          </>
        )}
        {showRate && (
          <Field
            label="Toque · CUP por 1 USD"
            value={rate}
            onChange={setRate}
            placeholder="680"
          />
        )}
      </Card>

      <Pressable style={styles.primaryButton} onPress={save}>
        <ThemedText style={styles.primaryButtonText}>
          {mode === 'setup' ? 'Guardar y empezar' : 'Guardar cambios'}
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.muted}
        value={value}
        onChangeText={onChange}
        selectionColor={Colors.tint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { color: Colors.muted, textAlign: 'center', marginTop: 40 },
  balanceCard: { gap: 8 },
  balanceLabel: { fontSize: 13, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  balanceValueUsd: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  cupBreakdown: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  conversionBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { borderWidth: 1, borderColor: Colors.tint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editLinkText: { color: Colors.tint, fontWeight: '700', fontSize: 14 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  summaryLeft: { flex: 1, gap: 3 },
  summaryLabel: { fontWeight: '600', color: Colors.text, fontSize: 15 },
  summarySplit: { fontSize: 12, color: Colors.muted },
  balanceLabelBig: { fontWeight: '700', fontSize: 16 },
  summaryValues: { alignItems: 'flex-end', gap: 3 },
  summaryAmount: { fontWeight: '700', fontSize: 14 },
  divider: { height: 1, backgroundColor: Colors.border },
  primaryButton: {
    backgroundColor: Colors.tint,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: Colors.onAccent, fontWeight: '800', fontSize: 16 },
  fieldWrap: { gap: 8 },
  fieldLabel: { fontSize: 14, color: Colors.muted, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
});
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExchangeDraft, ExchangeForm } from '@/components/exchange-form';
import { ThemedText } from '@/components/themed-text';
import { TransactionForm, TransactionDraft } from '@/components/transaction-form';
import { AppLogo } from '@/components/ui/logo';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { useToast } from '@/components/toast';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { useRefresh } from '@/lib/refresh-context';
import { todayISO } from '@/lib/utils';

type Mode = 'expense' | 'income' | 'exchange';

function fmtRate(r: number): string {
  if (!r || r <= 0) return '0';
  if (r >= 0.01) {
    return r.toLocaleString('es-CU', { maximumFractionDigits: 2 });
  }
  return r.toLocaleString('es-CU', { maximumFractionDigits: 6 });
}

const MODES: { key: Mode; label: string; color: string }[] = [
  { key: 'expense', label: 'Gasto', color: Colors.danger },
  { key: 'income', label: 'Ingreso', color: Colors.success },
  { key: 'exchange', label: 'Cambio', color: Colors.tint },
];

export default function NewTransactionScreen() {
  const sqlite = useSQLiteContext();
  const toast = useToast();
  const { refresh } = useRefresh();
  const [formKey, setFormKey] = useState(0);
  const [mode, setMode] = useState<Mode>('expense');

  function reset() {
    setFormKey((k) => k + 1);
    refresh();
  }

  async function onSave(draft: TransactionDraft) {
    await db.addTransaction(sqlite, {
      ...draft,
      date: todayISO(),
    });
    const verb = draft.type === 'income' ? 'Ingreso' : 'Gasto';
    toast.show(`${verb} de ${db.formatMoney(draft.amount, draft.currency)} registrado correctamente`);
    reset();
  }

  async function onSaveExchange(draft: ExchangeDraft) {
    const receiveCurrency = draft.giveCurrency === 'CUP' ? 'USD' : 'CUP';
    const cup = draft.giveCurrency === 'CUP' ? draft.giveAmount : draft.receiveAmount;
    const usd = draft.giveCurrency === 'CUP' ? draft.receiveAmount : draft.giveAmount;
    const rate = cup > 0 && usd > 0 ? cup / usd : 0;
    await db.addTransaction(sqlite, {
      type: 'exchange',
      amount: draft.giveAmount,
      currency: draft.giveCurrency,
      method: draft.giveMethod,
      categoryId: null,
      note: draft.note,
      date: todayISO(),
      toAmount: draft.receiveAmount,
      toCurrency: receiveCurrency,
      rate,
    });
    toast.show(
      `Cambio registrado: ${db.formatMoney(draft.receiveAmount, receiveCurrency)} por ${db.formatMoney(
        draft.giveAmount,
        draft.giveCurrency
      )} (1 USD = ${fmtRate(rate)} CUP)`
    );
    reset();
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="Nueva operación"
        subtitle={
          mode === 'exchange'
            ? 'Registra un cambio de moneda CUP ↔ USD'
            : 'Registra un ingreso o un gasto'
        }
        right={<AppLogo />}
      />

      <View style={styles.segmentRow}>
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <Pressable
              key={m.key}
              style={[
                styles.segment,
                { borderColor: active ? m.color : Colors.border },
                active && { backgroundColor: m.color },
              ]}
              onPress={() => setMode(m.key)}>
              <ThemedText style={[styles.segmentText, active && { color: '#FFFFFF' }]}>
                {m.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {mode === 'exchange' ? (
        <ExchangeForm key={formKey} submitLabel="Guardar cambio" onSubmit={onSaveExchange} />
      ) : (
        <TransactionForm
          key={`${mode}-${formKey}`}
          typeLocked
          initial={{ type: mode }}
          submitLabel="Guardar movimiento"
          submitIcon={mode === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
          onSubmit={onSave}
          onCategoryCreated={(name) => toast.show(`Categoría "${name}" creada`)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmentRow: { flexDirection: 'row', gap: 10 },
  segment: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  segmentText: { fontWeight: '700', fontSize: 16, color: Colors.muted },
});
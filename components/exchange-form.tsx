import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Currency, PaymentMethod } from '@/lib/schema';

export interface ExchangeDraft {
  giveAmount: number;
  giveCurrency: Currency;
  giveMethod: PaymentMethod;
  receiveAmount: number;
  note: string | null;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

function parseAmount(value: string): number {
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function fmtRate(r: number): string {
  if (!r || r <= 0) return '0';
  if (r >= 0.01) {
    return r.toLocaleString('es-CU', { maximumFractionDigits: 2 });
  }
  return r.toLocaleString('es-CU', { maximumFractionDigits: 6 });
}

export function ExchangeForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: {
    giveAmount: number;
    giveCurrency: Currency;
    giveMethod: PaymentMethod;
    receiveAmount: number;
    note: string | null;
  };
  submitLabel: string;
  onSubmit: (draft: ExchangeDraft) => void;
}) {
  const sqlite = useSQLiteContext();
  const [giveCurrency, setGiveCurrency] = useState<Currency>(initial?.giveCurrency ?? 'CUP');
  const [method, setMethod] = useState<PaymentMethod>(initial?.giveMethod ?? 'cash');
  const [cupAmount, setCupAmount] = useState(
    initial
      ? initial.giveCurrency === 'CUP'
        ? String(initial.giveAmount)
        : String(initial.receiveAmount)
      : ''
  );
  const [usdAmount, setUsdAmount] = useState(
    initial
      ? initial.giveCurrency === 'CUP'
        ? String(initial.receiveAmount)
        : String(initial.giveAmount)
      : ''
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);

  const cup = parseAmount(cupAmount);
  const usd = parseAmount(usdAmount);
  const rate = cup > 0 && usd > 0 ? cup / usd : null;
  const givingCup = giveCurrency === 'CUP';
  const giveAmount = givingCup ? cup : usd;
  const receiveAmount = givingCup ? usd : cup;

  async function save() {
    if (!giveAmount || giveAmount <= 0) {
      Alert.alert('Monto no válido', 'Introduce cuánto entregas (mayor que cero).');
      return;
    }
    if (!receiveAmount || receiveAmount <= 0) {
      Alert.alert('Monto no válido', 'Introduce cuánto recibes (mayor que cero).');
      return;
    }
    const caps = await db.getCurrentCapital(sqlite);
    let available = givingCup
      ? method === 'transfer'
        ? caps.CUP.transfer
        : caps.CUP.cash
      : caps.USD;
    const sameBucket =
      giveCurrency === (initial?.giveCurrency ?? 'CUP') &&
      (givingCup || method === (initial?.giveMethod ?? 'cash'));
    if (initial && sameBucket && initial.giveAmount) {
      available += initial.giveAmount;
    }
    if (giveAmount > available + 0.0001) {
      const where = givingCup ? `en ${METHOD_LABELS[method].toLowerCase()}` : 'en dólares';
      setSaving(false);
      Alert.alert(
        'Saldo insuficiente',
        `Solo tienes ${db.formatMoney(Math.max(available, 0), giveCurrency)} disponibles ${where}.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Guardar de todas formas',
            style: 'destructive',
            onPress: () => submit(),
          },
        ]
      );
      return;
    }
    submit();
  }

  async function submit() {
    setSaving(true);
    try {
      await Promise.resolve(
        onSubmit({
          giveAmount,
          giveCurrency,
          giveMethod: method,
          receiveAmount,
          note: note.trim() || null,
        })
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Card>
        <ThemedText style={styles.cardLabel}>Qué entregaste</ThemedText>
        <View style={styles.currencyRow}>
          {(['CUP', 'USD'] as Currency[]).map((c) => {
            const activeC = giveCurrency === c;
            return (
              <Pressable
                key={c}
                style={[styles.currencyButton, { borderColor: activeC ? Colors.tint : Colors.border }]}
                onPress={() => setGiveCurrency(c)}>
                <ThemedText style={[styles.currencyText, { color: activeC ? Colors.tint : Colors.muted }]}>
                  {c}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <ThemedText style={styles.hintText}>
          {givingCup
            ? 'Entregaste CUP y recibiste USD por ellos.'
            : 'Entregaste USD y recibiste CUP por ellos.'}
        </ThemedText>
      </Card>

      <Card>
        <ThemedText style={styles.cardLabel}>Precio en CUP</ThemedText>
        <View style={[styles.amountInputWrap, { borderColor: Colors.border }]}>
          <ThemedText style={[styles.amountPrefix, { color: Colors.muted }]}>CUP</ThemedText>
          <TextInput
            style={[styles.input, styles.amountInput]}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.muted}
            value={cupAmount}
            onChangeText={setCupAmount}
            selectionColor={Colors.tint}
          />
        </View>

        <ThemedText style={styles.cardLabel}>Precio en dólares</ThemedText>
        <View style={[styles.amountInputWrap, { borderColor: Colors.border }]}>
          <ThemedText style={[styles.amountPrefix, { color: Colors.muted }]}>USD</ThemedText>
          <TextInput
            style={[styles.input, styles.amountInput]}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.muted}
            value={usdAmount}
            onChangeText={setUsdAmount}
            selectionColor={Colors.tint}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.rateRow}>
          <ThemedText style={styles.rateLabel}>A cómo cogiste el dólar</ThemedText>
          <ThemedText style={[styles.rateValue, { color: rate ? Colors.tint : Colors.muted }]}>
            {rate ? `1 USD = ${fmtRate(rate)} CUP` : '—'}
          </ThemedText>
        </View>
        <ThemedText style={styles.rateHint}>
          {rate ? `Se calculó con el precio en CUP ÷ precio en USD.` : 'Pon ambos precios y se calcula solo.'}
        </ThemedText>
        <View style={styles.divider} />
        <ThemedText style={styles.cardLabel}>
          {givingCup ? '¿De dónde sacas los CUP?' : '¿A dónde llegan los CUP?'}
        </ThemedText>
        <View style={styles.currencyRow}>
          {(['cash', 'transfer'] as PaymentMethod[]).map((m) => {
            const activeM = method === m;
            return (
              <Pressable
                key={m}
                style={[styles.currencyButton, { borderColor: activeM ? Colors.tint : Colors.border }]}
                onPress={() => setMethod(m)}>
                <ThemedText style={[styles.currencyText, { color: activeM ? Colors.tint : Colors.muted }]}>
                  {METHOD_LABELS[m]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <ThemedText style={styles.cardLabel}>Nota (opcional)</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Detalle del cambio…"
          placeholderTextColor={Colors.muted}
          value={note}
          onChangeText={setNote}
          selectionColor={Colors.tint}
        />
      </Card>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: Colors.tint, opacity: saving ? 0.6 : 1 }]}
        onPress={save}
        disabled={saving}>
        <ThemedText style={[styles.primaryButtonText, { color: Colors.onAccent }]}>
          {saving ? 'Guardando…' : submitLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  cardLabel: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  hintText: { fontSize: 12, color: Colors.muted },
  currencyRow: { flexDirection: 'row', gap: 10 },
  currencyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  currencyText: { fontWeight: '700', fontSize: 15 },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  amountPrefix: { fontWeight: '700', fontSize: 13, marginRight: 10 },
  amountInput: { borderWidth: 0, flex: 1, paddingLeft: 0 },
  divider: { height: 1, backgroundColor: Colors.border },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rateLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rateValue: { fontWeight: '800', fontSize: 16 },
  rateHint: { fontSize: 12, color: Colors.muted },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
  primaryButton: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontWeight: '800', fontSize: 16 },
});
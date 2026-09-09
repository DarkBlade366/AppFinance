import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Category, Currency, PaymentMethod, TransactionType } from '@/lib/schema';

export interface TransactionDraft {
  type: TransactionType;
  amount: number;
  currency: Currency;
  method: PaymentMethod | null;
  categoryId: number | null;
  note: string | null;
  changeCup: number | null;
}

const METHOD_LABELS: Record<Exclude<PaymentMethod, null>, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export function TransactionForm({
  initial,
  submitLabel,
  submitIcon = 'check',
  typeLocked,
  onSubmit,
  onCategoryCreated,
}: {
  initial?: Partial<TransactionDraft>;
  submitLabel: string;
  submitIcon?: 'check' | 'arrow-up-circle' | 'arrow-down-circle';
  typeLocked?: boolean;
  onSubmit: (draft: TransactionDraft) => void;
  onCategoryCreated?: (name: string) => void;
}) {
  const sqlite = useSQLiteContext();
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'CUP');
  const [method, setMethod] = useState<PaymentMethod>(initial?.method ?? 'cash');
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [changeCup, setChangeCup] = useState(
    initial?.changeCup ? String(initial.changeCup) : ''
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    const list = await db.getCategories(sqlite, type);
    setCategories(list);
    setCategoryId((current) => {
      if (current !== null && list.some((c) => c.id === current)) return current;
      return null;
    });
  }, [sqlite, type]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const isIncome = type === 'income';
  const accent = isIncome ? Colors.success : Colors.danger;

  async function save() {
    const value = Number(amount);
    if (!value || value <= 0) {
      Alert.alert('Monto no válido', 'Introduce un monto mayor que cero.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Falta la categoría', 'Elige o crea una categoría para registrar el movimiento.');
      return;
    }
    const cc = type === 'expense' && currency === 'USD' && Number(changeCup) > 0 ? Number(changeCup) : null;
    if (type === 'expense') {
      const caps = await db.getCurrentCapital(sqlite);
      let available =
        currency === 'USD'
          ? caps.USD
          : method === 'transfer'
            ? caps.CUP.transfer
            : caps.CUP.cash;
      const sameBucket =
        currency === (initial?.currency ?? 'CUP') &&
        (currency !== 'CUP' || method === (initial?.method ?? 'cash'));
      if (initial && sameBucket && initial.amount) {
        available += initial.amount;
      }
      if (value > available + 0.0001) {
        const where =
          currency === 'USD'
            ? 'en dólares'
            : `en ${METHOD_LABELS[method as Exclude<PaymentMethod, null>].toLowerCase()}`;
        setSaving(false);
        Alert.alert(
          'Saldo insuficiente',
          `Solo tienes ${db.formatMoney(Math.max(available, 0), currency)} disponibles ${where}.`,
          [
            {
              text: 'Cancelar',
              style: 'cancel',
            },
            {
              text: 'Guardar de todas formas',
              style: 'destructive',
              onPress: () =>
                submit({
                  type,
                  amount: value,
                  currency,
                  method: currency === 'CUP' ? method : null,
                  categoryId,
                  note: note.trim() || null,
                  changeCup: cc,
                }),
            },
          ]
        );
        return;
      }
    }
    submit({
      type,
      amount: value,
      currency,
      method: currency === 'CUP' ? method : null,
      categoryId,
      note: note.trim() || null,
      changeCup: cc,
    });
  }

  async function submit(draft: TransactionDraft) {
    setSaving(true);
    try {
      await Promise.resolve(onSubmit(draft));
    } finally {
      setSaving(false);
    }
  }

  async function addNewCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para la categoría.');
      return;
    }
    const id = await db.addCategory(sqlite, name, type);
    setShowNewCategory(false);
    setNewCategoryName('');
    setCategoryId(id);
    await loadCategories();
    onCategoryCreated?.(name);
  }

  return (
    <View style={styles.wrap}>
      {!typeLocked && (
        <View style={styles.segmentRow}>
        <Pressable
          style={[
            styles.segment,
            { borderColor: !isIncome ? Colors.danger : Colors.border },
            !isIncome && { backgroundColor: Colors.danger },
          ]}
          onPress={() => setType('expense')}>
          <IconSymbol
            name="arrow-up-circle"
            size={18}
            color={!isIncome ? '#FFFFFF' : Colors.muted}
          />
          <ThemedText style={[styles.segmentText, !isIncome && { color: '#FFFFFF' }]}>
            Gasto
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            { borderColor: isIncome ? Colors.success : Colors.border },
            isIncome && { backgroundColor: Colors.success },
          ]}
          onPress={() => setType('income')}>
          <IconSymbol
            name="arrow-down-circle"
            size={18}
            color={isIncome ? '#FFFFFF' : Colors.muted}
          />
          <ThemedText style={[styles.segmentText, isIncome && { color: '#FFFFFF' }]}>
            Ingreso
          </ThemedText>
        </Pressable>
      </View>
      )}

      <Card>
        <ThemedText style={styles.cardLabel}>Monto</ThemedText>
        <View style={[styles.amountInputWrap, { borderColor: Colors.border }]}>
          <ThemedText style={[styles.amountPrefix, { color: Colors.muted }]}>
            {currency === 'CUP' ? 'CUP' : 'USD'}
          </ThemedText>
          <TextInput
            style={[styles.input, styles.amountInput]}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.muted}
            value={amount}
            onChangeText={setAmount}
            selectionColor={Colors.tint}
          />
        </View>

        <ThemedText style={styles.cardLabel}>Moneda</ThemedText>
        <View style={styles.currencyRow}>
          {(['CUP', 'USD'] as Currency[]).map((c) => {
            const activeC = currency === c;
            return (
              <Pressable
                key={c}
                style={[
                  styles.currencyButton,
                  { borderColor: activeC ? Colors.tint : Colors.border },
                ]}
                onPress={() => setCurrency(c)}>
                <ThemedText
                  style={[styles.currencyText, { color: activeC ? Colors.tint : Colors.muted }]}>
                  {c}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {currency === 'CUP' && (
          <>
            <ThemedText style={styles.cardLabel}>Tipo de pago</ThemedText>
            <View style={styles.currencyRow}>
              {(['cash', 'transfer'] as Exclude<PaymentMethod, null>[]).map((m) => {
                const activeM = method === m;
                const mAccent = activeM ? Colors.tint : Colors.border;
                return (
                  <Pressable
                    key={m}
                    style={[
                      styles.currencyButton,
                      { borderColor: mAccent, flexDirection: 'row', gap: 6 },
                    ]}
                    onPress={() => setMethod(m)}>
                    <IconSymbol
                      name={m === 'cash' ? 'banknote' : 'arrow.right.circle'}
                      size={16}
                      color={activeM ? Colors.tint : Colors.muted}
                    />
                    <ThemedText
                      style={[styles.currencyText, { color: activeM ? Colors.tint : Colors.muted }]}>
                      {METHOD_LABELS[m]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </Card>

      {type === 'expense' && currency === 'USD' && (
        <Card>
          <ThemedText style={styles.cardLabel}>Vuelto en CUP (opcional)</ThemedText>
          <ThemedText style={styles.hintText}>
            Si pagaste de más en dólares y te devolvieron cambio en CUP.
          </ThemedText>
          <View style={[styles.amountInputWrap, { borderColor: Colors.border }]}>
            <ThemedText style={[styles.amountPrefix, { color: Colors.muted }]}>CUP</ThemedText>
            <TextInput
              style={[styles.input, styles.amountInput]}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.muted}
              value={changeCup}
              onChangeText={setChangeCup}
              selectionColor={Colors.tint}
            />
          </View>
        </Card>
      )}

      <Card>
        <ThemedText style={styles.cardLabel}>
          Categoría {isIncome ? 'del ingreso' : 'del gasto'}
        </ThemedText>

        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>
              Todavía no tienes categorías de {isIncome ? 'ingresos' : 'gastos'}.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.chips}>
            {categories.map((c) => {
              const active = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[
                    styles.chip,
                    { borderColor: active ? accent : Colors.border },
                    active && { backgroundColor: accent },
                  ]}
                  onPress={() => setCategoryId(active ? null : c.id)}>
                  <ThemedText
                    style={[styles.chipText, { color: active ? '#FFFFFF' : Colors.text }]}>
                    {c.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {showNewCategory ? (
          <View style={styles.newCategoryRow}>
            <TextInput
              style={[styles.input, styles.newCategoryInput]}
              placeholder="Nombre de la categoría"
              placeholderTextColor={Colors.muted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
              selectionColor={Colors.tint}
            />
            <Pressable
              style={[styles.addCatButton, { backgroundColor: accent }]}
              onPress={addNewCategory}>
              <ThemedText style={[styles.addCatText, { color: '#FFFFFF' }]}>Añadir</ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.newCategoryLink} onPress={() => setShowNewCategory(true)}>
            <IconSymbol name="plus.circle.fill" size={16} color={Colors.tint} />
            <ThemedText style={[styles.newCategoryLinkText, { color: Colors.tint }]}>
              Crear nueva categoría
            </ThemedText>
          </Pressable>
        )}
      </Card>

      <Card>
        <ThemedText style={styles.cardLabel}>Nota (opcional)</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Detalle del movimiento…"
          placeholderTextColor={Colors.muted}
          value={note}
          onChangeText={setNote}
          selectionColor={Colors.tint}
        />
      </Card>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: accent, opacity: saving ? 0.6 : 1 }]}
        onPress={save}
        disabled={saving}>
        <IconSymbol name={submitIcon} size={18} color="#FFFFFF" />
        <ThemedText style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>
          {saving ? 'Guardando…' : submitLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  segmentRow: { flexDirection: 'row', gap: 12 },
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
  segmentText: { fontWeight: '700', fontSize: 16 },
  cardLabel: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  hintText: { fontSize: 12, color: Colors.muted, marginBottom: 8 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
  },
  chipText: { fontWeight: '600', fontSize: 15 },
  emptyState: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16 },
  emptyText: { color: Colors.muted, fontSize: 14 },
  newCategoryRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  newCategoryInput: { flex: 1 },
  addCatButton: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  addCatText: { fontWeight: '700' },
  newCategoryLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  newCategoryLinkText: { fontWeight: '600', fontSize: 15 },
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
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { fontWeight: '800', fontSize: 16 },
});
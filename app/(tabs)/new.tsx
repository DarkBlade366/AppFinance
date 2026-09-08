import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppColors } from '@/hooks/use-app-colors';
import * as db from '@/lib/db';
import { useRefresh } from '@/lib/refresh-context';
import { Category, Currency, TransactionType } from '@/lib/schema';
import { todayISO } from '@/lib/utils';

export default function NewTransactionScreen() {
  const sqlite = useSQLiteContext();
  const colors = useAppColors();
  const { refresh } = useRefresh();
  const [type, setType] = useState<TransactionType>('expense');
  const [currency, setCurrency] = useState<Currency>('CUP');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const loadCategories = useCallback(async () => {
    const list = await db.getCategories(sqlite, type);
    setCategories(list);
    setCategoryId((current) => {
      if (current !== null && list.some((c) => c.id === current)) return current;
      return null;
    });
  }, [sqlite, type]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setCategoryId(null);
    setShowNewCategory(false);
  }, [type, currency]);

  async function save() {
    const value = Number(amount);
    if (!value || value <= 0) {
      Alert.alert('Error', 'Introduce un monto válido.');
      return;
    }
    await db.addTransaction(sqlite, {
      type,
      amount: value,
      currency,
      categoryId,
      note: note.trim() || null,
      date: todayISO(),
    });
    setAmount('');
    setNote('');
    setCategoryId(null);
    refresh();
    Alert.alert('Listo', 'Transacción guardada.');
  }

  async function addNewCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const id = await db.addCategory(sqlite, name, type);
    await loadCategories();
    setCategoryId(id);
    setNewCategoryName('');
    setShowNewCategory(false);
  }

  const dangerColor = type === 'income' ? colors.success : colors.danger;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="title">Nueva operación</ThemedText>

      <ThemedView style={styles.segmentRow}>
        <Pressable
          style={[
            styles.segmentButton,
            { backgroundColor: colors.surface },
            type === 'expense' && { backgroundColor: colors.danger },
          ]}
          onPress={() => setType('expense')}>
          <ThemedText
            style={[styles.segmentText, type === 'expense' && { color: colors.dangerText }]}>
            Gasto
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.segmentButton,
            { backgroundColor: colors.surface },
            type === 'income' && { backgroundColor: colors.success },
          ]}
          onPress={() => setType('income')}>
          <ThemedText
            style={[styles.segmentText, type === 'income' && { color: colors.successText }]}>
            Ingreso
          </ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.label}>Moneda</ThemedText>
        <ThemedView style={styles.currencyRow}>
          {(['CUP', 'USD'] as Currency[]).map((c) => (
            <Pressable
              key={c}
              style={[
                styles.currencyButton,
                { backgroundColor: colors.surface },
                currency === c && { backgroundColor: colors.tint },
              ]}
              onPress={() => setCurrency(c)}>
              <ThemedText
                style={[styles.currencyText, currency === c && { color: colors.background }]}>
                {c}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.label}>Monto</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.icon}
          value={amount}
          onChangeText={setAmount}
        />
      </ThemedView>

      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.label}>Categoría</ThemedText>
        <ThemedView style={styles.categoryWrap}>
          {categories.map((c) => {
            const active = categoryId === c.id;
            return (
              <Pressable
                key={c.id}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  active && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
                onPress={() => setCategoryId(active ? null : c.id)}>
                <ThemedText style={[styles.chipText, active && { color: colors.background }]}>
                  {c.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
        {showNewCategory ? (
          <ThemedView style={styles.newCategoryRow}>
            <TextInput
              style={[
                styles.newCategoryInput,
                styles.input,
                { borderColor: colors.border, color: colors.text },
              ]}
              placeholder="Nombre de la categoría"
              placeholderTextColor={colors.icon}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <Pressable
              style={[styles.smallButton, { backgroundColor: colors.tint }]}
              onPress={addNewCategory}>
              <ThemedText style={[styles.smallButtonText, { color: colors.background }]}>
                Añadir
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <Pressable onPress={() => setShowNewCategory(true)}>
            <ThemedText style={[styles.newCategoryLink, { color: colors.tint }]}>
              + Nueva categoría
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>

      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.label}>Nota (opcional)</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="En qué... (ej. mercado, taxi, salario)"
          placeholderTextColor={colors.icon}
          value={note}
          onChangeText={setNote}
        />
      </ThemedView>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: dangerColor }]}
        onPress={save}>
        <ThemedText
          style={[
            styles.primaryButtonText,
            { color: type === 'income' ? colors.successText : colors.dangerText },
          ]}>
          {type === 'income' ? 'Añadir ingreso' : 'Registrar gasto'}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 18 },
  segmentRow: { flexDirection: 'row', gap: 12 },
  segmentButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  segmentText: { fontWeight: 'bold' },
  formGroup: { gap: 8 },
  label: { fontWeight: '600' },
  currencyRow: { flexDirection: 'row', gap: 12 },
  currencyButton: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  currencyText: { fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  chipText: { fontWeight: '600' },
  newCategoryRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  newCategoryInput: { flex: 1 },
  smallButton: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12 },
  smallButtonText: { fontWeight: 'bold' },
  newCategoryLink: { fontWeight: '600', marginTop: 4 },
  primaryButton: { borderRadius: 12, padding: 16, alignItems: 'center' },
  primaryButtonText: { fontWeight: 'bold', fontSize: 16 },
});
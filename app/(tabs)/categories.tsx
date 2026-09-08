import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppColors } from '@/hooks/use-app-colors';
import * as db from '@/lib/db';
import { useRefresh } from '@/lib/refresh-context';
import { Category, TransactionType } from '@/lib/schema';

export default function CategoriesScreen() {
  const sqlite = useSQLiteContext();
  const colors = useAppColors();
  const { version, refresh } = useRefresh();
  const [expenseCats, setExpenseCats] = useState<Category[]>([]);
  const [incomeCats, setIncomeCats] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');

  const load = useCallback(async () => {
    setExpenseCats(await db.getCategories(sqlite, 'expense'));
    setIncomeCats(await db.getCategories(sqlite, 'income'));
  }, [sqlite]);

  useEffect(() => {
    load();
  }, [load, version]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    await db.addCategory(sqlite, name, newType);
    setNewName('');
    refresh();
  }

  function confirmDelete(c: Category) {
    if (!c.isCustom) {
      Alert.alert('No se puede eliminar', 'Las categorías predefinidas no se pueden eliminar.');
      return;
    }
    Alert.alert('Eliminar', `¿Eliminar la categoría "${c.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await db.deleteCategory(sqlite, c.id);
          refresh();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="title">Categorías</ThemedText>
      <ThemedText style={styles.subtitle}>
        Crea tus propias categorías para gastos e ingresos.
      </ThemedText>

      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText type="subtitle">Añadir categoría</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Nombre (ej. Libras, Internet)"
          placeholderTextColor={colors.icon}
          value={newName}
          onChangeText={setNewName}
        />
        <ThemedView style={styles.typeRow}>
          {(['expense', 'income'] as TransactionType[]).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.typeButton,
                { backgroundColor: colors.surface },
                newType === t && { backgroundColor: colors.tint },
              ]}
              onPress={() => setNewType(t)}>
              <ThemedText
                style={[
                  styles.typeText,
                  newType === t && { color: colors.background },
                ]}>
                {t === 'expense' ? 'Gasto' : 'Ingreso'}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
        <Pressable style={[styles.primaryButton, { backgroundColor: colors.tint }]} onPress={add}>
          <ThemedText style={[styles.primaryButtonText, { color: colors.background }]}>
            Añadir
          </ThemedText>
        </Pressable>
      </ThemedView>

      <CategorySection title="Gastos" categories={expenseCats} colors={colors} onDelete={confirmDelete} />
      <CategorySection title="Ingresos" categories={incomeCats} colors={colors} onDelete={confirmDelete} />
    </ScrollView>
  );
}

function CategorySection({
  title,
  categories,
  colors,
  onDelete,
}: {
  title: string;
  categories: Category[];
  colors: ReturnType<typeof useAppColors>;
  onDelete: (c: Category) => void;
}) {
  return (
    <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {categories.map((c) => (
        <ThemedView
          key={c.id}
          style={[styles.categoryRow, { borderBottomColor: colors.border }]}>
          <ThemedText style={styles.categoryName}>{c.name}</ThemedText>
          <ThemedView style={styles.categoryRight}>
            {c.isCustom && (
              <Pressable onPress={() => onDelete(c)} hitSlop={8}>
                <IconSymbol name="trash" size={18} color={colors.danger} />
              </Pressable>
            )}
          </ThemedView>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  subtitle: { opacity: 0.7 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryName: { fontWeight: '600', fontSize: 16 },
  categoryRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeText: { fontWeight: 'bold' },
  primaryButton: { borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryButtonText: { fontWeight: 'bold', fontSize: 16 },
});
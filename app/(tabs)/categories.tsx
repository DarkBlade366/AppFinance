import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardProvider,
} from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppLogo } from '@/components/ui/logo';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { useToast } from '@/components/toast';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { useRefresh } from '@/lib/refresh-context';
import { Category, TransactionType } from '@/lib/schema';

export default function CategoriesScreen() {
  const sqlite = useSQLiteContext();
  const toast = useToast();
  const { version, refresh } = useRefresh();
  const [expenseCats, setExpenseCats] = useState<Category[]>([]);
  const [incomeCats, setIncomeCats] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [editing, setEditing] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setExpenseCats(await db.getCategories(sqlite, 'expense'));
    setIncomeCats(await db.getCategories(sqlite, 'income'));
  }, [sqlite]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos; los setState ocurren tras await
    load();
  }, [load, version]);

  async function add() {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para la categoría.');
      return;
    }
    await db.addCategory(sqlite, name, newType);
    toast.show(`Categoría "${name}" creada`);
    setNewName('');
    refresh();
  }

  function confirmDelete(c: Category) {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${c.name}"? Los movimientos asignados pasarán a "Sin categoría".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await db.deleteCategory(sqlite, c.id);
            toast.show('Categoría eliminada', 'info');
            refresh();
          },
        },
      ]
    );
  }

  return (
    <>
      <Screen scroll>
        <ScreenHeader
          title="Categorías"
          subtitle="Organiza tus gastos e ingresos como tú quieras."
          right={<AppLogo />}
        />

        <Card>
          <ThemedText style={styles.cardTitle}>Nueva categoría</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Nombre (ej. Libras, Internet, Remesa…)"
            placeholderTextColor={Colors.muted}
            value={newName}
            onChangeText={setNewName}
            selectionColor={Colors.tint}
          />
          <View style={styles.typeRow}>
            {(['expense', 'income'] as TransactionType[]).map((t) => {
              const active = newType === t;
              const accent = t === 'expense' ? Colors.danger : Colors.success;
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.typeButton,
                    { borderColor: active ? accent : Colors.border },
                    active && { backgroundColor: accent },
                  ]}
                  onPress={() => setNewType(t)}>
                  <ThemedText
                    style={[styles.typeText, { color: active ? '#FFFFFF' : Colors.muted }]}>
                    {t === 'expense' ? 'Gasto' : 'Ingreso'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={[styles.primaryButton, { backgroundColor: Colors.tint }]} onPress={add}>
            <IconSymbol name="plus.circle.fill" size={18} color={Colors.onAccent} />
            <ThemedText style={[styles.primaryButtonText, { color: Colors.onAccent }]}>
              Crear categoría
            </ThemedText>
          </Pressable>
        </Card>

        <CategorySection
          title="Gastos"
          categories={expenseCats}
          onEdit={setEditing}
          onDelete={confirmDelete}
        />
        <CategorySection
          title="Ingresos"
          categories={incomeCats}
          onEdit={setEditing}
          onDelete={confirmDelete}
        />
      </Screen>

      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}>
        <KeyboardProvider>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
            <Pressable style={styles.modalBackdrop} onPress={() => setEditing(null)} />
            {editing && <CategoryEditor key={editing.id} category={editing} onClose={() => setEditing(null)} />}
          </KeyboardAvoidingView>
        </KeyboardProvider>
      </Modal>
    </>
  );
}

function CategoryEditor({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) {
  const sqlite = useSQLiteContext();
  const toast = useToast();
  const { refresh } = useRefresh();
  const [name, setName] = useState(category.name);
  const [type, setType] = useState<TransactionType>(category.type);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Nombre requerido', 'La categoría debe tener un nombre.');
      return;
    }
    await db.updateCategory(sqlite, category.id, { name: trimmed, type });
    toast.show('Categoría actualizada');
    onClose();
    refresh();
  }

  const accent = type === 'expense' ? Colors.danger : Colors.success;

  return (
    <View style={[styles.modalCard, { borderColor: Colors.border }]}>
      <View style={styles.modalHeader}>
        <ThemedText style={styles.modalTitle}>Editar categoría</ThemedText>
        <Pressable onPress={onClose} hitSlop={8}>
          <IconSymbol name="close" size={22} color={Colors.muted} />
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Nombre"
        placeholderTextColor={Colors.muted}
        value={name}
        onChangeText={setName}
        autoFocus
        selectionColor={Colors.tint}
      />
      <View style={styles.typeRow}>
        {(['expense', 'income'] as TransactionType[]).map((t) => {
          const active = type === t;
          const a = t === 'expense' ? Colors.danger : Colors.success;
          return (
            <Pressable
              key={t}
              style={[
                styles.typeButton,
                { borderColor: active ? a : Colors.border },
                active && { backgroundColor: a },
              ]}
              onPress={() => setType(t)}>
              <ThemedText style={[styles.typeText, { color: active ? '#FFFFFF' : Colors.muted }]}>
                {t === 'expense' ? 'Gasto' : 'Ingreso'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <Pressable style={[styles.primaryButton, { backgroundColor: accent }]} onPress={save}>
        <IconSymbol name="check" size={18} color="#FFFFFF" />
        <ThemedText style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>Guardar</ThemedText>
      </Pressable>
    </View>
  );
}

function CategorySection({
  title,
  categories,
  onEdit,
  onDelete,
}: {
  title: string;
  categories: Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  return (
    <Card>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
      {categories.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.empty}>Sin categorías todavía.</ThemedText>
        </View>
      ) : (
        categories.map((c) => (
          <View key={c.id} style={[styles.catRow, { borderBottomColor: Colors.border }]}>
            <IconSymbol name="tag" size={16} color={Colors.icon} />
            <ThemedText style={styles.catName}>{c.name}</ThemedText>
            <Pressable onPress={() => onEdit(c)} hitSlop={8}>
              <IconSymbol name="edit" size={17} color={Colors.tint} />
            </Pressable>
            <Pressable onPress={() => onDelete(c)} hitSlop={8}>
              <IconSymbol name="trash" size={17} color={Colors.danger} />
            </Pressable>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  typeText: { fontWeight: '700', fontSize: 15 },
  primaryButton: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { fontWeight: '800', fontSize: 15 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catName: { flex: 1, color: Colors.text, fontWeight: '600', fontSize: 16 },
  emptyWrap: { paddingVertical: 10 },
  empty: { color: Colors.muted, fontSize: 15 },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: Colors.text },
});
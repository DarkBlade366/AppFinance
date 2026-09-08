import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppColors } from '@/hooks/use-app-colors';
import * as db from '@/lib/db';
import { useRefresh } from '@/lib/refresh-context';
import { Category, CategoryAggregate, Transaction } from '@/lib/schema';
import { currentMonth, formatDate, MONTH_NAMES } from '@/lib/utils';

interface MergedCategory {
  categoryId: number;
  name: string;
  totalCUP: number;
  totalUSD: number;
}

export default function HistoryScreen() {
  const sqlite = useSQLiteContext();
  const colors = useAppColors();
  const { version, refresh } = useRefresh();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [byCategory, setByCategory] = useState<MergedCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthTotals, setMonthTotals] = useState<
    { CUP: { expense: number; income: number }; USD: { expense: number; income: number } } | null
  >(null);
  const { month, year } = currentMonth();

  const load = useCallback(async () => {
    const list = await db.getTransactionsInMonth(sqlite, month, year);
    setTransactions(list);
    setCategories(await db.getCategories(sqlite));
    const expenseByCat = await db.getMonthByCategory(sqlite, month, year, 'CUP');
    const expenseByCatUsd = await db.getMonthByCategory(sqlite, month, year, 'USD');
    setByCategory(mergeCategories(expenseByCat, expenseByCatUsd));
    const totals = await db.totalsInMonthByCurrency(sqlite, month, year);
    setMonthTotals(totals);
  }, [sqlite, month, year]);

  useEffect(() => {
    load();
  }, [load, version]);

  function confirmDelete(t: Transaction) {
    Alert.alert('Eliminar', `¿Eliminar esta transacción?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await db.deleteTransaction(sqlite, t.id);
          refresh();
        },
      },
    ]);
  }

  const monthName = MONTH_NAMES[Number(month) - 1];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="title">Resumen de {monthName}</ThemedText>

      {monthTotals && (
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <TotalsRow title="Ingresos" c={monthTotals} colors={colors} income />
          <TotalsRow title="Gastos" c={monthTotals} colors={colors} />
        </ThemedView>
      )}

      {byCategory.length > 0 ? (
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText type="subtitle">Gastos por categoría</ThemedText>
          {byCategory.map((c) => (
            <ThemedView key={c.categoryId} style={styles.categoryRow}>
              <ThemedText style={styles.categoryName}>{c.name}</ThemedText>
              <ThemedView style={styles.categoryValues}>
                {c.totalCUP > 0 && (
                  <ThemedText style={[styles.categoryAmount, { color: colors.danger }]}>
                    {db.formatMoney(c.totalCUP, 'CUP')}
                  </ThemedText>
                )}
                {c.totalUSD > 0 && (
                  <ThemedText style={[styles.categoryAmount, { color: colors.danger }]}>
                    {db.formatMoney(c.totalUSD, 'USD')}
                  </ThemedText>
                )}
              </ThemedView>
            </ThemedView>
          ))}
        </ThemedView>
      ) : null}

      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText type="subtitle">Movimientos</ThemedText>
        {transactions.length === 0 ? (
          <ThemedText style={styles.empty}>No hay movimientos este mes.</ThemedText>
        ) : (
          transactions.map((t) => (
            <ThemedView
              key={t.id}
              style={[styles.transactionRow, { borderBottomColor: colors.border }]}>
              <ThemedView style={styles.transactionInfo}>
                <ThemedText style={styles.transactionDate}>{formatDate(t.date)}</ThemedText>
                <ThemedText style={styles.transactionCategory}>
                  {t.note || categoryName(t.categoryId)} · {t.currency}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.transactionRight}>
                <ThemedText
                  style={[
                    styles.transactionAmount,
                    { color: t.type === 'income' ? colors.success : colors.danger },
                  ]}>
                  {t.type === 'income' ? '+' : '-'}
                  {db.formatMoney(t.amount, t.currency)}
                </ThemedText>
                <Pressable onPress={() => confirmDelete(t)} hitSlop={8}>
                  <IconSymbol name="trash" size={16} color={colors.icon} />
                </Pressable>
              </ThemedView>
            </ThemedView>
          ))
        )}
      </ThemedView>
    </ScrollView>
  );

  function categoryName(id: number | null): string {
    if (id == null) return 'Sin categoría';
    const match = categories.find((c) => c.id === id);
    return match?.name ?? 'Sin categoría';
  }
}

function mergeCategories(
  cup: CategoryAggregate[],
  usd: CategoryAggregate[]
): MergedCategory[] {
  const map = new Map<
    number,
    { categoryId: number; name: string; totalCUP: number; totalUSD: number }
  >();
  for (const c of cup) {
    map.set(c.categoryId, { categoryId: c.categoryId, name: c.name, totalCUP: c.total, totalUSD: 0 });
  }
  for (const c of usd) {
    const existing = map.get(c.categoryId);
    if (existing) {
      existing.totalUSD = c.total;
    } else {
      map.set(c.categoryId, {
        categoryId: c.categoryId,
        name: c.name,
        totalCUP: 0,
        totalUSD: c.total,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.totalCUP + b.totalUSD - (a.totalCUP + a.totalUSD)
  );
}

function TotalsRow({
  title,
  c,
  colors,
  income,
}: {
  title: string;
  c: { CUP: { expense: number; income: number }; USD: { expense: number; income: number } };
  colors: ReturnType<typeof useAppColors>;
  income?: boolean;
}) {
  const color = income ? colors.success : colors.danger;
  const cup = income ? c.CUP.income : c.CUP.expense;
  const usd = income ? c.USD.income : c.USD.expense;
  return (
    <ThemedView style={styles.totalsRow}>
      <ThemedText style={styles.totalsTitle}>{title}</ThemedText>
      <ThemedView style={styles.summaryValues}>
        <ThemedText style={[styles.totalsAmount, { color }]}>
          {db.formatMoney(cup, 'CUP')}
        </ThemedText>
        <ThemedText style={[styles.totalsAmount, { color }]}>
          {db.formatMoney(usd, 'USD')}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalsTitle: { fontWeight: '600', fontSize: 16 },
  summaryValues: { flexDirection: 'row', gap: 16 },
  totalsAmount: { fontWeight: '600' },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryName: { fontWeight: '600', flex: 1 },
  categoryValues: { flexDirection: 'row', gap: 12 },
  categoryAmount: { fontWeight: '600' },
  empty: { opacity: 0.7 },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transactionInfo: { flex: 1, gap: 2 },
  transactionDate: { fontWeight: '600' },
  transactionCategory: { opacity: 0.7, fontSize: 13 },
  transactionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  transactionAmount: { fontWeight: 'bold' },
});
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/themed-text';
import { Card, StatCard } from '@/components/ui/card';
import { ExchangeDraft, ExchangeForm } from '@/components/exchange-form';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppLogo } from '@/components/ui/logo';
import { Screen } from '@/components/ui/screen';
import { useToast } from '@/components/toast';
import { TransactionDraft, TransactionForm } from '@/components/transaction-form';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { useRefresh } from '@/lib/refresh-context';
import { Category, CategoryAggregate, Transaction, TransactionType } from '@/lib/schema';
import { addMonths, currentMonth, formatDate, MONTH_NAMES } from '@/lib/utils';

interface MergedCategory {
  categoryId: number;
  name: string;
  totalCUP: number;
  totalUSD: number;
}

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

export default function HistoryScreen() {
  const sqlite = useSQLiteContext();
  const toast = useToast();
  const { version, refresh } = useRefresh();
  const now = currentMonth();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(Number(now.month));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [byCategory, setByCategory] = useState<MergedCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totals, setTotals] = useState<MonthTotals | null>(null);
  const [incomeByCat, setIncomeByCat] = useState<MergedCategory[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [day, setDay] = useState('');

  const load = useCallback(
    async (m: number, y: number) => {
      const ms = String(m).padStart(2, '0');
      const list = await db.getTransactionsInMonth(sqlite, ms, y, {
        type: typeFilter === 'all' ? undefined : typeFilter,
        day: day ? Number(day) : undefined,
      });
      setTransactions(list);
      setCategories(await db.getCategories(sqlite));
      setTotals(await db.totalsInMonthByCurrency(sqlite, ms, y));
      setByCategory(
        mergeCategories(
          await db.getMonthByCategory(sqlite, ms, y, 'CUP'),
          await db.getMonthByCategory(sqlite, ms, y, 'USD')
        )
      );
      setIncomeByCat(
        mergeCategories(
          await db.getMonthByCategoryForType(sqlite, ms, y, 'CUP', 'income'),
          await db.getMonthByCategoryForType(sqlite, ms, y, 'USD', 'income')
        )
      );
    },
    [sqlite, typeFilter, day]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos; los setState ocurren tras await
    load(month, year);
  }, [load, month, year, version]);

  function goMonth(delta: number) {
    const { year: ny, month: nm } = addMonths(year, month, delta);
    setYear(ny);
    setMonth(nm);
  }

  function confirmDelete(t: Transaction) {
    Alert.alert('Eliminar movimiento', '¿Seguro que quieres eliminarlo? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await db.deleteTransaction(sqlite, t.id);
          toast.show('Movimiento eliminado', 'info');
          refresh();
        },
      },
    ]);
  }

  async function applyEdit(t: Transaction, draft: TransactionDraft) {
    await db.updateTransaction(sqlite, t.id, draft);
    toast.show('Movimiento actualizado');
    setEditing(null);
    refresh();
  }

  async function applyEditExchange(id: number, draft: ExchangeDraft) {
    const receiveCurrency = draft.giveCurrency === 'CUP' ? 'USD' : 'CUP';
    const cup = draft.giveCurrency === 'CUP' ? draft.giveAmount : draft.receiveAmount;
    const usd = draft.giveCurrency === 'CUP' ? draft.receiveAmount : draft.giveAmount;
    const rate = cup > 0 && usd > 0 ? cup / usd : 0;
    await db.updateTransaction(sqlite, id, {
      type: 'exchange',
      amount: draft.giveAmount,
      currency: draft.giveCurrency,
      method: draft.giveMethod,
      categoryId: null,
      note: draft.note,
      toAmount: draft.receiveAmount,
      toCurrency: receiveCurrency,
      rate,
    });
    toast.show('Cambio actualizado');
    setEditing(null);
    refresh();
  }

  function fmtRate(r: number): string {
    if (!r || r <= 0) return '0';
    if (r >= 0.01) {
      return r.toLocaleString('es-CU', { maximumFractionDigits: 2 });
    }
    return r.toLocaleString('es-CU', { maximumFractionDigits: 6 });
  }

  function exchangeRate(t: Transaction): number {
    const cup = t.currency === 'CUP' ? t.amount : (t.toAmount ?? 0);
    const usd = t.currency === 'CUP' ? (t.toAmount ?? 0) : t.amount;
    return usd > 0 ? cup / usd : 0;
  }

  function methodText(m: string | null): string {
    return m === 'cash' ? 'Efectivo · ' : m === 'transfer' ? 'Transferencia · ' : '';
  }

  const monthName = MONTH_NAMES[month - 1];
  const isCurrentMonth = month === now.monthNumber && year === now.year;
  const balanceCup = totals ? totals.CUP.income - totals.CUP.expense : 0;
  const balanceUsd = totals ? totals.USD.income - totals.USD.expense : 0;

  return (
    <Screen scroll>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <ThemedText style={styles.title}>{monthName}</ThemedText>
          <ThemedText style={styles.year}>{year}</ThemedText>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.monthNav}>
            <Pressable style={styles.navButton} onPress={() => goMonth(-1)} hitSlop={8}>
              <IconSymbol name="chevron.left" size={20} color={Colors.text} />
            </Pressable>
            <Pressable
              style={[styles.navButton, { opacity: isCurrentMonth ? 0.3 : 1 }]}
              onPress={() => goMonth(1)}
              disabled={isCurrentMonth}
              hitSlop={8}>
              <IconSymbol name="chevron.right" size={20} color={Colors.text} />
            </Pressable>
          </View>
          <AppLogo size={52} />
        </View>
      </View>

      <Card style={styles.filtersCard}>
        <ThemedText style={styles.cardTitle}>Buscar movimientos</ThemedText>
        <View style={styles.filterRow}>
          {(
            [
              { key: 'all', label: 'Todos', color: Colors.muted },
              { key: 'expense', label: 'Gastos', color: Colors.danger },
              { key: 'income', label: 'Ingresos', color: Colors.success },
              { key: 'exchange', label: 'Cambios', color: Colors.tint },
            ] as const
          ).map((f) => {
            const active = typeFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[
                  styles.filterPill,
                  { borderColor: active ? f.color : Colors.border },
                  active && { backgroundColor: f.color },
                ]}
                onPress={() => setTypeFilter(f.key)}>
                <ThemedText style={[styles.filterPillText, { color: active ? '#FFFFFF' : Colors.muted }]}>
                  {f.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.dayRow}>
          <ThemedText style={styles.dayLabel}>Día</ThemedText>
          <TextInput
            style={styles.dayInput}
            keyboardType="number-pad"
            placeholder="Todo el mes (1-31)"
            placeholderTextColor={Colors.muted}
            value={day}
            onChangeText={(v) => setDay(v.replace(/[^0-9]/g, ''))}
            selectionColor={Colors.tint}
          />
          {day ? (
            <Pressable onPress={() => setDay('')} hitSlop={8}>
              <IconSymbol name="close" size={18} color={Colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </Card>

      {totals && (
        <>
          <View style={styles.statsRow}>
            <StatCard
              label="Balance en CUP"
              value={`${balanceCup > 0 ? '+' : ''}${db.formatMoney(balanceCup, 'CUP')}`}
              valueColor={
                balanceCup > 0 ? Colors.success : balanceCup < 0 ? Colors.danger : Colors.text
              }
            />
            <StatCard
              label="Balance en USD"
              value={`${balanceUsd > 0 ? '+' : ''}${db.formatMoney(balanceUsd, 'USD')}`}
              valueColor={
                balanceUsd > 0 ? Colors.success : balanceUsd < 0 ? Colors.danger : Colors.text
              }
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Ingresos CUP"
              value={db.formatMoney(totals.CUP.income, 'CUP')}
              valueColor={Colors.success}
              hints={[
                `Efectivo ${db.formatMoney(totals.CUP.incomeCash, 'CUP')}`,
                `Transferencia ${db.formatMoney(totals.CUP.incomeTransfer, 'CUP')}`,
              ]}
            />
            <StatCard
              label="Gastos CUP"
              value={db.formatMoney(totals.CUP.expense, 'CUP')}
              valueColor={Colors.danger}
              hints={[
                `Efectivo ${db.formatMoney(totals.CUP.expenseCash, 'CUP')}`,
                `Transferencia ${db.formatMoney(totals.CUP.expenseTransfer, 'CUP')}`,
              ]}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Ingresos USD"
              value={db.formatMoney(totals.USD.income, 'USD')}
              valueColor={Colors.success}
            />
            <StatCard
              label="Gastos USD"
              value={db.formatMoney(totals.USD.expense, 'USD')}
              valueColor={Colors.danger}
            />
          </View>
        </>
      )}

      {byCategory.length > 0 && (
        <Card>
          <ThemedText style={styles.cardTitle}>Gastos por categoría</ThemedText>
          {byCategory.map((c, i) => (
            <CatRow key={`${c.categoryId}-${i}`} c={c} color={Colors.danger} />
          ))}
        </Card>
      )}

      {incomeByCat.length > 0 && (
        <Card>
          <ThemedText style={styles.cardTitle}>Ingresos por categoría</ThemedText>
          {incomeByCat.map((c, i) => (
            <CatRow key={`i-${c.categoryId}-${i}`} c={c} color={Colors.success} />
          ))}
        </Card>
      )}

      <Card style={styles.movimientos}>
        <ThemedText style={styles.cardTitle}>Movimientos</ThemedText>
        {transactions.length === 0 ? (
          <ThemedText style={styles.empty}>No hay movimientos en este período.</ThemedText>
        ) : (
          transactions.map((t) => (
            <Pressable key={t.id} style={styles.txnRow} onPress={() => setDetail(t)}>
              <View style={styles.txnInfo}>
                <ThemedText style={styles.txnDate}>{formatDate(t.date)}</ThemedText>
                <ThemedText style={styles.txnCategory}>
                  {t.type === 'exchange'
                    ? `Cambio · 1 USD = ${fmtRate(exchangeRate(t))} CUP${t.note ? ` · ${t.note}` : ''}`
                    : `${methodText(t.method)}${categoryName(t.categoryId)}${t.note ? ` · ${t.note}` : ''}${
                        t.type === 'expense' && t.currency === 'USD' && t.changeCup
                          ? ` · Vuelto ${db.formatMoney(t.changeCup, 'CUP')}`
                          : ''
                      }`}
                </ThemedText>
              </View>
              <View style={styles.txnRightCol}>
                <View style={styles.txnTopRight}>
                  <ThemedText
                    style={[
                      styles.txnAmount,
                      {
                        color:
                          t.type === 'income'
                            ? Colors.success
                            : t.type === 'exchange'
                              ? Colors.tint
                              : Colors.danger,
                      },
                    ]}>
                    {t.type === 'exchange'
                      ? db.formatMoney(t.amount, t.currency)
                      : `${t.type === 'income' ? '+' : '-'}${db.formatMoney(t.amount, t.currency)}`}
                  </ThemedText>
                  <IconSymbol
                    name={
                      t.type === 'income'
                        ? 'arrow.down.circle.fill'
                        : t.type === 'exchange'
                          ? 'arrow.left.arrow.right'
                          : 'arrow.up.circle.fill'
                    }
                    size={16}
                    color={
                      t.type === 'income'
                        ? Colors.success
                        : t.type === 'exchange'
                          ? Colors.tint
                          : Colors.danger
                    }
                  />
                </View>
                {t.type === 'exchange' && (
                  <ThemedText style={styles.txnExchangeTo}>
                    → {db.formatMoney(t.toAmount ?? 0, t.toCurrency ?? 'USD')}
                  </ThemedText>
                )}
                <View style={styles.txnActions}>
                  <Pressable onPress={() => setEditing(t)} hitSlop={8}>
                    <IconSymbol name="edit" size={16} color={Colors.tint} />
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(t)} hitSlop={8}>
                    <IconSymbol name="trash" size={16} color={Colors.icon} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </Card>

      <Modal
        visible={!!editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}>
        <KeyboardProvider>
          <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditing(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {editing?.type === 'exchange' ? 'Editar cambio' : 'Editar movimiento'}
              </ThemedText>
              <Pressable onPress={() => setEditing(null)} hitSlop={8}>
                <IconSymbol name="close" size={22} color={Colors.muted} />
              </Pressable>
            </View>
            {editing &&
              (editing.type === 'exchange' ? (
                <KeyboardAwareScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bottomOffset={24}>
                  <ExchangeForm
                    key={editing.id}
                    initial={{
                      giveAmount: editing.amount,
                      giveCurrency: editing.currency,
                      giveMethod: editing.method ?? 'cash',
                      receiveAmount: editing.toAmount ?? 0,
                      note: editing.note,
                    }}
                    submitLabel="Guardar cambios"
                    onSubmit={(draft) => applyEditExchange(editing.id, draft)}
                  />
                </KeyboardAwareScrollView>
              ) : (
                <KeyboardAwareScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bottomOffset={24}>
                  <TransactionForm
                    key={editing.id}
                    initial={{
                      type: editing.type,
                      currency: editing.currency,
                      method: editing.method,
                      amount: editing.amount,
                      note: editing.note ?? undefined,
                      categoryId: editing.categoryId,
                      changeCup: editing.changeCup ?? undefined,
                    }}
                    submitLabel="Guardar cambios"
                    submitIcon="check"
                    onSubmit={(draft) => applyEdit(editing, draft)}
                    onCategoryCreated={(name) => toast.show(`Categoría "${name}" creada`)}
                  />
                </KeyboardAwareScrollView>
              ))}
          </View>
          </View>
        </KeyboardProvider>
      </Modal>
    <Modal
        visible={!!detail}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}>
        <View style={styles.detailOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDetail(null)} />
          {detail && (
            <View style={styles.detailCard}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Detalles del movimiento</ThemedText>
                <Pressable onPress={() => setDetail(null)} hitSlop={8}>
                  <IconSymbol name="close" size={22} color={Colors.muted} />
                </Pressable>
              </View>
              <View style={styles.detailAmountRow}>
                <ThemedText
                  style={[
                    styles.detailAmount,
                    {
                      color:
                        detail.type === 'income'
                          ? Colors.success
                          : detail.type === 'exchange'
                            ? Colors.tint
                            : Colors.danger,
                    },
                  ]}>
                  {detail.type === 'exchange'
                    ? db.formatMoney(detail.amount, detail.currency)
                    : `${detail.type === 'income' ? '+' : '-'}${db.formatMoney(detail.amount, detail.currency)}`}
                </ThemedText>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      borderColor:
                        detail.type === 'income'
                          ? Colors.success
                          : detail.type === 'exchange'
                            ? Colors.tint
                            : Colors.danger,
                    },
                  ]}>
                  <ThemedText
                    style={[
                      styles.typeBadgeText,
                      {
                        color:
                          detail.type === 'income'
                            ? Colors.success
                            : detail.type === 'exchange'
                              ? Colors.tint
                              : Colors.danger,
                      },
                    ]}>
                    {detail.type === 'income'
                      ? 'Ingreso'
                      : detail.type === 'exchange'
                        ? 'Cambio'
                        : 'Gasto'}
                  </ThemedText>
                </View>
              </View>

              {detail.type === 'exchange' ? (
                <>
                  <DetailRow
                    label="Recibido"
                    value={db.formatMoney(detail.toAmount ?? 0, detail.toCurrency ?? 'USD')}
                  />
                  <DetailRow
                    label="Precio"
                    value={`1 USD = ${fmtRate(exchangeRate(detail))} CUP`}
                  />
                  <DetailRow label="Fecha" value={formatDate(detail.date)} />
                  <DetailRow
                    label="Método del CUP"
                    value={detail.method === 'transfer' ? 'Transferencia' : 'Efectivo'}
                  />
                </>
              ) : (
                <>
                  <DetailRow label="Fecha" value={formatDate(detail.date)} />
                  <DetailRow label="Categoría" value={categoryName(detail.categoryId)} />
                  <DetailRow
                    label="Método"
                    value={
                      detail.method === null
                        ? '—'
                        : detail.method === 'cash'
                          ? 'Efectivo'
                          : 'Transferencia'
                    }
                  />
                  {detail.type === 'expense' && detail.currency === 'USD' && detail.changeCup ? (
                    <DetailRow label="Vuelto en CUP" value={db.formatMoney(detail.changeCup, 'CUP')} />
                  ) : null}
                </>
              )}
              {detail.note ? <DetailRow label="Nota" value={detail.note} /> : null}
              <View style={styles.divider} />
              <View style={styles.detailActions}>
                <Pressable
                  style={[styles.detailButton, { backgroundColor: Colors.tint }]}
                  onPress={() => {
                    setEditing(detail);
                    setDetail(null);
                  }}>
                  <ThemedText style={[styles.detailButtonText, { color: Colors.onAccent }]}>
                    Editar
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.detailButton, styles.detailDeleteButton]}
                  onPress={() => {
                    confirmDelete(detail);
                    setDetail(null);
                  }}>
                  <ThemedText style={[styles.detailButtonText, { color: Colors.danger }]}>
                    Eliminar
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );

  function categoryName(id: number | null): string {
    if (id == null) return 'Sin categoría';
    const match = categories.find((c) => c.id === id);
    return match?.name ?? 'Sin categoría';
  }
}

function CatRow({ c, color }: { c: MergedCategory; color: string }) {
  return (
    <View style={styles.catRow}>
      <View style={styles.catMain}>
        <ThemedText style={styles.catName}>{c.name}</ThemedText>
        <ThemedText style={[styles.catAmount, { color }]}>
          {c.totalCUP > 0 ? db.formatMoney(c.totalCUP, 'CUP') : ''}
          {c.totalCUP > 0 && c.totalUSD > 0 ? ' · ' : ''}
          {c.totalUSD > 0 ? db.formatMoney(c.totalUSD, 'USD') : ''}
        </ThemedText>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { backgroundColor: color, width: '100%' }]} />
      </View>
    </View>
  );
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

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerText: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  year: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  monthNav: { flexDirection: 'row', gap: 8 },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  filtersCard: { gap: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterPill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  filterPillText: { fontWeight: '700', fontSize: 14 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayLabel: { fontSize: 14, fontWeight: '700', color: Colors.muted },
  dayInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  catRow: { gap: 8 },
  catMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName: { color: Colors.text, fontWeight: '600', fontSize: 15 },
  catAmount: { fontWeight: '700', fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.surface, overflow: 'hidden' },
  barFill: { height: 8 },
  movimientos: { gap: 6 },
  empty: { color: Colors.muted, fontSize: 14 },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    gap: 14,
  },
  txnInfo: { flex: 1, gap: 3 },
  txnDate: { fontWeight: '700', color: Colors.text, fontSize: 15 },
  txnCategory: { color: Colors.muted, fontSize: 14 },
  txnRightCol: { gap: 10, alignItems: 'flex-end' },
  txnTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txnExchangeTo: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  txnActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  txnAmount: { fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  detailOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  detailCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 14,
  },
  detailAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailAmount: { fontSize: 26, fontWeight: '800' },
  typeBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  detailLabel: { color: Colors.muted, fontSize: 14 },
  detailValue: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: Colors.border },
  detailActions: { flexDirection: 'row', gap: 12 },
  detailButton: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  detailDeleteButton: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.danger },
  detailButtonText: { fontSize: 15, fontWeight: '800' },
});

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailValue}>{value}</ThemedText>
    </View>
  );
}
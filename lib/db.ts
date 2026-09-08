import type { SQLiteDatabase } from 'expo-sqlite';
import {
  Category,
  CategoryAggregate,
  Settings,
  Transaction,
  TransactionType,
} from './schema';

export type { Category, CategoryAggregate, Settings, Transaction, TransactionType } from './schema';
export type { Currency } from './schema';

const SETTING_KEYS = {
  baseCUP: 'baseCUP',
  baseUSD: 'baseUSD',
  exchangeRate: 'exchangeRate',
  initialized: 'initialized',
};

function parseNumber(value: string | null | undefined): number {
  const n = value ? Number(value) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    baseCUP: parseNumber(map.get(SETTING_KEYS.baseCUP)),
    baseUSD: parseNumber(map.get(SETTING_KEYS.baseUSD)),
    exchangeRate: parseNumber(map.get(SETTING_KEYS.exchangeRate)),
    initialized: map.get(SETTING_KEYS.initialized) === '1',
  };
}

export async function saveSettings(
  db: SQLiteDatabase,
  settings: {
    baseCUP: number;
    baseUSD: number;
    exchangeRate: number;
    initialized: boolean;
  }
) {
  const values = [
    [SETTING_KEYS.baseCUP, String(settings.baseCUP)],
    [SETTING_KEYS.baseUSD, String(settings.baseUSD)],
    [SETTING_KEYS.exchangeRate, String(settings.exchangeRate)],
    [SETTING_KEYS.initialized, settings.initialized ? '1' : '0'],
  ];
  for (const [key, value] of values) {
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  }
}

export async function getCategories(
  db: SQLiteDatabase,
  type?: TransactionType
): Promise<Category[]> {
  if (type) {
    return db.getAllAsync<Category>(
      'SELECT * FROM categories WHERE type = ? ORDER BY isCustom, name',
      type
    );
  }
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY isCustom, name');
}

export async function addCategory(
  db: SQLiteDatabase,
  name: string,
  type: TransactionType
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO categories (name, type, isCustom) VALUES (?, ?, 1)',
    [name, type]
  );
  return result.lastInsertRowId;
}

export async function deleteCategory(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM categories WHERE id = ? AND isCustom = 1', id);
}

export async function addTransaction(
  db: SQLiteDatabase,
  txn: {
    type: TransactionType;
    amount: number;
    currency: 'CUP' | 'USD';
    categoryId: number | null;
    note: string | null;
    date: string;
  }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO transactions (type, amount, currency, category_id, note, date) VALUES (?, ?, ?, ?, ?, ?)',
    [txn.type, txn.amount, txn.currency, txn.categoryId, txn.note, txn.date]
  );
  return result.lastInsertRowId;
}

export async function deleteTransaction(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function getTransactions(db: SQLiteDatabase): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    'SELECT * FROM transactions ORDER BY date DESC, id DESC'
  );
}

export async function getTransactionsInMonth(
  db: SQLiteDatabase,
  month: string,
  year: number
): Promise<Transaction[]> {
  const prefix = `${year}-${month}-`;
  return db.getAllAsync<Transaction>(
    'SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC, id DESC',
    `${prefix}%`
  );
}

/**
 * Calcula el gasto e ingreso totales del mes en la moneda dada.
 */
export async function getMonthSummary(
  db: SQLiteDatabase,
  month: string,
  year: number,
  currency: 'CUP' | 'USD'
): Promise<{ expense: number; income: number }> {
  const prefix = `${year}-${month}-`;
  const rows = await db.getAllAsync<{ type: TransactionType; total: number }>(
    'SELECT type, SUM(amount) as total FROM transactions WHERE date LIKE ? AND currency = ? GROUP BY type',
    [`${prefix}%`, currency]
  );
  let expense = 0;
  let income = 0;
  for (const row of rows) {
    if (row.type === 'expense') expense += row.total;
    else income += row.total;
  }
  return { expense, income };
}

export async function getMonthByCategory(
  db: SQLiteDatabase,
  month: string,
  year: number,
  currency: 'CUP' | 'USD'
): Promise<CategoryAggregate[]> {
  const prefix = `${year}-${month}-`;
  return db.getAllAsync<CategoryAggregate>(
    `SELECT t.category_id as categoryId, c.name, SUM(t.amount) as total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.date LIKE ? AND t.currency = ? AND t.type = 'expense'
     GROUP BY t.category_id
     ORDER BY total DESC`,
    [`${prefix}%`, currency]
  );
}

/**
 * Capital acumulado por moneda: capital base + ingresos - gastos.
 */
export async function getCurrentCapital(
  db: SQLiteDatabase
): Promise<{ CUP: number; USD: number }> {
  const settings = await getSettings(db);
  const totals = await db.getAllAsync<{ currency: 'CUP' | 'USD'; delta: number }>(
    `SELECT currency, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as delta
     FROM transactions
     GROUP BY currency`
  );
  const delta = { CUP: 0, USD: 0 };
  for (const row of totals) {
    delta[row.currency] = row.delta;
  }
  return {
    CUP: settings.baseCUP + delta.CUP,
    USD: settings.baseUSD + delta.USD,
  };
}

export async function totalsInMonthByCurrency(
  db: SQLiteDatabase,
  month: string,
  year: number
): Promise<{ CUP: { expense: number; income: number }; USD: { expense: number; income: number } }> {
  const prefix = `${year}-${month}-`;
  const rows = await db.getAllAsync<{
    type: TransactionType;
    currency: 'CUP' | 'USD';
    sum: number;
  }>(
    `SELECT type, currency, SUM(amount) as sum FROM transactions
     WHERE date LIKE ? GROUP BY type, currency`,
    `${prefix}%`
  );
  const result = {
    CUP: { expense: 0, income: 0 },
    USD: { expense: 0, income: 0 },
  };
  for (const row of rows) {
    if (row.type === 'expense') result[row.currency].expense += row.sum;
    else result[row.currency].income += row.sum;
  }
  return result;
}

export function formatMoney(amount: number, currency: 'CUP' | 'USD'): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = rounded.toLocaleString('es-CU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'CUP' ? `$${formatted} CUP` : `$${formatted} USD`;
}

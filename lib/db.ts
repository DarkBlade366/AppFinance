import type { SQLiteDatabase } from 'expo-sqlite';
import {
  Category,
  CategoryAggregate,
  Currency,
  PaymentMethod,
  Settings,
  Transaction,
  TransactionType,
} from './schema';

export type { Category, CategoryAggregate, Currency, PaymentMethod, Settings, Transaction, TransactionType } from './schema';

export interface TransactionWrite {
  type: TransactionType;
  amount: number;
  currency: Currency;
  method: PaymentMethod | null;
  categoryId: number | null;
  note: string | null;
  toAmount?: number | null;
  toCurrency?: Currency | null;
  rate?: number | null;
  changeCup?: number | null;
}

const SETTING_KEYS = {
  baseCUPcash: 'baseCUPcash',
  baseCUPtransfer: 'baseCUPtransfer',
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
    baseCUPcash: parseNumber(map.get(SETTING_KEYS.baseCUPcash)),
    baseCUPtransfer: parseNumber(map.get(SETTING_KEYS.baseCUPtransfer)),
    baseUSD: parseNumber(map.get(SETTING_KEYS.baseUSD)),
    exchangeRate: parseNumber(map.get(SETTING_KEYS.exchangeRate)),
    initialized: map.get(SETTING_KEYS.initialized) === '1',
  };
}

export async function saveSettings(
  db: SQLiteDatabase,
  settings: {
    baseCUPcash: number;
    baseCUPtransfer: number;
    baseUSD: number;
    exchangeRate: number;
    initialized: boolean;
  }
) {
  const values = [
    [SETTING_KEYS.baseCUPcash, String(settings.baseCUPcash)],
    [SETTING_KEYS.baseCUPtransfer, String(settings.baseCUPtransfer)],
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
      'SELECT * FROM categories WHERE type = ? ORDER BY name',
      type
    );
  }
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY type, name');
}

export async function addCategory(
  db: SQLiteDatabase,
  name: string,
  type: TransactionType
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO categories (name, type) VALUES (?, ?)',
    [name, type]
  );
  return result.lastInsertRowId;
}

export async function deleteCategory(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

export async function updateCategory(
  db: SQLiteDatabase,
  id: number,
  fields: { name: string; type: TransactionType }
) {
  await db.runAsync('UPDATE categories SET name = ?, type = ? WHERE id = ?', [
    fields.name,
    fields.type,
    id,
  ]);
}

export async function addTransaction(
  db: SQLiteDatabase,
  txn: TransactionWrite & { date: string }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO transactions (type, amount, currency, method, category_id, note, date, to_amount, to_currency, rate, change_cup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      txn.type,
      txn.amount,
      txn.currency,
      txn.method,
      txn.categoryId,
      txn.note,
      txn.date,
      txn.toAmount ?? null,
      txn.toCurrency ?? null,
      txn.rate ?? null,
      txn.changeCup ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function deleteTransaction(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function updateTransaction(
  db: SQLiteDatabase,
  id: number,
  txn: TransactionWrite
) {
  await db.runAsync(
    'UPDATE transactions SET type = ?, amount = ?, currency = ?, method = ?, category_id = ?, note = ?, to_amount = ?, to_currency = ?, rate = ?, change_cup = ? WHERE id = ?',
    [
      txn.type,
      txn.amount,
      txn.currency,
      txn.method,
      txn.categoryId,
      txn.note,
      txn.toAmount ?? null,
      txn.toCurrency ?? null,
      txn.rate ?? null,
      txn.changeCup ?? null,
      id,
    ]
  );
}

export async function getTransactions(db: SQLiteDatabase): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `SELECT id, type, amount, currency, method, category_id AS categoryId, note, date,
            to_amount AS toAmount, to_currency AS toCurrency, rate, change_cup AS changeCup
     FROM transactions ORDER BY date DESC, id DESC`
  );
}

export interface TransactionFilters {
  type?: TransactionType;
  day?: number;
}

export async function getTransactionsInMonth(
  db: SQLiteDatabase,
  month: string,
  year: number,
  filters?: TransactionFilters
): Promise<Transaction[]> {
  const prefix = `${year}-${month}-`;
  const where = ['date LIKE ?'];
  const args: (string | number)[] = [`${prefix}%`];
  if (filters?.type) {
    where.push('type = ?');
    args.push(filters.type);
  }
  if (filters?.day) {
    where.push('substr(date, 9, 2) = ?');
    args.push(String(filters.day).padStart(2, '0'));
  }
  return db.getAllAsync<Transaction>(
    `SELECT id, type, amount, currency, method, category_id AS categoryId, note, date,
            to_amount AS toAmount, to_currency AS toCurrency, rate, change_cup AS changeCup
     FROM transactions WHERE ${where.join(' AND ')} ORDER BY date DESC, id DESC`,
    args
  );
}

/**
 * Gastos del mes por categoría en la moneda dada.
 */
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

export async function getMonthByCategoryForType(
  db: SQLiteDatabase,
  month: string,
  year: number,
  currency: 'CUP' | 'USD',
  type: 'expense' | 'income'
): Promise<CategoryAggregate[]> {
  const prefix = `${year}-${month}-`;
  const rows = await db.getAllAsync<CategoryAggregate>(
    `SELECT t.category_id as categoryId, c.name, SUM(t.amount) as total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.date LIKE ? AND t.currency = ? AND t.type = ?
     GROUP BY t.category_id
     ORDER BY total DESC`,
    [`${prefix}%`, currency, type]
  );
  if (type === 'income' && currency === 'CUP') {
    const vuelto = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(change_cup), 0) AS total FROM transactions
       WHERE date LIKE ? AND currency = 'USD' AND type = 'expense' AND change_cup IS NOT NULL`,
      `${prefix}%`
    );
    if ((vuelto?.total ?? 0) > 0) {
      rows.push({ categoryId: 0, name: 'Vuelto de cambio', total: vuelto!.total });
      rows.sort((a, b) => b.total - a.total);
    }
  }
  return rows;
}

/**
 * Capital acumulado por moneda y, para CUP, dividido en efectivo y transferencia.
 * Los cambios de moneda mueven capital entre CUP y USD (el lado CUP usa `method`).
 */
export async function getCurrentCapital(
  db: SQLiteDatabase
): Promise<{
  CUP: { cash: number; transfer: number; total: number };
  USD: number;
}> {
  const settings = await getSettings(db);
  const rows = await db.getAllAsync<{
    type: TransactionType;
    currency: Currency;
    method: PaymentMethod | null;
    amount: number;
    toAmount: number | null;
    changeCup: number | null;
  }>(
    `SELECT type, currency, method, amount, to_amount AS toAmount, change_cup AS changeCup
     FROM transactions`
  );
  let cupCash = settings.baseCUPcash;
  let cupTransfer = settings.baseCUPtransfer;
  let usd = settings.baseUSD;
  for (const row of rows) {
    if (row.type === 'exchange') {
      const bucket = row.method === 'transfer' ? 'transfer' : 'cash';
      if (row.currency === 'CUP') {
        if (bucket === 'transfer') cupTransfer -= row.amount;
        else cupCash -= row.amount;
        usd += row.toAmount ?? 0;
      } else {
        usd -= row.amount;
        if (bucket === 'transfer') cupTransfer += row.toAmount ?? 0;
        else cupCash += row.toAmount ?? 0;
      }
    } else if (row.currency === 'CUP') {
      const delta = row.type === 'income' ? row.amount : -row.amount;
      if (row.method === 'transfer') cupTransfer += delta;
      else cupCash += delta;
    } else {
      usd += row.type === 'income' ? row.amount : -row.amount;
      if (row.type === 'expense' && row.changeCup) cupCash += row.changeCup;
    }
  }
  return {
    CUP: { cash: cupCash, transfer: cupTransfer, total: cupCash + cupTransfer },
    USD: usd,
  };
}

/**
 * Totales del mes por moneda, con CUP dividido en efectivo/transferencia.
 */
export async function totalsInMonthByCurrency(
  db: SQLiteDatabase,
  month: string,
  year: number
): Promise<{
  CUP: {
    expense: number;
    income: number;
    expenseCash: number;
    expenseTransfer: number;
    incomeCash: number;
    incomeTransfer: number;
  };
  USD: { expense: number; income: number };
}> {
  const prefix = `${year}-${month}-`;
  const rows = await db.getAllAsync<{
    type: TransactionType;
    currency: Currency;
    method: PaymentMethod | null;
    sum: number;
  }>(
    `SELECT type, currency, method, SUM(amount) as sum FROM transactions
     WHERE date LIKE ? AND type != 'exchange' GROUP BY type, currency, method`,
    `${prefix}%`
  );
  const result = {
    CUP: {
      expense: 0,
      income: 0,
      expenseCash: 0,
      expenseTransfer: 0,
      incomeCash: 0,
      incomeTransfer: 0,
    },
    USD: { expense: 0, income: 0 },
  };
  for (const row of rows) {
    if (row.currency === 'CUP') {
      const isTransfer = row.method === 'transfer';
      if (row.type === 'expense') {
        result.CUP.expense += row.sum;
        if (isTransfer) result.CUP.expenseTransfer += row.sum;
        else result.CUP.expenseCash += row.sum;
      } else {
        result.CUP.income += row.sum;
        if (isTransfer) result.CUP.incomeTransfer += row.sum;
        else result.CUP.incomeCash += row.sum;
      }
    } else if (row.type === 'expense') {
      result.USD.expense += row.sum;
    } else {
      result.USD.income += row.sum;
    }
  }
  const vuelto = await db.getFirstAsync<{ sum: number }>(
    `SELECT COALESCE(SUM(change_cup), 0) AS sum FROM transactions
     WHERE date LIKE ? AND currency = 'USD' AND type = 'expense' AND change_cup IS NOT NULL`,
    `${prefix}%`
  );
  const vueltoCup = vuelto?.sum ?? 0;
  result.CUP.income += vueltoCup;
  result.CUP.incomeCash += vueltoCup;
  return result;
}

export function formatMoney(amount: number, currency: 'CUP' | 'USD'): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Math.abs(rounded).toLocaleString('es-CU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const sign = rounded < 0 ? '-' : '';
  const symbol = currency === 'CUP' ? `$${formatted} CUP` : `$${formatted} USD`;
  return `${sign}${symbol}`;
}

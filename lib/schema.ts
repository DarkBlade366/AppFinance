import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'finance.db';

export type Currency = 'CUP' | 'USD';
export type TransactionType = 'expense' | 'income';

export interface Settings {
  baseCUP: number;
  baseUSD: number;
  exchangeRate: number;
  initialized: boolean;
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  isCustom: boolean;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  currency: Currency;
  categoryId: number | null;
  note: string | null;
  date: string;
}

export interface CategoryAggregate {
  categoryId: number;
  name: string;
  total: number;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;
  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  let currentDbVersion = versionRow?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  isCustom INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  category_id INTEGER,
  note TEXT,
  date TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);
`);

    const defaultCategories: Array<{ name: string; type: TransactionType }> = [
      { name: 'Comida', type: 'expense' },
      { name: 'Transporte', type: 'expense' },
      { name: 'Salud', type: 'expense' },
      { name: 'Servicios', type: 'expense' },
      { name: 'Ropa', type: 'expense' },
      { name: 'Entretenimiento', type: 'expense' },
      { name: 'Otros Gastos', type: 'expense' },
      { name: 'Salario', type: 'income' },
      { name: 'Ventas', type: 'income' },
      { name: 'Regalos', type: 'income' },
      { name: 'Otros Ingresos', type: 'income' },
    ];

    for (const category of defaultCategories) {
      await db.runAsync('INSERT INTO categories (name, type, isCustom) VALUES (?, ?, 0)', [
        category.name,
        category.type,
      ]);
    }

    currentDbVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

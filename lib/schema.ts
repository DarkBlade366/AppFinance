import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'finance.db';

export type Currency = 'CUP' | 'USD';
export type TransactionType = 'expense' | 'income' | 'exchange';
export type PaymentMethod = 'cash' | 'transfer';

export interface Settings {
  baseCUPcash: number;
  baseCUPtransfer: number;
  baseUSD: number;
  exchangeRate: number;
  initialized: boolean;
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  currency: Currency;
  method: PaymentMethod | null;
  categoryId: number | null;
  note: string | null;
  date: string;
  toAmount: number | null;
  toCurrency: Currency | null;
  rate: number | null;
  changeCup: number | null;
}

export interface CategoryAggregate {
  categoryId: number;
  name: string;
  total: number;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 5;
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
    currentDbVersion = 1;
  }

  if (currentDbVersion === 1) {
    // Las categorías son creadas solo por el usuario. Se eliminan las predefinidas.
    await db.runAsync("DELETE FROM categories WHERE isCustom = 0");
    await db.execAsync(`ALTER TABLE categories RENAME TO categories_old;
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL
);
INSERT INTO categories (id, name, type) SELECT id, name, type FROM categories_old WHERE isCustom = 1;
DROP TABLE categories_old;`);
    currentDbVersion = 2;
  }

  if (currentDbVersion === 2) {
    // Método de pago para CUP (efectivo/transferencia).
    await db.execAsync(`
ALTER TABLE transactions ADD COLUMN method TEXT;
UPDATE transactions SET method = 'cash' WHERE currency = 'CUP' AND method IS NULL;
`);
    // El capital CUP antiguo se asume en efectivo.
    const cupRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'baseCUP'"
    );
    if (cupRow) {
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('baseCUPcash', ?)",
        cupRow.value
      );
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('baseCUPtransfer', '0')"
      );
      await db.runAsync("DELETE FROM settings WHERE key = 'baseCUP'");
    }
    currentDbVersion = 3;
  }

  if (currentDbVersion === 3) {
    // Cambio de moneda: lado recibido y precio (CUP por 1 USD).
    await db.execAsync(`
ALTER TABLE transactions ADD COLUMN to_amount REAL;
ALTER TABLE transactions ADD COLUMN to_currency TEXT;
ALTER TABLE transactions ADD COLUMN rate REAL;
`);
    currentDbVersion = 4;
  }

  if (currentDbVersion === 4) {
    // Vuelto en CUP cuando se paga en USD.
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN change_cup REAL;`);
    currentDbVersion = 5;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

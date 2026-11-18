import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';

import { DATABASE_VERSION } from './schema';

/**
 * Respaldo portable de toda la base de datos.
 *
 * El objetivo es migrar estos datos a otra app (Flutter) sin pérdida: se
 * vuelcan las filas crudas de cada tabla con los nombres de columna reales de
 * SQLite, más la versión de esquema y metadatos. Así el importador de la app
 * nueva puede reconstruir el estado exacto (el capital y los totales se
 * recalculan a partir de las transacciones, no se guardan).
 */
export interface BackupFile {
  app: 'CuentasClaras';
  format: 'cuentas-claras-backup';
  formatVersion: 1;
  schemaVersion: number;
  exportedAt: string;
  counts: { settings: number; categories: number; transactions: number };
  data: {
    /** Filas crudas de `settings` (clave/valor). */
    settings: { key: string; value: string }[];
    /** Filas crudas de `categories`. */
    categories: { id: number; name: string; type: string }[];
    /** Filas crudas de `transactions` con nombres de columna de SQLite. */
    transactions: {
      id: number;
      type: string;
      amount: number;
      currency: string;
      method: string | null;
      category_id: number | null;
      note: string | null;
      date: string;
      to_amount: number | null;
      to_currency: string | null;
      rate: number | null;
      change_cup: number | null;
    }[];
  };
}

/** Lee todas las tablas y arma el objeto de respaldo (sin tocar el disco). */
export async function buildBackup(db: SQLiteDatabase): Promise<BackupFile> {
  const settings = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings ORDER BY key'
  );
  const categories = await db.getAllAsync<{ id: number; name: string; type: string }>(
    'SELECT id, name, type FROM categories ORDER BY id'
  );
  const transactions = await db.getAllAsync<BackupFile['data']['transactions'][number]>(
    `SELECT id, type, amount, currency, method, category_id, note, date,
            to_amount, to_currency, rate, change_cup
     FROM transactions ORDER BY id`
  );

  return {
    app: 'CuentasClaras',
    format: 'cuentas-claras-backup',
    formatVersion: 1,
    schemaVersion: DATABASE_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      settings: settings.length,
      categories: categories.length,
      transactions: transactions.length,
    },
    data: { settings, categories, transactions },
  };
}

function backupFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `cuentas-claras-backup-${stamp}.json`;
}

export interface ExportResult {
  counts: BackupFile['counts'];
  shared: boolean;
}

/**
 * Exporta todos los datos a un archivo JSON y abre el menú de compartir para
 * guardarlo donde el usuario quiera (Archivos, Drive, enviárselo, etc.).
 *
 * Lanza si el menú de compartir no está disponible en la plataforma.
 */
export async function exportBackup(db: SQLiteDatabase): Promise<ExportResult> {
  const backup = await buildBackup(db);
  const json = JSON.stringify(backup, null, 2);

  const file = new File(Paths.cache, backupFilename());
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return { counts: backup.counts, shared: false };
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar respaldo de Cuentas Claras',
    UTI: 'public.json',
  });

  return { counts: backup.counts, shared: true };
}

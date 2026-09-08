import { SQLiteProvider } from 'expo-sqlite';
import { PropsWithChildren } from 'react';
import { DATABASE_NAME, migrateDbIfNeeded } from './schema';

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      {children}
    </SQLiteProvider>
  );
}

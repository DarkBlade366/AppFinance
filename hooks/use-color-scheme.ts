import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Devuelve siempre un esquema válido ('light' | 'dark').
 * En Android `useColorScheme` puede devolver 'unspecified'/null; lo normalizamos.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}

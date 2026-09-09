/**
 * Tema de la app. La app es oscura por diseño (ver app.json userInterfaceStyle: "dark").
 * Tanto "light" como "dark" comparten la misma paleta para evitar variaciones.
 * La paleta también se expone a nivel raíz para uso directo: Colors.tint, Colors.muted, ...
 */

const palette = {
  background: '#0B0F17',
  card: '#141B26',
  surface: '#1C2432',
  border: '#1E2635',
  text: '#E6EAF0',
  muted: '#8A94A6',
  tint: '#22D3EE',
  success: '#34D399',
  danger: '#F87171',
  cup: '#FBBF24',
  usd: '#34D399',
  icon: '#8A94A6',
  tabIconDefault: '#5A6474',
  tabIconSelected: '#22D3EE',
  onAccent: '#06121F',
  white: '#FFFFFF',
};

export const Colors = {
  light: palette,
  dark: palette,
  ...palette,
};

export const HeaderGradient = ['#14213A', '#0B0F17'] as const;

export const Fonts = {
  sans: 'normal',
  serif: 'serif',
  mono: 'monospace',
};
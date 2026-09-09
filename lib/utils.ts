export function todayISO(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function currentMonth(): { month: string; year: number; monthNumber: number } {
  const now = new Date();
  const monthNumber = now.getMonth() + 1;
  return {
    month: String(monthNumber).padStart(2, '0'),
    year: now.getFullYear(),
    monthNumber,
  };
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function addMonths(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const zeroIndexed = month - 1 + delta;
  const date = new Date(year, zeroIndexed, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

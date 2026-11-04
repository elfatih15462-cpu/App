export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  overlay: string;
}

export const light: Palette = {
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F7',
  border: '#E2E6EF',
  text: '#111827',
  textMuted: '#6B7280',
  primary: '#4F46E5',
  primarySoft: '#E0E7FF',
  onPrimary: '#FFFFFF',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export const dark: Palette = {
  bg: '#0B1020',
  surface: '#151B2E',
  surfaceAlt: '#1E2640',
  border: '#28314F',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  primary: '#818CF8',
  primarySoft: '#272F5C',
  onPrimary: '#0B1020',
  success: '#4ADE80',
  successSoft: '#13361F',
  danger: '#F87171',
  dangerSoft: '#3D1717',
  warning: '#FBBF24',
  warningSoft: '#3A2C0B',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const PRIORITY_COLOR = {
  light: { high: '#DC2626', medium: '#D97706', low: '#0EA5E9' },
  dark: { high: '#F87171', medium: '#FBBF24', low: '#38BDF8' },
} as const;

export const CATEGORY_COLORS = [
  '#2563EB', '#16A34A', '#9333EA', '#EA580C', '#64748B',
  '#DB2777', '#0891B2', '#CA8A04', '#DC2626', '#4F46E5',
];

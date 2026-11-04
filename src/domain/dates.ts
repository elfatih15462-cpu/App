/**
 * Date helpers. All task dates are stored as local calendar days ("YYYY-MM-DD")
 * and optional local times ("HH:mm"), so a task never shifts day when the
 * device timezone changes.
 */

export type DateKey = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Adds months keeping the anchor day, clamped to the end of shorter months. */
export function addMonths(key: DateKey, months: number, anchorDay?: number): DateKey {
  const d = parseDateKey(key);
  const day = anchorDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const clamped = Math.min(day, daysInMonth(target.getFullYear(), target.getMonth()));
  return toDateKey(new Date(target.getFullYear(), target.getMonth(), clamped));
}

export function diffDays(a: DateKey, b: DateKey): number {
  const ms = parseDateKey(a).getTime() - parseDateKey(b).getTime();
  return Math.round(ms / 86400000);
}

/** Week starts on Saturday (common in Arabic-speaking countries). */
export function startOfWeek(key: DateKey, weekStartsOn = 6): DateKey {
  const d = parseDateKey(key);
  const delta = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(key, -delta);
}

export function startOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + '01';
}

export function endOfMonth(key: DateKey): DateKey {
  const d = parseDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function combineDateTime(date: DateKey, time: string | null | undefined, fallbackTime = '09:00'): Date {
  const d = parseDateKey(date);
  const [h, m] = (time || fallbackTime).split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const AR_DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
export const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function formatDayName(key: DateKey): string {
  return AR_DAYS[parseDateKey(key).getDay()];
}

export function formatLongDate(key: DateKey): string {
  const d = parseDateKey(key);
  return `${AR_DAYS[d.getDay()]}، ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(key: DateKey): string {
  const d = parseDateKey(key);
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`;
}

export function formatMonthYear(key: DateKey): string {
  const d = parseDateKey(key);
  return `${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}

export function formatDateTimeISO(iso: string): string {
  const d = new Date(iso);
  return `${formatShortDate(toDateKey(d))} ${d.getFullYear()} – ${formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}

/** Arabic count of days with correct plural form. */
export function arDays(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يوماً`;
}

/** "اليوم" / "غداً" / "أمس" / "منذ 3 أيام" / "بعد 4 أيام" / date */
export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const n = diffDays(key, today);
  if (n === 0) return 'اليوم';
  if (n === 1) return 'غداً';
  if (n === -1) return 'أمس';
  if (n < 0 && n > -31) return `منذ ${arDays(-n)}`;
  if (n > 1 && n < 8) return `بعد ${arDays(n)}`;
  return formatShortDate(key);
}

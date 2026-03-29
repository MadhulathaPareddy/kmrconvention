import { IST_TIME_ZONE, istYear } from './ist';

export function formatINR(n: number | string): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(num) || num == null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

const DATE_DISPLAY: Intl.DateTimeFormatOptions = {
  timeZone: IST_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

/**
 * Calendar date only (YYYY-MM-DD). Shown as that civil date in IST (not shifted by viewer TZ).
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** For YYYY-MM-DD strings, use the literal year; avoids UTC offset shifting the year in grouping. */
export function calendarYearFromDateString(s: string): number {
  const m = DATE_ONLY.exec(s.trim());
  if (m) return parseInt(m[1], 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? istYear() : istYear(d);
}

export function formatDate(s: string | Date | null | undefined): string {
  if (s == null) return '—';
  if (typeof s === 'string') {
    const t = s.trim();
    const m = DATE_ONLY.exec(t);
    if (m) {
      const y = m[1];
      const mo = m[2];
      const day = m[3];
      const anchor = new Date(`${y}-${mo}-${day}T12:00:00+05:30`);
      if (Number.isNaN(anchor.getTime())) return '—';
      return anchor.toLocaleDateString('en-IN', DATE_DISPLAY);
    }
  }
  const d = typeof s === 'string' ? new Date(s) : s;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', DATE_DISPLAY);
}

/** Instants (created_at, etc.) — date and time in IST. */
export function formatDateTime(s: string | Date | null | undefined): string {
  if (s == null) return '—';
  const d = typeof s === 'string' ? new Date(s) : s;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: IST_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

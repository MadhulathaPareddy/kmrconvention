/**
 * All business calendars, “today”, and displayed dates use Indian Standard Time (Asia/Kolkata).
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function istCalendarParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
  }
  return { year, month, day };
}

/** Current calendar date in IST as YYYY-MM-DD. */
export function istYmd(date: Date = new Date()): string {
  const { year, month, day } = istCalendarParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function istYear(date: Date = new Date()): number {
  return istCalendarParts(date).year;
}

function istWeekdaySun0Ist(instant: Date): number {
  const long = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIME_ZONE,
    weekday: 'long',
  }).format(instant);
  const map: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  return map[long] ?? 0;
}

/** IST noon on calendar day (India has no DST; avoids boundary issues). */
function istNoonUtcMs(y: number, month: number, day: number): number {
  return Date.parse(`${y}-${pad2(month)}-${pad2(day)}T12:00:00+05:30`);
}

/** Sunday–Saturday week in IST containing `date`. */
export function istWeekRangeFrom(date: Date = new Date()): { from: string; to: string } {
  const { year: y, month: m, day: d } = istCalendarParts(date);
  const t = istNoonUtcMs(y, m, d);
  const dow = istWeekdaySun0Ist(new Date(t));
  const startMs = t - dow * 86400000;
  const endMs = startMs + 6 * 86400000;
  return { from: istYmd(new Date(startMs)), to: istYmd(new Date(endMs)) };
}

/** First and last calendar day of the IST month containing `date`. */
export function istMonthRangeFrom(date: Date = new Date()): { from: string; to: string } {
  const { year: y, month: m } = istCalendarParts(date);
  const from = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${pad2(m)}-${pad2(lastDay)}`;
  return { from, to };
}

const YM_RE = /^(\d{4})-(\d{2})$/;

/** Inclusive date range for a calendar month string `YYYY-MM` (same boundaries as IST month picker). */
export function istRangeForYm(ym: string): { from: string; to: string } | null {
  const m = YM_RE.exec(ym.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return null;
  const from = `${m[1]}-${m[2]}-01`;
  const lastDay = new Date(y, mo, 0).getDate();
  const to = `${m[1]}-${m[2]}-${pad2(lastDay)}`;
  return { from, to };
}

/** Display label e.g. "March 2026" for `YYYY-MM`, using IST for formatting. */
export function istMonthLabelLong(ym: string): string {
  const r = istRangeForYm(ym);
  if (!r) return ym;
  const mo = parseInt(ym.slice(5, 7), 10);
  const y = parseInt(ym.slice(0, 4), 10);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: IST_TIME_ZONE,
  }).format(new Date(y, mo - 1, 15));
}

/** Events list filter: week / month in IST. */
export function istEventsFilterRange(filter: string | null): { from?: string; to?: string } {
  if (!filter || filter === 'all') return {};
  const now = new Date();
  if (filter === 'week') return istWeekRangeFrom(now);
  if (filter === 'month') return istMonthRangeFrom(now);
  return {};
}

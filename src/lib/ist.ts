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

/** Events list filter: week / month in IST. */
export function istEventsFilterRange(filter: string | null): { from?: string; to?: string } {
  if (!filter || filter === 'all') return {};
  const now = new Date();
  if (filter === 'week') return istWeekRangeFrom(now);
  if (filter === 'month') return istMonthRangeFrom(now);
  return {};
}

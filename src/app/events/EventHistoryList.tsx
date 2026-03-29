import type { EventHistoryEntry } from '@/lib/types';
import { formatINR, formatDate, formatDateTime } from '@/lib/format';

function diffLabel(key: string): string {
  const labels: Record<string, string> = {
    date: 'Date',
    event_type: 'Event type',
    contact_info: 'Contact',
    price: 'Price',
    decor_royalty: 'Decor royalty',
    kitchen_royalty: 'Kitchen royalty',
    diesel_amount: 'Diesel amount',
    diesel_type: 'Incl_Diesel',
    diesel_expenditure_suppressed: 'Diesel line removed',
    notes: 'Notes',
  };
  return labels[key] ?? key;
}

function formatValue(key: string, val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (
    (key === 'price' ||
      key === 'decor_royalty' ||
      key === 'kitchen_royalty' ||
      key === 'diesel_amount') &&
    typeof val === 'number'
  ) {
    return formatINR(val);
  }
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return formatDate(val);
  }
  return String(val);
}

const HIDE_SNAPSHOT_KEYS = new Set(['updated_at']);

export function EventHistoryList({ entries }: { entries: EventHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="mt-2 text-sm text-neutral-500">No updates recorded for this event.</p>
    );
  }

  return (
    <ul className="mt-4 max-h-[min(60vh,28rem)] space-y-4 overflow-y-auto pr-1">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 text-sm"
        >
          <div className="font-medium text-neutral-700">
            Updated at {formatDateTime(entry.changed_at)}
          </div>
          {entry.change_comment ? (
            <p className="mt-2 rounded-md border border-seagreen-light/60 bg-white px-3 py-2 text-neutral-800">
              <span className="text-xs font-medium text-neutral-500">Comment — </span>
              {entry.change_comment}
            </p>
          ) : null}
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            {Object.entries(entry.snapshot_before || {})
              .filter(([key]) => !HIDE_SNAPSHOT_KEYS.has(key))
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-neutral-500">{diffLabel(key)}</dt>
                  <dd className="font-medium text-neutral-800">{formatValue(key, value)}</dd>
                </div>
              ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

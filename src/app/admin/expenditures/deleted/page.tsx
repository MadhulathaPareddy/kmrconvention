import Link from 'next/link';
import { getDeletedExpenditures } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DeletedExpendituresPage() {
  const deleted = await getDeletedExpenditures();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-seagreen-dark">Deleted expenditures</h1>
        <Link
          href="/admin/expenditures"
          className="text-sm font-medium text-seagreen-dark hover:text-seagreen"
        >
          ← Back to expenditures
        </Link>
      </div>
      <p className="text-sm text-neutral-600">
        Admin-only audit log. Each row shows the snapshot at deletion time and the reason.
      </p>

      {deleted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/50 py-12 text-center text-neutral-500">
          No deleted expenditure records yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-seagreen-light bg-seagreen-light/50">
                <th className="px-4 py-3 font-medium text-seagreen-dark">Deleted at</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Original ID</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Date</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Category</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Amount</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Reason</th>
              </tr>
            </thead>
            <tbody>
              {deleted.map((row) => {
                const s = row.snapshot;
                const date = typeof s.date === 'string' ? s.date : '';
                const cat =
                  s.category === 'Other' && typeof s.category_other === 'string'
                    ? s.category_other
                    : String(s.category ?? '—');
                const amount = typeof s.amount === 'number' ? s.amount : Number(s.amount);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-seagreen-light/30"
                  >
                    <td className="px-4 py-3 text-neutral-700">
                      {new Date(row.deleted_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                      {row.expenditure_id}
                    </td>
                    <td className="px-4 py-3">{date ? formatDate(date) : '—'}</td>
                    <td className="px-4 py-3">{cat}</td>
                    <td className="px-4 py-3 text-red-700">
                      {Number.isNaN(amount) ? '—' : formatINR(amount)}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-neutral-800">{row.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { getMonthlySummaries } from '@/lib/db';
import { formatINR } from '@/lib/format';

export const dynamic = 'force-dynamic';

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default async function SummaryPage() {
  const summaries = await getMonthlySummaries();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-seagreen-dark">Monthly summary</h1>
      <p className="text-neutral-600">
        Events count, revenue, expenditure and profit by month.
      </p>

      {summaries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/50 py-12 text-center text-neutral-500">
          No data yet. Add events and expenditures to see monthly summaries.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-seagreen-light bg-seagreen-light/50">
                <th className="px-4 py-3 font-medium text-seagreen-dark">Month</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Events</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Revenue</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Expenditure</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Profit</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr
                  key={s.month}
                  className="border-b border-neutral-100 last:border-0 hover:bg-seagreen-light/30"
                >
                  <td className="px-4 py-3 font-medium">
                    {monthLabel(s.month)}
                  </td>
                  <td className="px-4 py-3">{s.event_count}</td>
                  <td className="px-4 py-3 text-green-700">
                    {formatINR(s.revenue)}
                  </td>
                  <td className="px-4 py-3 text-red-700">
                    {formatINR(s.expenditure)}
                  </td>
                  <td className="px-4 py-3 font-medium text-seagreen-dark">
                    {formatINR(s.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

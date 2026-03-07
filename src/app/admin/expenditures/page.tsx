import Link from 'next/link';
import { getExpenditures } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';
import { ExpenditureForm } from './ExpenditureForm';
import { DeleteExpenditureButton } from './DeleteExpenditureButton';

export const dynamic = 'force-dynamic';

export default async function AdminExpendituresPage() {
  const expenditures = await getExpenditures();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-seagreen-dark">Expenditures</h1>
        <Link
          href="/"
          className="text-sm font-medium text-seagreen-dark hover:text-seagreen"
        >
          ← Dashboard
        </Link>
      </div>

      <ExpenditureForm />

      <div className="overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-seagreen-light bg-seagreen-light/50">
              <th className="px-4 py-3 font-medium text-seagreen-dark">Date</th>
              <th className="px-4 py-3 font-medium text-seagreen-dark">Category</th>
              <th className="px-4 py-3 font-medium text-seagreen-dark">Amount</th>
              <th className="px-4 py-3 font-medium text-seagreen-dark">Description</th>
              <th className="px-4 py-3 font-medium text-seagreen-dark">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenditures.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No expenditures yet.
                </td>
              </tr>
            ) : (
              expenditures.map((ex) => (
                <tr
                  key={ex.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-seagreen-light/30"
                >
                  <td className="px-4 py-3">{formatDate(ex.date)}</td>
                  <td className="px-4 py-3 font-medium">{ex.category}</td>
                  <td className="px-4 py-3 text-red-700">{formatINR(ex.amount)}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {ex.description || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteExpenditureButton id={ex.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

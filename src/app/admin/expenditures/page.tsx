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
        <h1 className="text-2xl font-bold text-amber-900">Expenditures</h1>
        <Link
          href="/"
          className="text-sm font-medium text-amber-700 hover:text-amber-600"
        >
          ← Dashboard
        </Link>
      </div>

      <ExpenditureForm />

      <div className="overflow-hidden rounded-xl border border-amber-200/60 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-amber-100 bg-amber-50/50">
              <th className="px-4 py-3 font-medium text-amber-900">Date</th>
              <th className="px-4 py-3 font-medium text-amber-900">Category</th>
              <th className="px-4 py-3 font-medium text-amber-900">Amount</th>
              <th className="px-4 py-3 font-medium text-amber-900">Description</th>
              <th className="px-4 py-3 font-medium text-amber-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenditures.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No expenditures yet.
                </td>
              </tr>
            ) : (
              expenditures.map((ex) => (
                <tr
                  key={ex.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-amber-50/30"
                >
                  <td className="px-4 py-3">{formatDate(ex.date)}</td>
                  <td className="px-4 py-3 font-medium">{ex.category}</td>
                  <td className="px-4 py-3 text-red-700">{formatINR(ex.amount)}</td>
                  <td className="px-4 py-3 text-stone-600">
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

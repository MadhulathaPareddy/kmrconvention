import Link from 'next/link';
import { getExpenditures, getEvents } from '@/lib/db';
import { ExpenditureForm } from './ExpenditureForm';
import { ExpenditureViews } from './ExpenditureViews';

export const dynamic = 'force-dynamic';

export default async function AdminExpendituresPage() {
  const [expenditures, events] = await Promise.all([
    getExpenditures(),
    getEvents(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-seagreen-dark">Expenditures</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/expenditures/deleted"
            className="text-sm font-medium text-neutral-600 hover:text-seagreen-dark"
          >
            Deleted expenditures
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-seagreen-dark hover:text-seagreen"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <ExpenditureForm />

      <ExpenditureViews expenditures={expenditures ?? []} events={events ?? []} />
    </div>
  );
}

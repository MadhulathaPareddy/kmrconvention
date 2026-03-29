import Link from 'next/link';
import { getExpenditures, getEvents, getDeletedExpenditures } from '@/lib/db';
import { ExpenditureForm } from './ExpenditureForm';
import { ExpenditureViews } from './ExpenditureViews';

export const dynamic = 'force-dynamic';

export default async function AdminExpendituresPage() {
  const [expenditures, events, deletions] = await Promise.all([
    getExpenditures(),
    getEvents(),
    getDeletedExpenditures(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-seagreen-dark">Expenditures</h1>
        <Link
          href="/"
          className="text-sm font-medium text-seagreen-dark hover:text-seagreen"
        >
          ← Dashboard
        </Link>
      </div>

      <ExpenditureForm deletions={deletions ?? []} />

      <ExpenditureViews expenditures={expenditures ?? []} events={events ?? []} />
    </div>
  );
}

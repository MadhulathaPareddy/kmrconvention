import Link from 'next/link';
import { InvestmentLedgerClient } from './InvestmentLedgerClient';

export const dynamic = 'force-dynamic';

export default function AdminInvestmentLedgerPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-seagreen-dark">Investment ledger</h1>
        <Link
          href="/"
          className="text-sm font-medium text-seagreen-dark hover:text-seagreen"
        >
          ← Dashboard
        </Link>
      </div>
      <p className="text-sm text-neutral-600">
        Partner and external borrowings, ledger expenses, and pending bills with payment history.
        Only admins can view or change this data.
      </p>
      <InvestmentLedgerClient />
    </div>
  );
}

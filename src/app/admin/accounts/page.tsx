import Link from 'next/link';
import { AccountsClient } from './AccountsClient';

export const dynamic = 'force-dynamic';

export default function AdminAccountsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-seagreen-dark">Accounts</h1>
        <Link
          href="/"
          className="text-sm font-medium text-seagreen-dark hover:text-seagreen"
        >
          ← Dashboard
        </Link>
      </div>
      <p className="text-sm text-neutral-600">
        <strong>Loan account</strong> tracks money you move from event profits into a dedicated loan
        pool and EMI (or other) payments drawn from that pool. <strong>Other account</strong> is the
        remaining hall profit after those transfers. Numbers stay in sync when you edit entries;
        event revenue and expenditure lines in Summary are unchanged — this is an allocation layer
        on top.
      </p>
      <AccountsClient />
    </div>
  );
}

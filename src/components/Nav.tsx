'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export function Nav() {
  const { isAdmin, refresh } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refresh();
    router.push('/');
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-seagreen-light bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-seagreen-dark transition hover:text-seagreen"
        >
          KMR Convention
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/"
            className="text-neutral-600 transition hover:text-seagreen-dark"
          >
            Dashboard
          </Link>
          <Link
            href="/events"
            className="text-neutral-600 transition hover:text-seagreen-dark"
          >
            Events
          </Link>
          {isAdmin === true && (
            <>
              <Link
                href="/admin/events"
                className="text-seagreen-dark transition hover:text-seagreen"
              >
                Add Event
              </Link>
              <Link
                href="/admin/expenditures"
                className="text-seagreen-dark transition hover:text-seagreen"
              >
                Expenditures
              </Link>
              <Link
                href="/admin/expenditures/deleted"
                className="text-neutral-500 transition hover:text-seagreen-dark"
                title="Deleted expenditure audit log"
              >
                Deleted expenses
              </Link>
              <Link
                href="/summary"
                className="text-seagreen-dark transition hover:text-seagreen"
              >
                Monthly Summary
              </Link>
            </>
          )}
          {isAdmin === true ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-seagreen px-3 py-1.5 text-white transition hover:bg-seagreen-dark"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-seagreen px-3 py-1.5 text-white transition hover:bg-seagreen-dark"
            >
              Admin Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

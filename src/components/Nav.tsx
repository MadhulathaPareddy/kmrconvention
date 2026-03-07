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
    <nav className="sticky top-0 z-10 border-b border-amber-200/50 bg-amber-50/95 backdrop-blur supports-[backdrop-filter]:bg-amber-50/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-amber-900 transition hover:text-amber-700"
        >
          KMR Convention
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/"
            className="text-amber-900/80 transition hover:text-amber-900"
          >
            Dashboard
          </Link>
          <Link
            href="/events"
            className="text-amber-900/80 transition hover:text-amber-900"
          >
            Events
          </Link>
          <Link
            href="/summary"
            className="text-amber-900/80 transition hover:text-amber-900"
          >
            Monthly Summary
          </Link>
          {isAdmin === true && (
            <>
              <Link
                href="/admin/events"
                className="text-amber-800 transition hover:text-amber-700"
              >
                Add Event
              </Link>
              <Link
                href="/admin/expenditures"
                className="text-amber-800 transition hover:text-amber-700"
              >
                Expenditures
              </Link>
            </>
          )}
          {isAdmin === true ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-amber-900 px-3 py-1.5 text-amber-100 transition hover:bg-amber-800"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-amber-700 px-3 py-1.5 text-white transition hover:bg-amber-600"
            >
              Admin Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export function EditEventButton({ eventId }: { eventId: string }) {
  const { isAdmin } = useAuth();
  if (isAdmin !== true) return null;
  return (
    <Link
      href={`/admin/events/${eventId}/edit`}
      className="inline-flex rounded-md bg-seagreen px-3 py-1.5 text-sm font-medium text-white hover:bg-seagreen-dark"
    >
      Edit event
    </Link>
  );
}

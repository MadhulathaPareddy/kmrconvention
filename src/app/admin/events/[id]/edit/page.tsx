import { notFound } from 'next/navigation';
import { getEventById } from '@/lib/db';
import { EditEventForm } from './EditEventForm';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  return <EditEventForm event={event} />;
}

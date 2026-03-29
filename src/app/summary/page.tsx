import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { SummaryClient } from './SummaryClient';

export const dynamic = 'force-dynamic';

export default async function SummaryPage() {
  const admin = await isAdmin();
  if (!admin) {
    redirect('/');
  }
  return <SummaryClient />;
}

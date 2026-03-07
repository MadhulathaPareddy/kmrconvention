import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isAdmin();
  if (!admin) {
    redirect('/login');
  }
  return <>{children}</>;
}

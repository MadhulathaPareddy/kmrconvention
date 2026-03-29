import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Bookmarked URLs redirect to main expenditures (deleted list is on that page). */
export default function DeletedExpendituresRedirectPage() {
  redirect('/admin/expenditures');
}

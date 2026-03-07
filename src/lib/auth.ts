import { cookies } from 'next/headers';

const ADMIN_COOKIE = 'kmr_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const expected = getAdminPassword();
  if (!expected) return false;
  return token === expected;
}

export async function setAdminSession(password: string): Promise<boolean> {
  const expected = getAdminPassword();
  if (!expected || password !== expected) return false;
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return true;
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

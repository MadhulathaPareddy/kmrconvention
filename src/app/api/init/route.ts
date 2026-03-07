import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';

export async function POST() {
  try {
    await ensureSchema();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to init schema' }, { status: 500 });
  }
}

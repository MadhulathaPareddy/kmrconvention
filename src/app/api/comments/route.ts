import { NextRequest, NextResponse } from 'next/server';
import { getCommentsByEventId, createComment } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const eventId = req.nextUrl.searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 });
    }
    const comments = await getCommentsByEventId(eventId);
    return NextResponse.json(comments);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_id, author_name, author_email, content } = body;
    if (!event_id || !author_name || !content) {
      return NextResponse.json(
        { error: 'event_id, author_name, and content are required' },
        { status: 400 }
      );
    }
    const comment = await createComment({
      event_id,
      author_name,
      author_email: author_email ?? undefined,
      content,
    });
    return NextResponse.json(comment);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

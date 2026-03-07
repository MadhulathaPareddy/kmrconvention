'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDate } from '@/lib/format';

type Comment = {
  id: string;
  event_id: string;
  author_name: string;
  author_email: string | null;
  content: string;
  created_at: string;
};

export function CommentsSection({ eventId }: { eventId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?eventId=${eventId}`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          author_name: name.trim(),
          author_email: email.trim() || undefined,
          content: content.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to post');
      setName('');
      setEmail('');
      setContent('');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-amber-900">Comments</h2>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-amber-200/60 bg-amber-50/30 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="comment-name" className="block text-xs font-medium text-stone-600">
              Name *
            </label>
            <input
              id="comment-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="comment-email" className="block text-xs font-medium text-stone-600">
              Email (optional)
            </label>
            <input
              id="comment-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3">
          <label htmlFor="comment-content" className="block text-xs font-medium text-stone-600">
            Comment *
          </label>
          <textarea
            id="comment-content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-3 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Post comment'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-stone-500">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-amber-200 py-6 text-center text-sm text-stone-500">
          No comments yet. Be the first to add one.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <p className="text-sm font-medium text-amber-900">{c.author_name}</p>
              {c.author_email && (
                <p className="text-xs text-stone-500">{c.author_email}</p>
              )}
              <p className="mt-1 text-stone-700">{c.content}</p>
              <p className="mt-2 text-xs text-stone-400">
                {formatDate(c.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/format';

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
      <h2 className="text-lg font-semibold text-seagreen-dark">Comments</h2>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-seagreen-light bg-seagreen-light/30 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="comment-name" className="block text-xs font-medium text-neutral-600">
              Name *
            </label>
            <input
              id="comment-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="comment-email" className="block text-xs font-medium text-neutral-600">
              Email (optional)
            </label>
            <input
              id="comment-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3">
          <label htmlFor="comment-content" className="block text-xs font-medium text-neutral-600">
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
          className="mt-3 rounded-md bg-seagreen px-4 py-2 text-sm font-medium text-white hover:bg-seagreen-dark disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Post comment'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-seagreen-light py-6 text-center text-sm text-neutral-500">
          No comments yet. Be the first to add one.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              <p className="text-sm font-medium text-seagreen-dark">{c.author_name}</p>
              {c.author_email && (
                <p className="text-xs text-neutral-500">{c.author_email}</p>
              )}
              <p className="mt-1 text-neutral-700">{c.content}</p>
              <p className="mt-2 text-xs text-neutral-400">
                {formatDateTime(c.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

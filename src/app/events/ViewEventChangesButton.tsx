'use client';

import { useState } from 'react';
import { EventChangesModal } from './EventChangesModal';

export function ViewEventChangesButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setModalKey((k) => k + 1);
          setOpen(true);
        }}
        className="rounded-md border border-seagreen-light bg-white px-2.5 py-1 text-xs font-medium text-seagreen-dark hover:bg-seagreen-light/40"
      >
        View changes
      </button>
      <EventChangesModal
        key={modalKey}
        eventId={eventId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

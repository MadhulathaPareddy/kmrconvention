'use client';

import Link from 'next/link';

export function EventsFilterTabs({ currentFilter }: { currentFilter: string }) {
  const tabs = [
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'all', label: 'All events' },
  ];
  return (
    <div className="flex gap-2 border-b border-seagreen-light">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={`/events?filter=${tab.value}`}
          className={`px-4 py-2 text-sm font-medium transition ${
            currentFilter === tab.value
              ? 'border-b-2 border-seagreen text-seagreen-dark'
              : 'text-neutral-600 hover:text-seagreen-dark'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

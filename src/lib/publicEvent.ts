import type { Event } from './types';

/** Event fields safe for non-admin UI/API (no amounts). */
export function toPublicEventPayload(e: Event) {
  return {
    id: e.id,
    date: e.date,
    event_type: e.event_type,
    contact_info: e.contact_info,
    diesel_type: e.diesel_type,
  };
}

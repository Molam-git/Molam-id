// canonicalize.js
import stringify from 'fast-json-stable-stringify';

// canonicalize event object to deterministic JSON for hashing
export function canonicalizeEvent(event) {
  // event: { id, event_time, event_type, actor_id, actor_role, module, payload }
  // redact sensitive keys inside payload if present (implement policy)
  // example: remove full_pan, raw_biometrics
  const payload = {...event.payload};
  if(payload.card && payload.card.pan) {
    payload.card.pan = 'REDACTED';
  }
  // return deterministic JSON string
  const canonical = {
    id: event.id,
    event_time: event.event_time,
    event_type: event.event_type,
    actor_id: event.actor_id || null,
    actor_role: event.actor_role || null,
    module: event.module,
    payload
  };
  return stringify(canonical);
}

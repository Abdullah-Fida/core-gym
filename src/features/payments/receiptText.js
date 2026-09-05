/**
 * `payment_type` has no column of its own — it is encoded into `payments.notes`
 * as `payment_type:x;`. These helpers read and strip that marker so receipts can
 * show a human reason without the storage detail leaking into the UI.
 *
 * TODO(phase-7): replace with a real `payment_type` column.
 */

const REASON_LABELS = {
  registration: 'Registration fee',
  trial: 'Free trial',
  membership: 'Membership fee',
};

/** Remove the encoded markers, leaving only what the user actually typed. */
export function stripReceiptMarkers(notes) {
  return notes
    ? String(notes).replace(/payment_type:[^;]+;?|registration_fee:\d+;?/g, '').trim()
    : '';
}

/** Human-readable reason line for a printed receipt. */
export function parseReceiptReason(notes) {
  if (!notes) return 'Membership fee';
  const match = String(notes).match(/payment_type:([a-z_]+);?/i);
  const base = match ? (REASON_LABELS[match[1]] ?? match[1]) : '';
  const rest = stripReceiptMarkers(notes);
  if (!base && rest) return rest;
  return rest ? `${base} — ${rest}` : base || 'Membership fee';
}

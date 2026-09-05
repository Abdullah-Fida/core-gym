import { Printer } from 'lucide-react';
import { formatPKR, formatDate, formatDateTime } from '../../lib/utils';
import { Modal, Button, Card } from '../../components/ui';
import { stripReceiptMarkers } from './receiptText';

const shortId = (id) => (id ? String(id).substring(0, 8) : '');

/** True when a payment_date carries a meaningful time component. */
const hasTime = (value) => {
  if (!value) return false;
  if (String(value).includes('T')) return true;
  const d = new Date(value);
  return Boolean(d.getHours() || d.getMinutes());
};

export default function ReceiptModal({ open, onClose, receipts, onPrint, onDone }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Payment receipt${receipts.length > 1 ? 's' : ''}`}
      size="lg"
      footer={
        <Button block onClick={onDone}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {receipts.map((r) => {
          const cleanNotes = stripReceiptMarkers(r.notes);
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-heading truncate">{r.member_name || r.member_id}</p>
                  <p className="text-xs text-muted mt-0.5">Invoice {shortId(r.id)}</p>
                  {r.member_phone && <p className="text-xs text-muted">{r.member_phone}</p>}
                  {r.expiry_date && (
                    <p className="text-xs text-muted mt-1">
                      Valid until <span className="text-body font-medium">{formatDate(r.expiry_date)}</span>
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-success font-display tabular-nums">
                    {formatPKR(r.items?.length ? r.total : r.amount)}
                  </p>
                  <p className="text-xs text-muted">
                    {hasTime(r.payment_date) ? formatDateTime(r.payment_date) : formatDate(r.payment_date)}
                  </p>
                  {cleanNotes && <p className="text-xs text-muted mt-0.5">{cleanNotes}</p>}
                  {r.received_by && <p className="text-xs text-muted">Received by {r.received_by}</p>}
                </div>
              </div>

              {/* Itemised breakdown, when a registration fee was bundled in. */}
              {r.items?.length > 0 && (
                <dl className="flex flex-col gap-1 mt-3 pt-3 border-t border-line text-xs">
                  {r.items.map((it) => (
                    <div key={it.label} className="flex justify-between">
                      <dt className="text-muted">{it.label}</dt>
                      <dd className="text-body tabular-nums">{formatPKR(it.amount)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <Button variant="secondary" size="sm" className="mt-3" onClick={() => onPrint(r)}>
                <Printer className="size-4" aria-hidden="true" />
                Print receipt
              </Button>
            </Card>
          );
        })}
      </div>
    </Modal>
  );
}

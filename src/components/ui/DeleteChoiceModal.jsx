import Modal from './Modal';
import Button from './Button';

/**
 * "Remove profile" vs "delete everything" confirmation.
 *
 * MembersListPage and StaffDetailPage each carried their own ~65-line copy of
 * this dialog built entirely from inline style objects, with values that
 * existed in no token (`borderRadius: '28px'`, `width: 74`) and a `.btn`
 * element whose classes were then overridden by `style`.
 */
export default function DeleteChoiceModal({
  open,
  onClose,
  title = 'Delete',
  name,
  softLabel = 'Remove profile only',
  softDescription,
  hardLabel = 'Delete everything',
  hardDescription,
  onSoftDelete,
  onHardDelete,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={name ? `How would you like to remove ${name}?` : undefined}
      size="md"
    >
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSoftDelete}
          className="text-left p-4 rounded-xl border border-line bg-surface-3 transition-colors hover:border-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="block font-bold text-heading text-sm">{softLabel}</span>
          {softDescription && <span className="block text-xs text-muted mt-1">{softDescription}</span>}
        </button>

        <button
          type="button"
          onClick={onHardDelete}
          className="text-left p-4 rounded-xl border border-danger/25 bg-danger-soft transition-colors hover:border-danger/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="block font-bold text-danger text-sm">{hardLabel}</span>
          {hardDescription && <span className="block text-xs text-muted mt-1">{hardDescription}</span>}
        </button>

        <Button variant="secondary" block className="mt-2" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

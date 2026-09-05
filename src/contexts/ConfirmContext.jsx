import { createContext, useContext, useState, useCallback } from 'react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const ConfirmContext = createContext();

const CLOSED = { isOpen: false };

/**
 * Promise-based confirmation dialog: `await confirm({ title, message })`.
 *
 * Now built on the shared Modal, so it inherits the focus trap, Escape
 * handling, scroll lock and `role="dialog"` that the hand-rolled version
 * lacked. It was also the last place still rendering `borderRadius: 0`, left
 * over from an abandoned brutalist design.
 */
export function ConfirmProvider({ children }) {
  const [modal, setModal] = useState(CLOSED);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        const close = (result) => {
          setModal(CLOSED);
          resolve(result);
        };
        setModal({
          isOpen: true,
          title: options.title || 'Are you sure?',
          message: options.message || 'This action cannot be undone.',
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          variant: options.type === 'warning' ? 'primary' : 'danger',
          onConfirm: () => close(true),
          onCancel: () => close(false),
        });
      }),
    []
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(modal.isOpen)}
        onClose={modal.onCancel}
        title={modal.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" block onClick={modal.onCancel}>
              {modal.cancelText}
            </Button>
            <Button variant={modal.variant} block onClick={modal.onConfirm}>
              {modal.confirmText}
            </Button>
          </>
        }
      >
        <p className="text-sm text-body leading-relaxed">{modal.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    type: 'danger' // 'danger' or 'warning'
  });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title: options.title || 'Are you sure?',
        message: options.message || 'This action cannot be undone.',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'danger',
        onConfirm: () => {
          setModal(p => ({ ...p, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setModal(p => ({ ...p, isOpen: false }));
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {modal.isOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={modal.onCancel}>
          <div className="modal-content" style={{ maxWidth: 400, borderRadius: 0 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 900, marginBottom: 'var(--space-sm)' }}>
              {modal.title}
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-base)', marginBottom: 'var(--space-lg)', lineHeight: 1.5 }}>
              {modal.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" onClick={modal.onCancel}>
                {modal.cancelText}
              </button>
              <button 
                className={`btn ${modal.type === 'danger' ? 'btn-primary' : 'btn-primary'}`} 
                style={{ background: modal.type === 'danger' ? 'var(--status-danger)' : 'var(--accent-primary)', borderColor: modal.type === 'danger' ? 'var(--status-danger)' : 'var(--accent-primary)' }}
                onClick={modal.onConfirm}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

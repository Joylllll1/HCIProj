import React, { useCallback, useId, useRef } from 'react';
import Modal from './Modal';
import Icon from './Icon';

export default function BookmarkActionDialog({ title, description, icon, pending, onCancel, children, onConfirm, confirmText, confirmDisabled, message }) {
  const id = useId();
  const hasBody = Boolean(children || message);
  const closeState = useRef({ pending, onCancel });
  closeState.current = { pending, onCancel };
  // Keep Modal's focus lifecycle stable while the selected folder changes.
  const close = useCallback(() => {
    if (!closeState.current.pending) closeState.current.onCancel();
  }, []);

  return (
    <Modal isOpen onClose={close} labelledBy={`${id}-title`} describedBy={description ? `${id}-description` : undefined}>
      <section className="bookmark-action-dialog">
        <header className={`flex items-start gap-3 bg-surface-soft/60 px-6 py-5 max-sm:px-4 ${hasBody ? 'border-b border-line-soft' : ''}`}>
          {icon && <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line bg-surface text-blue">
            <Icon name={icon} />
          </span>}
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="m-0 text-2xl font-bold tracking-tight">{title}</h2>
            {description && <p id={`${id}-description`} className="mt-2 mb-0 text-sm leading-relaxed text-text-2">{description}</p>}
          </div>
        </header>
        {hasBody && <div className="px-6 py-5 max-sm:px-4">
          {children}
          {message && <p role="alert" className="mt-4 mb-0 text-sm leading-relaxed text-text-2">{message}</p>}
        </div>}
        <footer className="flex flex-wrap justify-end gap-3 border-t border-line-soft bg-surface/70 px-6 py-4 max-sm:px-4">
          <button type="button" className="secondary-button" disabled={pending} onClick={close}>取消</button>
          <button type="button" className="primary-button" disabled={pending || confirmDisabled} onClick={onConfirm}>{confirmText}</button>
        </footer>
      </section>
    </Modal>
  );
}

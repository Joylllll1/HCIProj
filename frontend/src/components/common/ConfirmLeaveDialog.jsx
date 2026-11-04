import React, { useId, useRef } from 'react';
import Icon from './Icon';
import useDialogFocus from '../../hooks/useDialogFocus';

export default function ConfirmLeaveDialog({ open, title, description, error, confirmText, discardText, cancelText, mode = 'discard', pending = false, onConfirm, onDiscard, onCancel }) {
  const dialogRef = useRef(null);
  const headingId = useId();
  const descriptionId = useId();
  useDialogFocus(dialogRef, open, onCancel, pending);
  if (!open) return null;
  return (
    <div className="confirm-overlay" role="presentation" onClick={() => !pending && onCancel?.()}>
      <section className="confirm-panel" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId} aria-busy={pending} onClick={(event) => event.stopPropagation()}>
        <div className="confirm-copy"><Icon name={mode === 'save' ? 'edit_square' : 'error_outline'} /><div><h2 id={headingId}>{title}</h2><p id={descriptionId}>{description}</p>{error && <p className="danger-text" role="alert">{error}</p>}</div></div>
        <div className="confirm-actions">
          <button className="secondary-button" onClick={onCancel} disabled={pending} type="button">{cancelText}</button>
          {discardText && <button className="secondary-button" onClick={onDiscard} disabled={pending} type="button">{discardText}</button>}
          <button className="primary-button" onClick={onConfirm} disabled={pending} type="button">{confirmText}</button>
        </div>
      </section>
    </div>
  );
}

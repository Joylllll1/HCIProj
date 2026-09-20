import React from 'react';
import Icon from './Icon';

function ConfirmLeaveDialog({
  open,
  title,
  description,
  confirmText,
  discardText,
  cancelText,
  mode = 'discard',
  onConfirm,
  onDiscard,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] grid place-items-center bg-[rgba(76,54,61,0.18)] px-4 backdrop-blur-[4px] animate-modal-fade-in"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-[min(460px,100%)] overflow-hidden rounded-[24px] border border-line bg-[rgba(255,250,248,0.97)] shadow-md animate-modal-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
      >
        <div className="relative overflow-hidden px-6 pt-6 pb-4 max-sm:px-4 max-sm:pt-4 max-sm:pb-3">
          <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_left,rgba(232,180,184,0.34),transparent_62%),radial-gradient(circle_at_top_right,rgba(196,168,184,0.18),transparent_54%)]" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[16px] border border-line bg-surface-soft text-blue shadow-xs">
              <Icon name={mode === 'save' ? 'edit_square' : 'error_outline'} />
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-text-3">Draft Reminder</p>
              <h2 id="leave-dialog-title" className="m-0 text-[26px] leading-[1.08] tracking-tight text-text">
                {title}
              </h2>
              <p className="mt-3 mb-0 max-w-[34ch] text-[15px] leading-7 text-text-2">
                {description}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-[rgba(255,255,255,0.72)] px-6 py-5 max-sm:px-4 max-sm:py-3">
          <button
            className="inline-flex min-w-[112px] items-center justify-center rounded-full border border-line bg-white px-4 py-[11px] text-sm font-semibold text-text-2 transition-all duration-150 hover:bg-surface-soft hover:text-text"
            onClick={onCancel}
            type="button"
          >
            {cancelText}
          </button>
          {discardText && (
            <button
              className="inline-flex min-w-[124px] items-center justify-center rounded-full border border-line bg-surface px-4 py-[11px] text-sm font-semibold text-text-2 transition-all duration-150 hover:border-[#d9b3b6] hover:bg-[#fff5f3] hover:text-text"
              onClick={onDiscard}
              type="button"
            >
              {discardText}
            </button>
          )}
          <button
            className="inline-flex min-w-[132px] items-center justify-center rounded-full border-0 bg-blue px-5 py-[11px] text-sm font-bold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2"
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmLeaveDialog;

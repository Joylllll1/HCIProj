import { useEffect, useRef } from 'react';

export default function useDialogFocus(ref, open, onClose, pending = false) {
  const current = useRef({ onClose, pending });
  current.current = { onClose, pending };
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const controls = () => [...(ref.current?.querySelectorAll('button, input, textarea, select, [href], [tabindex]') || [])]
      .filter((element) => !element.matches(':disabled') && !element.closest('[hidden], [inert]') && element.type !== 'hidden' && element.tabIndex >= 0)
      .sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    if (ref.current && !ref.current.hasAttribute('tabindex')) ref.current.tabIndex = -1;
    const initial = ref.current?.querySelector('[data-dialog-focus]:not(:disabled)') || controls()[0] || ref.current;
    initial?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === 'Escape' && !current.current.pending) { event.preventDefault(); current.current.onClose?.(); }
      if (event.key !== 'Tab') return;
      const elements = controls();
      if (!elements.length) { event.preventDefault(); ref.current?.focus({ preventScroll: true }); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (document.activeElement === ref.current || !ref.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, ref]);
  useEffect(() => {
    if (open && pending && document.activeElement?.matches(':disabled')) ref.current?.focus({ preventScroll: true });
  }, [open, pending, ref]);
}

import React, { useEffect } from 'react';

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div role="status" aria-live="polite" className="toast-message fixed bottom-[100px] max-sm:bottom-[120px] left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 rounded-md bg-text px-4 py-3 text-sm font-medium text-surface shadow-md animate-toast-in">
      <span>{message}</span>
    </div>
  );
}

export default Toast;

import React, { useEffect } from 'react';
import Icon from './Icon';

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-[100px] max-sm:bottom-[120px] left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white shadow-md animate-toast-in">
      <Icon name="check" />
      <span>{message}</span>
    </div>
  );
}

export default Toast;
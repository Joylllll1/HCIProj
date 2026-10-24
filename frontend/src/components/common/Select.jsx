import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

/** Small themed select. Focus stays on the combobox while its list is open. */
export default function Select({ value, options, onChange, className = '', disabled = false, placeholder = '请选择', id, name, ...labelProps }) {
  const generatedId = useId();
  const listId = `${generatedId}-options`;
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);
  const selected = options.findIndex(option => option.value === value);
  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index !== -1);
  const unavailable = disabled || !enabled.length;
  const isOpen = open && !unavailable;
  const positioned = position !== null;
  useEffect(() => { if (unavailable) setOpen(false); }, [unavailable]);
  useLayoutEffect(() => {
    if (isOpen && !enabled.includes(active)) setActive(enabled.includes(selected) ? selected : enabled[0]);
  }, [isOpen, enabled, active, selected]);
  const show = (edge) => {
    if (unavailable) return;
    setPosition(null);
    setActive(edge === 'first' ? enabled[0] : edge === 'last' ? enabled.at(-1) : enabled.includes(selected) ? selected : enabled[0]);
    searchRef.current = { text: '', time: 0 };
    setOpen(true);
  };
  const choose = index => {
    if (!options[index] || options[index].disabled) return;
    onChange(options[index].value);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      if (rect.bottom < 0 || rect.top > viewportHeight) { setOpen(false); return; }
      const width = Math.min(Math.max(rect.width, 176), viewportWidth - 24);
      const below = viewportHeight - rect.bottom - 18;
      const above = rect.top - 18;
      const flip = below < 240 && above > below;
      const maxHeight = Math.max(40, Math.min(288, flip ? above : below));
      setPosition({ width, left: Math.max(12, Math.min(rect.right - width, viewportWidth - width - 12)), maxHeight, ...(flip ? { bottom: viewportHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
    };
    const outside = event => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    place();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const option = menu?.querySelector(`[data-option-index="${active}"]`);
    if (!isOpen || !option) return;
    if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
  }, [active, isOpen, positioned]);

  const onKeyDown = event => {
    if (unavailable) return;
    const key = event.key;
    if (key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (key === 'Tab') { if (isOpen && options[active] && !options[active].disabled) onChange(options[active].value); setOpen(false); return; }
    if (key === 'ArrowUp' && event.altKey && isOpen) { event.preventDefault(); event.stopPropagation(); choose(active); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(key)) {
      event.preventDefault(); event.stopPropagation();
      if (!isOpen) { show(key === 'Home' ? 'first' : key === 'End' ? 'last' : undefined); return; }
      const current = enabled.indexOf(active);
      const step = key === 'PageDown' ? 10 : key === 'PageUp' ? -10 : key === 'ArrowDown' ? 1 : -1;
      setActive(key === 'Home' ? enabled[0] : key === 'End' ? enabled.at(-1) : enabled[Math.min(enabled.length - 1, Math.max(0, current + step))]);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault(); event.stopPropagation();
      if (isOpen) choose(active); else show();
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - searchRef.current.time < 700 ? searchRef.current.text : '') + key.toLocaleLowerCase();
      searchRef.current = { text, time: now };
      const cycle = text.length > 1 && [...text].every(character => character === text[0]);
      const candidates = cycle ? [...enabled.filter(index => index > active), ...enabled.filter(index => index <= active)] : enabled;
      const index = candidates.find(index => String(options[index].label).toLocaleLowerCase().startsWith(cycle ? text[0] : text));
      if (index !== undefined) { event.preventDefault(); if (!isOpen) { setPosition(null); setOpen(true); } setActive(index); }
    }
  };

  return <>
    <button {...labelProps} id={id} ref={triggerRef} type="button" role="combobox" className={`select-trigger ${className}`} disabled={unavailable} aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={isOpen ? listId : undefined} aria-activedescendant={isOpen && active >= 0 ? `${listId}-${active}` : undefined} onKeyDown={onKeyDown} onBlur={() => setOpen(false)} onClick={() => isOpen ? setOpen(false) : show()}>
      <span className="select-value">{selected >= 0 ? options[selected].label : placeholder}</span><Icon name="expand_more" />
    </button>
    {name && <input type="hidden" name={name} value={value} />}
    {isOpen && position && createPortal(
      <div id={listId} ref={menuRef} role="listbox" aria-label={labelProps['aria-label'] || '可选项'} className="select-menu" style={position} onMouseDown={event => { if (event.target !== event.currentTarget) event.preventDefault(); }}>
        {options.map((option, index) => <React.Fragment key={option.value}>
          {option.group && option.group !== options[index - 1]?.group && <div className="select-group">{option.group}</div>}
          <div id={`${listId}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} data-option-index={index} className={`select-option ${active === index ? 'is-active' : ''}`} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
            <span>{option.label}</span>{option.value === value && <Icon name="check" />}
          </div>
        </React.Fragment>)}
      </div>, document.body
    )}
  </>;
}

import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Select from './Select';

const options = [{ value: '', label: '不限话题' }, { value: 'campus', label: '校园生活', group: '常用话题' }, { value: 'disabled', label: '不可选', disabled: true }, { value: 'study', label: '学习交流', group: '常用话题' }];
function Control() {
  const [value, setValue] = useState('');
  return <Select aria-label="筛选话题" value={value} options={options} onChange={setValue} />;
}
afterEach(cleanup);

it('opens a themed list, selects an option, and restores trigger focus', () => {
  render(<Control />);
  const trigger = screen.getByRole('combobox', { name: '筛选话题' });
  trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '不限话题' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('option', { name: '校园生活' }));
  expect(trigger).toHaveTextContent('校园生活');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('supports arrow navigation, skips disabled values, and commits with Enter', () => {
  render(<Control />);
  const trigger = screen.getByRole('combobox');
  trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '学习交流' }).id);
  fireEvent.keyDown(trigger, { key: 'Home' });
  expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '不限话题' }).id);
  fireEvent.keyDown(trigger, { key: 'End' }); fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(trigger).toHaveTextContent('学习交流');
});

it('cancels without changing the value and prevents Escape from closing a parent dialog', () => {
  const onEscape = vi.fn();
  render(<div onKeyDown={event => { if (event.key === 'Escape') onEscape(); }}><Control /><button>其他控件</button></div>);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger); fireEvent.keyDown(trigger, { key: 'End' }); fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(trigger).toHaveTextContent('不限话题'); expect(onEscape).not.toHaveBeenCalled();
  fireEvent.click(trigger); fireEvent.pointerDown(screen.getByRole('button', { name: '其他控件' }));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(trigger); fireEvent.keyDown(trigger, { key: 'Tab' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('supports typing to find an option and does not submit its parent form', () => {
  const onSubmit = vi.fn(); const onChange = vi.fn();
  render(<form onSubmit={onSubmit}><Select aria-label="Theme" value="day" onChange={onChange} options={[{ value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }]} /></form>);
  const trigger = screen.getByRole('combobox'); trigger.focus();
  fireEvent.keyDown(trigger, { key: 'N' }); fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('night'); expect(onSubmit).not.toHaveBeenCalled();
});

it('commits keyboard navigation on Tab and supports repeated-letter lookup', () => {
  const onChange = vi.fn();
  render(<Select aria-label="地点" value="north" onChange={onChange} options={[{ value: 'north', label: 'North' }, { value: 'new', label: 'New' }, { value: 'south', label: 'South' }]} />);
  const trigger = screen.getByRole('combobox'); trigger.focus();
  fireEvent.keyDown(trigger, { key: 'N' }); fireEvent.keyDown(trigger, { key: 'N' });
  expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'New' }).id);
  fireEvent.keyDown(trigger, { key: 'Tab' });
  expect(onChange).toHaveBeenCalledWith('new'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('prevents disabled selection and closes an open control when disabled', () => {
  const props = { options, value: '', onChange: vi.fn(), 'aria-label': '测试' };
  const { rerender } = render(<Select {...props} />);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: '不可选' }));
  expect(props.onChange).not.toHaveBeenCalled();
  rerender(<Select {...props} disabled />);
  expect(screen.getByRole('combobox')).toBeDisabled(); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  rerender(<Select {...props} />);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('keeps the active option valid when live options change while the menu is open', () => {
  const onChange = vi.fn();
  const { rerender } = render(<Select aria-label="评论者" value="" options={options} onChange={onChange} />);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger); fireEvent.keyDown(trigger, { key: 'End' });
  rerender(<Select aria-label="评论者" value="" options={[options[0]]} onChange={onChange} />);
  expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '不限话题' }).id);
  fireEvent.keyDown(trigger, { key: 'Tab' }); expect(onChange).toHaveBeenCalledWith('');
});

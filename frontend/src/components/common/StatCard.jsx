import React from 'react';
import Icon from './Icon';

function StatCard({ icon, label, value, trend, tone }) {
  return (
    <article className={`stat-card tone-${tone} p-4 rounded-md border border-line-soft bg-surface shadow-sm`}>
      <div className="flex items-center justify-between text-xs font-semibold tracking-widest uppercase text-text-3">
        <span>{label}</span>
        <Icon name={icon} />
      </div>
      <strong className="block mt-3 mb-1 text-[30px] tracking-tight">{value}</strong>
      <small className="text-text-2">{trend}</small>
    </article>
  );
}

export default StatCard;
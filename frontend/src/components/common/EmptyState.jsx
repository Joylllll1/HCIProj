import React from 'react';
import Icon from './Icon';

function EmptyState({ title, description }) {
  return (
    <section className="empty-state">
      <Icon name="inventory_2" />
      <h3 className="mt-3 mb-1.5">{title}</h3>
      <p className="m-0">{description}</p>
    </section>
  );
}

export default EmptyState;
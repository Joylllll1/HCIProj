import React from 'react';

export default function PageHeader({ title, description, actions, back }) {
  return (
    <header className="page-heading">
      <div className="page-heading-copy">
        {back}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}

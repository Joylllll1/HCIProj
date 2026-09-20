import React from 'react';

const PlainTextContent = React.forwardRef(function PlainTextContent({
  as: Component = 'p',
  className = '',
  whitespaceClassName = 'whitespace-pre-wrap',
  content,
  children,
  ...props
}, ref) {
  const text = content ?? children;
  const classes = [whitespaceClassName, 'break-words', className].filter(Boolean).join(' ');

  return (
    <Component ref={ref} className={classes} {...props}>
      {text}
    </Component>
  );
});

export default PlainTextContent;

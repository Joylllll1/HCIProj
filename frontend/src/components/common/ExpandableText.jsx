import React, { useLayoutEffect, useRef, useState } from 'react';
import PlainTextContent from './PlainTextContent';

function shouldEnableCollapse(content, charThreshold, lineThreshold) {
  const text = typeof content === 'string' ? content.trim() : '';

  if (!text) {
    return false;
  }

  const lineCount = text.split(/\r?\n/).length;
  return text.length > charThreshold || lineCount > lineThreshold;
}

function ExpandableText({
  as = 'p',
  className = '',
  content,
  collapsedLinesClass = 'line-clamp-5',
  charThreshold = 180,
  lineThreshold = 5,
  expandLabel = '展开',
  collapseLabel = '收起',
  buttonClassName = 'mt-2 inline-flex text-xs font-semibold text-blue hover:underline',
  forceShowToggle = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState(null);
  const [wasCollapsible, setWasCollapsible] = useState(false);
  const contentRef = useRef(null);
  const heuristicCollapsible = shouldEnableCollapse(content, charThreshold, lineThreshold);
  const collapsedLines = Number.parseInt((collapsedLinesClass.match(/line-clamp-(\d+)/) || [])[1] || '0', 10);

  useLayoutEffect(() => {
    setExpanded(false);
    setHasOverflow(false);
    setCollapsedHeight(null);
    setWasCollapsible(false);
  }, [content]);

  useLayoutEffect(() => {
    if (!heuristicCollapsible) {
      setHasOverflow(false);
      setCollapsedHeight(null);
      setWasCollapsible(false);
      return;
    }

    const element = contentRef.current;
    if (!element || !collapsedLines) {
      setHasOverflow(false);
      setCollapsedHeight(null);
      return;
    }

    const resolveLineHeight = () => {
      const computedStyles = window.getComputedStyle(element);
      const lineHeight = Number.parseFloat(computedStyles.lineHeight);
      if (Number.isFinite(lineHeight) && lineHeight > 0) {
        return lineHeight;
      }

      const fontSize = Number.parseFloat(computedStyles.fontSize);
      return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.5 : 24;
    };

    const measureOverflow = () => {
      const nextCollapsedHeight = resolveLineHeight() * collapsedLines;
      const nextOverflow = element.scrollHeight - nextCollapsedHeight > 1;

      setCollapsedHeight(nextCollapsedHeight);
      setHasOverflow(nextOverflow);
      if (nextOverflow) {
        setWasCollapsible(true);
      }
    };

    measureOverflow();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        measureOverflow();
      });
      observer.observe(element);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measureOverflow);
      return () => window.removeEventListener('resize', measureOverflow);
    }

    return undefined;
  }, [heuristicCollapsible, content, collapsedLines]);

  const isCollapsible = forceShowToggle ?? (heuristicCollapsible && (hasOverflow || (expanded && wasCollapsible)));
  const collapsedStyle = !expanded && isCollapsible && collapsedHeight
    ? { maxHeight: `${collapsedHeight}px`, overflow: 'hidden' }
    : undefined;

  return (
    <div>
      <PlainTextContent
        ref={contentRef}
        as={as}
        className={className}
        content={content}
        style={collapsedStyle}
      />
      {isCollapsible && (
        <button
          type="button"
          className={buttonClassName}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
    </div>
  );
}

export default ExpandableText;

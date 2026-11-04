import React, { useSyncExternalStore } from 'react';
import { formatTimeAgo, subscribeToTimeTick, getTimeTick } from '../../utils';

function TimeAgo({ timeString, className = '', compact = false }) {
  useSyncExternalStore(subscribeToTimeTick, getTimeTick);

  const formatted = formatTimeAgo(timeString);
  const text = compact ? formatted.split(' · ')[0].replace(/（.*?）|\(.*?\)/g, '').trim() : formatted;
  return (
    <time className={className} dateTime={timeString} title={timeString ? new Date(timeString).toLocaleString('zh-CN') : undefined}>
      {text}
    </time>
  );
}

export default TimeAgo;

import React, { useSyncExternalStore } from 'react';
import { formatTimeAgo, subscribeToTimeTick, getTimeTick } from '../../utils';

function TimeAgo({ timeString, className = '' }) {
  useSyncExternalStore(subscribeToTimeTick, getTimeTick);

  return (
    <span className={className}>
      {formatTimeAgo(timeString)}
    </span>
  );
}

export default TimeAgo;

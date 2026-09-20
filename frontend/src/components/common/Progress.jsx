import React from 'react';

function Progress({ label, value }) {
  return (
    <div className="progress-row">
      <span className="flex justify-between">
        <small>{label}</small>
        <small>{value}%</small>
      </span>
      <i className="block h-[7px] overflow-hidden rounded-full bg-white/12">
        <b className="block h-full rounded-full bg-gradient-to-r from-[#72a7ff] to-[#9df2bd]" style={{ width: `${value}%` }} />
      </i>
    </div>
  );
}

export default Progress;
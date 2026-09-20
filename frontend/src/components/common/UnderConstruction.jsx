import React from 'react';
import Icon from './Icon';

export default function UnderConstruction({ feature }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-tint flex items-center justify-center mb-5">
        <Icon name="construction" />
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">功能开发中</h2>
      <p className="text-text-2 text-sm max-w-xs">
        {feature ? `${feature}功能正在开发，` : ''}敬请期待。
      </p>
    </div>
  );
}

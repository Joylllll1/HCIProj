import React from 'react';
import Icon from '../common/Icon';

export default function TodoPage() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-soft text-blue grid place-items-center mb-6">
        <Icon name="construction" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">功能开发中</h1>
      <p className="text-text-2 text-sm max-w-[320px] leading-relaxed">
        此功能正在紧锣密鼓地开发中，敬请期待！
      </p>
    </div>
  );
}

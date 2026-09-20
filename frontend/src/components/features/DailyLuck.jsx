import React from 'react';

function DailyLuck() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const luckWords = ['大吉', '中吉', '小吉', '吉'];
  const luckIdx = today.getDate() % luckWords.length;

  return (
    <section className="luck-card rounded-md p-4 text-white bg-gradient-to-br from-[#0f3d6e] to-[#1a6dd4] shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <strong>每日运势</strong>
        <span className="text-xs opacity-78">{dateStr}</span>
      </div>
      <strong className="block mt-[18px] mb-2 text-[38px] tracking-[0.16em] text-center">{luckWords[luckIdx]}</strong>
      <p className="m-0 text-[13px] leading-relaxed text-white/78 text-center">宜：复习、勇敢提问、早睡。忌：把所有压力都留到深夜。</p>
    </section>
  );
}

export { DailyLuck };

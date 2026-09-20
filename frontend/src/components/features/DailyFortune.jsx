import { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import { getStatus, checkin } from '../../services/fortuneService';

const FORTUNE_LEVELS = [
  { level: '大吉', color: 'var(--color-blue)', icon: 'stars', desc: '诸事顺遂，好运连连' },
  { level: '中吉', color: 'var(--color-teal)', icon: 'sentiment_very_satisfied', desc: '运势不错，继续保持' },
  { level: '小吉', color: 'var(--color-green)', icon: 'sentiment_satisfied', desc: '平稳向好，小有收获' },
  { level: '中平', color: 'var(--color-orange)', icon: 'sentiment_neutral', desc: '平淡无奇，顺其自然' },
  { level: '小凶', color: 'var(--color-purple)', icon: 'sentiment_dissatisfied', desc: '小心谨慎，避免冲动' },
  { level: '大凶', color: 'var(--color-blue-2)', icon: 'warning', desc: '韬光养晦，静待时机' },
];

function getMonthDay() {
  const d = new Date();
  return { month: d.getMonth() + 1, day: d.getDate() };
}

function getWeekday() {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdays[new Date().getDay()];
}

function DailyFortune({ showToast }) {
  const [fortune, setFortune] = useState(null);
  const [streak, setStreak] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getStatus();
        if (res.checkedIn) {
          const levelInfo = FORTUNE_LEVELS.find((l) => l.level === res.level) || FORTUNE_LEVELS[0];
          setFortune({ ...res, ...levelInfo });
          setStreak(res.streak || 0);
        }
      } catch {
        // 未登录等静默处理
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCheckIn = async () => {
    if (loading || fortune) return;
    setIsAnimating(true);
    try {
      const res = await checkin();
      const levelInfo = FORTUNE_LEVELS.find((l) => l.level === res.level) || FORTUNE_LEVELS[0];
      setTimeout(() => {
        setFortune({ ...res, ...levelInfo });
        setStreak(res.streak || 0);
        setIsAnimating(false);
        showToast(`🎉 打卡成功！你已连续打卡 ${res.streak} 天`);
      }, 600);
    } catch {
      setIsAnimating(false);
      showToast('打卡失败，请稍后重试');
    }
  };

  // 加载中
  if (loading) {
    return (
      <div className="daily-fortune-card overflow-hidden rounded-2xl border border-line-soft bg-surface backdrop-blur-md shadow-sm">
        <div className="p-8 text-center text-text-3 text-sm">加载中...</div>
      </div>
    );
  }

  // 未打卡：优雅的日期展示
  if (!fortune) {
    const { month, day } = getMonthDay();
    const weekday = getWeekday();
    return (
      <div className="daily-fortune-card overflow-hidden rounded-2xl border border-line-soft bg-surface backdrop-blur-md shadow-sm">
        <div className="relative p-8">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold tracking-widest text-text-3 uppercase mb-3">{weekday}</p>
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-6xl font-black tracking-tight" style={{ color: 'var(--color-blue)' }}>{day}</span>
              <span className="text-xl font-medium text-text-2">{month}月</span>
            </div>
            <p className="text-sm text-text-3">点击打卡，开启今日运势</p>
          </div>
          <button
            className={`w-full py-3.5 rounded-full font-bold text-base transition-all duration-200 text-white shadow-sm hover:shadow-md hover:-translate-y-px ${isAnimating ? 'scale-95' : ''}`}
            style={{ background: 'linear-gradient(135deg, var(--color-blue) 0%, var(--color-blue-2) 100%)' }}
            onClick={handleCheckIn}
            disabled={isAnimating}
            type="button"
          >
            {isAnimating ? '打卡中...' : '立即打卡'}
          </button>
          {streak > 0 && (
            <p className="mt-4 text-center text-xs text-text-3">
              已连续打卡 <span className="font-bold" style={{ color: 'var(--color-blue)' }}>{streak}</span> 天
            </p>
          )}
        </div>
      </div>
    );
  }

  // 已打卡：运势展示
  return (
    <div className="daily-fortune-card overflow-hidden rounded-2xl border border-line-soft bg-surface backdrop-blur-md shadow-sm">
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="grid w-9 h-9 place-items-center rounded-lg text-white" style={{ background: 'linear-gradient(135deg, var(--color-blue) 0%, var(--color-blue-2) 100%)' }}>
              <Icon name="auto_awesome" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">每日运势</h3>
              <p className="text-xs text-text-3">{fortune.date}</p>
            </div>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'var(--color-blue-soft)', color: 'var(--color-blue)' }}>
              <Icon name="local_fire_department" className="text-sm" />
              <span>{streak}天</span>
            </div>
          )}
        </div>

        <div className="mb-6 text-center py-5 rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-surface-tint) 0%, var(--color-surface-soft) 100%)', border: '1px solid var(--color-line-soft)' }}>
          <div className="text-3xl font-black mb-1.5" style={{ color: fortune.color }}>{fortune.level}</div>
          <p className="text-sm text-text-2">{fortune.desc}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Icon name="check_circle" className="text-base" style={{ color: 'var(--color-green)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--color-green)' }}>宜</span>
            </div>
            <div className="space-y-2">
              {fortune.dos?.map((item, index) => (
                <div key={index} className="px-3 py-2.5 rounded-lg bg-white/60 border border-line-soft">
                  <div className="text-sm font-bold text-text mb-0.5">{item.activity}</div>
                  <div className="text-xs text-text-2 leading-relaxed">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Icon name="cancel" className="text-base" style={{ color: 'var(--color-purple)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--color-purple)' }}>忌</span>
            </div>
            <div className="space-y-2">
              {fortune.donts?.map((item, index) => (
                <div key={index} className="px-3 py-2.5 rounded-lg bg-white/60 border border-line-soft">
                  <div className="text-sm font-bold text-text mb-0.5">{item.activity}</div>
                  <div className="text-xs text-text-2 leading-relaxed">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-line-soft text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-soft text-text-3 text-sm">
            <Icon name="check_circle" className="text-base" style={{ color: 'var(--color-green)' }} />
            今日已打卡
          </div>
        </div>
      </div>
    </div>
  );
}

export default DailyFortune;

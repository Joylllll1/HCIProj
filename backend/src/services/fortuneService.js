import CheckIn from '../models/CheckIn.js';
import FortuneItem from '../models/FortuneItem.js';

const FORTUNE_LEVELS = [
  { level: '大吉', weight: 5 },
  { level: '中吉', weight: 15 },
  { level: '小吉', weight: 30 },
  { level: '中平', weight: 25 },
  { level: '小凶', weight: 15 },
  { level: '大凶', weight: 10 },
];

function pickWeighted() {
  const total = FORTUNE_LEVELS.reduce((s, l) => s + l.weight, 0);
  const r = Math.random() * total;
  let sum = 0;
  for (const { level, weight } of FORTUNE_LEVELS) {
    sum += weight;
    if (r < sum) return level;
  }
  return FORTUNE_LEVELS[FORTUNE_LEVELS.length - 1].level;
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pickRandom(arr, count) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}

async function calcStreak(userId) {
  const records = await CheckIn.find({ userId }).sort({ date: -1 }).lean();
  if (!records.length) return 0;

  const today = getToday();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const startDate = records[0].date === today ? today : yesterday;

  let streak = 0;
  for (let i = 0; i < records.length; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (records.some((r) => r.date === dateStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export const checkin = async (userId) => {
  const today = getToday();

  // 已打卡？直接返回
  const existing = await CheckIn.findOne({ userId, date: today }).lean();
  if (existing) {
    const streak = await calcStreak(userId);
    return { checkedIn: false, ...existing, streak };
  }

  // 运势等级：当天首次打卡时真正随机一次，然后落库固定当日结果
  const level = pickWeighted();

  // 选取宜忌：当天首次打卡时随机一次，然后落库固定当日结果
  const allDos = await FortuneItem.find({ type: 'dos' }).lean();
  const allDonts = await FortuneItem.find({ type: 'donts' }).lean();
  const dos = pickRandom(allDos, 2);
  const donts = pickRandom(allDonts, 2);

  // 创建打卡记录
  await CheckIn.create({ userId, date: today, level, dos, donts });

  const streak = await calcStreak(userId);

  return { checkedIn: true, date: today, level, dos, donts, streak };
};

export const getStatus = async (userId) => {
  const today = getToday();
  const existing = await CheckIn.findOne({ userId, date: today }).lean();
  const streak = await calcStreak(userId);

  if (existing) {
    return { checkedIn: true, ...existing, streak };
  }
  return { checkedIn: false, streak };
};

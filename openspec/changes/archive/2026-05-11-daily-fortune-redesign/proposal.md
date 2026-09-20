## Why

重新设计每日运势功能，参考洛谷的简洁设计风格。当前实现存在以下问题：
1. 未打卡状态过于复杂，应简化为仅显示日期
2. 宜忌内容偏向明显（忌多为贬义词），应改为中性描述
3. 宜/忌缺少有趣的详细描述，仅有简单词语

## What Changes

- 重新设计未打卡状态：仅显示当前日期（模仿洛谷风格）
- 重写宜忌内容库：使用中性词语，避免明显偏向
- 为每个宜/忌添加有趣的详细描述（2-3句话）
- 调整宜忌数量：每天2个宜 + 2个忌（不是3个）
- 优化UI布局，参考洛谷的简洁设计

## Capabilities

### New Capabilities
- `daily-fortune-redesign`: 每日运势功能重新设计，包括UI和内容重构

### Modified Capabilities
- 无需修改现有 capabilities

## Impact

- **前端**: 重写 [DailyFortune.jsx](frontend/src/components/DailyFortune.jsx)
- **内容**: 重写宜忌描述库，确保中性有趣的描述
- **UI**: 简化未打卡状态，优化打卡后的展示布局

## 非目标

- 不涉及后端API改动
- 不改变核心随机算法逻辑
- 不改变localStorage存储结构

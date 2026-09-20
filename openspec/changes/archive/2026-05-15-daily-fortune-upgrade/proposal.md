## Why

每日运势系统的词汇目前硬编码在前端组件中（各 20 条），种类稀少、缺乏新鲜感。打卡记录仅存于 localStorage，换浏览器或跨设备时数据丢失，无法累积连续打卡天数。需要将数据后移，实现词汇的大规模拓展和打卡记录的持久化。

## What Changes

1. **新建 FortuneItem 数据模型** — 在 MongoDB 中存储宜/忌条目，每条含 activity + description，通过 seed 脚本批量灌入约 400 条
2. **新建 CheckIn 模型 + 打卡 API** — `POST /api/fortune/checkin` 实现打卡、运势生成、连续天数计算
3. **前端 DailyFortune 组件对接 API** — 替换硬编码数据源和 localStorage 打卡逻辑
4. **宜忌词汇大规模拓展** — 每条约 200 条，覆盖学习、生活、社交、健康、娱乐等多维度
5. **忌类描述风格改造** — 从"温和辩解"改为"批评/后果+幽默"风格

## Capabilities

### New Capabilities
- `fortune-checkin`: 每日打卡 + 运势生成 + 连续签到。包含 FortuneItem 模型、CheckIn 模型、seed 脚本、打卡 API、前端对接

### Modified Capabilities
- （无现有 spec 修改）

## Impact

- **后端新增**：FortuneItem 模型、CheckIn 模型、fortuneRoutes/Controller/Service、seed 脚本
- **前端修改**：DailyFortune.jsx 重写为 API 驱动（保留 UI 和动效不变）
- **数据**：需运行 seed 脚本灌入初始词汇
- **无破坏性变更**：现有打卡记录从 localStorage 迁移，首次调用 API 时自动同步

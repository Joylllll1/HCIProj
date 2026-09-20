## Context

每日运势（DailyFortune）当前为纯前端实现：
- 宜忌条目硬编码在 `DailyFortune.jsx` 中，仅各 20 条，种类稀少
- 打卡记录存储于 `localStorage`，换浏览器/设备时数据丢失
- 运势生成使用 `seededRandom` 算法，基于日期 + 用户 ID 做种子

需要将数据层后移，实现词汇大规模拓展和打卡持久化。

## Goals / Non-Goals

**Goals:**
- FortuneItem 数据存入 MongoDB，支持宜忌各约 200 条
- 打卡记录存入后端，跨设备、跨浏览器同步
- 连续打卡天数基于后端 CheckIn 记录计算
- 后端提供打卡 API，前端调用获取运势和记录
- 运势生成沿用伪随机算法（确保同一用户同一天运势一致）
- seed 脚本可一键灌入初始词汇数据
- 前端 DailyFortune 组件的 UI 和动效不变

**Non-Goals:**
- 不做 AI 生成运势（仍使用随机选取 + 预定义等级）
- 不做用户手动选择运势等级
- 不做打卡提醒/推送通知
- 不做社交分享功能
- 不做历史运势回顾

## Decisions

### 1. FortuneItem 独立集合

**Decision**: 新建 `FortuneItem` 集合存储宜忌条目。

**Rationale**: 独立集合便于 seed 脚本管理、后续 CRUD（后台管理增删改查）。每条含 `type`（dos/donts）、`activity`、`description` 三个字段。

```
FortuneItem {
  type: 'dos' | 'donts',
  activity: String,      // e.g. "晨跑锻炼"
  description: String,   // e.g. "神清气爽"
}
```

### 2. CheckIn 独立集合

**Decision**: 新建 `CheckIn` 集合，每条记录 `{ userId, date, fortune }`，并在 `{ userId, date }` 上建复合唯一索引防止重复打卡。

**Rationale**: 独立集合查询灵活——查 streak 只需按 userId 排序最近记录。复合索引天然防止同一天重复打卡。比嵌入 User 模型更清晰，数据量小（每人每天一条），性能无虞。

```
CheckIn {
  userId: ObjectId (ref: User),
  date: String (YYYY-MM-DD),
  level: String,         // "大吉" | "中吉" | ...
  dos: [{ activity, description }],
  donts: [{ activity, description }]
}
// 复合唯一索引: { userId, date }
```

### 3. 打卡 API 设计

**Decision**: 单端点 `POST /api/fortune/checkin`，幂等设计。

**Rationale**: 
- 首次调用：创建 CheckIn 记录，生成运势，返回结果
- 当天重复调用：查询已有记录直接返回，不放额外请求
- 前端无需区分"打卡"和"查询"两个操作，简化逻辑

```
POST /api/fortune/checkin → {
  checkedIn: boolean,     // 是否是今天第一次打卡
  date: "2026-05-12",
  level: { level, color, icon, desc },
  dos: [{ activity, description }, ...],
  donts: [{ activity, description }, ...],
  streak: 5
}
```

如果当天已打过卡，`checkedIn: false`，其余数据不变。

### 4. 运势生成算法

**Decision**: 后端沿用伪随机算法，与前端当前实现保持一致。

**Rationale**: 保证同一用户同一天获得相同运势。算法从 DB 中按 `type` 分组取出所有条目，用 `seededRandom(dateNum + userIdHash)` 选取 2 宜 2 忌。

### 5. seed 脚本

**Decision**: `backend/src/scripts/seedFortune.js`，跑一次灌入约 2000 条数据。

**Rationale**: 独立脚本不耦合启动流程，只在需要时执行。提供 `--reset` 参数清空重建。约 400 条数据可直接写在脚本中。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| seed 脚本中约 400 条数据可控 | 数据直接写在 seed 脚本中，无需外部文件 |
| 现有用户 localStorage 中的打卡记录丢失 | 首次 API 调用即开始新记录，历史 streak 重置属于可接受行为；项目非生产环境 |
| 后端依赖 MongoDB，部署新增 seed 步骤 | 在 README/部署文档中注明；提供 `npm run seed:fortune` 快捷命令 |
| 约 400 条中可能出现内容重复 | seed 脚本插入前做去重检查 |

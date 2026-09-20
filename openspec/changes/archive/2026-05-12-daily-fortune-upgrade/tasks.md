## 1. 后端数据模型

- [x] 1.1 新建 FortuneItem 模型（`models/FortuneItem.js`）：字段 type、activity、description
- [x] 1.2 新建 CheckIn 模型（`models/CheckIn.js`）：字段 userId、date、level、dos、donts，复合唯一索引 `{ userId, date }`
- [x] 1.3 在 `backend/src/index.js` 中确保模型注册

## 2. 后端 API

- [x] 2.1 创建 fortuneService.js：打卡逻辑（查/建 CheckIn）、运势生成（seededRandom + FortuneItem 选取）、连续天数计算
- [x] 2.2 创建 fortuneController.js：checkin 处理器，调用 service 并组装响应
- [x] 2.3 创建 fortuneRoutes.js：`POST /api/fortune/checkin`（挂 auth 中间件）
- [x] 2.4 在 `backend/src/index.js` 注册 fortuneRoutes

## 3. 种子数据

- [x] 3.1 创建 seedFortune.js 脚本，内置宜约 200 条、忌约 200 条数据，按类别组织，忌类采用批评/后果+幽默风格
- [x] 3.2 seed 脚本逻辑：清空集合 → 批量插入，支持 `--reset` 参数
- [x] 3.3 在 `backend/package.json` 添加 `seed:fortune` 快捷命令

## 4. 前端对接

- [x] 4.1 fortuneService.js：封装 `GET /api/fortune/status` 和 `POST /api/fortune/checkin`
- [x] 4.2 重写 DailyFortune.jsx：移除硬编码 FORTUNE_ITEMS 和 localStorage 逻辑，改为调 API
- [ ] 4.3 验证：打卡 → 显示运势 → 刷新 → 数据不丢失 → 连续天数正确

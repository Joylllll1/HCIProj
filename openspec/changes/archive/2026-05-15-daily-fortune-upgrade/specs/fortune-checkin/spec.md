## ADDED Requirements

### Requirement: 用户可每日打卡获取运势

系统 SHALL 提供 `POST /api/fortune/checkin` 端点，支持认证用户每日打卡并获取当日运势。同一用户一天内多次调用为幂等操作。

#### Scenario: 首次打卡返回运势
- **WHEN** 认证用户当日首次请求 `POST /api/fortune/checkin`
- **THEN** 系统创建 CheckIn 记录，返回 `{ checkedIn: true, date, level, dos, donts, streak }`

#### Scenario: 重复打卡返回已有记录
- **WHEN** 认证用户当天已打卡后再次请求 `POST /api/fortune/checkin`
- **THEN** 系统返回已有 CheckIn 记录，`checkedIn` 为 `false`

#### Scenario: 连续打卡天数累加
- **WHEN** 用户连续多天打卡
- **THEN** `streak` 随连续天数递增，中断后重置为 1

#### Scenario: 未认证用户返回 401
- **WHEN** 未认证用户请求 `POST /api/fortune/checkin`
- **THEN** 系统返回 401 错误

### Requirement: 运势包含等级和宜忌

系统 SHALL 为每次打卡生成运势等级（大吉/中吉/小吉/中平/小凶/大凶）和 2 条宜、2 条忌。

#### Scenario: 运势等级随机
- **WHEN** 用户打卡
- **THEN** 运势等级基于 `seededRandom(date + userId)` 决定，同一用户同一天结果一致

#### Scenario: 宜忌条目来自 FortuneItem 集合
- **WHEN** 用户打卡
- **THEN** 宜忌条目从 FortuneItem 集合中随机选取，同一用户同一天结果一致

#### Scenario: 宜忌条目不重复
- **WHEN** 用户打卡
- **THEN** 当天 4 条推荐条目互不重复（活动名不同）

### Requirement: FortuneItem 集合可初始化

系统 SHALL 提供 seed 脚本 `seedFortune.js` 一键灌入初始词汇数据。

#### Scenario: seed 脚本插入数据
- **WHEN** 运行 seed 脚本
- **THEN** FortuneItem 集合被清空并插入所有预定义条目（宜约 200 条、忌约 200 条）

#### Scenario: seed 脚本幂等
- **WHEN** 多次运行 seed 脚本
- **THEN** 最终数据与单次运行一致（先清空再插入）

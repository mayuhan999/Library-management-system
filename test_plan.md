# 测试计划

## 范围

本文档覆盖以下功能迭代的测试：
- **操作 1–2**：续借功能（renewCount 字段、续借 API 与前端 UI）
- **操作 3**：预约功能（Hold API 与图书详情页联动）
- **操作 4**：借阅历史页面
- **操作 5**：图书详情页增强（库存状态、排队人数）
- **操作 6**：配置管理 API 与前端规则页
- **操作 7**：密码重置 API 与前端用户管理页
- **操作 8–9**：还书 API（含逾期罚金）与前台还书表单

---

## 测试环境准备

### 基础数据（通过 seed 初始化）

| 角色 | Email | 密码 | 说明 |
|------|-------|------|------|
| 管理员 | admin@library.local | admin123 | 可访问所有 API |
| 馆员 | librarian@library.local | librarian123 | 可操作借还书 |
| 读者 | student1@library.local | student123 | 常规借阅用户 |
| 读者 | student2@library.local | student123 | 预约/罚金测试 |

### 系统配置（Config 表默认值）

| Key | 默认值 | 说明 |
|-----|--------|------|
| LOAN_DAYS | 14 | 借阅天数 |
| MAX_BORROW_BOOKS | 5 | 最大并发借阅数 |
| MAX_RENEW_COUNT | 1 | 每笔借阅最大续借次数 |
| FINE_RATE_PER_DAY | 0.50 | 每日逾期罚金 |

### 测试前提

- 后端服务运行于 `http://localhost:3001`
- 前端开发服务器运行于 `http://localhost:5173`
- 数据库为 SQLite（Prisma dev.db）
- 每个测试用例开始前执行 `npx prisma db seed` 以确保数据干净

---

## 功能 1：续借功能（Renew）

### 前置条件

以 `student1@library.local` 登录，借阅一本书（获取 loanId）。

### API 测试用例

#### TC-REN-01：成功续借一次
- **操作**：调用 `POST /api/reader/loans/:loanId/renew`
- **预期**：
  - HTTP 200
  - 响应体 `loan.dueAt` 延后 14 天
  - `loan.renewCount` = 1
  - `loan.status` = BORROWED
- **验证点**：数据库 Loan 表中 `renewCount = 1`，`dueAt` 已更新

#### TC-REN-02：续借超限被拒绝
- **操作**：同一笔 loan 再次调用 `POST /api/reader/loans/:loanId/renew`
- **预期**：
  - HTTP 409
  - 错误信息包含 "Maximum renewals"
- **验证点**：loan 记录未被修改

#### TC-REN-03：逾期借阅不允许续借
- **前置**：loan 的 `dueAt` 已过（手动修改数据库或等待超时）
- **操作**：`POST /api/reader/loans/:loanId/renew`
- **预期**：HTTP 409，错误信息包含 "overdue"

#### TC-REN-04：不属于当前用户的借阅不能续借
- **操作**：以 `student2@library.local` 登录，请求 `student1` 的 loanId
- **预期**：HTTP 404，错误信息 "Active loan not found"

#### TC-REN-05：续借已归还的借阅
- **前置**：loan 状态为 RETURNED
- **操作**：`POST /api/reader/loans/:loanId/renew`
- **预期**：HTTP 404

#### TC-REN-06：匿名用户无权续借
- **操作**：不带 JWT token 调用 `POST /api/reader/loans/:id/renew`
- **预期**：HTTP 401

### 前端测试用例

#### TC-REN-FE-01：续借按钮仅对"借阅中"记录可见
- 登录后进入"我的借阅"页面
- **验证**：已归还记录的操作列无 [Renew] 按钮；逾期记录无 [Renew] 按钮

#### TC-REN-FE-02：续借进行中按钮禁用
- 点击 [Renew] 后
- **验证**：按钮文字变为 "Renewing…"，按钮被禁用

#### TC-REN-FE-03：续借成功后列表刷新
- 点击 [Renew]
- **验证**：dueAt 列显示新的应还日期

#### TC-REN-FE-04：续借失败显示错误
- 模拟超限情况
- **验证**：页面顶部显示红色错误信息

---

## 功能 2：预约功能（Hold）

### 前置条件

以 `student1@library.local` 登录，找到一本 `availableCopies = 0` 的图书（或通过借出所有副本制造此状态）。

### API 测试用例

#### TC-HLD-01：成功创建预约
- **操作**：`POST /api/holds` body: `{ bookId: "无库存图书的ID" }`
- **预期**：
  - HTTP 201
  - 响应 `{ hold, queuePosition }`
  - `hold.status` = ACTIVE
  - `queuePosition` ≥ 1

#### TC-HLD-02：有可用副本时不能预约
- **前置**：图书 `availableCopies > 0`
- **操作**：`POST /api/holds` body: `{ bookId: "有库存图书ID" }`
- **预期**：HTTP 400，错误信息包含 "available"

#### TC-HLD-03：重复预约同一本书被拒绝
- **前置**：该用户已有该书 ACTIVE 状态的预约
- **操作**：再次 `POST /api/holds`
- **预期**：HTTP 409，错误信息包含 "already"

#### TC-HLD-04：预约不存在的图书
- **操作**：`POST /api/holds` body: `{ bookId: "不存在的ID" }`
- **预期**：HTTP 404

#### TC-HLD-05：queuePosition 计算正确
- **前置**：同一本书已有 2 个 ACTIVE 预约（通过其他用户预约）
- **操作**：当前用户预约该书
- **预期**：`queuePosition = 3`

#### TC-HLD-06：匿名用户无权预约
- **操作**：不带 token 调用 `POST /api/holds`
- **预期**：HTTP 401

### 前端测试用例

#### TC-HLD-FE-01：库存为0时显示 [Place hold] 按钮
- 进入无库存图书详情页
- **验证**：[Borrow online] 按钮禁用；[Place hold] 按钮可见

#### TC-HLD-FE-02：有库存时隐藏 [Place hold] 按钮
- 进入有库存图书详情页
- **验证**：仅 [Borrow online] 按钮可用；无 [Place hold] 按钮

#### TC-HLD-FE-03：预约成功显示排队位置
- 点击 [Place hold]
- **验证**：成功提示显示 `"Hold placed. You are #N in the queue."`

#### TC-HLD-FE-04：无库存且有人预约时显示排队人数
- 进入无库存且有预约的图书详情页
- **验证**：Availability 区域显示 `"N people in the hold queue"`

---

## 功能 3：借阅历史页面

### 前置条件

以 `student1@library.local` 登录，有借阅记录（含已归还和借阅中）。

### 前端测试用例

#### TC-HIST-FE-01：历史页面正确显示所有记录
- 进入"借阅历史"页面
- **验证**：表格包含所有历史借阅（无论状态）

#### TC-HIST-FE-02：已归还记录显示归还日期
- 有一笔已归还的借阅
- **验证**：Returned 列显示实际归还日期

#### TC-HIST-FE-03：有罚金的记录罚金以红色显示
- 有一笔产生罚金的归还记录
- **验证**：Fine 列显示红色金额 `$X.XX`

#### TC-HIST-FE-04：无记录时显示空状态
- 以新用户（无历史）登录
- **验证**：显示 `"No borrowing history yet."`

#### TC-HIST-FE-05：记录按借阅日期降序排列
- **验证**：第一行为最近借阅的图书

#### TC-HIST-FE-06：导航中存在 History 链接
- MEMBER 角色登录
- **验证**：侧边栏有 "History" 链接

### API 测试用例

#### TC-HIST-API-01：历史接口返回正确字段
- **操作**：`GET /api/reader/loans/history`
- **预期**：返回字段包含 `book.title`、`borrowedAt`、`returnedAt`、`fineAmount`、`status`

---

## 功能 4：图书详情页增强

### 前端测试用例

#### TC-DET-FE-01：库存状态显示
- 进入任意图书详情页
- **验证**：Availability 显示 `"Available · X / Y copies"` 或 `"Unavailable · 0 / Y copies"`

#### TC-DET-FE-02：无库存且有预约时显示排队人数
- 找一本 `availableCopies = 0` 且 `activeHoldsCount > 0` 的书
- **验证**：显示 `"N people in the hold queue"`

#### TC-DET-FE-03：Borrow 和 Hold 按钮互斥显示
- 有库存：仅 [Borrow online] 可用
- 无库存：仅 [Place hold] 显示

---

## 功能 5：配置管理 API 与前端

### API 测试用例

#### TC-CFG-01：获取所有配置项
- **操作**：`GET /api/admin/config`
- **预期**：返回数组，包含 LOAN_DAYS、MAX_BORROW_BOOKS、MAX_RENEW_COUNT、FINE_RATE_PER_DAY 等

#### TC-CFG-02：批量更新配置
- **操作**：`PATCH /api/admin/config` body: `{ entries: [{ key: "LOAN_DAYS", value: "21" }] }`
- **预期**：HTTP 200，数据库中 LOAN_DAYS = '21'

#### TC-CFG-03：更新单个配置项（PUT）
- **操作**：`PUT /api/admin/config/LOAN_DAYS` body: `{ value: "30" }`
- **预期**：HTTP 200，数据库更新

#### TC-CFG-04：读取 MAX_RENEW_COUNT 配置值
- **操作**：`GET /api/admin/config`
- **预期**：返回项中包含 `MAX_RENEW_COUNT`

#### TC-CFG-05：非管理员无权访问配置
- 以 MEMBER 角色调用 `GET /api/admin/config`
- **预期**：HTTP 403

### 前端测试用例

#### TC-CFG-FE-01：规则页面正确渲染所有配置项
- 进入 Admin → Rules 页面
- **验证**：显示 LOAN_DAYS、MAX_RENEW_COUNT、FINE_RATE_PER_DAY 等所有配置项

#### TC-CFG-FE-02：修改并保存配置
- 修改 LOAN_DAYS 为 "30"，点击 Save
- **验证**：显示 "Saved."，刷新后值正确

---

## 功能 6：密码重置 API 与前端

### API 测试用例

#### TC-RST-01：管理员成功重置用户密码
- **操作**：`POST /api/admin/users/:targetUserId/reset-password`
- **预期**：
  - HTTP 200
  - 响应包含 `user` 和 `tempPassword`
  - `tempPassword` 为 12 位随机字符串
  - 数据库中该用户的 `passwordHash` 已更新

#### TC-RST-02：重置后新密码可登录
- **前置**：重置 `student2@library.local` 的密码
- **操作**：用返回的 `tempPassword` 登录
- **预期**：登录成功，获取有效 JWT token

#### TC-RST-03：重置不存在的用户
- **操作**：`POST /api/admin/users/不存在的ID/reset-password`
- **预期**：HTTP 404

#### TC-RST-04：审计日志记录密码重置
- **前置**：`POST /api/admin/users/:id/reset-password`
- **操作**：查询 `prisma.auditLog.findFirst({ where: { details: { contains: 'PASSWORD_RESET' } } })`
- **预期**：存在记录，详情包含 `targetEmail`

#### TC-RST-05：非管理员无权重置密码
- 以 MEMBER 角色调用 `POST /api/admin/users/:id/reset-password`
- **预期**：HTTP 403

### 前端测试用例

#### TC-RST-FE-01：用户列表每行显示 [Reset password] 按钮
- 进入 Admin → Users 页面
- **验证**：每行操作列有 [Reset password] 按钮

#### TC-RST-FE-02：重置成功显示临时密码弹窗
- 点击 [Reset password]
- **验证**：显示绿色提示框，含临时密码（高亮字体）

#### TC-RST-FE-03：点击 Close 关闭弹窗
- 弹窗显示后点击 [Close]
- **验证**：弹窗关闭，`resetTarget` 状态清除

#### TC-RST-FE-04：重置失败显示错误
- 模拟网络错误
- **验证**：红色错误信息显示

---

## 功能 7：还书 API（含逾期罚金）

### 前置条件

以 `librarian@library.local` 登录，确认存在一笔 `BORROWED` 状态的 loan（可通过借书 API 创建）。

### API 测试用例

#### TC-RET-01：按时还书无罚金
- **前置**：loan `dueAt` 未过期
- **操作**：`POST /api/librarian/return` body: `{ loanId: "..." }`
- **预期**：
  - HTTP 200
  - `fineAmount` = 0
  - `isOverdue` = false
  - `loan.status` = RETURNED
  - `loan.returnedAt` 已设置
  - Book 的 `availableCopies` 已 +1

#### TC-RET-02：逾期还书产生罚金
- **前置**：loan `dueAt` 已过期（手动修改数据库将 dueAt 设为过去日期）
- **操作**：`POST /api/librarian/return` body: `{ loanId: "..." }`
- **预期**：
  - HTTP 200
  - `fineAmount` > 0（根据 `FINE_RATE_PER_DAY * 逾期天数` 计算）
  - `isOverdue` = true
  - 审计日志中记录逾期天数和罚金

#### TC-RET-03：罚金计算精度
- **前置**：`FINE_RATE_PER_DAY = 0.50`，逾期 3 天
- **操作**：`POST /api/librarian/return`
- **预期**：`fineAmount = 1.50`

#### TC-RET-04：还书后库存增加
- **前置**：记录还书前 Book 的 `availableCopies`
- **操作**：归还该书
- **预期**：`availableCopies = 原值 + 1`

#### TC-RET-05：重复还书（已归还）被拒绝
- **前置**：loan 状态已为 RETURNED
- **操作**：再次调用 `POST /api/librarian/return`
- **预期**：HTTP 404，错误 "Active loan not found"

#### TC-RET-06：还书后触发预约队列（数据层面）
- **前置**：某书有 ACTIVE 预约但 `availableCopies = 0`，还书后 `availableCopies = 1`
- **操作**：还书
- **预期**：数据更新成功；馆员可在预约队列看到等待中的预约（实际通知触发不在本版本范围）

#### TC-RET-07：匿名/非馆员无权还书
- 以 MEMBER 角色调用 `POST /api/librarian/return`
- **预期**：HTTP 403

#### TC-RET-08：Prisma 事务一致性验证
- 模拟还书过程中途失败（如数据库中断）
- **验证**：Loan 状态和 Book availableCopies 均未改变（事务回滚）

### 前端测试用例

#### TC-RET-FE-01：还书表单正确显示
- 进入 Librarian → Desk 页面
- **验证**：存在"Return"区块，包含 Loan ID 输入框和 [Confirm return] 按钮

#### TC-RET-FE-02：还书成功无罚金时绿色提示
- 按时还书
- **验证**：绿色成功提示 `"Book returned successfully."`

#### TC-RET-FE-03：逾期还书时红色提示显示罚金
- 逾期还书
- **验证**：红色提示 `"Book returned. Overdue fine: $X.XX"`

#### TC-RET-FE-04：还书成功后表单清空
- 还书成功后
- **验证**：Loan ID 输入框被清空

#### TC-RET-FE-05：还书失败显示错误
- 输入不存在的 loanId
- **验证**：显示红色错误信息

---

## 回归测试

### RT-01：未登录用户所有受保护接口返回 401
- 调用 `/api/reader/*`、`/api/librarian/*`、`/api/admin/*` 任一接口（不带 token）
- **预期**：均为 HTTP 401

### RT-02：MEMBER 角色不能访问馆员和管理员接口
- 以 `student1@library.local` 调用 `/api/librarian/*`、`/api/admin/*`
- **预期**：HTTP 403

### RT-03：借阅流程完整闭环
1. 以 `student1` 借阅一本书 → 借阅成功，`availableCopies - 1`
2. 以馆员身份归还 → 归还成功，`availableCopies + 1`，状态 RETURNED
- **预期**：全流程数据一致

### RT-04：预约→借出→归还→库存恢复
1. 借出某书所有副本使 `availableCopies = 0`
2. `student1` 预约该书 → `queuePosition = 1`
3. 归还另一本该书 → `availableCopies = 1`（但预约仍 ACTIVE）
- **验证**：数据一致

### RT-05：配置变更后续借逻辑受影响
- 在 Admin Rules 页面将 `MAX_RENEW_COUNT` 设为 `0`
- 以读者身份尝试续借
- **预期**：HTTP 409，错误 "Maximum renewals (0) reached"

### RT-06：罚金率变更后还书计算受影响
- 在 Admin Rules 页面将 `FINE_RATE_PER_DAY` 设为 `1.00`
- 归还一笔逾期 2 天的借阅
- **预期**：`fineAmount = 2.00`

---

## 测试数据清理

每个测试用例完成后：
- 使用 `prisma db seed` 重新初始化数据库
- 或使用 `npx prisma migrate reset` 清空并重新迁移

---

## 风险项

| 风险 | 描述 | 缓解措施 |
|------|------|----------|
| 罚金计算时区问题 | `dueAt` 使用 UTC 存储，可能产生时间差 | 统一使用 UTC 存储，toLocaleDateString 显示本地时间 |
| queuePosition 并发问题 | 同时多人预约，placedAt 可能相同 | 使用 `<` 而非 `<=` 比较；生产环境需事务锁 |
| $transaction 失败 | SQLite 不支持 savepoint 回滚 | 开发环境使用内存数据库隔离测试 |

# 协作日志

## 2026-04-27

### 操作 1：Loan 模型添加 renewCount 字段

**修改文件：**
- `backend/prisma/schema.prisma`
  - 在 `Loan` 模型中添加 `renewCount Int @default(0)` 字段，用于记录借阅续借次数。

- `backend/src/lib/libraryRules.js`
  - 新增 `getMaxRenewCount()` 辅助函数，从 Config 表读取 `MAX_RENEW_COUNT`（默认值为 1）。
  - 更新模块导出，包含 `getMaxRenewCount`。

**执行的数据库迁移：**
- `npx prisma migrate dev --name add_renew_count_to_loan`
- 迁移文件：`prisma/migrations/20260427071258_add_renew_count_to_loan/migration.sql`
- 迁移后重新生成了 Prisma Client。

---

### 操作 2：实现续借（Renew）功能

**后端 - `backend/src/routes/reader.js`：**
- 更新导入，引入 `getMaxRenewCount`。
- 重写 `POST /loans/:id/renew` 接口逻辑：
  - 从系统配置读取 `loanDays` 和 `maxRenew`。
  - 检查借阅记录是否存在且属于当前用户。
  - 若借阅已逾期（dueAt < now）则拒绝续借。
  - 若 `renewCount >= maxRenew`（已达最大续借次数）则拒绝。
  - 将 `dueAt` 延长 `loanDays`，并将 `renewCount + 1`。
  - 创建审计日志记录续借操作。
- 审计日志详情中包含 `renewCount`。

**前端 - `frontend/src/pages/reader/ReaderLoansPage.jsx`：**
- 新增 `renewingId` 状态，用于追踪正在续借的借阅记录。
- 新增 `handleRenew(loanId)` 异步函数：
  - 调用 `POST /api/reader/loans/${loanId}/renew`。
  - 续借成功后刷新借阅列表。
  - 失败时显示错误信息。
- 新增 `isActive` 计算变量：`loan.status === 'BORROWED' && !overdue`。
- 新增 [Renew] 按钮：
  - 仅对"借阅中且未逾期"的记录显示。
  - 续借请求进行中时显示 `Renewing…` 并禁用按钮。
  - 位于 [Details] 按钮左侧。
- 表格支持通过后端拒绝消息感知最大续借次数限制。

---

## 2026-04-27（续）

### 操作 3：实现预约（Hold）功能

**后端 - `backend/src/routes/holds.js`：**
- 新增角色限制：`requireRole(['MEMBER'])`（此前仅有 `requireAuth`）。
- 创建预约前计算 `queuePosition`：统计同一本书在当前时间之前已存在的 ACTIVE 状态的预约数量，再 +1。
- 创建预约记录时设置 `queuePosition` 字段。
- 审计日志详情中包含 `queuePosition`。
- 响应体返回 `{ hold, queuePosition }`（状态码 201）。

---

### 操作 4：实现借阅历史页面

**后端 - `backend/src/routes/reader.js`：**
- 新增 `GET /loans/history` 接口：返回当前用户的所有借阅记录，按 `borrowedAt` 降序排列。

**前端 - 新建文件 `frontend/src/pages/reader/ReaderHistoryPage.jsx`：**
- 新建页面组件。
- 表格列：书名、借出日期、应还日期、实际归还日期、罚金、状态、操作。
- 罚金金额大于0时以红色显示。
- 无记录时显示空状态提示。
- 逾期行以红色背景高亮。

**前端 - `frontend/src/App.jsx`：**
- 新增 `ReaderHistoryPage` 组件导入。
- 新增路由：`reader/history` → `ReaderHistoryPage`。

**前端 - `frontend/src/components/AppLayout.jsx`：**
- 在 MEMBER 侧边栏导航中添加 `History` 链接（`/reader/history`）。

---

### 操作 5：图书详情页增强

**后端 - `backend/src/routes/books.js`：**
- `GET /books/:id` 接口现同时返回 `activeHoldsCount`（该书 ACTIVE 状态的预约数量）。

**前端 - `frontend/src/pages/BookDetailPage.jsx`：**
- `handleHold()` 函数现显示预约排队位置：提示 `"Hold placed. You are #${res.queuePosition} in the queue."`。
- 库存信息区域：当 `availableCopies === 0` 且 `activeHoldsCount > 0` 时，显示 `"N people in the hold queue"`。
- 读者操作区域：[Borrow online] 按钮仅在 `canBorrow` 时启用；[Place hold] 按钮仅在 `!canBorrow` 时显示（移除了原先的占位按钮文案）。

---

## 2026-04-27（阶段二：管理员模块）

### 操作 6：配置管理 API 与前端集成

**后端 - `backend/src/routes/admin.js`：**
- 新增 `PUT /api/admin/config/:key` 接口：更新单个配置项（key, value, 可选 description），返回更新后的记录。
- 在 `database-bootstrap` 默认配置中新增 `MAX_RENEW_COUNT`（默认值 '1'，说明：每笔借阅最多续借次数，0 = 禁用续借）。
- `GET /api/admin/config` 和 `PATCH /api/admin/config` 保持不变（已存在）。

**前端 - `frontend/src/pages/admin/AdminRulesPage.jsx`：**
- `KEY_LABEL` 中新增 `MAX_RENEW_COUNT` 的标签文本：`'Max renewals per loan (0 = disabled)'`。
- 其余读取/保存逻辑已适配（基于 configRows 动态渲染）。

---

### 操作 7：密码重置 API 与前端集成

**后端 - `backend/src/routes/admin.js`：**
- 新增 `POST /api/admin/users/:id/reset-password` 接口：
  - 生成随机8位临时密码（字母+数字混合）。
  - 使用 bcrypt 哈希后存入 User 表。
  - 创建审计日志（action: UPDATE，详情含 targetEmail）。
  - 返回 `{ user, tempPassword }`。

**前端 - `frontend/src/pages/admin/AdminUsersPage.jsx`：**
- 新增 `resetTarget` 状态：`{ user, tempPassword }`，用于展示重置结果弹窗。
- 新增 `handleResetPassword(u)` 函数：调用 `POST /api/admin/users/${u.id}/reset-password`。
- 用户列表每行操作列新增 [Reset password] 按钮。
- 重置成功后显示临时密码提示框（绿色背景，含临时密码高亮显示），附"请安全分享给用户"的提示。
- 新增 `resetErr` 状态用于展示重置失败错误。
- 重置结果弹窗包含 [Close] 按钮，关闭后清除 `resetTarget` 状态。

---

## 2026-04-27（阶段三：馆员模块）

### 操作 8：还书 API（含逾期罚金计算）

**后端 - `backend/src/lib/libraryRules.js`：**
- 新增 `getFineRatePerDay()` 辅助函数，从 Config 表读取 `FINE_RATE_PER_DAY`（默认值为 0）。
- 更新模块导出，包含 `getFineRatePerDay`。

**后端 - `backend/src/routes/librarian.js`：**
- 重写 `POST /return` 接口逻辑（在 `$transaction` 中完成）：
  - 查找状态为 `BORROWED` 的借阅记录。
  - 计算是否逾期（dueAt < now）。
  - 若逾期且 `fineRate > 0`，按 `ceil((now - dueAt) / 天) * fineRate` 计算罚金。
  - 将 Loan 状态更新为 `RETURNED`，记录 `returnedAt` 和 `fineAmount`。
  - 将 Book 的 `availableCopies + 1`。
  - 创建审计日志（详情含 isOverdue、overdueDays、fineAmount）。
  - 响应体返回 `{ ok, loanId, fineAmount, isOverdue, message }`。

---

### 操作 9：前台还书表单 UI

**前端 - `frontend/src/pages/librarian/LibrarianDeskPage.jsx`：**
- 新增"Return"区块（含标题和说明文字）。
- 新增 `returnLoanId`、`returnMsg`、`returnErr`、`returnPending`、`lastReturnFine` 状态。
- 新增 `handleReturn(e)` 函数：调用 `POST /api/librarian/return`。
- 还书表单字段：Loan ID（输入框）。
- 提交后：
  - 若有罚金（`fineAmount > 0`），提示信息以红色显示：`"Book returned. Overdue fine: $X.XX"`。
  - 若无罚金，提示信息以绿色显示：`"Book returned successfully."`。
- 页面顶部副标题更新为 `"Check out books to patrons or process returns."`。
- 移除了原有的 Release 1 提示文字。

---

### 操作 10：用户密码修改功能

**后端 - `backend/src/routes/auth.js`：**
- 新增 `PATCH /api/auth/me/password` 接口。
- 验证当前密码（bcrypt compare）。
- 检查新密码长度（至少 MIN_PASSWORD_LENGTH）。
- 使用 bcrypt.hash 更新密码。
- 创建审计日志（action: UPDATE，详情含 PASSWORD_CHANGE）。

**前端 - `frontend/src/pages/reader/ReaderAccountPage.jsx`：**
- 新增密码修改表单（当前密码、新密码、确认密码）。
- 点击 "Change Password" 按钮显示表单。
- 验证两次新密码一致。
- 成功/失败提示显示。
- 取消按钮重置表单并隐藏。

**前端 - 新建 `frontend/src/pages/librarian/LibrarianAccountPage.jsx`：**
- librarian 账户页面，功能与 ReaderAccountPage 相同。
- Role 显示为 "Librarian"。

**前端 - `frontend/src/App.jsx`：**
- 导入 `LibrarianAccountPage`。
- 添加路由 `/librarian/account` → `LibrarianAccountPage`。

**前端 - `frontend/src/components/LibrarianLayout.jsx`：**
- 在 `nav` 数组中添加 `{ to: '/librarian/account', label: 'Account' }`。

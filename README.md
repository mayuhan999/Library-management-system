# Library-management-system

Week 1-12 SPM Course Project

## Week 1 开发日志（中文）

### 1. 本周目标
- 搭建图书馆管理系统前后端开发环境与项目脚手架。
- 完成前端（React + Vite + Tailwind）与后端（Node.js + Express）基础运行。
- 完成 Prisma + SQLite 数据库建模、迁移与种子数据填充。
- 完成 Git 分支开发与代码推送（feature/week1-setup）。

### 2. 已完成内容
- **前端初始化**
  - 创建 `frontend` 项目并安装依赖。
  - 配置 Tailwind 扫描 `src` 下 React 文件。
  - 集成 `shadcn/ui` 并添加测试按钮组件。
- **后端初始化**
  - 创建 `backend` 项目并安装 `express`、`cors`、`dotenv`、`nodemon`。
  - 完成健康检查接口 `GET /health`，服务端口为 `3001`。
- **数据库与 ORM**
  - 安装 `prisma`、`@prisma/client`，使用 SQLite 数据源。
  - 完成 8 个核心模型：`User`、`Book`、`Loan`、`Rating`、`Hold`、`Wishlist`、`Config`、`AuditLog`。
  - 执行迁移并生成数据库。
- **种子数据**
  - 编写 `prisma/seed.js`（实际调用 `seed.cjs`）。
  - 插入 4 个用户（1 管理员、1 图书管理员、2 学生）。
  - 插入 20 本图书（技术/小说/科学/历史/管理各 4 本），其中 15 本可借、5 本已借。
  - 插入配置项：`FINE_RATE_PER_DAY=0.50`。
- **版本管理**
  - 在 `feature/week1-setup` 分支完成提交并推送到 GitHub。

### 3. 运行与验证
- 前端启动：
  - `cd frontend`
  - `npm run dev`
  - 访问 `http://localhost:5173`
- 后端启动：
  - `cd backend`
  - `npm run dev`
  - 访问 `http://localhost:3001/health`
- 数据验证：
  - `cd backend`
  - `npm run seed`
  - `npx prisma studio` 查看 `User`、`Book` 表数据

### 4. 本周问题与处理
- **问题 1：`npm run dev` 前端启动失败**
  - 现象：`path is not defined`（`vite.config.js`）。
  - 处理：改为 ESM 别名写法（`fileURLToPath(new URL(...))`）。
- **问题 2：`git add .` 失败**
  - 现象：`frontend/ does not have a commit checked out`。
  - 原因：`frontend` 目录存在嵌套 `.git`。
  - 处理：移除 `frontend/.git` 后重新 `git add .`。
- **问题 3：Prisma 初始化/seed 兼容问题**
  - 处理：按 Prisma 7 配置方式调整 `prisma.config.ts` 与 seed 入口，完成验证。

---

## Release 1 · Sprint 1 开发日志（中文）

**时间线（课程路线图）：** Weeks 3–5  
**Sprint 目标：** 学生可以注册、登录、浏览馆藏、按关键词搜索图书，并查看单本图书详情。  
**交付用户故事：** STU-01、STU-02、STU-03、STU-04（约 25 story points，以课程规划为准）。

### 1. 本周目标
- 实现学生端账号体系：注册（默认学生角色 `MEMBER`）、登录、JWT 会话、当前用户查询。
- 实现馆藏只读能力：分页浏览、按书名/作者/简介/分类等关键词搜索、图书详情页。
- 前后端联调：Vite 开发代理 `/api` → 后端；生产构建可通过 `VITE_API_BASE` 指向网关。
- 种子数据：用户密码改为 bcrypt 哈希，图书补充简介字段，便于检索与详情展示。

### 2. Release 1 — User Story Map（用户故事地图）

用户故事地图按**学生使用图书馆的主线活动**从左到右排列；上层为活动环节，下层为对应用户故事编号与名称。

| 活动 backbone（从左到右） | 建立身份与进入系统 | 发现图书 | 缩小范围 | 决策是否借阅（本 Sprint 仅到「了解详情」） |
|---------------------------|-------------------|----------|----------|------------------------------------------|
| **用户故事** | **STU-01** 注册与登录 | **STU-02** 浏览书目 | **STU-03** 搜索 | **STU-04** 图书详情 |
| **说明** | 注册为学生账号并登录，获得令牌以访问受保护页面 | 分页查看馆藏列表与可借状态 | 按标题、作者、简介关键词等检索 | 查看 ISBN、分类、出版社、简介、可借册数等 |

**故事依赖关系（简图）：** `STU-01` →（登录后）`STU-02` → `STU-03` → `STU-04`（浏览与搜索可交替进行，详情从列表进入）。

### 3. Release 1 — Acceptance Criteria（验收标准）

以下为 **Definition of Done** 层面的可验证标准；验收时按条打勾。

#### STU-01 — 学生注册与登录
- **注册**
  - 学生可使用邮箱、姓名、密码注册；密码长度不少于 6 个字符；邮箱格式合法且未重复时注册成功。
  - 注册成功后默认角色为学生（`MEMBER`），并自动登录进入系统主界面（馆藏页）。
  - 重复邮箱返回明确错误提示（HTTP 409 / 业务错误信息）。
- **登录**
  - 学生可使用邮箱 + 密码登录；凭证正确时返回 JWT，前端持久化后访问受保护接口成功。
  - 凭证错误时返回统一错误提示，不区分「用户不存在」与「密码错误」（避免枚举邮箱）。
  - 停用账号不可登录（`isActive === false`）。
- **安全与审计**
  - 密码仅以 bcrypt 哈希存储；登录成功写入一条 `AuditLog`，动作为 `LOGIN`。

#### STU-02 — 浏览书目
- 已登录用户可打开馆藏列表页，默认分页展示图书（含书名、作者、分类、ISBN、可借/总册数等关键字段）。
- 无搜索条件时展示「浏览」全量（分页），列表项可点击进入详情页。

#### STU-03 — 搜索图书
- 已登录用户可在搜索框输入关键词，系统在**书名、作者、图书简介、分类**等字段中进行匹配（OR 逻辑），结果分页返回。
- 支持清空关键词后恢复为浏览模式；分页在搜索状态下仍然有效。

#### STU-04 — 图书详情
- 已登录用户从列表进入详情页，可查看该书的完整元数据及简介（若有）。
- 请求不存在的图书 ID 时返回 404 与明确提示。

### 4. 已实现内容（技术摘要）

- **后端（`backend`）**
  - `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`（Bearer JWT）。
  - `GET /api/books`：查询参数 `q`（可选）、`page`、`limit`；需认证。
  - `GET /api/books/:id`：单本图书；需认证。
  - 依赖：`jsonwebtoken`、`bcrypt`、现有 Prisma + SQLite。
  - 环境变量示例见 `backend/.env.example`（`DATABASE_URL`、`JWT_SECRET`）。
- **前端（`frontend`）**
  - `react-router-dom`：`/login`、`/register`、`/books`、`/books/:id`；馆藏与详情需登录。
  - `vite.config.js` 将 `/api` 代理到 `http://localhost:3001`（开发环境）。
- **种子数据（`backend/prisma/seed.cjs`）**
  - 演示账号密码使用 bcrypt 写入；示例：`student1@library.local` / `student123`（执行 `npm run seed` 后可用）。

### 5. 运行与验证（Sprint 1）

1. **准备环境变量：** 将 `backend/.env.example` 复制为 `backend/.env`，按需修改 `DATABASE_URL` 与 `JWT_SECRET`。  
2. **写入演示数据：** 在 `backend` 目录执行 `npm run seed`。  
3. **启动后端：** `cd backend` → `npm run dev`（默认 `http://localhost:3001`）。  
4. **启动前端：** `cd frontend` → `npm run dev`（默认 `http://localhost:5173`）。  



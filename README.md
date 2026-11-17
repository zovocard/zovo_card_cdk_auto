# CDK 充值系统

一个现代化的 CDK 激活码充值系统，支持虚拟货币兑换。用户可以通过输入 CDK 码快速充值，管理员可以批量发放 CDK 和审核充值申请。

## 官方入口

| 类型 | 链接 |
|------|------|
| **卡台官网** | [https://zovocard.com](https://zovocard.com) |
| **官方频道** | [https://t.me/spacex_card_visa](https://t.me/zovo_card_tz) |


## 主要特性

✨ **用户端**
- 用户注册和登录
- CDK 激活码输入和验证
- 实时充值申请提交
- 充值历史查看
- 账户余额管理

⚙️ **管理端**
- CDK 批量生成
- CDK 管理和禁用
- 充值申请审核
- 充值历史和审计日志
- 统计分析和报表

🔒 **技术特性**
- JWT 认证
- PostgreSQL 数据库
- Redis 缓存
- 精确的小数点计算
- 完整的审计日志

## 技术栈

### 前端
- Vue 3.4+
- Vite 5.0+
- TypeScript
- Tailwind CSS 3.4
- Pinia (状态管理)
- Axios (HTTP 客户端)
- Chart.js (数据可视化)

### 后端
- Go 1.26.3
- Gin Web Framework
- Ent ORM
- PostgreSQL 15+
- Redis 7+

## 快速开始

### 前置要求
- Docker 和 Docker Compose
- Node.js 18+ (本地开发前端)
- Go 1.26+ (本地开发后端)

### 使用 Docker Compose 运行

```bash
# 启动所有服务
docker-compose up

# 访问应用
# 前端: http://localhost:5173
# 后端 API: http://localhost:8080
# PostgreSQL: localhost:5432 (user: postgres, password: postgres)
# Redis: localhost:6379
```

### 本地开发

**后端**
```bash
cd backend
go mod download
go run ./cmd/server/main.go
```

**前端**
```bash
cd frontend
npm install
npm run dev
```

## 项目结构

```
cdk-recharge-system/
├── frontend/              # Vue 3 前端应用
│   ├── src/
│   │   ├── api/          # API 调用
│   │   ├── views/        # 页面视图
│   │   ├── components/   # 可复用组件
│   │   ├── stores/       # Pinia 状态管理
│   │   ├── router/       # Vue Router 路由
│   │   └── types/        # TypeScript 类型
│   ├── package.json
│   └── vite.config.ts
│
├── backend/               # Go 后端应用
│   ├── cmd/server/       # 主程序入口
│   ├── ent/              # Ent ORM (数据库)
│   ├── internal/
│   │   ├── handler/      # HTTP 请求处理
│   │   ├── service/      # 业务逻辑
│   │   ├── repository/   # 数据访问
│   │   ├── middleware/   # 中间件
│   │   ├── config/       # 配置管理
│   │   └── pkg/          # 工具包
│   └── go.mod
│
├── docker-compose.yml    # Docker 编排配置
└── Makefile             # 构建脚本
```

## 环境变量配置

### 后端 (.env 或环境变量)

```env
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_MODE=debug

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=cdk_recharge
DB_SSLMODE=disable

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=your-secret-key
JWT_EXPIRATION_HOURS=24
```

## 数据库 Schema

### 核心表结构

**users** - 用户表
- id, email, username, password_hash, balance_credit, is_admin, created_at, updated_at, deleted_at

**cd_keys** - CDK 激活码表
- id, code, key_type (gpt-5x, gpt-20x), amount, status, created_by_user_id, used_by_user_id, used_at, expires_at

**recharge_requests** - 充值申请表
- id, user_id, cdk_codes, amount_requested, status, created_at, approved_by_user_id, approved_at, rejection_reason

**recharge_logs** - 充值日志（审计）
- id, user_id, old_balance, new_balance, amount, action, reason, created_at, created_by_user_id

## API 端点

### 认证 (`/api/v1/auth/*`)
- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录
- `POST /auth/refresh` - Token 刷新
- `GET /auth/me` - 获取当前用户信息

### 用户 (`/api/v1/user/*`)
- `GET /user/balance` - 获取余额
- `GET /user/recharge-history` - 充值历史
- `POST /recharge/verify-cdk` - 验证 CDK
- `POST /recharge/submit` - 提交充值申请

### 管理员 (`/api/v1/admin/*`)
- `POST /admin/cdkeys/generate` - 生成 CDK
- `GET /admin/cdkeys` - CDK 列表
- `PATCH /admin/cdkeys/:id/disable` - 禁用 CDK
- `GET /admin/recharge-requests` - 申请列表
- `POST /admin/recharge-requests/:id/approve` - 批准申请
- `POST /admin/recharge-requests/:id/reject` - 拒绝申请
- `GET /admin/stats` - 统计信息

## 充值流程

```
1. 用户提交 CDK 码
   ↓
2. 系统验证 CDK 有效性
   ↓
3. 创建 RechargeRequest（待审核）
   ↓
4. 管理员审核
   ↓
5. 批准：消耗 CDK → 更新余额 → 记录日志
   或
   拒绝：记录原因
```

## 开发指南

### 添加新的 API 端点

1. 在 `backend/internal/handler/` 中创建处理器
2. 在 `backend/internal/service/` 中实现业务逻辑
3. 在 `backend/internal/server/routes/` 中注册路由
4. 在 `frontend/src/api/` 中添加 API 调用

### 创建新的前端页面

1. 在 `frontend/src/views/` 中创建 Vue 组件
2. 在 `frontend/src/router/index.ts` 中添加路由
3. 导入必要的 stores 和 API 调用

## 测试

### 后端测试
```bash
cd backend
go test ./...
```

### 前端测试
```bash
cd frontend
npm run test
```

## 部署

### Docker 镜像构建
```bash
docker-compose build
```

### 生产环境部署
见 `docs/DEPLOYMENT.md`

## 常见问题

**Q: 如何重置数据库？**
```bash
docker-compose down -v
docker-compose up
```

**Q: 如何查看日志？**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Q: 默认管理员账户是什么？**
初始化时需要手动创建或通过数据库脚本创建。

## 贡献

欢迎提交 Issue 和 Pull Request！

## License

MIT License

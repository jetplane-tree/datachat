# DataChat

AI 驱动的数据分析平台 — 用自然语言和数据对话，自动生成 SQL 查询、图表和数据洞察。

## 功能

- 内置 3 个业务数据集（电商销售、用户行为、营销投放）
- 支持 CSV / Excel 文件上传分析
- 自然语言提问，AI 自动生成 SQL 并在服务端执行
- 数据表格预览，支持分页和复制 CSV
- SQL 查询编辑与重新执行
- ECharts 图表可视化，支持切换图表类型（折线、柱状、饼图等）
- 多轮对话上下文记忆
- SQL 执行失败自动修正重试
- 访问密码 + IP 限流双重保护

## 技术栈

- **Next.js 15** — React 全栈框架（App Router）
- **Turso** — 云端 SQLite 数据库，服务端执行 SQL 查询
- **ECharts** — 数据可视化图表库
- **DeepSeek API** — 大语言模型，自然语言转 SQL
- **shadcn/ui + Tailwind CSS** — UI 组件与样式
- **TypeScript** — 类型安全

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 LLM API Key 和 Turso 凭证
```

### Turso 数据库设置

1. 在 [turso.tech](https://turso.tech) 注册账号（免费）
2. 创建一个数据库
3. 获取数据库 URL 和 Auth Token
4. 将 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN` 填入 `.env.local`
5. 运行 `npm run seed-turso` 填充示例数据

```bash
# 填充示例数据到 Turso
npm run seed-turso

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可使用。

## 环境变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `LLM_API_KEY` | LLM API 密钥 | `sk-xxx` |
| `LLM_BASE_URL` | API 地址 | `https://api.deepseek.com` |
| `LLM_MODEL` | 模型名称 | `deepseek-chat` |
| `ACCESS_CODE` | 访问密码（留空则关闭） | `mypassword` |
| `TURSO_DATABASE_URL` | Turso 数据库 URL | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso 认证令牌 | `eyJhbGciOi...` |

## 架构

用户通过自然语言提问，LLM 生成 SQL 查询，服务端通过 Turso 执行 SQL 并返回结果，前端渲染数据表格和 ECharts 图表。

```
用户提问 → LLM API（生成 SQL） → 服务端 API → Turso（执行查询） → 数据表格 + 图表渲染
```

## 部署

推荐部署到 [Vercel](https://vercel.com)：

1. 在 Vercel 导入 GitHub 仓库
2. 在项目 **Settings → Environment Variables** 中添加以下所有环境变量：

| 变量 | 必填 | 说明 |
|---|---|---|
| `LLM_API_KEY` | ✅ | LLM API 密钥 |
| `LLM_BASE_URL` | ✅ | API 地址，如 `https://api.deepseek.com` |
| `LLM_MODEL` | ✅ | 模型名称，如 `deepseek-chat` |
| `TURSO_DATABASE_URL` | ✅ | Turso 数据库 URL，如 `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | ✅ | Turso 认证令牌 |
| `ACCESS_CODE` | 可选 | 访问密码，留空则关闭 |

3. 部署后即可访问

## 作者

**Kamook** — kamook0201@gmail.com.com

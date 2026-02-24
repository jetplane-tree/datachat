# DataChat

AI 驱动的数据分析平台 — 用自然语言和数据对话，自动生成 SQL 查询、图表和数据洞察。

## 功能

- 内置 3 个业务数据集（电商销售、用户行为、营销投放）
- 支持 CSV / Excel 文件上传分析
- 自然语言提问，AI 自动生成 SQL 并执行
- ECharts 图表可视化（折线、柱状、饼图等）
- 多轮对话上下文记忆
- SQL 执行失败自动修正重试
- 访问密码 + IP 限流双重保护

## 技术栈

- **Next.js 15** — React 全栈框架（App Router）
- **DuckDB WASM** — 浏览器端高性能 SQL 引擎
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
# 编辑 .env.local，填入你的 LLM API Key

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

## 部署

推荐部署到 [Vercel](https://vercel.com)，在项目设置中配置上述环境变量即可。

## 作者

**Kamook** — aloiwatermelon@hotmail.com

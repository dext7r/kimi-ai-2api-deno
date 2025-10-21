# kimi-ai-2api · Deno 版本

> 最后更新：2025-10-21 21:53（UTC+8）

将 Python 版 `kimi-ai-2api` 适配为 Deno/TypeScript 实现，保持与 OpenAI Chat Completions API 兼容，并针对 Kimi 官方站点做了专用优化（nonce 抓取、会话缓存、伪流式输出）。

---

## ✨ 核心特性
- ✅ **OpenAI 接口兼容**：提供 `/v1/chat/completions` 与 `/v1/models` 两个端点，可直接接入 OpenAI SDK。
- 🔐 **API 密钥验证**：沿用 Python 版 `API_MASTER_KEY` 语义，默认关闭认证，设置后自动启用 Bearer Token 校验。
- 🧠 **会话记忆管理**：根据 `user` 字段维护内存会话，支持 TTL 自动过期与智能截断，保持上下文长度受控。
- 🔄 **自动刷新 nonce**：内置并发安全的 nonce 缓存，若上游返回失败会自动刷新并重试一次。
- 💨 **伪流式输出**：默认逐字符推送 SSE 数据，也支持 `stream=false` 返回一次性 JSON，兼容不同客户端。
- 📊 **监控与面板**：自带仪表板、文档、Playground 页面，可查看实时统计、在线调试。
- 🎨 **现代化界面**：整合 Tailwind CSS + Highlight.js + ECharts，提供渐变界面、高亮代码块与可视化图表。

---

## 📁 目录结构
```
deno/
├── main.ts                # 核心服务入口（FastAPI 逻辑的 Deno 实现）
├── deno.json              # Deno 任务与编译配置
├── .env.example           # 环境变量模板
├── start.sh               # 本地启动脚本（兼容 .env 加载）
├── lib/
│   ├── types.ts           # 统一类型定义（含扩展后的 ProxyConfig 字段）
│   ├── utils.ts           # 工具函数：鉴权、SSE 工具、随机 UA 等
│   ├── pages.ts           # 首页/仪表板渲染
│   └── i18n.ts            # 多语言文案
└── pages/
    ├── docs-deploy.ts     # 文档 + 部署页面
    └── playground.ts      # 在线调试页面
```

---

## 🚀 快速开始
1. **安装 Deno**
   ```bash
   curl -fsSL https://deno.land/x/install/install.sh | sh
   ```

2. **复制环境变量模板**
   ```bash
   cd deno
   cp .env.example .env
   # 根据需求修改密钥、端口、模型等
   ```

3. **启动服务**
   ```bash
   # 开发模式（自动重载）
    deno task dev

   # 生产模式
   deno task start
   # 或使用脚本（含端口占用检测）
   ./start.sh
   ```

4. **验证接口**
   ```bash
   # 获取模型列表
   curl http://localhost:9090/v1/models \
     -H "Authorization: Bearer sk-kimi-ai-2api-default-key-please-change-me"

   # 伪流式聊天
   curl -N http://localhost:9090/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer sk-kimi-ai-2api-default-key-please-change-me" \
     -d '{
           "model":"kimi-k2-instruct-0905",
           "messages":[{"role":"user","content":"你好"}]
         }'
   ```

访问 `http://localhost:9090/` 查看首页、文档、Playground、仪表板。

---

## ⚙️ 环境变量说明

| 变量名 | 作用 | 默认值 |
| --- | --- | --- |
| `PORT` | 服务监听端口 | `9090` |
| `DEBUG_MODE` | 输出上游请求/响应日志 | `false` |
| `DEFAULT_STREAM` | 未显式传入 `stream` 时的默认行为 | `true` |
| `DASHBOARD_ENABLED` | 是否开放 `/dashboard` 页面 | `true` |
| `API_MASTER_KEY` | Bearer Token；为空或 `1` 表示关闭校验 | *(空)* |
| `SESSION_CACHE_TTL` | 会话缓存有效期（秒） | `3600` |
| `CONTEXT_MAX_LENGTH` | 上下文拼接后字数上限 | `1000` |
| `UPSTREAM_URL` | Kimi 聊天接口地址 | `https://kimi-ai.chat/wp-admin/admin-ajax.php` |
| `CHAT_PAGE_URL` | 用于抓取 nonce 的页面 | `https://kimi-ai.chat/chat/` |
| `API_REQUEST_TIMEOUT` | 上游请求超时时间（秒） | `180` |
| `DEFAULT_MODEL` | 默认模型标识 | `kimi-k2-instruct-0905` |
| `KNOWN_MODELS` | 可用模型列表，逗号分隔 | `kimi-k2-instruct-0905,kimi-k2-instruct` |
| `UPSTREAM_MODEL_MAP` | (可选) JSON 字符串，自定义模型映射 | - |
| `SERVICE_NAME` / `SERVICE_EMOJI` / `FOOTER_TEXT` | 页面品牌文案 | - |
| `DISCUSSION_URL` / `GITHUB_REPO` | 页面外链展示 | `https://linux.do/t/topic/1068201` / `https://github.com/lzA6/kimi-ai-2api` |

> 与 Python 版一致：若 `API_MASTER_KEY` 留空或设置为 `1`，所有请求将跳过鉴权。

---

## 🧭 API 说明
### `GET /v1/models`
- 返回配置中的 `KNOWN_MODELS` 列表。
- 需在 Header 中携带 `Authorization: Bearer <API_MASTER_KEY>`（除非关闭认证）。

### `POST /v1/chat/completions`
- 请求体与 OpenAI Chat Completions 保持一致。
- 如果 `messages` 最后一条不是 `user` 角色，会直接返回 400 错误。
- **会话策略**
  - 请求带 `user` 字段 → 进入有状态模式，缓存上下文并自动截断。
  - 未带 `user` → 生成一次性 `session_id`，不保留上下文。
- **流式行为**
  - `stream=true`（或默认开启）→ 伪流式 SSE，逐字符发送。
  - `stream=false` → 返回一次性 JSON，便于脚本处理。
- **错误处理**
  - 上游失败会刷新 nonce 后重试一次，再失败直接抛错。
  - 流式模式下会以 SSE 形式返回错误信息并附带 `[DONE]`。

---

## 🔒 安全与会话
- **鉴权**：`verifyAuth` 会忽略未启用的密钥，保持与 Python 版一致的行为。
- **随机指纹**：请求上游时使用随机浏览器 UA 和必要头部，降低被风控的概率。
- **缓存清理**：每次请求前会清空过期会话，避免内存无限增长。
- **nonce 并发锁**：`getNonce` 采用 Promise 锁，确保高并发下仅发起一次抓取。

---

## 🛠️ 常用命令
```bash
# 格式化 / Lint （如需，可自行扩展）
deno fmt
deno lint

# 生产启动
deno task start

# 开发模式
deno task dev

# Shell 脚本方式（自动加载 .env 并检查端口占用）
./start.sh
```

---

## 🧪 调试建议
- 设置 `DEBUG_MODE=true` 可查看上游请求体、返回体及 nonce 变更日志。
- 使用 `KNOWN_MODELS` 自定义多个模型时，确保同时更新 `UPSTREAM_MODEL_MAP`。
- 若上游接口策略收紧，可调整 `CONTEXT_MAX_LENGTH`、`SESSION_CACHE_TTL` 或自行扩展代理逻辑。
- 测试伪流式可配合 `curl -N` 或 OpenAI SDK 的 `stream` 模式。

---

## ☁️ 部署指引概览
### Deno Deploy
```bash
deno install -Arf jsr:@deno/deployctl
deployctl deploy --project=<your-project> main.ts
```
> 在控制台配置环境变量（含 `API_MASTER_KEY`、`KNOWN_MODELS` 等），并启用 `ALLOW_NET`、`ALLOW_ENV` 权限。

### Docker（可选）
```dockerfile
FROM denoland/deno:alpine
WORKDIR /app
COPY . .
RUN deno cache main.ts
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read=.env", "main.ts"]
```

---

## 🔄 与 Python 版的差异
| 能力 | Python 版 | Deno 版 |
| --- | --- | --- |
| 框架 | FastAPI + Uvicorn | Deno 原生 `Deno.serve` |
| 云端绕过 | `cloudscraper` | 随机指纹 + Fetch + 手动 nonce |
| 会话缓存 | `cachetools.TTLCache` | 原生 `Map` + TTL 逻辑 |
| 流式实现 | 始终 SSE（伪流式） | 支持 SSE 与 JSON 双模式 |
| 配置管理 | Pydantic Settings | `.env` + TypeScript 类型校验 |
| 监控面板 | 无 | 自带 Dashboard 页面 |

---

## 📮 反馈与贡献
- 仓库地址：<https://github.com/lzA6/kimi-ai-2api>
- 建议通过 Issue 提交 Bug/需求，或直接发起 Pull Request。
- 若需扩展多上游、统计指标等，可在 `deno/main.ts` 基础上继续扩展。
- 讨论区：<https://linux.do/t/topic/1068201>

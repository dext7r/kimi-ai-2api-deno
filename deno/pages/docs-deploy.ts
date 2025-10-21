// Docs & Deploy pages with refreshed styling

import type { ProxyConfig, Language } from "../lib/types.ts";
import { getTranslations } from "../lib/i18n.ts";
import { getHtmlHead, getFooter, getLanguageSwitcher, getNavigationBar } from "../lib/pages.ts";

export function getDocsPage(
  config: ProxyConfig,
  lang: Language = "zh-CN",
  currentUrl?: string,
  extraSections?: string
): string {
  const t = getTranslations(lang);
  return `${getHtmlHead(t.docsTitle, config, lang, config.seoDescription, currentUrl)}
<body class="min-h-screen bg-slate-100 text-slate-900">
    ${getLanguageSwitcher(lang)}
    ${getNavigationBar("/docs", config, lang)}
    <main class="max-w-4xl mx-auto px-6 pt-24 pb-16 space-y-6">
        <header class="mb-8">
            <h1 class="text-3xl font-semibold text-slate-900 mb-2 flex items-center gap-3">
                <span class="text-3xl">📖</span>${t.docsTitle}
            </h1>
            <p class="text-slate-500">${t.docsSubtitle}</p>
        </header>

        <section class="card p-6 space-y-3">
            <h2 class="text-xl font-semibold text-slate-800 flex items-center gap-2">🔐 认证</h2>
            <p class="text-slate-600">所有请求需要在 Header 中携带 Bearer Token：</p>
            <div class="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre class="hljs language-bash">Authorization: Bearer ${config.defaultKey}</pre>
            </div>
        </section>

        <section class="card p-6 space-y-3">
            <h2 class="text-xl font-semibold text-slate-800 flex items-center gap-2">📋 获取模型列表</h2>
            <p class="text-slate-600">GET <code class="px-2 py-1 rounded bg-slate-200 text-slate-700">/v1/models</code></p>
            <div class="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
<pre class="hljs language-bash">curl https://kimi-ai-2api.deno.dev/v1/models \\
  -H "Authorization: Bearer ${config.defaultKey}"</pre>
            </div>
        </section>

        <section class="card p-6 space-y-4">
            <h2 class="text-xl font-semibold text-slate-800 flex items-center gap-2">💬 聊天完成</h2>
            <div>
                <h3 class="text-sm font-semibold text-slate-700 mb-2">非流式</h3>
                <div class="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
<pre class="hljs language-bash">curl -X POST https://kimi-ai-2api.deno.dev/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${config.defaultKey}" \\
  -d '{
    "model": "${config.modelName}",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'</pre>
                </div>
            </div>
            <div>
                <h3 class="text-sm font-semibold text-slate-700 mb-2">流式</h3>
                <div class="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
<pre class="hljs language-bash">curl -N -X POST https://kimi-ai-2api.deno.dev/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${config.defaultKey}" \\
  -d '{
    "model": "${config.modelName}",
    "messages": [
      {"role": "user", "content": "Tell me a story"}
    ],
    "stream": true
  }'</pre>
                </div>
            </div>
        </section>

        <section class="card p-6 space-y-4">
            <h2 class="text-xl font-semibold text-slate-800 flex items-center gap-2">🔧 使用 OpenAI SDK</h2>
            <div>
                <h3 class="text-sm font-semibold text-slate-700 mb-2">Python</h3>
                <div class="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
<pre class="hljs language-python">from openai import OpenAI

client = OpenAI(
    api_key="${config.defaultKey}",
    base_url="https://kimi-ai-2api.deno.dev/v1"
)

response = client.chat.completions.create(
    model="${config.modelName}",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)</pre>
                </div>
            </div>
            <div>
                <h3 class="text-sm font-semibold text-slate-700 mb-2">JavaScript / TypeScript</h3>
                <div class="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
<pre class="hljs language-typescript">import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${config.defaultKey}",
  baseURL: "https://kimi-ai-2api.deno.dev/v1",
});

const response = await client.chat.completions.create({
  model: "${config.modelName}",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);</pre>
                </div>
            </div>
        </section>

        ${extraSections || ""}

        ${getFooter(config)}
    </main>
</body>
</html>`;
}

export function getDeployPage(
  config: ProxyConfig,
  lang: Language = "zh-CN",
  currentUrl?: string,
  extraContent?: string
): string {
  const t = getTranslations(lang);
  return `${getHtmlHead(t.deployTitle, config, lang, config.seoDescription, currentUrl)}
<body class="min-h-screen bg-slate-100 text-slate-900">
    ${getLanguageSwitcher(lang)}
    ${getNavigationBar("/deploy", config, lang)}
    <main class="max-w-4xl mx-auto px-6 pt-24 pb-16 space-y-6">
        <header class="mb-8">
            <h1 class="text-3xl font-semibold text-slate-900 mb-2 flex items-center gap-3">
                <span class="text-3xl">🚀</span>${t.deployTitle}
            </h1>
            <p class="text-slate-500">${t.deploySubtitle}</p>
        </header>

        <section class="card p-6 space-y-4">
            <h2 class="text-xl font-semibold text-slate-800 flex items-center gap-2">⚡ 快速部署</h2>
            <ol class="text-sm text-slate-600 list-decimal list-inside space-y-2">
                <li>Fork 本项目到你的 GitHub。</li>
                <li>访问 <a class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" href="https://dash.deno.com">Deno Deploy 控制台</a>。</li>
                <li>创建新项目并选择仓库，指定入口为 <code class="px-2 py-1 bg-slate-200 rounded text-slate-700">deno/main.ts</code>。</li>
                <li>在 Deploy 设置里配置环境变量（参见下方表格）。</li>
                <li>点击 Deploy，即可上线。</li>
            </ol>
        </section>

        <section class="card p-6 space-y-4">
            <h2 class="text-xl font-semibold text-slate-800 flex items-center gap-2">💻 命令行部署</h2>
            <p class="text-sm text-slate-600">使用 deployctl 工具部署到 Deno Deploy：</p>
            <div class="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
<pre class="hljs language-bash"># 安装 deployctl
deno install -Arf jsr:@deno/deployctl

# 部署项目
deployctl deploy --project=your-project-name deno/main.ts</pre>
            </div>
        </section>

        <section class="card p-6 space-y-4">
            <h2 class="text-xl font-semibold text-slate-800 flex items-center gap-2">🔧 环境变量配置</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-100 text-slate-600">
                        <tr>
                            <th class="text-left py-2 px-3">变量名</th>
                            <th class="text-left py-2 px-3">说明</th>
                            <th class="text-left py-2 px-3">示例值</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-slate-600">
                        <tr>
                            <td class="py-2 px-3 font-mono text-xs">API_MASTER_KEY</td>
                            <td class="py-2 px-3">API 访问密钥</td>
                            <td class="py-2 px-3 font-mono text-xs">${config.defaultKey}</td>
                        </tr>
                        <tr>
                            <td class="py-2 px-3 font-mono text-xs">UPSTREAM_URL</td>
                            <td class="py-2 px-3">上游接口地址</td>
                            <td class="py-2 px-3 font-mono text-xs">${config.upstreamUrl}</td>
                        </tr>
                        <tr>
                            <td class="py-2 px-3 font-mono text-xs">KNOWN_MODELS</td>
                            <td class="py-2 px-3">支持的模型（逗号分隔）</td>
                            <td class="py-2 px-3 font-mono text-xs">${config.knownModels.join(",")}</td>
                        </tr>
                        <tr>
                            <td class="py-2 px-3 font-mono text-xs">NGINX_PORT</td>
                            <td class="py-2 px-3">对外暴露端口（自托管场景）</td>
                            <td class="py-2 px-3 font-mono text-xs">${config.port}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section class="card p-6 space-y-3">
            <h2 class="text-xl font-semibold text-slate-800 flex items-center gap-2">🏠 本地运行</h2>
            <div class="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
<pre class="hljs language-bash">deno task start

# 开发模式（自动重载）
deno task dev

# 或直接运行
deno run --allow-net --allow-env --allow-read=.env main.ts</pre>
            </div>
        </section>

        ${extraContent || ""}

        ${getFooter(config)}
    </main>
</body>
</html>`;
}

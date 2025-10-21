// Common HTML page templates for OpenAI-compatible API proxy

import type { ProxyConfig, RequestStats, LiveRequest, Language, I18nTranslations } from "./types.ts";
import { formatUptime, getTopModels } from "./utils.ts";
import { getSeoMeta, getStructuredData } from "./seo.ts";
import { getTranslations } from "./i18n.ts";

/**
 * Generate common HTML head section with SEO and i18n support
 */
function getHtmlHead(
  title: string,
  config: ProxyConfig,
  lang: Language = "zh-CN",
  pageDescription?: string,
  currentUrl?: string
): string {
  const t = getTranslations(lang);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${config.serviceName}</title>
    ${getSeoMeta(config, title, pageDescription, currentUrl)}
    ${getStructuredData(config, currentUrl)}
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
    <style>
        :root {
            --surface: #ffffff;
            --surface-muted: #f8fafc;
            --border: rgba(148, 163, 184, 0.25);
            --shadow: 0 20px 45px -28px rgba(15, 23, 42, 0.45);
            --shadow-hover: 0 18px 50px -20px rgba(15, 23, 42, 0.3);
            --primary: #2563eb;
            --primary-soft: rgba(37, 99, 235, 0.1);
            --text: #0f172a;
            --muted: #475569;
        }
        body {
            background: #f5f7fb;
            color: var(--text);
            font-family: "Inter", "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        .top-nav {
            position: sticky;
            top: 0;
            z-index: 40;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(148, 163, 184, 0.2);
            box-shadow: 0 10px 30px -22px rgba(15, 23, 42, 0.45);
        }
        .nav-inner {
            max-width: 1200px;
            margin: 0 auto;
            padding: 14px 24px;
            display: flex;
            align-items: center;
            gap: 32px;
        }
        .nav-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 700;
            font-size: 18px;
            color: var(--text);
        }
        .nav-links {
            display: flex;
            align-items: center;
            gap: 18px;
            flex: 1;
        }
        .nav-link {
            color: var(--muted);
            font-weight: 500;
            font-size: 15px;
            padding: 6px 10px;
            border-radius: 999px;
            transition: color 0.2s ease, background 0.2s ease;
        }
        .nav-link:hover {
            color: var(--primary);
            background: var(--primary-soft);
        }
        .nav-link-active {
            color: #1d4ed8;
            background: rgba(37, 99, 235, 0.12);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        .nav-extra {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .nav-extra a {
            font-size: 14px;
            color: var(--muted);
        }
        .nav-extra a:hover {
            color: var(--primary);
        }
        .lang-switcher {
            position: fixed;
            top: 18px;
            right: 20px;
            z-index: 50;
        }
        .lang-switcher select {
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 10px;
            padding: 7px 12px;
            font-size: 13px;
            color: var(--text);
            box-shadow: 0 8px 18px -14px rgba(15, 23, 42, 0.6);
        }
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: var(--shadow);
            transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .card:hover {
            transform: translateY(-3px);
            box-shadow: var(--shadow-hover);
        }
        .chip {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
        }
        .chip-blue { background: rgba(59,130,246,0.12); color: #1d4ed8; }
        .chip-green { background: rgba(34,197,94,0.12); color: #047857; }
        .chip-red { background: rgba(248,113,113,0.12); color: #b91c1c; }
        .chip-amber { background: rgba(251,191,36,0.16); color: #b45309; }
        .chip-purple { background: rgba(168,85,247,0.12); color: #7c3aed; }
    </style>
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            if (window.hljs) {
                window.hljs.highlightAll();
            }
        });
    </script>
</head>`;
}

/**
 * Generate language switcher
 */
export function getLanguageSwitcher(currentLang: Language = "zh-CN"): string {
  return `
    <div class="lang-switcher">
        <select id="langSelect" onchange="window.location.href='?lang='+this.value">
            <option value="zh-CN" ${currentLang === "zh-CN" ? "selected" : ""}>🇨🇳 中文</option>
            <option value="en-US" ${currentLang === "en-US" ? "selected" : ""}>🇺🇸 English</option>
            <option value="ja-JP" ${currentLang === "ja-JP" ? "selected" : ""}>🇯🇵 日本語</option>
        </select>
    </div>
  `;
}

/**
 * Generate common navigation links with i18n
 */
function getNavLinks(currentPath: string, t: I18nTranslations): string {
  const links = [
    { href: "/", label: t.home },
    { href: "/docs", label: t.docs },
    { href: "/playground", label: t.playground },
    { href: "/deploy", label: t.deploy },
    { href: "/dashboard", label: t.dashboard },
  ];

  return links
    .map((link) => {
      const isActive = currentPath === link.href;
      const className = isActive ? "nav-link nav-link-active" : "nav-link";
      return `<a href="${link.href}" class="${className}">${link.label}</a>`;
    })
    .join("\n                    ");
}

function getNavigationBar(currentPath: string, config: ProxyConfig, lang: Language = "zh-CN"): string {
  const t = getTranslations(lang);
  return `
  <header class="top-nav">
      <div class="nav-inner">
          <a class="nav-brand" href="/">
              <span class="text-xl">${config.serviceEmoji}</span>
              <span>${config.serviceName}</span>
          </a>
          <nav class="nav-links">
              ${getNavLinks(currentPath, t)}
          </nav>
          <div class="nav-extra">
              <a href="${config.discussionUrl}" target="_blank" rel="noopener noreferrer">社区讨论</a>
              <a href="${config.githubRepo}" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
      </div>
  </header>`;
}

/**
 * Generate common footer
 */
function getFooter(config: ProxyConfig): string {
  return `<footer class="mt-12 text-center text-sm text-slate-500 space-y-3">
    <p>Powered by <span class="font-semibold text-slate-700">Deno 🦕</span> · OpenAI Compatible API</p>
    <div class="flex justify-center items-center gap-4 text-xs">
        <a href="${config.discussionUrl}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors">
            <span>💬</span> 讨论交流
        </a>
        <span class="text-slate-300">|</span>
        <a href="${config.githubRepo}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors">
            <span>⭐</span> GitHub
        </a>
    </div>
    <p class="text-xs text-slate-400">${config.footerText}</p>
</footer>`;
}

/**
 * Generate homepage HTML
 */
export function getHomePage(config: ProxyConfig, lang: Language = "zh-CN", currentUrl?: string): string {
  const t = getTranslations(lang);
  return `${getHtmlHead(t.homeTitle, config, lang, config.seoDescription, currentUrl)}
<body class="min-h-screen bg-slate-100 text-slate-900">
    ${getLanguageSwitcher(lang)}
    ${getNavigationBar("/", config, lang)}
    <main class="max-w-6xl mx-auto px-6 pt-28 pb-16">
        <!-- Hero -->
        <section class="text-center mb-12">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-3xl mb-4">${config.serviceEmoji}</div>
            <h1 class="text-4xl font-bold text-slate-900 mb-3">${config.serviceName}</h1>
            <p class="text-lg text-slate-600 max-w-2xl mx-auto">${t.homeSubtitle}</p>
        </section>

        <!-- Status Cards -->
        <section class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            <div class="card p-6 text-center">
                <div class="text-3xl mb-3">🎯</div>
                <p class="text-xs uppercase tracking-wide text-slate-500 mb-1">默认模型</p>
                <p class="text-lg font-semibold text-slate-800">${config.modelName}</p>
            </div>
            <div class="card p-6 text-center">
                <div class="text-3xl mb-3">🔌</div>
                <p class="text-xs uppercase tracking-wide text-slate-500 mb-1">服务端口</p>
                <p class="text-lg font-mono text-slate-800">${config.port}</p>
            </div>
            <div class="card p-6 text-center">
                <div class="text-3xl mb-3">⚡</div>
                <p class="text-xs uppercase tracking-wide text-slate-500 mb-1">运行环境</p>
                <p class="text-lg font-semibold text-slate-800">Deno Deploy / Self-host</p>
            </div>
        </section>

        <!-- Feature Grid -->
        <section class="grid grid-cols-1 md:grid-cols-5 gap-5 mb-12">
            <a href="/docs" class="card group p-6 hover:-translate-y-2 transition">
                <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📖</div>
                <h3 class="text-xl font-semibold text-slate-800 mb-2">API 文档</h3>
                <p class="text-sm text-slate-500 leading-relaxed">查阅完整的接口说明与示例请求。</p>
            </a>
            <a href="/playground" class="card group p-6 hover:-translate-y-2 transition">
                <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🎛️</div>
                <h3 class="text-xl font-semibold text-slate-800 mb-2">在线调试</h3>
                <p class="text-sm text-slate-500 leading-relaxed">在浏览器中直接测试 Chat Completions。</p>
            </a>
            <a href="/deploy" class="card group p-6 hover:-translate-y-2 transition">
                <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🚀</div>
                <h3 class="text-xl font-semibold text-slate-800 mb-2">部署指南</h3>
                <p class="text-sm text-slate-500 leading-relaxed">快速部署到 Deno Deploy 或自托管环境。</p>
            </a>
            <a href="/dashboard" class="card group p-6 hover:-translate-y-2 transition">
                <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📊</div>
                <h3 class="text-xl font-semibold text-slate-800 mb-2">实时指标</h3>
                <p class="text-sm text-slate-500 leading-relaxed">查看请求统计、趋势图与运行状况。</p>
            </a>
            <a href="/v1/models" class="card group p-6 hover:-translate-y-2 transition">
                <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🤖</div>
                <h3 class="text-xl font-semibold text-slate-800 mb-2">模型列表</h3>
                <p class="text-sm text-slate-500 leading-relaxed">获取当前服务支持的模型名称。</p>
            </a>
        </section>

        <!-- Quick Start -->
        <section class="card p-6 sm:p-8">
            <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span class="text-2xl">⚙️</span> 快速调用示例
            </h3>
            <div class="rounded-xl bg-slate-900 text-slate-50 p-4 sm:p-5 overflow-x-auto">
<pre class="hljs language-bash">curl -X POST https://kimi-ai-2api.deno.dev/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${config.defaultKey}" \\
  -d '{"model":"${config.modelName}","messages":[{"role":"user","content":"Hello!"}]}'</pre>
            </div>
        </section>

        ${getFooter(config)}
    </main>
</body>
</html>`;
}

/**
 * Generate dashboard HTML
 */
export function getDashboardPage(
  config: ProxyConfig,
  stats: RequestStats,
  liveRequests: LiveRequest[],
  lang: Language = "zh-CN",
  currentUrl?: string
): string {
  const topModels = getTopModels(stats.modelUsage, 3);
  const successRate = stats.totalRequests > 0
    ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)
    : "0.0";
  const uptime = formatUptime(stats.startTime);

  const recentRequests = liveRequests.slice(0, 20);

  return `${getHtmlHead("Dashboard", config, lang, config.seoDescription, currentUrl)}
<body class="min-h-screen bg-slate-100 text-slate-900">
    ${getLanguageSwitcher(lang)}
    ${getNavigationBar("/dashboard", config, lang)}
    <div class="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <!-- Header -->
        <div class="mb-10">
            <h1 class="text-3xl font-semibold text-slate-900 mb-2 flex items-center gap-3">
                <span class="text-3xl">📊</span> Dashboard
            </h1>
            <p class="text-slate-500">实时监控服务运行状态与请求表现。</p>
        </div>

        <!-- Top Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div class="card p-5">
                <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">总请求数</p>
                <p class="text-2xl font-semibold text-slate-900">${stats.totalRequests}</p>
            </div>
            <div class="card p-5">
                <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">成功请求</p>
                <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-semibold text-green-600">${stats.successfulRequests}</span>
                    <span class="chip chip-green">${successRate}%</span>
                </div>
            </div>
            <div class="card p-5">
                <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">失败请求</p>
                <p class="text-2xl font-semibold text-red-600">${stats.failedRequests}</p>
            </div>
            <div class="card p-5">
                <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">平均响应</p>
                <p class="text-2xl font-semibold text-slate-900">${stats.averageResponseTime.toFixed(0)}<span class="text-base text-slate-500 ml-1">ms</span></p>
            </div>
            <div class="card p-5">
                <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">API 调用</p>
                <p class="text-2xl font-semibold text-indigo-600">${stats.apiCallsCount}</p>
            </div>
        </div>

        <!-- System Info -->
        <div class="grid md:grid-cols-3 gap-6 mb-10">
            <div class="card p-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><span>⚡</span>性能指标</h3>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between text-slate-600"><span>最快响应</span><span class="font-mono text-slate-900">${stats.fastestResponse === Infinity ? "-" : stats.fastestResponse.toFixed(0)} ms</span></div>
                    <div class="flex justify-between text-slate-600"><span>最慢响应</span><span class="font-mono text-slate-900">${stats.slowestResponse.toFixed(0)} ms</span></div>
                    <div class="flex justify-between text-slate-600"><span>成功率</span><span class="font-mono text-slate-900">${successRate}%</span></div>
                </div>
            </div>
            <div class="card p-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><span>🧭</span>系统信息</h3>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between text-slate-600"><span>运行时长</span><span class="text-slate-900">${uptime}</span></div>
                    <div class="flex justify-between text-slate-600"><span>流式请求</span><span class="text-slate-900">${stats.streamingRequests}</span></div>
                    <div class="flex justify-between text-slate-600"><span>非流式请求</span><span class="text-slate-900">${stats.nonStreamingRequests}</span></div>
                </div>
            </div>
            <div class="card p-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><span>🏆</span>热门模型</h3>
                <div class="space-y-3">
                    ${
                      topModels.length === 0
                        ? '<p class="text-sm text-slate-500">暂无数据</p>'
                        : topModels.map(([model, count], idx) => `
                    <div class="flex items-center justify-between text-sm text-slate-600">
                        <span>${["🥇", "🥈", "🥉"][idx]} ${model}</span>
                        <span class="chip chip-blue">${count}</span>
                    </div>`).join("")
                    }
                </div>
            </div>
        </div>

        <!-- Charts -->
        <div class="grid md:grid-cols-2 gap-6 mb-10">
            <div class="card p-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-4">📈 请求耗时趋势</h3>
                <div id="requestsChart" class="h-72 w-full"></div>
            </div>
            <div class="card p-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-4">🥧 请求状态分布</h3>
                <div id="statusChart" class="h-72 w-full"></div>
            </div>
        </div>

        <!-- Recent Requests -->
        <div class="card p-6">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">📋 最近请求</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-100 text-slate-600">
                        <tr>
                            <th class="text-left py-2 px-3">时间</th>
                            <th class="text-left py-2 px-3">方法</th>
                            <th class="text-left py-2 px-3">路径</th>
                            <th class="text-left py-2 px-3">状态</th>
                            <th class="text-left py-2 px-3">耗时</th>
                            <th class="text-left py-2 px-3">模型</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${recentRequests.length === 0 ? `<tr><td colspan="6" class="py-6 text-center text-slate-500">暂无请求数据</td></tr>` : recentRequests.map((req) => `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="py-2 px-3 font-mono text-xs text-slate-500">${req.timestamp.toLocaleTimeString()}</td>
                            <td class="py-2 px-3"><span class="chip chip-blue">${req.method}</span></td>
                            <td class="py-2 px-3 font-mono text-xs text-slate-600">${req.path}</td>
                            <td class="py-2 px-3">
                                <span class="chip ${req.status >= 200 && req.status < 300 ? "chip-green" : "chip-red"}">${req.status}</span>
                            </td>
                            <td class="py-2 px-3 font-mono text-xs text-slate-600">${req.duration.toFixed(0)} ms</td>
                            <td class="py-2 px-3 text-xs text-slate-600">${req.model || "-"}</td>
                        </tr>`).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            if (!window.echarts) return;

            const trendData = ${JSON.stringify(recentRequests.map((req) => ({
              time: req.timestamp.toISOString(),
              duration: Number(req.duration.toFixed(2)),
              status: req.status
            })))};
            const statusData = [
                { name: "成功", value: ${stats.successfulRequests} },
                { name: "失败", value: ${stats.failedRequests} }
            ];

            const requestsChartEl = document.getElementById("requestsChart");
            if (requestsChartEl && trendData.length > 0) {
                const requestsChart = echarts.init(requestsChartEl);
                const timeAxis = trendData.map(item => new Date(item.time).toLocaleTimeString());
                const durationSeries = trendData.map(item => item.duration);
                requestsChart.setOption({
                    tooltip: { trigger: "axis" },
                    grid: { left: 40, right: 20, top: 20, bottom: 30 },
                    xAxis: {
                        type: "category",
                        data: timeAxis,
                        boundaryGap: false,
                        axisLabel: { color: "#94a3b8" }
                    },
                    yAxis: {
                        type: "value",
                        name: "耗时(ms)",
                        axisLabel: { color: "#94a3b8" },
                        splitLine: { lineStyle: { color: "rgba(148,163,184,0.28)" } }
                    },
                    series: [
                        {
                            name: "响应耗时",
                            type: "line",
                            smooth: true,
                            showSymbol: false,
                            areaStyle: {
                                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                    { offset: 0, color: "rgba(59,130,246,0.32)" },
                                    { offset: 1, color: "rgba(148,163,184,0.08)" }
                                ])
                            },
                            lineStyle: { color: "#3b82f6", width: 2 },
                            data: durationSeries
                        }
                    ]
                });
            } else if (requestsChartEl) {
                requestsChartEl.innerHTML = '<div class="flex h-full items-center justify-center text-sm text-slate-500">暂无请求数据用于绘制趋势图</div>';
            }

            const statusChartEl = document.getElementById("statusChart");
            if (statusChartEl) {
                const statusChart = echarts.init(statusChartEl);
                statusChart.setOption({
                    tooltip: { trigger: "item" },
                    legend: {
                        bottom: 0,
                        textStyle: { color: "#475569" }
                    },
                    series: [
                        {
                            name: "请求状态",
                            type: "pie",
                            radius: ["40%", "70%"],
                            avoidLabelOverlap: false,
                            itemStyle: {
                                borderRadius: 10,
                                borderColor: "rgba(248,250,252,0.9)",
                                borderWidth: 2
                            },
                            label: {
                                color: "#334155",
                                formatter: "{b}: {d}%"
                            },
                            data: statusData
                        }
                    ]
                });
            }
        });
    </script>
</body>
</html>`;
}

// Export simpler page generators
export { getHtmlHead, getNavLinks, getNavigationBar, getFooter };

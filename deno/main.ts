import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

import type { ProxyConfig, RequestStats, LiveRequest, Message, Language } from "./lib/types.ts";
import {
  generateBrowserHeaders,
  generateRequestId,
  recordRequest,
  debugLog,
  createErrorResponse,
  verifyAuth,
  createSSEData,
} from "./lib/utils.ts";
import { getHomePage, getDashboardPage } from "./lib/pages.ts";
import { getDocsPage, getDeployPage } from "./pages/docs-deploy.ts";
import { getPlaygroundPage } from "./pages/playground.ts";
import { detectLanguage, getLanguageFromUrl } from "./lib/i18n.ts";

// ---------------------------------------------------------------------------
// 环境变量加载
// ---------------------------------------------------------------------------
try {
  await load({ export: true });
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) {
    console.warn("无法加载 .env 文件:", error);
  }
}

const kv = await Deno.openKv();
const KV_STATS_KEY = ["dashboard", "stats"] as const;
const KV_REQUEST_PREFIX = ["dashboard", "requests"] as const;
const MAX_RECENT_REQUESTS = 50;

type PersistedStats = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastRequestTime: string;
  averageResponseTime: number;
  apiCallsCount: number;
  modelsCallsCount: number;
  streamingRequests: number;
  nonStreamingRequests: number;
  startTime: string;
  fastestResponse: number;
  slowestResponse: number;
  modelUsage: Array<[string, number]>;
};

type PersistedLiveRequest = {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  userAgent: string;
  model?: string;
};

const envOrDefault = (key: string, fallback: string) => Deno.env.get(key) ?? fallback;

const knownModels = envOrDefault("KNOWN_MODELS", "kimi-k2-instruct-0905,kimi-k2-instruct")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const defaultModel = Deno.env.get("DEFAULT_MODEL") ?? knownModels[0] ?? "kimi-k2-instruct-0905";

let upstreamModelMap: Record<string, string> = {
  "kimi-k2-instruct-0905": "moonshotai/Kimi-K2-Instruct-0905",
  "kimi-k2-instruct": "moonshotai/Kimi-K2-Instruct",
};

const upstreamModelMapEnv = Deno.env.get("UPSTREAM_MODEL_MAP");
if (upstreamModelMapEnv) {
  try {
    const parsed = JSON.parse(upstreamModelMapEnv);
    upstreamModelMap = { ...upstreamModelMap, ...parsed };
  } catch (error) {
    console.warn("UPSTREAM_MODEL_MAP 环境变量解析失败:", error);
  }
}

const sessionCacheTtlSeconds = Number(envOrDefault("SESSION_CACHE_TTL", "3600"));
const contextMaxLength = Number(envOrDefault("CONTEXT_MAX_LENGTH", "1000"));
const apiRequestTimeoutSeconds = Number(envOrDefault("API_REQUEST_TIMEOUT", "180"));

const CONFIG: ProxyConfig = {
  port: Number(envOrDefault("PORT", "9090")),
  debugMode: envOrDefault("DEBUG_MODE", "false") === "true",
  debugLogNonceHtml: envOrDefault("DEBUG_LOG_NONCE_HTML", "false") === "true",
  defaultStream: envOrDefault("DEFAULT_STREAM", "true") !== "false",
  dashboardEnabled: envOrDefault("DASHBOARD_ENABLED", "true") !== "false",
  upstreamUrl: envOrDefault("UPSTREAM_URL", "https://kimi-ai.chat/wp-admin/admin-ajax.php"),
  defaultKey: Deno.env.get("API_MASTER_KEY") ?? "",
  modelName: defaultModel,
  chatPageUrl: envOrDefault("CHAT_PAGE_URL", "https://kimi-ai.chat/chat/"),
  sessionCacheTtl: Number.isFinite(sessionCacheTtlSeconds) ? sessionCacheTtlSeconds : 3600,
  apiRequestTimeout: Number.isFinite(apiRequestTimeoutSeconds) ? apiRequestTimeoutSeconds : 180,
  contextMaxLength: Number.isFinite(contextMaxLength) ? contextMaxLength : 1000,
  knownModels: knownModels.length > 0 ? knownModels : [defaultModel],
  upstreamModelMap,
  serviceName: envOrDefault("SERVICE_NAME", "kimi-ai-2api"),
  serviceEmoji: envOrDefault("SERVICE_EMOJI", "🤖"),
  footerText: envOrDefault("FOOTER_TEXT", "连接世界，创造未来"),
  discussionUrl: envOrDefault("DISCUSSION_URL", "https://github.com/lzA6/kimi-ai-2api/discussions"),
  githubRepo: envOrDefault("GITHUB_REPO", "https://github.com/lzA6/kimi-ai-2api"),
  seoTitle: envOrDefault("SEO_TITLE", "kimi-ai-2api - OpenAI 兼容的 Kimi 代理服务"),
  seoDescription: envOrDefault("SEO_DESCRIPTION", "将 Kimi AI 对话能力转换为 OpenAI API 兼容格式的高性能代理。"),
  seoKeywords: envOrDefault("SEO_KEYWORDS", "Kimi AI,OpenAI Proxy,AI2API,Deno,聊天代理"),
  seoAuthor: envOrDefault("SEO_AUTHOR", "kimi-ai-2api"),
  seoOgImage: envOrDefault("SEO_OG_IMAGE", ""),
};

// ============================================================================ 
// 统计信息
// ============================================================================

const stats: RequestStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastRequestTime: new Date(),
  averageResponseTime: 0,
  apiCallsCount: 0,
  modelsCallsCount: 0,
  streamingRequests: 0,
  nonStreamingRequests: 0,
  startTime: new Date(),
  fastestResponse: Infinity,
  slowestResponse: 0,
  modelUsage: new Map<string, number>(),
};

const liveRequests: LiveRequest[] = [];

await restoreDashboardState();
await saveDashboardState();

setInterval(() => {
  saveDashboardState().catch((error) => console.warn("定时持久化仪表盘统计信息失败:", error));
}, 30_000);

function recordAndPersist(
  statsObj: RequestStats,
  liveReqs: LiveRequest[],
  req: { method: string; path: string; userAgent: string; model?: string },
  status: number,
  duration: number,
): void {
  recordRequest(statsObj, liveReqs, req, status, duration);
  const latest = liveReqs[0];
  if (latest) {
    const copy: LiveRequest = {
      ...latest,
      timestamp: new Date(latest.timestamp),
    };
    persistRecentRequest(copy).catch((error) => console.warn("写入最近请求记录失败:", error));
  }
  scheduleDashboardPersist();
}

async function restoreDashboardState(): Promise<void> {
  try {
    const statsEntry = await kv.get<PersistedStats>(KV_STATS_KEY);

    if (statsEntry.value) {
      const data = statsEntry.value;
      stats.totalRequests = data.totalRequests ?? stats.totalRequests;
      stats.successfulRequests = data.successfulRequests ?? stats.successfulRequests;
      stats.failedRequests = data.failedRequests ?? stats.failedRequests;
      stats.averageResponseTime = data.averageResponseTime ?? stats.averageResponseTime;
      stats.apiCallsCount = data.apiCallsCount ?? stats.apiCallsCount;
      stats.modelsCallsCount = data.modelsCallsCount ?? stats.modelsCallsCount;
      stats.streamingRequests = data.streamingRequests ?? stats.streamingRequests;
      stats.nonStreamingRequests = data.nonStreamingRequests ?? stats.nonStreamingRequests;
      stats.fastestResponse = data.fastestResponse ?? stats.fastestResponse;
      stats.slowestResponse = data.slowestResponse ?? stats.slowestResponse;
      stats.lastRequestTime = data.lastRequestTime ? new Date(data.lastRequestTime) : stats.lastRequestTime;
      stats.startTime = data.startTime ? new Date(data.startTime) : stats.startTime;
      stats.modelUsage = new Map(data.modelUsage ?? []);
    }

    const restored: LiveRequest[] = [];
    const iter = kv.list<PersistedLiveRequest>({ prefix: KV_REQUEST_PREFIX }, {
      reverse: true,
      limit: MAX_RECENT_REQUESTS,
    });
    for await (const entry of iter) {
      const value = entry.value;
      if (!value) continue;
      restored.push({
        ...value,
        timestamp: new Date(value.timestamp),
      });
    }
    liveRequests.splice(0, liveRequests.length, ...restored);
    await pruneOldRequests();
  } catch (error) {
    console.warn("恢复仪表盘状态失败:", error);
  }
}

async function saveDashboardState(): Promise<void> {
  try {
    const statsValue: PersistedStats = {
      totalRequests: stats.totalRequests,
      successfulRequests: stats.successfulRequests,
      failedRequests: stats.failedRequests,
      lastRequestTime: stats.lastRequestTime.toISOString(),
      averageResponseTime: stats.averageResponseTime,
      apiCallsCount: stats.apiCallsCount,
      modelsCallsCount: stats.modelsCallsCount,
      streamingRequests: stats.streamingRequests,
      nonStreamingRequests: stats.nonStreamingRequests,
      startTime: stats.startTime.toISOString(),
      fastestResponse: stats.fastestResponse,
      slowestResponse: stats.slowestResponse,
      modelUsage: Array.from(stats.modelUsage.entries()),
    };

    await kv.set(KV_STATS_KEY, statsValue);
  } catch (error) {
    console.warn("持久化仪表盘统计信息失败:", error);
  }
}

async function persistRecentRequest(req: LiveRequest): Promise<void> {
  try {
    const key: Deno.KvKey = [...KV_REQUEST_PREFIX, req.timestamp.getTime(), req.id];
    const value: PersistedLiveRequest = {
      id: req.id,
      timestamp: req.timestamp.toISOString(),
      method: req.method,
      path: req.path,
      status: req.status,
      duration: req.duration,
      userAgent: req.userAgent,
      model: req.model,
    };
    await kv.set(key, value);
    await pruneOldRequests();
  } catch (error) {
    console.warn("写入最近请求记录失败:", error);
  }
}

async function pruneOldRequests(): Promise<void> {
  try {
    let count = 0;
    const deletions: Promise<void>[] = [];
    const iter = kv.list<PersistedLiveRequest>({ prefix: KV_REQUEST_PREFIX }, { reverse: true });
    for await (const entry of iter) {
      if (!entry.value) continue;
      count++;
      if (count > MAX_RECENT_REQUESTS) {
        deletions.push(kv.delete(entry.key));
      }
    }
    if (deletions.length) {
      await Promise.allSettled(deletions);
    }
  } catch (error) {
    console.warn("清理由于过多的最近请求失败:", error);
  }
}

let persistScheduled = false;
function scheduleDashboardPersist(): void {
  if (persistScheduled) return;
  persistScheduled = true;
  queueMicrotask(() => {
    persistScheduled = false;
    saveDashboardState().catch((error) => console.warn("异步持久化仪表盘统计信息失败:", error));
  });
}

// ============================================================================ 
// 会话与 nonce 管理
// ============================================================================

interface SessionData {
  kimiSessionId: string;
  messages: Message[];
  expiresAt: number;
}

const sessionCache = new Map<string, SessionData>();

let cachedNonce: string | null = null;
let noncePromise: Promise<string> | null = null;

const encoder = new TextEncoder();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanupSessions(): void {
  const now = Date.now();
  for (const [key, session] of sessionCache.entries()) {
    if (session.expiresAt <= now) {
      sessionCache.delete(key);
    }
  }
}

function createSessionId(): string {
  const timestamp = Date.now();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 9);
  return `session_${timestamp}_${random}`;
}

function getOrCreateSession(userKey: string): SessionData {
  const now = Date.now();
  const cached = sessionCache.get(userKey);
  if (cached && cached.expiresAt > now) {
    return cached;
  }

  const session: SessionData = {
    kimiSessionId: createSessionId(),
    messages: cached?.messages ?? [],
    expiresAt: now + CONFIG.sessionCacheTtl * 1000,
  };
  sessionCache.set(userKey, session);
  return session;
}

function buildContextualPrompt(history: Message[], newMessage: string): string {
  const toLine = (msg: Message) => `${msg.role === "user" ? "用户" : "模型"}: ${msg.content ?? ""}`;
  let historyLines = history.map(toLine);
  let historyStr = historyLines.join("\n");
  let fullPrompt = historyStr ? `${historyStr}\n用户: ${newMessage}` : `用户: ${newMessage}`;

  while (fullPrompt.length > CONFIG.contextMaxLength && history.length > 0) {
    history.shift();
    if (history.length > 0) {
      history.shift();
    }
    historyLines = history.map(toLine);
    historyStr = historyLines.join("\n");
    fullPrompt = historyStr ? `${historyStr}\n用户: ${newMessage}` : `用户: ${newMessage}`;
  }

  return fullPrompt.trim();
}

async function fetchNonce(): Promise<string> {
  const origin = new URL(CONFIG.chatPageUrl).origin;
  const headers = generateBrowserHeaders(origin, CONFIG.chatPageUrl);
  headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
  headers["Accept-Encoding"] = "identity";
  delete headers["Content-Type"];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    debugLog(CONFIG.debugMode, "开始获取聊天页面以提取 nonce", { url: CONFIG.chatPageUrl });
    const response = await fetch(CONFIG.chatPageUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    debugLog(CONFIG.debugMode, "聊天页面响应已返回", {
      status: response.status,
      redirected: response.redirected,
      finalUrl: response.url,
      contentEncoding: response.headers.get("content-encoding") ?? "none",
    });

    if (!response.ok) {
      throw new Error(`获取聊天页面失败，状态 ${response.status}`);
    }

    const html = await response.text();
    if (CONFIG.debugLogNonceHtml) {
      const preview = html.replace(/\s+/g, " ").slice(0, 500);
      console.log("[DEBUG][nonce-html]", new Date().toISOString(), preview);
    }

    const match = html.match(/var\s+kimi_ajax\s*=\s*({[\s\S]*?});/);
    if (!match) {
      debugLog(CONFIG.debugMode, "未在页面中匹配到 kimi_ajax 对象");
      throw new Error("在页面 HTML 中未找到 'kimi_ajax' 变量。");
    }

    const ajaxData = JSON.parse(match[1]);
    const nonce = ajaxData?.nonce;
    if (!nonce) {
      throw new Error("'kimi_ajax' 对象中缺少 'nonce' 字段。");
    }

    debugLog(CONFIG.debugMode, "成功获取新的 nonce:", nonce);
    return nonce;
  } finally {
    clearTimeout(timeout);
  }
}

async function getNonce(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    cachedNonce = null;
  }

  if (cachedNonce) {
    return cachedNonce;
  }

  if (!noncePromise) {
    noncePromise = fetchNonce()
      .then((value) => {
        cachedNonce = value;
        return value;
      })
      .finally(() => {
        noncePromise = null;
      });
  }

  return noncePromise;
}

function getUpstreamHeaders(): Record<string, string> {
  const origin = new URL(CONFIG.chatPageUrl).origin;
  const headers = generateBrowserHeaders(origin, CONFIG.chatPageUrl);
  headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
  headers["Accept"] = "application/json, text/javascript, */*; q=0.01";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
}

function preparePayload(prompt: string, upstreamModel: string, sessionId: string, nonce: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("action", "kimi_send_message");
  params.set("nonce", nonce);
  params.set("message", prompt);
  params.set("model", upstreamModel);
  params.set("session_id", sessionId);
  return params;
}

async function sendUpstreamWithRetry(
  payload: URLSearchParams,
  signal: AbortSignal,
  attempt = 0,
): Promise<any> {
  const response = await fetch(CONFIG.upstreamUrl, {
    method: "POST",
    headers: getUpstreamHeaders(),
    body: payload,
    signal,
  });

  const rawText = await response.text();
  let responseData: any;
  try {
    responseData = JSON.parse(rawText);
  } catch {
    throw new Error(`上游返回非 JSON 内容: ${rawText.slice(0, 120)}`);
  }

  if (!response.ok) {
    throw new Error(`上游返回状态 ${response.status}: ${response.statusText}`);
  }

  if (!responseData.success) {
    if (attempt === 0) {
      debugLog(CONFIG.debugMode, "上游返回失败，尝试刷新 nonce 后重试:", responseData.data);
      const newNonce = await getNonce(true);
      payload.set("nonce", newNonce);
      return sendUpstreamWithRetry(payload, signal, attempt + 1);
    }
    const errorMessage = typeof responseData.data === "string" ? responseData.data : JSON.stringify(responseData.data);
    throw new Error(`上游请求失败: ${errorMessage}`);
  }

  return responseData;
}

function buildCompletionChunk(requestId: string, model: string, content: string, finishReason: string | null = null) {
  return {
    id: requestId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: finishReason,
      },
    ],
  };
}

function streamSuccessResponse(
  content: string,
  requestId: string,
  model: string,
  startTime: number,
  userAgent: string,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (content.length === 0) {
          controller.enqueue(encoder.encode(createSSEData(buildCompletionChunk(requestId, model, "", "stop"))));
        } else {
          for (const char of content) {
            controller.enqueue(encoder.encode(createSSEData(buildCompletionChunk(requestId, model, char))));
            await delay(20);
          }
          controller.enqueue(encoder.encode(createSSEData(buildCompletionChunk(requestId, model, "", "stop"))));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        recordAndPersist(
          stats,
          liveRequests,
          { method: "POST", path: "/v1/chat/completions", userAgent, model },
          200,
          Date.now() - startTime,
        );
      } catch (error) {
        debugLog(CONFIG.debugMode, "伪流式输出失败:", error);
        const message = error instanceof Error ? error.message : String(error);
        controller.enqueue(
          encoder.encode(
            createSSEData(buildCompletionChunk(requestId, model, `内部服务器错误: ${message}`, "stop")),
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        recordAndPersist(
          stats,
          liveRequests,
          { method: "POST", path: "/v1/chat/completions", userAgent, model },
          500,
          Date.now() - startTime,
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function streamErrorResponse(
  message: string,
  requestId: string,
  model: string,
  startTime: number,
  userAgent: string,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          createSSEData(buildCompletionChunk(requestId, model, `内部服务器错误: ${message}`, "stop")),
        ),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
      recordAndPersist(
        stats,
        liveRequests,
        { method: "POST", path: "/v1/chat/completions", userAgent, model },
        500,
        Date.now() - startTime,
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ============================================================================ 
// API 处理函数
// ============================================================================

async function handleModels(req: Request): Promise<Response> {
  const startTime = Date.now();
  const userAgent = req.headers.get("user-agent") || "unknown";

  if (!verifyAuth(req, CONFIG.defaultKey)) {
    recordAndPersist(stats, liveRequests, { method: "GET", path: "/v1/models", userAgent }, 401, Date.now() - startTime);
    return createErrorResponse("需要 Bearer Token 认证。", "unauthorized", 401);
  }

  const models = {
    object: "list",
    data: Object.entries(CONFIG.upstreamModelMap).map(([modelId, upstreamModel]) => ({
      id: modelId,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "kimi-ai-2api",
      metadata: {
        upstream_model: upstreamModel,
      },
    })),
  };

  recordAndPersist(stats, liveRequests, { method: "GET", path: "/v1/models", userAgent }, 200, Date.now() - startTime);

  return new Response(JSON.stringify(models), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleChatCompletions(req: Request): Promise<Response> {
  const startTime = Date.now();
  const userAgent = req.headers.get("user-agent") || "unknown";

  if (!verifyAuth(req, CONFIG.defaultKey)) {
    recordAndPersist(
      stats,
      liveRequests,
      { method: "POST", path: "/v1/chat/completions", userAgent },
      401,
      Date.now() - startTime,
    );
    return createErrorResponse("需要 Bearer Token 认证。", "unauthorized", 401);
  }

  let requestData: any;
  try {
    requestData = await req.json();
  } catch {
    recordAndPersist(
      stats,
      liveRequests,
      { method: "POST", path: "/v1/chat/completions", userAgent },
      400,
      Date.now() - startTime,
    );
    return createErrorResponse("请求体必须是 JSON。");
  }

  const messages: Message[] = Array.isArray(requestData.messages) ? requestData.messages : [];
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    recordAndPersist(
      stats,
      liveRequests,
      { method: "POST", path: "/v1/chat/completions", userAgent },
      400,
      Date.now() - startTime,
    );
    return createErrorResponse("'messages' 列表不能为空，且最后一条必须是 user 角色。");
  }

  cleanupSessions();

  const userKey: string | undefined = typeof requestData.user === "string" ? requestData.user : undefined;
  const currentUserMessage = messages[messages.length - 1];
  let sessionData: SessionData | null = null;
  let promptToSend = currentUserMessage.content;
  let kimiSessionId = createSessionId();

  if (userKey) {
    sessionData = getOrCreateSession(userKey);
    promptToSend = buildContextualPrompt(sessionData.messages, currentUserMessage.content);
    kimiSessionId = sessionData.kimiSessionId;
  }

  const clientModel = typeof requestData.model === "string" ? requestData.model : CONFIG.modelName;
  const upstreamModel = CONFIG.upstreamModelMap[clientModel];
  if (!upstreamModel) {
    recordAndPersist(
      stats,
      liveRequests,
      { method: "POST", path: "/v1/chat/completions", userAgent },
      400,
      Date.now() - startTime,
    );
    return createErrorResponse(`不支持的模型: ${clientModel}`);
  }

  const isStreaming = requestData.stream ?? CONFIG.defaultStream;
  if (isStreaming) {
    stats.streamingRequests++;
  } else {
    stats.nonStreamingRequests++;
  }

  const requestId = generateRequestId();
  debugLog(CONFIG.debugMode, "生成请求ID:", requestId);
  debugLog(CONFIG.debugMode, "发送到上游的提示词:", promptToSend.slice(0, 200));

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(`请求超过 ${CONFIG.apiRequestTimeout}s 超时限制。`), CONFIG.apiRequestTimeout * 1000);

  try {
    const nonce = await getNonce();
    const payload = preparePayload(promptToSend, upstreamModel, kimiSessionId, nonce);
    const upstreamData = await sendUpstreamWithRetry(payload, abortController.signal);

    const assistantResponseContent = upstreamData?.data?.message ?? "";
    debugLog(CONFIG.debugMode, "上游返回内容:", assistantResponseContent.slice(0, 200));

    if (sessionData && userKey) {
      sessionData.messages.push(currentUserMessage);
      sessionData.messages.push({ role: "assistant", content: assistantResponseContent });
      sessionData.expiresAt = Date.now() + CONFIG.sessionCacheTtl * 1000;
      sessionCache.set(userKey, sessionData);
    }

    if (isStreaming) {
      return streamSuccessResponse(assistantResponseContent, requestId, clientModel, startTime, userAgent);
    }

    const nonStreamingResponse = {
      id: requestId,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: clientModel,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: assistantResponseContent,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    recordAndPersist(
      stats,
      liveRequests,
      { method: "POST", path: "/v1/chat/completions", userAgent, model: clientModel },
      200,
      Date.now() - startTime,
    );

    return new Response(JSON.stringify(nonStreamingResponse), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog(CONFIG.debugMode, "处理聊天请求失败:", message);

    if (isStreaming) {
      return streamErrorResponse(message, requestId, clientModel, startTime, userAgent);
    }

    recordAndPersist(
      stats,
      liveRequests,
      { method: "POST", path: "/v1/chat/completions", userAgent, model: clientModel },
      500,
      Date.now() - startTime,
    );
    return createErrorResponse(`内部服务器错误: ${message}`, "internal_server_error", 500);
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================ 
// 服务入口
// ============================================================================

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const urlLang = getLanguageFromUrl(url);
  const browserLang = detectLanguage(req);
  const lang: Language = urlLang || browserLang;
  const currentUrl = url.toString();

  if (path === "/v1/models") {
    return handleModels(req);
  }

  if (path === "/v1/chat/completions") {
    return handleChatCompletions(req);
  }

  if (path === "/" || path === "/index.html") {
    return new Response(getHomePage(CONFIG, lang, currentUrl), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (path === "/docs") {
    return new Response(getDocsPage(CONFIG, lang, currentUrl), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (path === "/deploy") {
    return new Response(getDeployPage(CONFIG, lang, currentUrl), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (path === "/playground") {
    return new Response(getPlaygroundPage(CONFIG, lang, currentUrl), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (path === "/dashboard" && CONFIG.dashboardEnabled) {
    return new Response(getDashboardPage(CONFIG, stats, liveRequests, lang, currentUrl), {
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response("Not Found", { status: 404 });
}

console.log(`🚀 ${CONFIG.serviceName} ${CONFIG.serviceEmoji}`);
console.log(`🔗 Server starting on http://localhost:${CONFIG.port}`);
console.log(`📊 Dashboard: ${CONFIG.dashboardEnabled ? "enabled" : "disabled"}`);
console.log(`🤖 Default Model: ${CONFIG.modelName}`);
console.log(`🔑 API Key: ${CONFIG.defaultKey ? "已启用" : "未启用"}`);

Deno.serve({ port: CONFIG.port }, handler);

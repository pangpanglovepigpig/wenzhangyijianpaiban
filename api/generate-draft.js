const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-pro";
const MAX_INPUT_LENGTH = 12000;
const MAX_BLOCKS = 120;
const REQUEST_TIMEOUT_MS = 45000;
const VALID_BLOCK_TYPES = new Set(["h1", "h2", "h3", "p", "hr"]);
const VALID_COLORS = new Set(["red", "blue"]);

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "请使用 POST 生成初稿。" });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "还没有配置 DEEPSEEK_API_KEY。" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      sendJson(res, 400, { error: "请先输入文章内容。" });
      return;
    }

    if (text.length > MAX_INPUT_LENGTH) {
      sendJson(res, 413, { error: `文章太长了，请控制在 ${MAX_INPUT_LENGTH} 字以内。` });
      return;
    }

    const rawDraft = await requestDeepSeekDraft(text, apiKey);
    const blocks = sanitizeDraft(rawDraft);

    if (!blocks.length) {
      throw new Error("DeepSeek 没有返回可用的初稿内容。");
    }

    sendJson(res, 200, { blocks });
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : "DeepSeek 生成失败，请稍后再试。",
    });
  }
}

async function requestDeepSeekDraft(text, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: [
              "你是小红书图文排版助手，只返回严格 JSON，不要 Markdown，不要解释。",
              "你的任务是把用户文章整理成适合多张小红书图片展示的结构化初稿。",
              "返回格式必须是：{\"blocks\":[{\"type\":\"h1|h2|h3|p|hr\",\"text\":\"...\",\"highlight\":false,\"underline\":false,\"segments\":[{\"text\":\"...\",\"bold\":true,\"color\":\"red|blue\"}]}]}。",
              "type 只能是 h1、h2、h3、p、hr。hr 不需要 text、segments、highlight、underline。",
              "text 必须等于 segments 中所有 text 拼接后的结果；没有局部样式时可以省略 segments。",
              "highlight 和 underline 只用于 p 段落，且不要同一段同时使用。",
              "加粗用于核心结论、关键名词、重要数字、强观点。",
              "红色用于风险、误区、不要、必须、警告、负面后果。",
              "蓝色用于方法、步骤、方案、正向收益、可执行动作。",
              "行内样式只标少量关键词或短语，避免整段加粗或整段染色。",
              "保留原文含义，不要虚构新信息；可以拆分长段、补充分隔线、识别标题和小标题。",
            ].join("\n"),
          },
          {
            role: "user",
            content: `请为下面文章生成结构化初稿：\n\n${text}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 5000,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`DeepSeek 请求失败：${response.status} ${responseText.slice(0, 180)}`);
    }

    const data = JSON.parse(responseText);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("DeepSeek 返回内容为空。");
    }

    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("DeepSeek 响应超时，请稍后再试。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sanitizeDraft(rawDraft) {
  const blocks = Array.isArray(rawDraft?.blocks) ? rawDraft.blocks : [];
  const sanitized = blocks.slice(0, MAX_BLOCKS).map(sanitizeBlock).filter(Boolean);
  const firstTextBlock = sanitized.find((block) => block.type !== "hr");

  if (firstTextBlock && !sanitized.some((block) => block.type === "h1")) {
    firstTextBlock.type = "h1";
    firstTextBlock.highlight = false;
    firstTextBlock.underline = false;
  }

  return compactDividers(sanitized);
}

function sanitizeBlock(block) {
  const type = VALID_BLOCK_TYPES.has(block?.type) ? block.type : "p";
  if (type === "hr") {
    return { type: "hr", text: "", highlight: false, underline: false };
  }

  const segments = sanitizeSegments(block?.segments);
  const text = segments ? segments.map((segment) => segment.text).join("") : sanitizeText(block?.text);
  if (!text.trim()) return null;

  return {
    type,
    text,
    segments,
    highlight: type === "p" && block?.highlight === true,
    underline: type === "p" && block?.underline === true && block?.highlight !== true,
  };
}

function sanitizeSegments(segments) {
  if (!Array.isArray(segments)) return undefined;

  const normalized = segments
    .map((segment) => ({
      text: sanitizeText(segment?.text),
      bold: segment?.bold === true || undefined,
      color: VALID_COLORS.has(segment?.color) ? segment.color : undefined,
    }))
    .filter((segment) => segment.text.trim().length > 0);

  if (!normalized.length) return undefined;

  return normalized.reduce((result, segment) => {
    const previous = result[result.length - 1];
    if (previous && previous.bold === segment.bold && previous.color === segment.color) {
      previous.text += segment.text;
      return result;
    }

    result.push(segment);
    return result;
  }, []);
}

function sanitizeText(value) {
  return String(value ?? "").replace(/\s*\n+\s*/g, " ").trim();
}

function compactDividers(blocks) {
  const compacted = blocks.filter((block, index, all) => {
    if (block.type !== "hr") return true;
    const previous = all[index - 1];
    const next = all[index + 1];
    return Boolean(previous && next && previous.type !== "hr" && next.type !== "hr");
  });

  return compacted.filter((block, index) => block.type !== "hr" || (index > 0 && index < compacted.length - 1));
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

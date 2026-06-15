const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";
const MAX_INPUT_LENGTH = 12000;
const MAX_BLOCKS = 120;
const DEFAULT_REQUEST_TIMEOUT_MS = 55000;
const MAX_REQUEST_TIMEOUT_MS = 55000;
const LOCAL_FALLBACK_NOTICE = "DeepSeek 暂时响应较慢，已先用本地规则生成可编辑初稿。";
const SLOW_RESPONSE_ERROR =
  "DeepSeek 当前响应较慢或繁忙，这次没有生成初稿。请稍后重试，或确认线上 DEEPSEEK_TIMEOUT_MS 已设为 55000 后重新部署。";
const VALID_BLOCK_TYPES = new Set(["h1", "h2", "h3", "p", "hr"]);
const VALID_COLORS = new Set(["red", "blue"]);
const FALLBACKABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const endPunctuation = /[。！？!?；;，,、：:]$/;
const markdownDividerPattern = /^-{3,}$/;
const sentenceSplitPattern = /[^。！？!?；;]+[。！？!?；;]?/g;

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

    let rawDraft;
    let notice;

    try {
      rawDraft = await requestDeepSeekDraft(text, apiKey);
    } catch (error) {
      if (!isFallbackableDeepSeekError(error) || !isLocalFallbackEnabled()) throw error;

      rawDraft = createFallbackDraft(text);
      notice = LOCAL_FALLBACK_NOTICE;
    }

    const blocks = sanitizeDraft(rawDraft);

    if (!blocks.length) {
      throw new Error("DeepSeek 没有返回可用的初稿内容。");
    }

    sendJson(res, 200, notice ? { blocks, notice, fallback: true } : { blocks });
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : "DeepSeek 生成失败，请稍后再试。",
    });
  }
}

async function requestDeepSeekDraft(text, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());
  const targetBlocks = getTargetBlockCount(text);

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
              "highlight 和 underline 必须始终返回 false；黄色高亮和红色波浪线由本地排版规则统一处理。",
              "加粗用于核心结论、关键名词、重要数字、强观点。",
              "红色只用于风险、误区、不要、必须、警告、负面后果等短词或短语。",
              "蓝色只用于方法、步骤、方案、正向收益、可执行动作等短词或短语。",
              "segments 主要用于 p 段落；h1、h2、h3 不要使用红色或蓝色。",
              "每个段落最多 2 处红色或蓝色，每处只标 2 到 12 个汉字左右；不要给整句、整段、带句号问号叹号分号的内容染色。",
              "行内样式只标少量关键词或短语，不确定就不要标色，避免整段加粗或整段染色。",
              "保留原文含义，不要虚构新信息；可以拆分长段、识别标题和小标题；可以返回必要的 hr 分隔线，但不要连续返回分隔线。",
              `输出要精简，blocks 总数控制在 ${targetBlocks} 个以内；优先保留标题、小标题、关键结论和可执行段落，避免逐句复写原文。`,
            ].join("\n"),
          },
          {
            role: "user",
            content: `请为下面文章生成结构化初稿：\n\n${text}`,
          },
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        stream: false,
        temperature: 0.2,
        max_tokens: getMaxTokensForText(text),
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      if (response.status === 429) {
        throw new DeepSeekRequestError(
          "DeepSeek 当前请求过于频繁或额度受限，这次没有生成初稿。请稍后重试，或检查 DeepSeek 账户额度。",
          true,
        );
      }

      if (FALLBACKABLE_STATUSES.has(response.status)) {
        throw new DeepSeekRequestError(SLOW_RESPONSE_ERROR, true);
      }

      throw new DeepSeekRequestError(
        `DeepSeek 请求失败：${response.status} ${responseText.slice(0, 180)}`,
        false,
      );
    }

    const data = safeParseJson(responseText);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new DeepSeekRequestError("DeepSeek 返回内容为空，这次没有生成初稿。请再试一次。", true);
    }

    const draft = safeParseJson(content);
    if (!draft) {
      throw new DeepSeekRequestError("DeepSeek 返回格式异常，这次没有生成初稿。请再试一次。", true);
    }

    return draft;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new DeepSeekRequestError(SLOW_RESPONSE_ERROR, true);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class DeepSeekRequestError extends Error {
  constructor(message, fallbackable = false) {
    super(message);
    this.name = "DeepSeekRequestError";
    this.fallbackable = fallbackable;
  }
}

function isFallbackableDeepSeekError(error) {
  return error instanceof DeepSeekRequestError && error.fallbackable === true;
}

function isLocalFallbackEnabled() {
  return String(process.env.DEEPSEEK_ENABLE_LOCAL_FALLBACK || "").toLowerCase() === "true";
}

function getRequestTimeoutMs() {
  const configured = Number(process.env.DEEPSEEK_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_REQUEST_TIMEOUT_MS;

  return Math.min(Math.max(configured, 10000), MAX_REQUEST_TIMEOUT_MS);
}

function getTargetBlockCount(text) {
  if (text.length > 9000) return 72;
  if (text.length > 6000) return 58;
  if (text.length > 3000) return 44;
  return 32;
}

function getMaxTokensForText(text) {
  if (text.length > 9000) return 3800;
  if (text.length > 6000) return 3200;
  if (text.length > 3000) return 2600;
  return 1800;
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
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
    highlight: false,
    underline: false,
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

function createFallbackDraft(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let hasTitle = false;

  lines.forEach((line, index) => {
    if (blocks.length >= MAX_BLOCKS) return;

    if (markdownDividerPattern.test(line)) {
      addFallbackDivider(blocks);
      return;
    }

    const markdownHeading = getFallbackMarkdownHeading(line);
    if (markdownHeading) {
      if (markdownHeading.level === 1 && !hasTitle) {
        blocks.push(createFallbackBlock("h1", markdownHeading.text));
        hasTitle = true;
        return;
      }

      addFallbackDivider(blocks);
      blocks.push(createFallbackBlock(markdownHeading.level === 2 ? "h2" : "h3", markdownHeading.text));
      return;
    }

    if (!hasTitle) {
      blocks.push(createFallbackBlock("h1", cleanFallbackPrefix(line)));
      hasTitle = true;
      return;
    }

    if (isFallbackHeading(line, index)) {
      addFallbackDivider(blocks);
      blocks.push(createFallbackBlock("h2", cleanFallbackPrefix(line)));
      return;
    }

    splitFallbackSentences(line).forEach((sentence) => {
      if (blocks.length < MAX_BLOCKS) {
        blocks.push(createFallbackBlock("p", sentence));
      }
    });
  });

  return { blocks: compactDividers(blocks) };
}

function getFallbackMarkdownHeading(line) {
  const match = /^(#{1,3})\s+(.+)$/.exec(line);
  if (!match) return null;

  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}

function isFallbackHeading(line, index) {
  if (index <= 0) return false;
  if (line.length > 28 || endPunctuation.test(line)) return false;

  return /^(第.+[章节步]|[一二三四五六七八九十\d]+[、.．）)]|[-*]\s*)?[\u4e00-\u9fa5A-Za-z0-9\s《》“”""：:]+$/.test(line);
}

function splitFallbackSentences(line) {
  if (line.length <= 54) return [line];

  const sentences = line.match(sentenceSplitPattern)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [line];
  const result = [];
  let buffer = "";

  sentences.forEach((sentence) => {
    const next = buffer ? `${buffer}${sentence}` : sentence;
    if (next.length <= 72) {
      buffer = next;
      return;
    }

    if (buffer) result.push(buffer);
    buffer = sentence;
  });

  if (buffer) result.push(buffer);
  return result;
}

function cleanFallbackPrefix(line) {
  return line.replace(/^([一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十\d]+[步章节]|[0-9]+[、.．]|\d+\s*[）)]|[-*]\s*)/, "").trim();
}

function createFallbackBlock(type, text = "") {
  return {
    type,
    text,
    highlight: false,
    underline: false,
  };
}

function addFallbackDivider(blocks) {
  const previous = blocks[blocks.length - 1];
  if (previous && previous.type !== "hr") {
    blocks.push(createFallbackBlock("hr"));
  }
}

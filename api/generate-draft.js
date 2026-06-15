const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";
const MAX_INPUT_LENGTH = 12000;
const MAX_BLOCKS = 600;
const DEFAULT_REQUEST_TIMEOUT_MS = 55000;
const MAX_REQUEST_TIMEOUT_MS = 55000;
const LOCAL_FALLBACK_NOTICE = "DeepSeek 暂时响应较慢，已用本地规则生成保留原文的初稿。";
const SOURCE_REPAIR_NOTICE = "DeepSeek 返回内容未完整保留原文，已改用本地排版规则。";
const SLOW_RESPONSE_ERROR =
  "DeepSeek 当前响应较慢或繁忙，这次没有生成初稿。请稍后重试，或确认线上 DEEPSEEK_TIMEOUT_MS 已设为 55000 后重新部署。";
const VALID_BLOCK_TYPES = new Set(["h1", "h2", "h3", "p", "hr"]);
const VALID_COLORS = new Set(["red", "blue"]);
const FALLBACKABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const endPunctuation = /[。！？!?；;，,、：:]$/;
const markdownDividerPattern = /^-{3,}$/;
const hardSentencePattern = /[^。！？!?；;]+[。！？!?；;]?/g;
const softClausePattern = /[^，,：:、]+[，,：:、]?/g;
const sourceH3Pattern = /^(第[一二三四五六七八九十\d]+个层次[，,].{2,38}[。！？!?]?)$/;
const standaloneH3Pattern = /^([一二三四五六七八九十\d]+[、.．）)]|第[一二三四五六七八九十\d]+[步章节])[^\n。！？!?；;]{2,32}$/;
const inlineColorCuePatterns = {
  red:
    /(注意|提醒|不要|不能|避免|一定要|一定|必须|停止|正视|千万|尤其|小心|警惕|风险|误区|雷区|常见|错误|失败|后果|遗漏|截断|焦虑|粗心|瓶颈|恶性循环|自我否定|最可惜|最容易|降低|失去|变差|浪费|拖慢|出错|失控|检查|确认|排雷)/,
  blue:
    /(方法|步骤|方案|建议|做法|行动|执行|结论|总结|核心|关键|重点|原则|清单|公式|路径|策略|工具|流程|解决|完成|拆成|搭建|先把|然后|最后|所以|因此|总之|一句话|简单说|也就是说|真正|适合|值得|可以|就能|即可|提升|优化|改善|效果|效率|增长|转化|复盘|获得|抓手)/,
};
const inlineRedActionPattern = /^(注意|提醒|不要|不能|避免|一定|必须|千万|小心|警惕|别|停止|检查|确认)|一定要|必须要|不要把|不能把/;
const inlineBlueActionPattern =
  /^(先|再|然后|最后|把|用|让|给|从|只要|可以|建议|总的来说|总之|所以|因此|一句话|简单说|也就是说)|就能|即可|适合用|拆成|解决/;
const summaryPattern =
  /(^所以|^因此|^总之|^一句话|^最后|^简单说|^也就是说|才是|就能|即可|更重要|更适合|更容易|更值得|更清楚|更稳定|更有效)/;
const infoBlockMinLength = 24;
const infoBlockTargetMaxLength = 68;
const infoBlockForcedMaxLength = 86;
const infoBlockMaxUnits = 2;
const longSentenceSplitLength = 78;
const orphanInfoBlockMaxLength = 6;
const implicitSectionMinParagraphs = 3;
const implicitSectionMinChars = 150;
const maxInlineColorLength = 60;
const minInlineColorLength = 6;
const inlineColorScoreThreshold = 5;

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

      rawDraft = createSourcePreservingDraft(text);
      notice = LOCAL_FALLBACK_NOTICE;
    }

    let blocks = sanitizeDraft(rawDraft);

    if (!draftPreservesSource(blocks, text)) {
      rawDraft = createSourcePreservingDraft(text);
      blocks = sanitizeDraft(rawDraft);
      notice = notice ?? SOURCE_REPAIR_NOTICE;
    }

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
              "你的任务是把用户文章整理成适合多张小红书图片展示的结构化初稿，但只能排版，不能改文。",
              "返回格式必须是：{\"blocks\":[{\"type\":\"h1|h2|h3|p|hr\",\"text\":\"...\",\"highlight\":false,\"underline\":false,\"segments\":[{\"text\":\"...\",\"bold\":true,\"color\":\"red|blue\"}]}]}。",
              "type 只能是 h1、h2、h3、p、hr。hr 不需要 text、segments、highlight、underline。",
              "所有非 hr 的 text 按返回顺序拼接后，必须与用户原文去除空行和分隔线后的文字完全一致。",
              "严禁改写、删减、概括、扩写、调整文字顺序，严禁新增原文没有的小标题、总结句或过渡句。",
              "text 必须等于 segments 中所有 text 拼接后的结果；segments 必须完整切分 text，不能漏掉空格或标点；没有局部样式时可以省略 segments。",
              "highlight 和 underline 必须始终返回 false；黄色高亮和红色波浪线由本地排版规则统一处理。",
              "第一行默认用 h1。",
              "h3 只能用于原文中完整存在的结构句或短段，例如“第一个层次，是因为……。”；不确定就用 p。",
              "普通正文按更细的信息块输出：同一部分可以有多个 p 段落，每个 p 通常 1 到 2 句，约 24 到 68 字；重要提醒句、方法句、结论句可以单独成段。",
              "不同部分之间必须用 hr 分隔；hr 只表示部分边界，不要放在同一部分的每个 p 段落之间。",
              "没有原文小标题时，也要按内容推进自然分成几个部分，每个部分可以包含多个 p 段落。",
              "短到无法独立阅读的句子可以合并，超长句可以按逗号、冒号、顿号等软切分。",
              "加粗用于核心结论、关键名词、重要数字、强观点，但必须来自原文原字。",
              "红色用于一句提醒、风险、不要做、必须注意、常见错误等句段，不要执着固定关键词。",
              "蓝色用于一句方法、结论、收益、行动建议、总结性判断等句段，不要执着固定关键词。",
              "segments 主要用于 p 段落；h1、h2、h3 不要使用红色或蓝色。",
              "每个段落最多 1 处红色或蓝色，每处约 6 到 60 个字，可以是一条完整句子，也可以包含句号、问号、叹号或分号。",
              "避免把多个句子或很长整段染色；不确定就不标色，避免整段加粗或整段染色。",
              "可以拆分长段、识别原文已有标题和小标题；可以返回必要的 hr 分隔线，但不要连续返回分隔线。",
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
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new DeepSeekRequestError("DeepSeek 返回内容为空，这次没有生成初稿。请再试一次。", true);
    }

    if (choice?.finish_reason === "length") {
      throw new DeepSeekRequestError("DeepSeek 返回内容被截断，这次没有生成初稿。请缩短原文后再试一次。", true);
    }

    const draft = parseDraftContent(content);
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

function getMaxTokensForText(text) {
  if (text.length > 9000) return 18000;
  if (text.length > 6000) return 14000;
  if (text.length > 3000) return 9000;
  return 5000;
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseDraftContent(content) {
  const parsed = parseJsonLoose(content);
  if (!parsed) return null;
  if (Array.isArray(parsed)) return { blocks: parsed };
  if (Array.isArray(parsed?.blocks)) return parsed;
  if (Array.isArray(parsed?.data?.blocks)) return parsed.data;

  return parsed;
}

function parseJsonLoose(value) {
  const trimmed = String(value ?? "").trim().replace(/^\uFEFF/, "");
  if (!trimmed) return null;

  const direct = safeParseJson(trimmed);
  if (direct) return direct;

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced) {
    const parsedFence = safeParseJson(fenced[1].trim());
    if (parsedFence) return parsedFence;
  }

  const candidate = extractJsonCandidate(trimmed);
  return candidate ? safeParseJson(candidate) : null;
}

function extractJsonCandidate(value) {
  for (let start = 0; start < value.length; start += 1) {
    const opening = value[start];
    if (opening !== "{" && opening !== "[") continue;

    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < value.length; index += 1) {
      const char = value[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
      } else if (char === opening) {
        depth += 1;
      } else if (char === closing) {
        depth -= 1;
        if (depth === 0) {
          return value.slice(start, index + 1);
        }
      }
    }
  }

  return null;
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
      text: sanitizeSegmentText(segment?.text),
      bold: segment?.bold === true || undefined,
      color: VALID_COLORS.has(segment?.color) ? segment.color : undefined,
    }))
    .filter((segment) => segment.text.length > 0);

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

function sanitizeSegmentText(value) {
  return String(value ?? "").replace(/\s*\n+\s*/g, " ");
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

function draftPreservesSource(blocks, sourceText) {
  const source = getComparableSourceText(sourceText);
  const draft = getComparableDraftText(blocks);
  if (!source || source !== draft) return false;

  return blocks.every((block) => {
    if (block.type === "hr") return true;
    return sourceText.includes(block.text);
  });
}

function getComparableSourceText(text) {
  return getSourceLines(text)
    .filter((line) => !markdownDividerPattern.test(line))
    .join("")
    .replace(/\s/g, "");
}

function getComparableDraftText(blocks) {
  return blocks
    .filter((block) => block.type !== "hr")
    .map((block) => block.text)
    .join("")
    .replace(/\s/g, "");
}

function getSourceLines(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getSourceTextLines(text) {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim());

  return rawLines.reduce((result, line, index) => {
    if (!line) return result;

    result.push({
      text: line,
      hasBlankBefore: index === 0 || rawLines[index - 1] === "",
    });

    return result;
  }, []);
}

function createSourcePreservingDraft(text) {
  const lines = getSourceTextLines(text);

  const blocks = [];
  let hasTitle = false;
  let sectionParagraphCount = 0;
  let sectionTextLength = 0;
  const hasExplicitSections = lines.some((line, index) => {
    if (index === 0 || markdownDividerPattern.test(line.text)) return false;
    const markdownHeading = getFallbackMarkdownHeading(line.text);
    return Boolean((markdownHeading && markdownHeading.level > 1) || isFallbackHeading(line.text, index));
  });

  const resetSectionStats = () => {
    sectionParagraphCount = 0;
    sectionTextLength = 0;
  };

  lines.forEach((line, index) => {
    if (blocks.length >= MAX_BLOCKS) return;

    if (markdownDividerPattern.test(line.text)) {
      addFallbackDivider(blocks);
      resetSectionStats();
      return;
    }

    if (!hasTitle) {
      blocks.push(createFallbackBlock("h1", line.text));
      hasTitle = true;
      addFallbackDivider(blocks);
      resetSectionStats();
      return;
    }

    const markdownHeading = getFallbackMarkdownHeading(line.text);
    if (markdownHeading) {
      addFallbackDivider(blocks);
      blocks.push(createFallbackBlock(markdownHeading.level === 2 ? "h2" : "h3", line.text));
      resetSectionStats();
      return;
    }

    if (isFallbackHeading(line.text, index)) {
      addFallbackDivider(blocks);
      blocks.push(createFallbackBlock("h3", line.text));
      resetSectionStats();
      return;
    }

    splitIntoInfoBlocks(line.text).forEach((sentence, paragraphIndex) => {
      if (blocks.length < MAX_BLOCKS) {
        if (isSourceH3Candidate(sentence)) {
          addFallbackDivider(blocks);
          blocks.push(createFallbackBlock("h3", sentence));
          resetSectionStats();
          return;
        }

        if (
          shouldStartImplicitSection(
            blocks,
            hasExplicitSections,
            line,
            paragraphIndex,
            sectionParagraphCount,
            sectionTextLength,
          )
        ) {
          addFallbackDivider(blocks);
          resetSectionStats();
        }

        blocks.push(createFallbackBlock("p", sentence, decorateFallbackSegments(sentence)));
        sectionParagraphCount += 1;
        sectionTextLength += getComparableTextLength(sentence);
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
  if (line.length > 34 || endPunctuation.test(line)) return false;

  return standaloneH3Pattern.test(line);
}

function splitIntoInfoBlocks(line) {
  const units = getSentenceRanges(line).flatMap((range) => splitLongSentenceRange(line, range));
  if (!units.length) return line ? [line] : [];

  const blocks = [];
  let current = null;
  let currentUnitCount = 0;

  units.forEach((unit) => {
    if (!current) {
      current = { ...unit };
      currentUnitCount = 1;
      return;
    }

    const currentText = line.slice(current.start, current.end);
    const currentLength = getComparableTextLength(currentText);
    const nextLength = getComparableTextLength(line.slice(current.start, unit.end));
    const canAddUnit = currentUnitCount < infoBlockMaxUnits;
    const currentCanStandAlone = isStandaloneInfoUnit(currentText);
    const shouldMergeShortBlock =
      currentLength < infoBlockMinLength && !currentCanStandAlone && nextLength <= infoBlockForcedMaxLength;
    const fitsTargetBlock = !currentCanStandAlone && nextLength <= infoBlockTargetMaxLength;

    if (canAddUnit && (shouldMergeShortBlock || fitsTargetBlock)) {
      current.end = unit.end;
      currentUnitCount += 1;
      return;
    }

    blocks.push(current);
    current = { ...unit };
    currentUnitCount = 1;
  });

  if (current) blocks.push(current);

  mergeShortTrailingBlock(line, blocks);

  return blocks.map((range) => line.slice(range.start, range.end).trim()).filter(Boolean);
}

function splitLongSentenceRange(line, range) {
  const sentence = line.slice(range.start, range.end);
  if (getComparableTextLength(sentence) <= longSentenceSplitLength) return [range];

  const clauses = getRegexRanges(sentence, softClausePattern).map((clause) => ({
    start: range.start + clause.start,
    end: range.start + clause.end,
  }));

  return clauses.length > 1 ? clauses : [range];
}

function mergeShortTrailingBlock(line, blocks) {
  if (blocks.length < 2) return;

  const last = blocks[blocks.length - 1];
  const previous = blocks[blocks.length - 2];
  const lastLength = getComparableTextLength(line.slice(last.start, last.end));
  const mergedLength = getComparableTextLength(line.slice(previous.start, last.end));

  if (lastLength <= orphanInfoBlockMaxLength && mergedLength <= infoBlockTargetMaxLength) {
    previous.end = last.end;
    blocks.pop();
  }
}

function isStandaloneInfoUnit(text) {
  const length = getComparableTextLength(text);
  if (length < 12) return false;

  return (
    scoreInlineColorCandidate(text, "red") >= inlineColorScoreThreshold ||
    scoreInlineColorCandidate(text, "blue") >= inlineColorScoreThreshold
  );
}

function getSentenceRanges(text) {
  const ranges = getRegexRanges(text, hardSentencePattern);
  return ranges.length ? ranges : trimTextRange(text, 0, text.length);
}

function getRegexRanges(text, pattern) {
  const ranges = [];
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match;

  while ((match = regex.exec(text))) {
    ranges.push(...trimTextRange(text, match.index, match.index + match[0].length));
  }

  return ranges;
}

function trimTextRange(text, start, end) {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && /\s/.test(text[nextStart])) nextStart += 1;
  while (nextEnd > nextStart && /\s/.test(text[nextEnd - 1])) nextEnd -= 1;

  return nextStart < nextEnd ? [{ start: nextStart, end: nextEnd }] : [];
}

function shouldStartImplicitSection(
  blocks,
  hasExplicitSections,
  line,
  paragraphIndex,
  sectionParagraphCount,
  sectionTextLength,
) {
  if (hasExplicitSections) return false;
  if (sectionParagraphCount === 0) return false;
  if (blocks[blocks.length - 1]?.type === "hr") return false;

  const isSourceParagraphBoundary = paragraphIndex === 0 && line.hasBlankBefore;
  if (isSourceParagraphBoundary && sectionParagraphCount >= 2) return true;

  return sectionParagraphCount >= implicitSectionMinParagraphs || sectionTextLength >= implicitSectionMinChars;
}

function isSourceH3Candidate(sentence) {
  return sourceH3Pattern.test(sentence);
}

function createFallbackBlock(type, text = "", segments) {
  return {
    type,
    text,
    segments,
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

function decorateFallbackSegments(text) {
  const selectedRange = chooseInlineColorRange(text);
  if (!selectedRange) return undefined;

  const segments = [];
  let cursor = 0;

  if (selectedRange.start > cursor) {
    segments.push({ text: text.slice(cursor, selectedRange.start) });
  }
  segments.push({ text: text.slice(selectedRange.start, selectedRange.end), bold: true, color: selectedRange.color });
  cursor = selectedRange.end;

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}

function chooseInlineColorRange(text) {
  const ranges = getInlineColorCandidateRanges(text)
    .flatMap((range) => {
      const candidateText = text.slice(range.start, range.end).trim();
      return ["red", "blue"].map((color) => ({
        ...range,
        color,
        score: scoreInlineColorCandidate(candidateText, color),
      }));
    })
    .filter((range) => range.score >= inlineColorScoreThreshold)
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;
      if (a.color !== b.color) return a.color === "red" ? -1 : 1;
      return b.end - b.start - (a.end - a.start) || a.start - b.start;
    });

  return ranges[0];
}

function getInlineColorCandidateRanges(text) {
  const ranges = [];
  const addRange = (range) => {
    const length = getComparableTextLength(text.slice(range.start, range.end));
    const alreadyExists = ranges.some((item) => item.start === range.start && item.end === range.end);
    if (!alreadyExists && length >= minInlineColorLength && length <= maxInlineColorLength) {
      ranges.push(range);
    }
  };

  getSentenceRanges(text).forEach((sentenceRange) => {
    addRange(sentenceRange);

    const sentence = text.slice(sentenceRange.start, sentenceRange.end);
    const clauseRanges = getRegexRanges(sentence, softClausePattern).map((range) => ({
      start: sentenceRange.start + range.start,
      end: sentenceRange.start + range.end,
    }));

    if (clauseRanges.length > 1) {
      clauseRanges.forEach(addRange);
    }
  });

  return ranges;
}

function scoreInlineColorCandidate(text, color) {
  const length = getComparableTextLength(text);
  if (length < minInlineColorLength || length > maxInlineColorLength) return Number.NEGATIVE_INFINITY;

  let score = 0;

  if (inlineColorCuePatterns[color].test(text)) score += 4;
  if (color === "red" && inlineRedActionPattern.test(text)) score += 2;
  if (color === "blue" && inlineBlueActionPattern.test(text)) score += 2;
  if (color === "blue" && summaryPattern.test(text)) score += 2;
  if (color === "blue" && /\d+(\.\d+)?\s*(%|倍|个|条|步|天|分钟|小时|元)/.test(text)) score += 2;
  if (color === "blue" && /(才是|就能|即可|更重要|更适合|更容易|更值得|更清楚|更稳定|更有效)/.test(text)) {
    score += 2;
  }
  if (color === "red" && /(太多|过度|反而|否则|一旦|导致|失去|降低|变差)/.test(text)) score += 1;
  if (color === "blue" && /(不是.+而是|只解决一个问题|一直在获得信息)/.test(text)) score += 1;
  if (length >= 12 && length <= 45) score += 1;

  return score;
}

function getComparableTextLength(text) {
  return Array.from(String(text ?? "").replace(/\s/g, "")).length;
}

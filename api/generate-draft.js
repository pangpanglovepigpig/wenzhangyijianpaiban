const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";
const MAX_INPUT_LENGTH = 12000;
const MAX_BLOCKS = 600;
const MAX_AI_STYLES = 14;
const MAX_AI_H3_SUGGESTIONS = 6;
const MAX_AI_SECTION_SUGGESTIONS = 3;
const MIN_AI_QUOTE_LENGTH = 6;
const MAX_AI_QUOTE_LENGTH = 60;
const DEFAULT_REQUEST_TIMEOUT_MS = 25000;
const MAX_REQUEST_TIMEOUT_MS = 25000;
const LOCAL_FALLBACK_NOTICE = "AI 生成较慢或暂时不可用，已返回完整的本地排版。";
const SLOW_RESPONSE_ERROR = "DeepSeek 当前响应较慢或繁忙，已使用本地排版。";
const VALID_BLOCK_TYPES = new Set(["h1", "h2", "h3", "p", "hr"]);
const VALID_COLORS = new Set(["red", "blue"]);
const VALID_STRUCTURE_ACTIONS = new Set(["h3", "section"]);
const unsafeAiH3OpeningPattern = /^(我先说|我认为|我觉得|我的看法|很多人|有些人|有人|如果|所以|因此|总之)/;
const FALLBACKABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const endPunctuation = /[。！？!?；;，,、：:]$/;
const markdownDividerPattern = /^-{3,}$/;
const hardSentencePattern = /[^。！？!?；;]+[。！？!?；;]?/g;
const softClausePattern = /[^，,：:、]+[，,：:、]?/g;
const sourceH3Pattern = /^(第[一二三四五六七八九十\d]+个层次[，,].{2,38}[。！？!?]?)$/;
const standaloneH3Pattern = /^([一二三四五六七八九十\d]+[、.．）)]|第[一二三四五六七八九十\d]+[步章节])[^\n。！？!?；;]{2,32}$/;
const inlineColorCuePatterns = {
  red:
    /(注意|提醒|不要|避免|一定要|一定|必须|停止|正视|千万|尤其|小心|警惕|风险|误区|雷区|常见|错误|失败|后果|遗漏|截断|焦虑|粗心|瓶颈|恶性循环|自我否定|最可惜|最容易|降低|失去|变差|浪费|拖慢|出错|失控|检查|确认|排雷)/,
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
const implicitSectionMinParagraphs = 2;
const implicitSectionMinChars = 180;
const implicitSectionOpeningPattern =
  /^(真正|关键|核心|重点|结论|建议|方法|做法|解决|接下来|下一步|所以|因此|总之|最后|一句话|简单说|也就是说|具体做法|具体来说|注意|提醒|不要|不能|避免|必须|一定要|首先|其次|第一|第二|第三|另外|另一方面|换句话说)/;
const implicitSectionPivotPattern =
  /^(如果你(?:现在|目前|暂时)?还(?:拿不准|没想好|不确定)|如果你只是|如果[一二三四五六七八九十几\d]+(?:周|天|个月)下来|第[一二三四五六七八九十\d]+周结束时|说到底|归根结底|总的来说|最后想说|最后要说)/;
const implicitSectionAdvicePattern = /(调整|判断|做法|方法|建议|解决|可以|应该|需要|先|再|步骤|原则|边界)/;
const implicitSectionScenePattern = /(家长|学生|同事|领导|孩子|老师|消息|任务|拜托|撒娇|委屈|情绪|状态|场景|问题)/;
const continuationOpeningPattern = /^(这些|这种|同时|也|还|而且|然后|后来|前面|刚开始|上面|这时候)/;
const structuralHeadingOpeningPattern =
  /^(先看|再看|接着看|然后才是|首先|其次|再次|最后(?:再)?看|最后(?:是|，|,|：|:)|第[一二三四五六七八九十\d]+笔账(?:是|：|:)|第[一二三四五六七八九十\d]+周可以从|资料选择(?:也)?要|计划不要|到了周末)/;
const numberedMatterOpeningPattern = /^(?:提前准备的)?第([一二三四五六七八九十\d]+)件事[，,:：]/;
const structuralHeadingMinLength = 6;
const structuralHeadingMaxLength = 34;
const numberedMatterHeadingMaxLength = 40;
const prohibitionPattern = /(^不能|不能(?:把|只|让|靠|等|将|用|因为|为了|完全|仅|说|有)|不应|不该)/;
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

    const localDraft = createSourcePreservingDraft(text);
    let blocks = sanitizeDraft(localDraft);
    let notice;

    try {
      const enhancements = await requestDeepSeekEnhancements(text, apiKey);
      blocks = applyStructureSuggestions(blocks, enhancements.structure, text);
      blocks = applyStyleSuggestions(blocks, enhancements.styles, text);
    } catch (error) {
      if (!isFallbackableDeepSeekError(error)) throw error;
      notice = LOCAL_FALLBACK_NOTICE;
    }

    if (!blocks.length || !draftPreservesSource(blocks, text)) {
      throw new Error("本地排版没有完整保留原文，请刷新后重试。");
    }

    sendJson(res, 200, notice ? { blocks, notice } : { blocks });
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : "DeepSeek 生成失败，请稍后再试。",
    });
  }
}

async function requestDeepSeekEnhancements(text, apiKey) {
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
              "从原文中判断结构句和重点样式，但只能逐字引用原文，不能改写、概括、补字或调整标点。",
              "返回格式必须是：{\"structure\":[{\"quote\":\"原文段首完整句\",\"action\":\"h3|section\"}],\"styles\":[{\"quote\":\"原文中的连续文字\",\"bold\":true,\"color\":\"red|blue\"}]}。",
              "structure 最多 9 条，其中 h3 最多 6 条、section 最多 3 条。quote 必须是自然段开头的完整第一句，长度 6 到 60 字，并且在全文唯一出现。",
              "h3 只用于能够统领后续内容的阶段、动作或主题句，例如成组序号、明确的新任务、新方法或新讨论主题；通常后面还有句子继续展开它。",
              "判断 h3 时重点看句间关系：移出首句后，余下内容仍是在解释它、列举它或给出它的步骤，才适合升为标题；没有序号但承担同样统领作用的简短主题句也可以选择。",
              "section 用于值得单独开始新区块、但不适合显示成标题的心态转折、建议转折或结尾收束句。",
              "不要把开场观点、普通强观点、风险提醒、疑问句、单纯结论或只解释自身的正文句标为 h3。不要选择 Markdown 主标题和已有标题。",
              "一篇约 8 到 14 个自然段的文章通常选择 4 到 6 个 h3；没有高置信度结构句时可以少选或不选。",
              "styles 最多 14 条，建议 8 到 12 条；每条 quote 必须逐字复制原文中唯一出现的一段连续文字，长度 6 到 60 字。",
              "quote 不能跨自然段，不能包含 Markdown 标题或分隔线，不能改写、删减、概括、补字或调整标点。",
              "红色用于提醒、风险、不要做、必须注意和常见错误；蓝色用于方法、结论、收益、行动建议和总结性判断。",
              "每个自然段最多选择一处；不确定就少选，不要选择整篇标题或小标题。",
              "bold 只能是布尔值；color 只能是 red 或 blue。",
            ].join("\n"),
          },
          {
            role: "user",
            content: `请判断下面文章的结构句和重点样式，并只返回约定的 JSON：\n\n${text}`,
          },
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        stream: false,
        temperature: 0.1,
        max_tokens: 1600,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      if (response.status === 429) {
        throw new DeepSeekRequestError(
          "DeepSeek 当前请求过于频繁或额度受限，已使用本地排版。",
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

    const enhancements = parseDraftEnhancements(content);
    if (!enhancements) {
      throw new DeepSeekRequestError("DeepSeek 返回格式异常，已使用本地排版。", true);
    }

    return enhancements;
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

function getRequestTimeoutMs() {
  const configured = Number(process.env.DEEPSEEK_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_REQUEST_TIMEOUT_MS;

  return Math.min(Math.max(configured, 10000), MAX_REQUEST_TIMEOUT_MS);
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseDraftEnhancements(content) {
  const parsed = parseJsonLoose(content);
  if (!parsed) return null;
  const candidate = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const hasStyles = Array.isArray(candidate?.styles);
  const hasStructure = Array.isArray(candidate?.structure);
  if (hasStyles || hasStructure) {
    return {
      structure: hasStructure ? candidate.structure : [],
      styles: hasStyles ? candidate.styles : [],
    };
  }
  return null;
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

function applyStructureSuggestions(blocks, rawStructure, sourceText) {
  const nextBlocks = blocks.map((block) => ({
    ...block,
    segments: block.segments?.map((segment) => ({ ...segment })),
  }));
  const suggestions = getValidStructureSuggestions(rawStructure, sourceText);

  suggestions.forEach(({ quote, action }) => {
    if (action === "h3" && nextBlocks.some((block) => block.type === "h3" && block.text === quote)) {
      return;
    }

    const blockIndex = nextBlocks.findIndex((block) => block.type === "p" && block.text.startsWith(quote));
    if (blockIndex === -1) return;

    if (nextBlocks[blockIndex - 1]?.type !== "hr") {
      nextBlocks.splice(blockIndex, 0, createFallbackBlock("hr"));
    }

    if (action === "section") return;

    const paragraphIndex = nextBlocks.findIndex((block) => block.type === "p" && block.text.startsWith(quote));
    if (paragraphIndex === -1) return;

    const paragraph = nextBlocks[paragraphIndex];
    const remainder = paragraph.text.slice(quote.length).trim();
    const replacement = [createFallbackBlock("h3", quote)];
    if (remainder) {
      replacement.push(createFallbackBlock("p", remainder, decorateFallbackSegments(remainder)));
    }
    nextBlocks.splice(paragraphIndex, 1, ...replacement);
  });

  return compactDividers(nextBlocks);
}

function getValidStructureSuggestions(rawStructure, sourceText) {
  if (!Array.isArray(rawStructure)) return [];

  const sourceParagraphOpenings = getSourceTextLines(sourceText).reduce((result, line, index) => {
    if (
      index === 0 ||
      !line.hasBlankBefore ||
      markdownDividerPattern.test(line.text) ||
      getFallbackMarkdownHeading(line.text)
    ) {
      return result;
    }

    const firstSentence = getSentenceRanges(line.text)[0];
    if (!firstSentence || firstSentence.start !== 0) return result;
    result.set(line.text.slice(firstSentence.start, firstSentence.end).trim(), sourceText.indexOf(line.text));
    return result;
  }, new Map());
  const accepted = [];
  const usedQuotes = new Set();
  let h3Count = 0;
  let sectionCount = 0;

  rawStructure.forEach((rawSuggestion) => {
    if (
      !rawSuggestion ||
      typeof rawSuggestion !== "object" ||
      typeof rawSuggestion.quote !== "string" ||
      !VALID_STRUCTURE_ACTIONS.has(rawSuggestion.action)
    ) {
      return;
    }

    const quote = rawSuggestion.quote.trim();
    const quoteLength = getComparableTextLength(quote);
    if (quoteLength < MIN_AI_QUOTE_LENGTH || quoteLength > MAX_AI_QUOTE_LENGTH) return;
    if (usedQuotes.has(quote) || countOccurrences(sourceText, quote) !== 1) return;
    if (!sourceParagraphOpenings.has(quote)) return;
    if (rawSuggestion.action === "h3" && (/[？?]$/.test(quote) || unsafeAiH3OpeningPattern.test(quote))) return;
    if (rawSuggestion.action === "h3" && h3Count >= MAX_AI_H3_SUGGESTIONS) return;
    if (rawSuggestion.action === "section" && sectionCount >= MAX_AI_SECTION_SUGGESTIONS) return;

    usedQuotes.add(quote);
    if (rawSuggestion.action === "h3") h3Count += 1;
    if (rawSuggestion.action === "section") sectionCount += 1;
    accepted.push({
      quote,
      action: rawSuggestion.action,
      sourceIndex: sourceParagraphOpenings.get(quote),
    });
  });

  return accepted.sort((left, right) => left.sourceIndex - right.sourceIndex);
}

function applyStyleSuggestions(blocks, rawStyles, sourceText) {
  const nextBlocks = blocks.map((block) => ({
    ...block,
    segments: block.segments?.map((segment) => ({ ...segment })),
  }));
  if (!Array.isArray(rawStyles)) return nextBlocks;

  const usedBlockIndexes = new Set();

  rawStyles.slice(0, MAX_AI_STYLES).forEach((rawStyle) => {
    if (!rawStyle || typeof rawStyle !== "object" || typeof rawStyle.quote !== "string") return;

    const quote = rawStyle.quote.trim();
    const quoteLength = getComparableTextLength(quote);
    if (quoteLength < MIN_AI_QUOTE_LENGTH || quoteLength > MAX_AI_QUOTE_LENGTH) return;
    if (countOccurrences(sourceText, quote) !== 1) return;
    if (rawStyle.bold !== undefined && typeof rawStyle.bold !== "boolean") return;
    if (rawStyle.color !== undefined && !VALID_COLORS.has(rawStyle.color)) return;

    const bold = rawStyle.bold === true || undefined;
    const color = VALID_COLORS.has(rawStyle.color) ? rawStyle.color : undefined;
    if (!bold && !color) return;

    const matchingBlockIndexes = nextBlocks.reduce((result, block, blockIndex) => {
      if (block.type === "p" && block.text.includes(quote)) result.push(blockIndex);
      return result;
    }, []);
    if (matchingBlockIndexes.length !== 1) return;

    const blockIndex = matchingBlockIndexes[0];
    if (usedBlockIndexes.has(blockIndex)) return;

    const block = nextBlocks[blockIndex];
    const quoteStart = block.text.indexOf(quote);
    const quoteEnd = quoteStart + quote.length;
    const segments = [];
    if (quoteStart > 0) segments.push({ text: block.text.slice(0, quoteStart) });
    segments.push({ text: quote, bold, color });
    if (quoteEnd < block.text.length) segments.push({ text: block.text.slice(quoteEnd) });

    block.segments = segments;
    usedBlockIndexes.add(blockIndex);
  });

  return nextBlocks;
}

function countOccurrences(text, quote) {
  let count = 0;
  let cursor = 0;

  while (cursor <= text.length - quote.length) {
    const index = text.indexOf(quote, cursor);
    if (index === -1) break;
    count += 1;
    if (count > 1) return count;
    cursor = index + 1;
  }

  return count;
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
    .map((line) => getFallbackMarkdownHeading(line)?.text ?? line)
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
  let sectionParagraphTexts = [];
  const numberedMatterHeadingLines = getOrderedNumberedMatterHeadingLines(lines);
  const hasExplicitSections = lines.some((line, index) => {
    if (index === 0 || markdownDividerPattern.test(line.text)) return false;
    const markdownHeading = getFallbackMarkdownHeading(line.text);
    return Boolean((markdownHeading && markdownHeading.level > 1) || isFallbackHeading(line.text, index));
  });

  const resetSectionStats = () => {
    sectionParagraphTexts = [];
  };

  const appendParagraphs = (content) => {
    let addedParagraph = false;

    splitIntoInfoBlocks(content).forEach((sentence) => {
      if (blocks.length >= MAX_BLOCKS) return;

      if (isSourceH3Candidate(sentence)) {
        addFallbackDivider(blocks);
        blocks.push(createFallbackBlock("h3", sentence));
        resetSectionStats();
        return;
      }

      blocks.push(createFallbackBlock("p", sentence, decorateFallbackSegments(sentence)));
      addedParagraph = true;
    });

    if (addedParagraph) sectionParagraphTexts.push(content);
  };

  lines.forEach((line, index) => {
    if (blocks.length >= MAX_BLOCKS) return;

    if (markdownDividerPattern.test(line.text)) {
      addFallbackDivider(blocks);
      resetSectionStats();
      return;
    }

    if (!hasTitle) {
      const firstHeading = getFallbackMarkdownHeading(line.text);
      blocks.push(createFallbackBlock("h1", firstHeading?.text ?? line.text));
      hasTitle = true;
      addFallbackDivider(blocks);
      resetSectionStats();
      return;
    }

    const markdownHeading = getFallbackMarkdownHeading(line.text);
    if (markdownHeading) {
      addFallbackDivider(blocks);
      blocks.push(createFallbackBlock(markdownHeading.level === 3 ? "h3" : "h2", markdownHeading.text));
      resetSectionStats();
      return;
    }

    if (isFallbackHeading(line.text, index)) {
      addFallbackDivider(blocks);
      blocks.push(createFallbackBlock("h3", line.text));
      resetSectionStats();
      return;
    }

    const structuralHeading = splitLeadingStructuralHeading(line.text, numberedMatterHeadingLines.has(line.text));
    if (structuralHeading) {
      addFallbackDivider(blocks);
      blocks.push(createFallbackBlock("h3", structuralHeading.heading));
      resetSectionStats();
      if (structuralHeading.remainder) appendParagraphs(structuralHeading.remainder);
      return;
    }

    if (shouldStartImplicitSection(blocks, hasExplicitSections, line, sectionParagraphTexts)) {
      addFallbackDivider(blocks);
      resetSectionStats();
    }

    appendParagraphs(line.text);
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

function splitLeadingStructuralHeading(line, allowNumberedMatter = false) {
  const firstSentence = getSentenceRanges(line)[0];
  if (!firstSentence || firstSentence.start !== 0) return null;

  const heading = line.slice(firstSentence.start, firstSentence.end).trim();
  const headingLength = getComparableTextLength(heading);
  const isNumberedMatter = allowNumberedMatter && numberedMatterOpeningPattern.test(heading);
  if (
    headingLength < structuralHeadingMinLength ||
    headingLength > (isNumberedMatter ? numberedMatterHeadingMaxLength : structuralHeadingMaxLength) ||
    (!isNumberedMatter && !structuralHeadingOpeningPattern.test(heading))
  ) {
    return null;
  }

  return {
    heading,
    remainder: line.slice(firstSentence.end).trim(),
  };
}

function getOrderedNumberedMatterHeadingLines(lines) {
  const candidates = lines
    .slice(1)
    .map((line) => ({ line: line.text, ordinal: getNumberedMatterOrdinal(line.text) }))
    .filter((candidate) => candidate.ordinal !== null);
  const approvedLines = new Set();
  let run = [];

  const approveRun = () => {
    if (run.length >= 2) run.forEach((candidate) => approvedLines.add(candidate.line));
  };

  candidates.forEach((candidate) => {
    if (!run.length || candidate.ordinal === run[run.length - 1].ordinal + 1) {
      run.push(candidate);
      return;
    }

    approveRun();
    run = [candidate];
  });
  approveRun();

  return approvedLines;
}

function getNumberedMatterOrdinal(text) {
  const match = numberedMatterOpeningPattern.exec(text);
  if (!match) return null;

  if (/^\d+$/.test(match[1])) {
    const value = Number(match[1]);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  return {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  }[match[1]] ?? null;
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
  sectionParagraphTexts,
) {
  if (hasExplicitSections) return false;
  if (!line.hasBlankBefore) return false;
  if (sectionParagraphTexts.length === 0) return false;
  if (blocks[blocks.length - 1]?.type === "hr") return false;
  if (implicitSectionPivotPattern.test(line.text)) return true;

  const sectionTextLength = sectionParagraphTexts.reduce(
    (total, paragraphText) => total + getComparableTextLength(paragraphText),
    0,
  );
  const hasEnoughContext =
    sectionParagraphTexts.length >= implicitSectionMinParagraphs || sectionTextLength >= implicitSectionMinChars;

  return hasEnoughContext && scoreImplicitSectionShift(line.text, sectionParagraphTexts) >= 4;
}

function scoreImplicitSectionShift(currentText, previousTexts) {
  const previousText = previousTexts.join("");
  let score = 0;

  if (implicitSectionPivotPattern.test(currentText)) score += 4;
  if (implicitSectionOpeningPattern.test(currentText)) score += 4;
  if (implicitSectionAdvicePattern.test(currentText)) score += 2;
  if (implicitSectionScenePattern.test(previousText) && implicitSectionAdvicePattern.test(currentText)) score += 2;
  if (/^(\d+[、.．）)]|[一二三四五六七八九十]+[、.．])/.test(currentText)) score += 4;
  if (continuationOpeningPattern.test(currentText)) score -= 4;

  return score;
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
  if (color === "red" && hasProhibition(text)) score += 4;
  if (color === "red" && inlineRedActionPattern.test(text)) score += 2;
  if (color === "blue" && inlineBlueActionPattern.test(text)) score += 2;
  if (color === "blue" && summaryPattern.test(text)) score += 2;
  if (color === "blue" && /\d+(\.\d+)?\s*(%|倍|个|条|步|天|分钟|小时|元)/.test(text)) score += 2;
  if (color === "blue" && /(才是|就能|即可|更重要|更适合|更容易|更值得|更清楚|更稳定|更有效)/.test(text)) {
    score += 2;
  }
  if (color === "red" && /(太多|过度|反而|否则|一旦|导致|失去|降低|变差)/.test(text)) score += 1;
  if (color === "red" && /(不等于|不代表)/.test(text)) score += 2;
  if (color === "blue" && /(不是.+而是|只解决一个问题|一直在获得信息)/.test(text)) score += 1;
  if (length >= 12 && length <= 45) score += 1;

  return score;
}

function getComparableTextLength(text) {
  return Array.from(String(text ?? "").replace(/\s/g, "")).length;
}

function hasProhibition(text) {
  return prohibitionPattern.test(String(text ?? "").replace(/能不能/g, ""));
}

export { applyStructureSuggestions, applyStyleSuggestions, createSourcePreservingDraft, parseDraftEnhancements };

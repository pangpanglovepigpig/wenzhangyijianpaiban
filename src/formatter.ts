import type { ContentBlock, InlineColor, RenderConfig, TextSegment } from "./types";
import { CARD_HEIGHT, CARD_WIDTH } from "./cardStyle";

export const IMAGE_CONFIG: RenderConfig = {
  markdown: "",
  themeMode: "",
  theme: "apple-notes",
  overHiddenMode: false,
  mdxMode: true,
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  splitMode: "autoSplit",
  background: "",
  shadowUrl: "",
  weChatMode: false,
};

const headingPattern =
  /^([一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十\d]+[步章节]|[0-9]+[、.．]|\d+\s*[）)]|[-*]\s*)/;
const endPunctuation = /[。！？!?；;，,、：:]$/;
const highlightPattern =
  /(核心|关键|重点|方法|结论|建议|原则|清单|公式|总结|一句话|真正|适合|值得|步骤|效率|复盘|定位|转化)/;
const underlinePattern =
  /(注意|提醒|不要|不能|避免|一定|必须|记得|别忘|千万|尤其|小心|风险|误区|雷区|检查|确认|遗漏|截断)/;
const summaryPattern =
  /(^所以|^因此|^总之|^一句话|^最后|^简单说|^也就是说|才是|就能|即可|更重要|更适合|更容易|更值得|更清楚|更稳定|更有效)/;
const markdownDividerPattern = /^-{3,}$/;
const redUnderlineStyle =
  "text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: #d93025; text-decoration-thickness: 1.5px; text-underline-offset: 4px;";
const inlineColorStyles: Record<InlineColor, string> = {
  red: "color: #d93025;",
  blue: "color: #1677ff;",
};
const inlineColorMeaningPatterns: Record<InlineColor, RegExp> = {
  red: /(风险|误区|不要|不能|避免|必须|警告|后果|负面|错误|失败|问题|雷区|小心|注意|千万|别|坑|陷阱|遗漏|截断|降低|失去|减少|变差|损失|浪费|拖慢|出错|失控|焦虑|成本)/,
  blue:
    /(方法|步骤|方案|建议|做法|行动|执行|正向|收益|可执行|提升|优化|改善|效果|效率|增长|转化|复盘|清单|路径|策略|原则|工具|流程|解决|完成|搭建|拆|先|再|适合|值得|可以|就能|即可|\d+\s*(个|条|步|点|种|类|分钟|小时|天|倍|%))/,
};
const inlineColorSentencePunctuation = /[。！？!?；;]/;
const maxInlineColorLength = 14;
const minInlineColorLength = 2;
const maxInlineColorRatio = 0.45;
const maxInlineColorSegmentsPerBlock = 2;
const maxInlineColorCharsPerBlock = 22;

type TextLine = {
  text: string;
  hasBlankBefore: boolean;
  hasBlankAfter: boolean;
  nonEmptyIndex: number;
};

export const sampleArticle = `小红书图文排版，先让读者愿意停下来

很多图文内容不是输在观点，而是输在阅读节奏。标题要明确，第一屏要有抓手，段落之间要给眼睛一点休息。

结构先行
先把文章拆成几个部分，每一部分只解决一个问题。这样读者滑动图片时，会感觉自己一直在获得信息。

重点句要少而准。真正有价值的结论、方法和数字，适合用黄色高亮提示。

注意不要把所有句子都标重点。高亮太多会让页面失去层次，也会降低读者的信任感。

发布前检查
一定要检查每一页是否有文字截断，标题是否醒目，提醒句是否足够清楚。`;

export function createBlocksFromText(input: string): ContentBlock[] {
  const lines = getTextLines(input);

  if (lines.length === 0) {
    return createBlocksFromText(sampleArticle);
  }

  const blocks: ContentBlock[] = [];
  let hasTitle = false;
  let bodyGroupCount = 0;
  const hasSectionHeading = lines.some((line, index) => index > 0 && isSubheadingLike(line));

  lines.forEach((line, index) => {
    if (markdownDividerPattern.test(line.text)) {
      addDividerIfNeeded(blocks);
      return;
    }

    const markdownHeading = getMarkdownHeading(line.text);
    if (markdownHeading) {
      if (markdownHeading.level === 1) {
        blocks.push(makeBlock(hasTitle ? "h2" : "h1", markdownHeading.text));
        hasTitle = true;
        return;
      }

      addDividerAfterTitleIfNeeded(blocks);
      blocks.push(makeBlock(markdownHeading.level === 2 ? "h2" : "h3", markdownHeading.text));
      if (markdownHeading.level === 2) bodyGroupCount += 1;
      return;
    }

    const isTitle = !hasTitle && (index === 0 || isTitleLike(line.text));
    const isHeading = !isTitle && isSubheadingLike(line);

    if (isTitle) {
      blocks.push(makeBlock("h1", cleanPrefix(line.text)));
      hasTitle = true;
      return;
    }

    addDividerAfterTitleIfNeeded(blocks);

    if (isHeading) {
      addDividerIfNeeded(blocks);
      blocks.push(makeBlock("h2", cleanPrefix(line.text)));
      bodyGroupCount += 1;
      return;
    }

    if (!hasSectionHeading && line.nonEmptyIndex > 1) {
      if (bodyGroupCount > 0) {
        addDividerIfNeeded(blocks);
      }
      bodyGroupCount += 1;
    } else if (!hasSectionHeading && bodyGroupCount === 0) {
      bodyGroupCount = 1;
    }

    const sentences = splitSentences(line.text);
    const emphasis = chooseSentenceEmphasis(sentences);
    sentences.forEach((sentence, sentenceIndex) => {
      blocks.push(
        makeBlock(
          "p",
          sentence,
          emphasis.highlightIndex === sentenceIndex && emphasis.underlineIndex !== sentenceIndex,
          emphasis.underlineIndex === sentenceIndex,
        ),
      );
    });
  });

  if (!blocks.some((block) => block.type === "h1") && blocks[0]) {
    blocks[0] = { ...blocks[0], type: "h1", highlight: false, underline: false };
  }

  return compactDividers(blocks);
}

export function stabilizeAiDraftBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const normalizedBlocks = blocks
    .map(prepareAiDraftBlock)
    .filter((block) => block.type === "hr" || block.text.trim().length > 0);

  const firstTextBlock = normalizedBlocks.find((block) => block.type !== "hr");
  if (firstTextBlock && !normalizedBlocks.some((block) => block.type === "h1")) {
    firstTextBlock.type = "h1";
    firstTextBlock.highlight = false;
    firstTextBlock.underline = false;
  }

  const structuredBlocks: ContentBlock[] = [];
  normalizedBlocks.forEach((block) => {
    if (block.type === "hr") {
      addDividerIfNeeded(structuredBlocks);
      return;
    }

    if (block.type === "h2") {
      addDividerIfNeeded(structuredBlocks);
    }

    structuredBlocks.push(block);

    if (block.type === "h1") {
      addDividerAfterTitleIfNeeded(structuredBlocks);
    }
  });

  return applyRuleBasedEmphasis(compactDividers(structuredBlocks));
}

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "hr") return "---";

      let text = renderInlineMarkdown(block);
      if (block.highlight) text = `<mark>${text}</mark>`;
      if (block.underline) {
        text = `<span style="${redUnderlineStyle}">${text}</span>`;
      }
      if (block.type === "h1") return `# ${text}`;
      if (block.type === "h2") return `## ${text}`;
      if (block.type === "h3") return `### ${text}`;
      return text;
    })
    .join("\n\n");
}

export function makeBlock(
  type: ContentBlock["type"],
  text = "",
  highlight = false,
  underline = false,
  segments?: TextSegment[],
): ContentBlock {
  const normalizedSegments = normalizeTextSegments(segments);
  const normalizedText = normalizedSegments ? textFromSegments(normalizedSegments) : text;

  return {
    id: crypto.randomUUID(),
    type,
    text: normalizedText,
    segments: normalizedSegments,
    highlight: type === "p" ? highlight : false,
    underline: type === "p" ? underline : false,
  };
}

export function makeBlockFromDraft(block: Omit<ContentBlock, "id">): ContentBlock {
  return makeBlock(block.type, block.text, block.highlight, block.underline, block.segments);
}

export function normalizeTextSegments(segments?: TextSegment[]): TextSegment[] | undefined {
  if (!segments?.length) return undefined;

  const normalized = segments
    .map((segment) => ({
      text: segment.text,
      bold: segment.bold || undefined,
      color: segment.color === "red" || segment.color === "blue" ? segment.color : undefined,
    }))
    .filter((segment) => segment.text.length > 0);

  if (!normalized.length) return undefined;

  return mergeAdjacentSegments(normalized);
}

export function textFromSegments(segments: TextSegment[]) {
  return segments.map((segment) => segment.text).join("");
}

function isTitleLike(line: string): boolean {
  return line.length <= 34 && !endPunctuation.test(line);
}

function getTextLines(input: string): TextLine[] {
  const rawLines = input.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim());

  return rawLines.reduce<TextLine[]>((result, text, index) => {
    if (!text) return result;

    result.push({
      text,
      hasBlankBefore: index === 0 || rawLines[index - 1] === "",
      hasBlankAfter: index === rawLines.length - 1 || rawLines[index + 1] === "",
      nonEmptyIndex: result.length,
    });

    return result;
  }, []);
}

function isSubheadingLike(line: TextLine): boolean {
  if (line.text.length > 22) return false;
  if (headingPattern.test(line.text)) return true;

  const looksStandalone = line.hasBlankBefore || line.hasBlankAfter;
  return looksStandalone && !endPunctuation.test(line.text) && line.text.length <= 12;
}

function cleanPrefix(line: string): string {
  return line.replace(/^#{1,3}\s+/, "").replace(/^[-*]\s+/, "").trim();
}

function getMarkdownHeading(line: string) {
  const match = /^(#{1,3})\s+(.+)$/.exec(line);
  if (!match) return null;
  return {
    level: match[1].length as 1 | 2 | 3,
    text: match[2].trim(),
  };
}

function splitSentences(line: string): string[] {
  const parts = line.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [line];
  return parts.map((part) => part.trim()).filter(Boolean);
}

function chooseSentenceEmphasis(sentences: string[]) {
  const highlightIndex = chooseBestIndex(sentences, scoreHighlightSentence, 3);
  const underlineIndex = chooseBestIndex(sentences, scoreUnderlineSentence, 4);

  return { highlightIndex, underlineIndex };
}

function chooseBestIndex(
  sentences: string[],
  scorer: (sentence: string, index: number, total: number) => number,
  threshold: number,
) {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  sentences.forEach((sentence, index) => {
    const score = scorer(sentence, index, sentences.length);
    if (score > bestScore || (score === bestScore && index === sentences.length - 1)) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestScore >= threshold ? bestIndex : -1;
}

function chooseBestIndexExcept(
  sentences: string[],
  scorer: (sentence: string, index: number, total: number) => number,
  threshold: number,
  excludedIndex: number,
) {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  sentences.forEach((sentence, index) => {
    if (index === excludedIndex) return;

    const score = scorer(sentence, index, sentences.length);
    if (score > bestScore || (score === bestScore && index === sentences.length - 1)) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestScore >= threshold ? bestIndex : -1;
}

function scoreHighlightSentence(sentence: string, index: number, total: number) {
  let score = 0;
  const isFirstOrLast = index === 0 || index === total - 1;

  if (isFirstOrLast && total > 1) score += 2;
  if (highlightPattern.test(sentence)) score += 2;
  if (summaryPattern.test(sentence)) score += 2;
  if (/\d+(\.\d+)?\s*(%|倍|个|条|步|天|分钟|小时|元)/.test(sentence)) score += 2;
  if (sentence.length >= 12 && sentence.length <= 70) score += 1;
  if (sentence.length < 8 || sentence.length > 96) score -= 2;

  return score;
}

function scoreUnderlineSentence(sentence: string, index: number, total: number) {
  let score = 0;

  if (underlinePattern.test(sentence)) score += 4;
  if (/(容易|常见|发布前|最后|遗漏|检查|确认)/.test(sentence)) score += 2;
  if ((index === 0 || index === total - 1) && total > 1) score += 1;
  if (sentence.length > 88) score -= 2;

  return score;
}

function addDividerIfNeeded(blocks: ContentBlock[]) {
  const last = blocks[blocks.length - 1];
  if (last && last.type !== "hr" && blocks.some((block) => block.type !== "h1")) {
    blocks.push(makeBlock("hr"));
  }
}

function addDividerAfterTitleIfNeeded(blocks: ContentBlock[]) {
  const last = blocks[blocks.length - 1];
  if (last?.type === "h1") {
    blocks.push(makeBlock("hr"));
  }
}

function compactDividers(blocks: ContentBlock[]): ContentBlock[] {
  const compacted = blocks.reduce<ContentBlock[]>((result, block) => {
    if (block.type !== "hr") {
      result.push(block);
      return result;
    }

    const previous = result[result.length - 1];
    if (previous && previous.type !== "hr") {
      result.push(block);
    }

    return result;
  }, []);

  return compacted.filter((block, index, all) => {
    if (block.type !== "hr") return true;
    return index > 0 && index < all.length - 1;
  });
}

function prepareAiDraftBlock(block: ContentBlock): ContentBlock {
  if (block.type === "hr") {
    return {
      ...block,
      text: "",
      segments: undefined,
      highlight: false,
      underline: false,
    };
  }

  return {
    ...block,
    segments: cleanDraftSegments(block),
    highlight: false,
    underline: false,
  };
}

function cleanDraftSegments(block: ContentBlock): TextSegment[] | undefined {
  const segments = normalizeTextSegments(block.segments);
  if (!segments) return undefined;

  let coloredSegments = 0;
  let coloredChars = 0;
  const cleanedSegments = segments.map((segment) => {
    const color = shouldKeepInlineColor(segment, block, coloredSegments, coloredChars) ? segment.color : undefined;
    if (color) {
      coloredSegments += 1;
      coloredChars += getComparableTextLength(segment.text);
    }

    return {
      text: segment.text,
      bold: segment.bold,
      color,
    };
  });

  const normalized = normalizeTextSegments(cleanedSegments);
  if (!normalized?.some((segment) => segment.bold || segment.color)) return undefined;
  return normalized;
}

function shouldKeepInlineColor(
  segment: TextSegment,
  block: ContentBlock,
  coloredSegments: number,
  coloredChars: number,
) {
  if (!segment.color || block.type !== "p") return false;

  const segmentText = segment.text.trim();
  const segmentLength = getComparableTextLength(segmentText);
  const blockLength = getComparableTextLength(block.text);

  if (segmentLength < minInlineColorLength || segmentLength > maxInlineColorLength) return false;
  if (blockLength > 0 && segmentLength / blockLength > maxInlineColorRatio) return false;
  if (inlineColorSentencePunctuation.test(segmentText)) return false;
  if (coloredSegments >= maxInlineColorSegmentsPerBlock) return false;
  if (coloredChars + segmentLength > maxInlineColorCharsPerBlock) return false;

  return inlineColorMeaningPatterns[segment.color].test(segmentText);
}

function getComparableTextLength(text: string) {
  return Array.from(text.replace(/\s/g, "")).length;
}

function applyRuleBasedEmphasis(blocks: ContentBlock[]): ContentBlock[] {
  const emphasizedBlocks = blocks.map((block) => ({
    ...block,
    highlight: false,
    underline: false,
  }));
  let paragraphIndexes: number[] = [];

  const flushParagraphGroup = () => {
    if (!paragraphIndexes.length) return;

    const sentences = paragraphIndexes.map((blockIndex) => emphasizedBlocks[blockIndex].text);
    const underlineIndex = chooseBestIndex(sentences, scoreUnderlineSentence, 4);
    const highlightIndex = chooseBestIndexExcept(sentences, scoreHighlightSentence, 3, underlineIndex);

    if (underlineIndex >= 0) {
      emphasizedBlocks[paragraphIndexes[underlineIndex]].underline = true;
    }

    if (highlightIndex >= 0) {
      emphasizedBlocks[paragraphIndexes[highlightIndex]].highlight = true;
    }

    paragraphIndexes = [];
  };

  emphasizedBlocks.forEach((block, index) => {
    if (block.type === "p") {
      paragraphIndexes.push(index);
      return;
    }

    flushParagraphGroup();
  });
  flushParagraphGroup();

  return emphasizedBlocks;
}

function escapeInlineMarkdown(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInlineMarkdown(block: ContentBlock) {
  const segments = normalizeTextSegments(block.segments);
  if (!segments) return escapeInlineMarkdown(block.text);

  return segments.map(renderSegmentMarkdown).join("");
}

function renderSegmentMarkdown(segment: TextSegment) {
  let text = escapeInlineMarkdown(segment.text);
  if (segment.bold) text = `**${text}**`;
  if (segment.color) text = `<span style="${inlineColorStyles[segment.color]}">${text}</span>`;
  return text;
}

function mergeAdjacentSegments(segments: TextSegment[]) {
  return segments.reduce<TextSegment[]>((result, segment) => {
    const previous = result[result.length - 1];
    if (previous && previous.bold === segment.bold && previous.color === segment.color) {
      previous.text += segment.text;
      return result;
    }

    result.push({ ...segment });
    return result;
  }, []);
}

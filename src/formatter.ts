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
  /(核心|关键|重点|结论|建议|原则|清单|公式|总结|一句话|真正|适合|值得|突破口|掌控感|排雷|提分|质的飞跃|前夜)/;
const underlinePattern =
  /(注意|提醒|不要|不能|避免|一定|必须|记得|别忘|千万|尤其|小心|风险|误区|雷区|检查|确认|遗漏|截断|错误|失败|后果|失去|降低|变差|出错|失控)/;
const summaryPattern =
  /(^所以|^因此|^总之|^一句话|^最后|^简单说|^也就是说|才是|就能|即可|更重要|更适合|更容易|更值得|更清楚|更稳定|更有效)/;
const markdownDividerPattern = /^-{3,}$/;
const redUnderlineStyle =
  "text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: #d93025; text-decoration-thickness: 1.5px; text-underline-offset: 4px;";
const inlineColorStyles: Record<InlineColor, string> = {
  red: "color: #d93025;",
  blue: "color: #1677ff;",
};
const inlineColorCuePatterns: Record<InlineColor, RegExp> = {
  red:
    /(注意|提醒|不要|不能|避免|一定要|一定|必须|停止|正视|千万|尤其|小心|警惕|风险|误区|雷区|常见|错误|失败|后果|遗漏|截断|焦虑|粗心|瓶颈|恶性循环|自我否定|最可惜|最容易|降低|失去|变差|浪费|拖慢|出错|失控|检查|确认|排雷)/,
  blue:
    /(方法|步骤|方案|建议|做法|行动|执行|结论|总结|核心|关键|重点|原则|清单|公式|路径|策略|工具|流程|解决|完成|拆成|搭建|先把|然后|最后|所以|因此|总之|一句话|简单说|也就是说|真正|适合|值得|可以|就能|即可|提升|优化|改善|效果|效率|增长|转化|复盘|获得|抓手)/,
};
const inlineRedActionPattern = /^(注意|提醒|不要|不能|避免|一定|必须|千万|小心|警惕|别|停止|检查|确认)|一定要|必须要|不要把|不能把/;
const inlineBlueActionPattern =
  /^(先|再|然后|最后|把|用|让|给|从|只要|可以|建议|总的来说|总之|所以|因此|一句话|简单说|也就是说)|就能|即可|适合用|拆成|解决/;
const hardSentencePattern = /[^。！？!?；;]+[。！？!?；;]?/g;
const softClausePattern = /[^，,：:、]+[，,：:、]?/g;
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
const implicitSectionAdvicePattern = /(调整|判断|做法|方法|建议|解决|可以|应该|需要|先|再|步骤|原则|边界)/;
const implicitSectionScenePattern = /(家长|学生|同事|领导|孩子|老师|消息|任务|拜托|撒娇|委屈|情绪|状态|场景|问题)/;
const continuationOpeningPattern = /^(这些|这种|同时|也|还|而且|然后|后来|前面|刚开始|上面|这时候)/;
const maxInlineColorLength = 60;
const minInlineColorLength = 6;
const maxInlineColorRatio = 0.86;
const maxInlineColorSegmentsPerBlock = 1;
const maxInlineColorCharsPerBlock = 60;
const inlineColorScoreThreshold = 5;

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
  let sectionParagraphTexts: string[] = [];
  const hasExplicitSections = lines.some((line, index) => {
    if (index === 0 || markdownDividerPattern.test(line.text)) return false;
    const markdownHeading = getMarkdownHeading(line.text);
    return Boolean((markdownHeading && markdownHeading.level > 1) || isSubheadingLike(line));
  });

  const resetSectionStats = () => {
    sectionParagraphTexts = [];
  };

  lines.forEach((line, index) => {
    if (markdownDividerPattern.test(line.text)) {
      addDividerIfNeeded(blocks);
      resetSectionStats();
      return;
    }

    const markdownHeading = getMarkdownHeading(line.text);
    if (markdownHeading) {
      if (markdownHeading.level === 1) {
        if (hasTitle) addDividerIfNeeded(blocks);
        blocks.push(makeBlock(hasTitle ? "h2" : "h1", markdownHeading.text));
        hasTitle = true;
        resetSectionStats();
        return;
      }

      addDividerAfterTitleIfNeeded(blocks);
      addDividerIfNeeded(blocks);
      blocks.push(makeBlock(markdownHeading.level === 2 ? "h2" : "h3", markdownHeading.text));
      resetSectionStats();
      return;
    }

    const isTitle = !hasTitle && (index === 0 || isTitleLike(line.text));
    const isHeading = !isTitle && isSubheadingLike(line);

    if (isTitle) {
      blocks.push(makeBlock("h1", cleanPrefix(line.text)));
      hasTitle = true;
      resetSectionStats();
      return;
    }

    addDividerAfterTitleIfNeeded(blocks);

    if (isHeading) {
      addDividerIfNeeded(blocks);
      blocks.push(makeBlock("h2", cleanPrefix(line.text)));
      resetSectionStats();
      return;
    }

    if (shouldStartImplicitSection(blocks, hasExplicitSections, line, sectionParagraphTexts)) {
      addDividerIfNeeded(blocks);
      resetSectionStats();
    }

    splitIntoInfoBlocks(line.text).forEach((paragraph) => {
      blocks.push(makeBlock("p", paragraph, false, false, createRuleBasedSegments(paragraph, "p")));
    });
    sectionParagraphTexts.push(line.text);
  });

  if (!blocks.some((block) => block.type === "h1") && blocks[0]) {
    blocks[0] = { ...blocks[0], type: "h1", highlight: false, underline: false };
  }

  return applyRuleBasedEmphasis(compactDividers(blocks));
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

    if (block.type === "h2" || block.type === "h3") {
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
  const nonEmptyLines = rawLines.reduce<TextLine[]>((result, text, index) => {
    if (!text) return result;

    result.push({
      text,
      hasBlankBefore: index === 0 || rawLines[index - 1] === "",
      hasBlankAfter: index === rawLines.length - 1 || rawLines[index + 1] === "",
      nonEmptyIndex: result.length,
    });

    return result;
  }, []);

  const lines: TextLine[] = [];
  let paragraphLines: TextLine[] = [];

  const pushLine = (line: Omit<TextLine, "nonEmptyIndex">) => {
    lines.push({ ...line, nonEmptyIndex: lines.length });
  };

  const flushParagraph = () => {
    if (!paragraphLines.length) return;

    const firstLine = paragraphLines[0];
    const lastLine = paragraphLines[paragraphLines.length - 1];
    pushLine({
      text: joinSoftWrappedLines(paragraphLines.map((line) => line.text)),
      hasBlankBefore: firstLine.hasBlankBefore,
      hasBlankAfter: lastLine.hasBlankAfter,
    });
    paragraphLines = [];
  };

  nonEmptyLines.forEach((line) => {
    const isFirstEffectiveLine = lines.length === 0 && paragraphLines.length === 0;
    const shouldKeepAsOwnLine =
      isFirstEffectiveLine ||
      markdownDividerPattern.test(line.text) ||
      Boolean(getMarkdownHeading(line.text)) ||
      isSubheadingLike(line);

    if (shouldKeepAsOwnLine) {
      flushParagraph();
      pushLine(line);
      return;
    }

    paragraphLines.push(line);
    if (line.hasBlankAfter) flushParagraph();
  });

  flushParagraph();

  return lines;
}

function joinSoftWrappedLines(lines: string[]) {
  return lines.reduce((result, line) => {
    if (!result) return line;

    const previousChar = result[result.length - 1] ?? "";
    const nextChar = line[0] ?? "";
    const needsSpace = /[A-Za-z0-9)]/.test(previousChar) && /[A-Za-z0-9(]/.test(nextChar);

    return `${result}${needsSpace ? " " : ""}${line}`;
  }, "");
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

type TextRange = {
  start: number;
  end: number;
};

function splitIntoInfoBlocks(line: string): string[] {
  const units = getSentenceRanges(line).flatMap((range) => splitLongSentenceRange(line, range));
  if (!units.length) return [line].filter(Boolean);

  const blocks: TextRange[] = [];
  let current: TextRange | null = null;
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

function splitLongSentenceRange(line: string, range: TextRange): TextRange[] {
  const sentence = line.slice(range.start, range.end);
  if (getComparableTextLength(sentence) <= longSentenceSplitLength) return [range];

  const clauses = getRegexRanges(sentence, softClausePattern).map((clause) => ({
    start: range.start + clause.start,
    end: range.start + clause.end,
  }));

  return clauses.length > 1 ? clauses : [range];
}

function mergeShortTrailingBlock(line: string, blocks: TextRange[]) {
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

function isStandaloneInfoUnit(text: string) {
  const length = getComparableTextLength(text);
  if (length < 12) return false;

  return (
    scoreInlineColorCandidate(text, "red") >= inlineColorScoreThreshold ||
    scoreInlineColorCandidate(text, "blue") >= inlineColorScoreThreshold
  );
}

function getSentenceRanges(text: string): TextRange[] {
  const ranges = getRegexRanges(text, hardSentencePattern);
  return ranges.length ? ranges : trimTextRange(text, 0, text.length);
}

function getRegexRanges(text: string, pattern: RegExp): TextRange[] {
  const ranges: TextRange[] = [];
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text))) {
    const range = trimTextRange(text, match.index, match.index + match[0].length);
    ranges.push(...range);
  }

  return ranges;
}

function trimTextRange(text: string, start: number, end: number): TextRange[] {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && /\s/.test(text[nextStart])) nextStart += 1;
  while (nextEnd > nextStart && /\s/.test(text[nextEnd - 1])) nextEnd -= 1;

  return nextStart < nextEnd ? [{ start: nextStart, end: nextEnd }] : [];
}

function shouldStartImplicitSection(
  blocks: ContentBlock[],
  hasExplicitSections: boolean,
  line: TextLine,
  sectionParagraphTexts: string[],
) {
  if (hasExplicitSections) return false;
  if (!line.hasBlankBefore) return false;
  if (sectionParagraphTexts.length === 0) return false;
  if (blocks[blocks.length - 1]?.type === "hr") return false;

  const sectionTextLength = sectionParagraphTexts.reduce((total, text) => total + getComparableTextLength(text), 0);
  const hasEnoughContext =
    sectionParagraphTexts.length >= implicitSectionMinParagraphs || sectionTextLength >= implicitSectionMinChars;

  return hasEnoughContext && scoreImplicitSectionShift(line.text, sectionParagraphTexts) >= 4;
}

function scoreImplicitSectionShift(currentText: string, previousTexts: string[]) {
  const previousText = previousTexts.join("");
  let score = 0;

  if (implicitSectionOpeningPattern.test(currentText)) score += 4;
  if (implicitSectionAdvicePattern.test(currentText)) score += 2;
  if (implicitSectionScenePattern.test(previousText) && implicitSectionAdvicePattern.test(currentText)) score += 2;
  if (/^(\d+[、.．）)]|[一二三四五六七八九十]+[、.．])/.test(currentText)) score += 4;
  if (continuationOpeningPattern.test(currentText)) score -= 4;

  return score;
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
  const isFirstOrLast = index === 0 || index === total - 1;

  if (underlinePattern.test(sentence)) score += 4;
  if (inlineRedActionPattern.test(sentence)) score += 2;
  if (/(太多|过度|反而|否则|一旦|导致|失去|降低|变差|出错|失控)/.test(sentence)) score += 2;
  if (isFirstOrLast && total > 1) score += 1;
  if (sentence.length >= 8 && sentence.length <= 80) score += 1;
  if (sentence.length < 6 || sentence.length > 120) score -= 2;

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
    segments: cleanDraftSegments(block) ?? createRuleBasedSegments(block.text, block.type),
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
  const isWholeSingleSentenceBlock = isWholeSingleSentenceSegment(block.text, segmentText);

  if (segmentLength < minInlineColorLength || segmentLength > maxInlineColorLength) return false;
  if (getSentenceRanges(segmentText).length > 1) return false;
  if (blockLength > 0 && segmentLength / blockLength > maxInlineColorRatio && !isWholeSingleSentenceBlock) {
    return false;
  }
  if (coloredSegments >= maxInlineColorSegmentsPerBlock) return false;
  if (coloredChars + segmentLength > maxInlineColorCharsPerBlock) return false;

  return scoreInlineColorCandidate(segmentText, segment.color) >= inlineColorScoreThreshold;
}

function isWholeSingleSentenceSegment(blockText: string, segmentText: string) {
  return getSentenceRanges(blockText).length <= 1 && getComparableText(blockText) === getComparableText(segmentText);
}

function getComparableText(text: string) {
  return text.replace(/\s/g, "");
}

function getComparableTextLength(text: string) {
  return Array.from(getComparableText(text)).length;
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
    const underlineIndex = chooseBestIndexExcept(sentences, scoreUnderlineSentence, 4, -1);
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

type StyledRange = {
  start: number;
  end: number;
  color: InlineColor;
  score: number;
};

function createRuleBasedSegments(text: string, blockType: ContentBlock["type"]): TextSegment[] | undefined {
  if (blockType !== "p") return undefined;

  const selectedRange = chooseInlineColorRange(text);
  if (!selectedRange) return undefined;

  const segments: TextSegment[] = [];
  let cursor = 0;

  if (selectedRange.start > cursor) {
    segments.push({ text: text.slice(cursor, selectedRange.start) });
  }
  segments.push({ text: text.slice(selectedRange.start, selectedRange.end), bold: true, color: selectedRange.color });
  cursor = selectedRange.end;

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return normalizeTextSegments(segments);
}

function chooseInlineColorRange(text: string): StyledRange | undefined {
  const ranges = getInlineColorCandidateRanges(text)
    .flatMap((range) => {
      const candidateText = text.slice(range.start, range.end).trim();
      return (["red", "blue"] as InlineColor[]).map((color) => ({
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

function getInlineColorCandidateRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  const addRange = (range: TextRange) => {
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

function scoreInlineColorCandidate(text: string, color: InlineColor) {
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

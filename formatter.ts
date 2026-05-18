import type { ContentBlock, RenderConfig } from "./types";

export const IMAGE_CONFIG: RenderConfig = {
  markdown: "",
  themeMode: "",
  theme: "apple-notes",
  overHiddenMode: false,
  mdxMode: true,
  width: 880,
  height: 1172,
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

    const isTitle = !hasTitle && (index === 0 || isTitleLike(line.text));
    const isHeading = !isTitle && isSubheadingLike(line);

    if (isTitle) {
      blocks.push(makeBlock("h1", cleanPrefix(line.text)));
      hasTitle = true;
      return;
    }

    if (isHeading) {
      addDividerIfNeeded(blocks);
      blocks.push(makeBlock("h3", cleanPrefix(line.text)));
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

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "hr") return "---";

      let text = escapeInlineMarkdown(block.text);
      if (block.highlight) text = `<mark>${text}</mark>`;
      if (block.underline) {
        text = `<span style="${redUnderlineStyle}">${text}</span>`;
      }
      if (block.type === "h1") return `# ${text}`;
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
): ContentBlock {
  return {
    id: crypto.randomUUID(),
    type,
    text,
    highlight: type === "p" ? highlight : false,
    underline: type === "p" ? underline : false,
  };
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
  return line.replace(/^[-*]\s+/, "").trim();
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

function compactDividers(blocks: ContentBlock[]): ContentBlock[] {
  const compacted = blocks.filter((block, index, all) => {
    if (block.type !== "hr") return true;
    const previous = all[index - 1];
    const next = all[index + 1];
    return Boolean(previous && next && previous.type !== "hr" && next.type !== "hr");
  });

  return compacted.filter((block, index) => {
    if (block.type !== "hr") return true;
    return index > 0 && index < compacted.length - 1;
  });
}

function escapeInlineMarkdown(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

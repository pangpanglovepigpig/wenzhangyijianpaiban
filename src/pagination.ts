import type { ContentBlock, PageModel } from "./types";
import { CARD_HEIGHT, CARD_WIDTH, type ResolvedCardStyle } from "./cardStyle";
import { createId } from "./uuid";
import { splitTextGraphemes } from "./textUnits";

export const PAGE_WIDTH = CARD_WIDTH;
export const PAGE_HEIGHT = CARD_HEIGHT;

// Page fragments never change the editable source blocks. Measure with the
// same canvas/font as the export, including margins and inline styles.
export function fitBlocksForPages(
  blocks: ContentBlock[],
  measure: (block: ContentBlock) => number,
  contentHeight: number,
): ContentBlock[] {
  return blocks.flatMap((block, index) => {
    if (block.type === "hr") return [block];
    let reserved = 0;
    if (block.type === "p") {
      let previous = index - 1;
      while (previous >= 0 && blocks[previous].type !== "p") {
        reserved += measure(blocks[previous]);
        previous -= 1;
      }
    }
    const firstLimit = Math.max(contentHeight / 2, contentHeight - reserved);
    if (measure(block) <= firstLimit) return [block];
    const units = splitTextGraphemes(block.text);
    const fragments: ContentBlock[] = [];
    let start = 0, offset = 0;
    while (start < units.length) {
      const limit = fragments.length ? contentHeight : firstLimit;
      let low = 1, high = units.length - start, fit = 0;
      while (low <= high) {
        const count = Math.floor((low + high) / 2);
        const candidate = sliceBlock(block, offset, offset + units.slice(start, start + count).join("").length);
        if (measure(candidate) <= limit) { fit = count; low = count + 1; }
        else high = count - 1;
      }
      if (!fit) throw new Error("文字尺寸超过页面可用高度，请减小字号。");
      // A closing quote/punctuation belongs with the previous character.
      if (start + fit < units.length && /^[，。！？、；：”’」』）)\]}]/.test(units[start + fit]) && fit > 1) fit -= 1;
      const end = offset + units.slice(start, start + fit).join("").length;
      fragments.push({ ...sliceBlock(block, offset, end), id: `${block.id}-page-${fragments.length}` });
      offset = end;
      start += fit;
    }
    return fragments;
  });
}

function sliceBlock(block: ContentBlock, start: number, end: number): ContentBlock {
  let offset = 0;
  const segments = block.segments?.flatMap(segment => {
    const from = Math.max(0, start - offset), to = Math.min(segment.text.length, end - offset);
    offset += segment.text.length;
    return from < to ? [{ ...segment, text: segment.text.slice(from, to) }] : [];
  });
  return { ...block, text: block.text.slice(start, end), segments };
}


export function paginateBlocks(
  blocks: ContentBlock[],
  measuredHeights: Map<string, number>,
  cardStyle: ResolvedCardStyle,
): PageModel[] {
  const pages: PageModel[] = [];
  let current: ContentBlock[] = [];
  let used = 0;
  let index = 0;

  const flushPage = () => {
    const pageBlocks = trimTrailingDivider(current);
    if (pageBlocks.length) pages.push({ id: createId(), blocks: pageBlocks });
    current = [];
    used = 0;
  };

  while (index < blocks.length) {
    const unit = getKeepTogetherUnit(blocks, index, measuredHeights, cardStyle.contentHeight);
    const unitHeight = unit.reduce(
      (total, block) => total + (measuredHeights.get(block.id) ?? fallbackHeight(block)),
      0,
    );

    if (unit.length > 1) {
      if (current.length && used + unitHeight > cardStyle.contentHeight) flushPage();
      current.push(...unit);
      used += unitHeight;
      index += unit.length;
      continue;
    }

    const block = unit[0];
    const height = unitHeight;
    if (current.length && used + height > cardStyle.contentHeight) {
      const trailingDivider = current[current.length - 1]?.type === "hr" ? current.pop() ?? null : null;
      flushPage();
      if (trailingDivider) {
        current.push(trailingDivider);
        used += measuredHeights.get(trailingDivider.id) ?? fallbackHeight(trailingDivider);
      }
    }

    current.push(block);
    used += height;
    index += 1;
  }

  if (current.length > 0) {
    flushPage();
  }

  return pages.length ? pages : [{ id: createId(), blocks: [] }];
}

function getKeepTogetherUnit(
  blocks: ContentBlock[],
  index: number,
  measuredHeights: Map<string, number>,
  contentHeight: number,
) {
  const block = blocks[index];
  const next = blocks[index + 1];
  const afterNext = blocks[index + 2];
  const candidateLengths: number[] = [];

  if (/^h[123]$/.test(block.type)) {
    let end = index + 1;
    while (end < blocks.length && blocks[end].type !== "p") end += 1;
    if (end < blocks.length) candidateLengths.push(end - index + 1);
  }

  if (block.type === "hr" && (next?.type === "h2" || next?.type === "h3") && afterNext?.type === "p") {
    candidateLengths.push(3);
  }
  if (block.type === "hr" && next) candidateLengths.push(2);
  if ((block.type === "h2" || block.type === "h3") && next?.type === "p") candidateLengths.push(2);

  for (const length of candidateLengths) {
    const candidate = blocks.slice(index, index + length);
    const height = candidate.reduce(
      (total, item) => total + (measuredHeights.get(item.id) ?? fallbackHeight(item)),
      0,
    );
    if (height <= contentHeight) return candidate;
  }

  return [block];
}

function trimTrailingDivider(blocks: ContentBlock[]) {
  let next = [...blocks];
  while (next[next.length - 1]?.type === "hr") {
    next = next.slice(0, -1);
  }
  return next;
}

function fallbackHeight(block: ContentBlock) {
  if (block.type === "hr") return 29;
  if (block.type === "h1") return 47;
  if (block.type === "h2") return 43;
  if (block.type === "h3") return 35;
  return 39;
}

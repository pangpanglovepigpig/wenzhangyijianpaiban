import type { ContentBlock, PageModel } from "./types";
import { CARD_HEIGHT, CARD_WIDTH, type ResolvedCardStyle } from "./cardStyle";
import { createId } from "./uuid";

export const PAGE_WIDTH = CARD_WIDTH;
export const PAGE_HEIGHT = CARD_HEIGHT;

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

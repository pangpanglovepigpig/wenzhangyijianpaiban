import type { ContentBlock, PageModel } from "./types";
import { CARD_HEIGHT, CARD_WIDTH, type ResolvedCardStyle } from "./cardStyle";

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

  blocks.forEach((block) => {
    const height = measuredHeights.get(block.id) ?? fallbackHeight(block);
    const startsPage = current.length === 0;

    if (!startsPage && used + height > cardStyle.contentHeight) {
      const trailingDivider = current[current.length - 1]?.type === "hr" ? current[current.length - 1] : null;
      const previousBlocks = trailingDivider ? current.slice(0, -1) : current;
      if (previousBlocks.length > 0) {
        pages.push({ id: crypto.randomUUID(), blocks: previousBlocks });
      }
      current = trailingDivider ? [trailingDivider, block] : [block];
      used = (trailingDivider ? measuredHeights.get(trailingDivider.id) ?? fallbackHeight(trailingDivider) : 0) + height;
      return;
    }

    current.push(block);
    used += height;
  });

  if (current.length > 0) {
    pages.push({ id: crypto.randomUUID(), blocks: trimTrailingDivider(current) });
  }

  return pages.length ? pages : [{ id: crypto.randomUUID(), blocks: [] }];
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

import type { ContentBlock, PageModel } from "./types";

export const PAGE_WIDTH = 440;
export const PAGE_HEIGHT = 586;
export const PAGE_CONTENT_HEIGHT = 476;

export function paginateBlocks(blocks: ContentBlock[], measuredHeights: Map<string, number>): PageModel[] {
  const pages: PageModel[] = [];
  let current: ContentBlock[] = [];
  let used = 0;

  blocks.forEach((block) => {
    const height = measuredHeights.get(block.id) ?? fallbackHeight(block);
    const startsPage = current.length === 0;

    if (!startsPage && used + height > PAGE_CONTENT_HEIGHT) {
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
  if (block.type === "h1") return 48;
  if (block.type === "h3") return 36;
  return 40;
}

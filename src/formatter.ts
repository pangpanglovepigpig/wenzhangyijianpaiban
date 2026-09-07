import type { ContentBlock, RenderConfig, TextSegment } from "./types";
import { CARD_HEIGHT, CARD_WIDTH } from "./cardStyle";
import { createId } from "./uuid";
import {
  createBlocksFromText as createArticleBlocks,
  formatArticle as formatLocalArticle,
  makeBlock as makeArticleBlock,
} from "../shared/articleStructure.js";

export { blocksToMarkdown, sampleArticle, normalizeTextSegments, textFromSegments } from "../shared/articleStructure.js";

export const IMAGE_CONFIG: RenderConfig = {
  markdown: "", themeMode: "", theme: "apple-notes", overHiddenMode: false,
  mdxMode: true, width: CARD_WIDTH, height: CARD_HEIGHT, splitMode: "autoSplit",
  background: "", shadowUrl: "", weChatMode: false,
};

export function createBlocksFromText(input: string): ContentBlock[] {
  return createArticleBlocks(input).map(withBlockId);
}

export function formatArticle(input: string): { blocks: ContentBlock[]; notice?: string } {
  const result = formatLocalArticle(input);
  return { ...result, blocks: result.blocks.map(withBlockId) };
}

export function makeBlock(
  type: ContentBlock["type"], text = "", highlight = false, underline = false, segments?: TextSegment[],
): ContentBlock {
  return { ...makeArticleBlock(type, text, highlight, underline, segments), id: createId() };
}

export function withBlockId(block: Omit<ContentBlock, "id">): ContentBlock {
  return { ...block, ...makeBlock(block.type, block.text, block.highlight, block.underline, block.segments) };
}

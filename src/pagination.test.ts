import { describe, expect, test } from "vitest";
import { resolveCardStyle } from "./cardStyle";
import { paginateBlocks } from "./pagination";
import type { ContentBlock } from "./types";
import { applyStructureSuggestions, buildSentenceIndex, createBlocksFromText } from "../shared/articleStructure.js";
import { huizhouArticle, huizhouStructure } from "./testFixtures";

describe("paginateBlocks", () => {
  test.each(["apple-notes", "rouge-red"] as const)("does not orphan Huizhou dividers or h3s in %s", (themeId) => {
    const style = resolveCardStyle({ themeId, fontFamilyId: "system", baseFontSize: 16.5 });
    const source = huizhouArticle.replace(/\n\n/g, "\n");
    const sentences = buildSentenceIndex(source);
    const suggestions = huizhouStructure.map(({ quote, action }) => ({ sentenceId: sentences.find((s) => s.text === quote)!.sentenceId, action }));
    const blocks = applyStructureSuggestions(createBlocksFromText(source), suggestions, source)
      .map((block, index) => ({ ...block, id: String(index) }));
    const heights = new Map(blocks.map((block) => [block.id, block.type === "hr" ? 29 : 20 + Math.ceil(block.text.length / 22) * 25]));
    const pages = paginateBlocks(blocks, heights, style);
    expect(pages.flatMap((page) => page.blocks).map((block) => block.id)).toEqual(blocks.map((block) => block.id));
    for (const page of pages) {
      expect(["hr", "h3"]).not.toContain(page.blocks[page.blocks.length - 1]?.type);
      page.blocks.forEach((block, index) => {
        if (block.type === "h3") {
          expect(page.blocks[index - 1]?.type).toBe("hr");
          expect(page.blocks[index + 1]?.type).toBe("p");
        }
      });
    }
  });
  test("moves a divider, subtitle, and first paragraph together instead of orphaning the subtitle", () => {
    const style = resolveCardStyle({ themeId: "apple-notes", fontFamilyId: "system", baseFontSize: 16.5 });
    const blocks = [
      makeBlock("intro", "p", "前一页正文"),
      makeBlock("divider", "hr"),
      makeBlock("subtitle", "h3", "新的部分"),
      makeBlock("body", "p", "新部分的第一段正文"),
    ];
    const heights = new Map([
      ["intro", style.contentHeight - 60],
      ["divider", 20],
      ["subtitle", 30],
      ["body", 40],
    ]);

    const pages = paginateBlocks(blocks, heights, style);

    expect(pages.map((page) => page.blocks.map((block) => block.id))).toEqual([
      ["intro"],
      ["divider", "subtitle", "body"],
    ]);
    expect(
      pages.every((page) => {
        const last = page.blocks[page.blocks.length - 1];
        return last?.type !== "hr" && last?.type !== "h3";
      }),
    ).toBe(true);
  });

  test("keeps an AI section-only divider with the paragraph that follows it", () => {
    const style = resolveCardStyle({ themeId: "apple-notes", fontFamilyId: "system", baseFontSize: 16.5 });
    const blocks = [
      makeBlock("intro", "p", "前一页正文"),
      makeBlock("divider", "hr"),
      makeBlock("closing", "p", "结尾收束段正文"),
    ];
    const heights = new Map([
      ["intro", style.contentHeight - 30],
      ["divider", 20],
      ["closing", 35],
    ]);

    const pages = paginateBlocks(blocks, heights, style);

    expect(pages.map((page) => page.blocks.map((block) => block.id))).toEqual([
      ["intro"],
      ["divider", "closing"],
    ]);
  });
});

function makeBlock(id: string, type: ContentBlock["type"], text = ""): ContentBlock {
  return { id, type, text, highlight: false, underline: false };
}

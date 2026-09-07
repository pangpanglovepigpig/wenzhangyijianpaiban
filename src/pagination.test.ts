import { describe, expect, test } from "vitest";
import { resolveCardStyle } from "./cardStyle";
import { paginateBlocks } from "./pagination";
import type { ContentBlock } from "./types";
import { createBlocksFromText } from "../shared/articleStructure.js";
import { huizhouArticle } from "./testFixtures";

describe("paginateBlocks", () => {
  test.each(["apple-notes", "rouge-red"] as const)("does not orphan Huizhou dividers or h3s in %s", (themeId) => {
    const style = resolveCardStyle({ themeId, fontFamilyId: "system", baseFontSize: 16.5 });
    const source = huizhouArticle.replace(/\n\n/g, "\n");
    const blocks = createBlocksFromText(source)
      .map((block, index) => ({ ...block, id: String(index) }));
    const heights = new Map(blocks.map((block) => [block.id, block.type === "hr" ? 29 : 20 + Math.ceil(block.text.length / 22) * 25]));
    const pages = paginateBlocks(blocks, heights, style);
    expect(pages.flatMap((page) => page.blocks).map((block) => block.id)).toEqual(blocks.map((block) => block.id));
    for (const page of pages) {
      expect(["hr", "h3"]).not.toContain(page.blocks[page.blocks.length - 1]?.type);
      page.blocks.forEach((block, index) => {
        if (block.type === "h3" && block !== blocks[0]) {
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

  test("keeps a section-only divider with the paragraph that follows it", () => {
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

import { fitBlocksForPages } from "./pagination";

describe("oversized page fragments", () => {
  const measure = (block: ContentBlock) => block.type === "hr" ? 10 : 10 + Array.from(block.text).length * 2;
  test("fits a very long paragraph without changing editable text or inline styles", () => {
    const text = "这是没有句号的长段，".repeat(30);
    const original: ContentBlock = { ...makeBlock("body", "p", text), segments: [
      { text: text.slice(0, 90), color: "red" }, { text: text.slice(90) },
    ] };
    const before = JSON.stringify(original);
    const fitted = fitBlocksForPages([original], measure, 120);
    expect(fitted.length).toBeGreaterThan(1);
    expect(fitted.map(b => b.text).join("")).toBe(text);
    expect(fitted.every(b => measure(b) <= 120)).toBe(true);
    expect(fitted.flatMap(b => b.segments ?? []).filter(s => s.color).map(s => s.text).join("")).toBe(text.slice(0, 90));
    expect(fitted.every(b => b.segments?.map(s => s.text).join("") === b.text)).toBe(true);
    expect(JSON.stringify(original)).toBe(before);
  });
  test("reserves room for a heading and its first body fragment", () => {
    const original = [makeBlock("title", "h1", "文章标题"), makeBlock("hr", "hr"), makeBlock("body", "p", "内容".repeat(80))];
    const fitted = fitBlocksForPages(original, measure, 120);
    const style = { ...resolveCardStyle({ themeId: "apple-notes", fontFamilyId: "system", baseFontSize: 16.5 }), contentHeight: 120 };
    const pages = paginateBlocks(fitted, new Map(fitted.map(b => [b.id, measure(b)])), style);
    expect(pages[0].blocks.map(b => b.type)).toEqual(["h1", "hr", "p"]);
    expect(pages.every(page => page.blocks.reduce((sum, b) => sum + measure(b), 0) <= 120)).toBe(true);
  });
  test("does not split joined emoji or accents at fragment boundaries", () => {
    const text = "👨‍👩‍👧‍👦😀é".repeat(15);
    const fitted = fitBlocksForPages([makeBlock("emoji", "p", text)], measure, 55);
    expect(fitted.map(b => b.text).join("")).toBe(text);
    expect(fitted.every(b => !/^[\u200D\p{Mark}]/u.test(b.text) && !b.text.endsWith("\u200D"))).toBe(true);
    expect(fitted.map(b => (b.text.match(/👨‍👩‍👧‍👦/g) ?? []).length).reduce((a,b) => a+b, 0)).toBe(15);
  });
});

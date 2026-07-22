import { afterEach, describe, expect, test, vi } from "vitest";
import {
  FONT_OPTIONS,
  THEME_OPTIONS,
  resolveCardStyle,
  type TextRoleStyle,
} from "./cardStyle";
import { measureBlocksForPng } from "./exportImage";
import { paginateBlocks } from "./pagination";
import type { ContentBlock, ThemeId } from "./types";

const EXPECTED_THEME_IDS: ThemeId[] = [
  "apple-notes",
  "bytedance",
  "alibaba",
  "turquoise-green",
  "rouge-red",
  "taro-purple",
  "ink-scroll",
  "cream-coffee",
];

const EXPECTED_THEME_LABELS = [
  "苹果备忘录",
  "字节范",
  "阿里橙",
  "松石绿",
  "胭脂红",
  "香芋紫",
  "墨青书卷",
  "奶油咖杂志",
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("card themes", () => {
  test("exposes eight themes in the approved order with unique ids and export names", () => {
    expect(THEME_OPTIONS.map((theme) => theme.id)).toEqual(EXPECTED_THEME_IDS);
    expect(THEME_OPTIONS.map((theme) => theme.label)).toEqual(EXPECTED_THEME_LABELS);
    expect(new Set(THEME_OPTIONS.map((theme) => theme.id)).size).toBe(8);
    expect(new Set(THEME_OPTIONS.map((theme) => theme.exportName)).size).toBe(8);
  });

  test.each([14, 16.5, 20])("resolves valid dimensions and typography at %spx", (baseFontSize) => {
    EXPECTED_THEME_IDS.forEach((themeId) => {
      const style = resolveCardStyle({ themeId, fontFamilyId: "system", baseFontSize });

      expect(style.settings.themeId).toBe(themeId);
      expect(style.width).toBe(440);
      expect(style.height).toBe(586);
      expect(style.contentWidth).toBeGreaterThan(280);
      expect(style.contentHeight).toBeGreaterThan(420);
      [style.title, style.heading, style.subtitle, style.paragraph].forEach((role) => {
        expect(role.fontSize).toBeGreaterThanOrEqual(14);
        expect(role.lineHeight).toBeGreaterThan(role.fontSize);
        expect(role.marginBottom).toBeGreaterThanOrEqual(0);
      });
    });
  });

  test("gives every new theme a distinct treatment for h1, h2, and h3", () => {
    EXPECTED_THEME_IDS.slice(3).forEach((themeId) => {
      const style = resolveCardStyle({ themeId, fontFamilyId: "system", baseFontSize: 16.5 });
      expect(hasDecoration(style.title)).toBe(true);
      expect(hasDecoration(style.heading)).toBe(true);
      expect(hasDecoration(style.subtitle)).toBe(true);
      expect(new Set([roleSignature(style.title), roleSignature(style.heading), roleSignature(style.subtitle)]).size).toBe(3);
    });
  });

  test.each([14, 20])("keeps long headings measurable and paginated at %spx", (baseFontSize) => {
    installFakeCanvas();
    const blocks: ContentBlock[] = [
      makeTextBlock("title", "h1", "这是一个较长的一级标题用于检查自动换行和标题装饰边界"),
      makeTextBlock("intro", "p", "好的排版会让信息层次更清楚，也让读者愿意继续阅读后面的内容。"),
      makeTextBlock("heading", "h2", "这是一个较长的二级标题用于检查标签容器"),
      makeTextBlock("body", "p", "每一页只讲一件事，段落之间保留呼吸感，并确保分页不会截断文字。"),
      makeTextBlock("subtitle", "h3", "这是一个较长的三级标题用于检查信息卡边界"),
      makeTextBlock("ending", "p", "重要结论要醒目，但不要让所有内容都变成重点。"),
    ];

    EXPECTED_THEME_IDS.forEach((themeId) => {
      const style = resolveCardStyle({ themeId, fontFamilyId: "system", baseFontSize });
      const measured = measureBlocksForPng(blocks, style);
      const pages = paginateBlocks(blocks, measured, style);

      blocks.forEach((block) => {
        const height = measured.get(block.id);
        expect(height).toBeDefined();
        expect(height).toBeGreaterThan(0);
        expect(height).toBeLessThan(style.contentHeight);
      });
      expect(pages.flatMap((page) => page.blocks.map((block) => block.id))).toEqual(
        blocks.map((block) => block.id),
      );
      pages.forEach((page) => {
        const usedHeight = page.blocks.reduce((total, block) => total + (measured.get(block.id) ?? 0), 0);
        expect(usedHeight).toBeLessThanOrEqual(style.contentHeight);
      });
    });
  });

  test("uses the selected font family while measuring every text role", () => {
    const assignedFonts: string[] = [];
    installFakeCanvas(assignedFonts);

    const blocks: ContentBlock[] = (["h1", "h2", "h3", "p"] as const).map((type) => ({
      id: type,
      type,
      text: "字体",
      highlight: false,
      underline: false,
    }));

    FONT_OPTIONS.forEach((font) => {
      assignedFonts.length = 0;
      const style = resolveCardStyle({
        themeId: "cream-coffee",
        fontFamilyId: font.id,
        baseFontSize: 16.5,
      });

      measureBlocksForPng(blocks, style);
      expect(assignedFonts.length).toBeGreaterThanOrEqual(blocks.length);
      expect(assignedFonts.every((assigned) => assigned.endsWith(font.canvasFamily))).toBe(true);
    });
  });
});

function hasDecoration(role: TextRoleStyle) {
  return (
    role.backgroundColor !== "transparent" ||
    role.borderLeftWidth > 0 ||
    role.borderBottomWidth > 0 ||
    role.paddingTop > 0 ||
    role.paddingRight > 0 ||
    role.paddingBottom > 0 ||
    role.paddingLeft > 0
  );
}

function roleSignature(role: TextRoleStyle) {
  return JSON.stringify({
    backgroundColor: role.backgroundColor,
    borderLeftWidth: role.borderLeftWidth,
    borderBottomWidth: role.borderBottomWidth,
    paddingTop: role.paddingTop,
    paddingRight: role.paddingRight,
    paddingBottom: role.paddingBottom,
    paddingLeft: role.paddingLeft,
  });
}

function makeTextBlock(id: string, type: ContentBlock["type"], text: string): ContentBlock {
  return { id, type, text, highlight: false, underline: false };
}

function installFakeCanvas(assignedFonts: string[] = []) {
  let currentFont = "";
  const context = {
    get font() {
      return currentFont;
    },
    set font(value: string) {
      currentFont = value;
      assignedFonts.push(value);
    },
    measureText(text: string) {
      const fontSize = Number(currentFont.match(/([\d.]+)px/)?.[1] ?? 16);
      return { width: Array.from(text).length * fontSize };
    },
  } as unknown as CanvasRenderingContext2D;

  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => context }),
  });
}

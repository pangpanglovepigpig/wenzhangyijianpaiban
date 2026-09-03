import { describe, expect, test } from "vitest";
import { applyStructureSuggestions, buildSentenceIndex, createBlocksFromText, draftPreservesSource, makeBlock, stabilizeAiDraftBlocks } from "./articleStructure.js";
import { huizhouArticle, huizhouStructure, shenzhenArticle, xiaomianArticle } from "../src/testFixtures";
import { createSourcePreservingDraft } from "../api/generate-draft.js";

function suggestions(source: string, quotes = huizhouStructure) {
  const sentences = buildSentenceIndex(source);
  return quotes.map(({ quote, action }) => {
    const sentence = sentences.find((item) => item.text === quote);
    expect(sentence, quote).toBeDefined();
    return { sentenceId: sentence!.sentenceId, action };
  });
}
function signature(blocks: ReturnType<typeof createBlocksFromText>) {
  let offset = 0;
  return blocks.map(({ type, text }) => {
    const start = offset;
    if (type !== "hr") offset += text.replace(/\s/g, "").length;
    return { type, start, text };
  }).filter((item) => item.type === "h3");
}
const paragraphs = huizhouArticle.split("\n\n");
const variants = [
  ["blank", huizhouArticle],
  ["single", paragraphs.join("\n")],
  ["continuous", paragraphs[0] + "\n" + paragraphs.slice(1).join("")],
  ["soft-wrapped", paragraphs[0] + "\n" + paragraphs.slice(1).map((p) => p.match(/.{1,17}/gu)!.join("\n")).join("\n")],
];

describe("shared sentence-position structure", () => {
  const expectedIndex = buildSentenceIndex(huizhouArticle);
  const reference = applyStructureSuggestions(createBlocksFromText(huizhouArticle), suggestions(huizhouArticle), huizhouArticle);
  test.each(variants)("keeps Huizhou suggestions at identical source positions: %s", (_label, source) => {
    const index = buildSentenceIndex(source);
    expect(index.map(({ sentenceId, start, end }) => ({ sentenceId, start, end })))
      .toEqual(expectedIndex.map(({ sentenceId, start, end }) => ({ sentenceId, start, end })));
    const base = createBlocksFromText(source);
    expect(createSourcePreservingDraft(source).blocks).toEqual(base);
    const stats = { accepted: 0, rejected: 0, reasons: {} };
    const structured = applyStructureSuggestions(base, suggestions(huizhouArticle), source, stats);
    expect(stats.rejected).toBe(0);
    expect(signature(structured)).toEqual(signature(reference));
    expect(draftPreservesSource(structured, source)).toBe(true);
    expect(structured.filter((b) => b.highlight).length).toBeLessThanOrEqual(3);
    expect(structured.filter((b) => b.underline).length).toBeLessThanOrEqual(3);
    const stabilized = stabilizeAiDraftBlocks(structured, source);
    expect(stabilized.map(({ type, text }) => ({ type, text })))
      .toEqual(structured.map(({ type, text }) => ({ type, text })));
  });

  test("does not split a quoted fragment or a semicolon clause into a heading", () => {
    const source = '### 标题\n他说：“先停一下。”也别只背素材。比如把“先想一想。再开始说。”作为提示；仍要讲清自己的方法。后面继续解释。';
    const index = buildSentenceIndex(source);
    expect(index.slice(1).map((s) => s.text)).toEqual([
      '他说：“先停一下。”', "也别只背素材。", '比如把“先想一想。再开始说。”作为提示；仍要讲清自己的方法。', "后面继续解释。",
    ]);
    expect(index.some((s) => s.text === "再开始说。")).toBe(false);
    expect(index.some((s) => s.text.startsWith("仍要"))).toBe(false);
  });

  test("local structural headings also use full sentences, not semicolon fragments", () => {
    const source = "### 完整标题\n\n首先要明确方向；再按步骤完成准备。后面解释具体安排。";
    const blocks = createBlocksFromText(source);
    expect(signature(blocks).map((s) => s.text)).toEqual(["首先要明确方向；再按步骤完成准备。"]);
    expect(draftPreservesSource(blocks, source)).toBe(true);
  });

  test("allows exactly one occurrence of a repeated sentence to be selected by ID", () => {
    const source = "### 重复测试\n也别只背素材。这里继续解释第一个主题。也别只背素材。这里继续解释第二个主题。";
    const repeated = buildSentenceIndex(source).filter((s) => s.text === "也别只背素材。");
    const structured = applyStructureSuggestions(createBlocksFromText(source), [{ sentenceId: repeated[1].sentenceId, action: "h3" }], source);
    expect(signature(structured)).toEqual([{ type: "h3", start: repeated[1].start, text: "也别只背素材。" }]);
    expect(draftPreservesSource(structured, source)).toBe(true);
  });

  test("rejects an adjacent structure item rather than leaving a heading without body", () => {
    const source = "### 相邻结构\n建立清楚的方法。也别只背素材。这里继续解释具体做法。";
    const index = buildSentenceIndex(source);
    const stats = { accepted: 0, rejected: 0, reasons: {} };
    const structured = applyStructureSuggestions(createBlocksFromText(source), [
      { sentenceId: index[1].sentenceId, action: "h3" },
      { sentenceId: index[2].sentenceId, action: "h3" },
    ], source, stats);
    expect(signature(structured).map((s) => s.text)).toEqual(["建立清楚的方法。"]);
    expect(stats.reasons).toEqual({ adjacent_structure: 1 });
    expect(draftPreservesSource(structured, source)).toBe(true);
  });

  test("keeps valid suggestions when IDs, actions, partial quotes and questions are invalid", () => {
    const source = '### 安全测试\n先解释一点背景。你真的想好了吗？也别只背素材。这里展开具体说明。';
    const index = buildSentenceIndex(source);
    const stats = { accepted: 0, rejected: 0, reasons: {} };
    const structured = applyStructureSuggestions(createBlocksFromText(source), [
      null, { sentenceId: "s9999", action: "h3" }, { sentenceId: "s1", action: "h3" },
      { sentenceId: index[2].sentenceId, action: "h3" },
      { quote: "背景。你真的", action: "h3" },
      { sentenceId: index[3].sentenceId, action: "h2" },
      { sentenceId: index[3].sentenceId, action: "h3" },
      { sentenceId: index[3].sentenceId, action: "h3" },
    ], source, stats);
    expect(signature(structured).map((s) => s.text)).toEqual(["也别只背素材。"]);
    expect(stats).toMatchObject({ accepted: 1, rejected: 7 });
    expect(draftPreservesSource(structured, source)).toBe(true);
    expect(stabilizeAiDraftBlocks(structured, source)).toEqual(structured);
  });

  test("keeps manual headings/dividers and does not revoke other AI titles beside a short local heading", () => {
    const source = "### 主标题\n\n发布前检查\n\n正文没有任何新的修改。也别只背素材。这里继续解释具体行动。\n\n---\n\n### 手工标题\n\n这是最后正文。";
    const index = buildSentenceIndex(source);
    const base = createBlocksFromText(source);
    const target = index.find((s) => s.text === "也别只背素材。")!;
    const structured = applyStructureSuggestions(base, [{ sentenceId: target.sentenceId, action: "h3" }], source);
    expect(createSourcePreservingDraft(source).blocks).toEqual(base);
    expect(stabilizeAiDraftBlocks(structured, source)).toEqual(structured);
    expect(structured.some((b) => b.type === "h2" && b.text === "发布前检查")).toBe(true);
    expect(signature(structured).map((s) => s.text)).toEqual(["也别只背素材。", "手工标题"]);
  });

  test("rejects a forged partial title independently in the browser", () => {
    const source = "### 主标题\n这里先解释原有的背景。也别只背素材。这里继续解释具体方法。";
    const base = createBlocksFromText(source);
    const target = buildSentenceIndex(source).find((s) => s.text === "也别只背素材。")!;
    const valid = applyStructureSuggestions(base, [{ sentenceId: target.sentenceId, action: "h3" }], source);
    const ai = valid.flatMap((block) => block.text === "这里先解释原有的背景。"
      ? [makeBlock("h3", "这里先解释"), makeBlock("p", "原有的背景。")] : [block]);
    expect(stabilizeAiDraftBlocks(ai, source).map(({ type, text }) => ({ type, text })))
      .toEqual(valid.map(({ type, text }) => ({ type, text })));
  });

  test.each([shenzhenArticle, xiaomianArticle])("shares fallback exactly for previous articles", (source) => {
    expect(createSourcePreservingDraft(source).blocks).toEqual(createBlocksFromText(source));
    expect(draftPreservesSource(createBlocksFromText(source), source)).toBe(true);
  });

  test("preserves astral characters and spaces when splitting source ranges", () => {
    const source = "### 标题\n前文有 emoji 😀 和 English words。也别只背素材。这里展开后续内容。";
    const target = buildSentenceIndex(source).find((s) => s.text === "也别只背素材。")!;
    const blocks = applyStructureSuggestions(createBlocksFromText(source), [{ sentenceId: target.sentenceId, action: "h3" }], source);
    expect(draftPreservesSource(blocks, source)).toBe(true);
    expect(signature(blocks).map((s) => s.text)).toEqual(["也别只背素材。"]);
  });
});

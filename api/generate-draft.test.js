import { describe, expect, test } from "vitest";
import { createBlocksFromText } from "../src/formatter";
import { shenzhenArticle, shenzhenHeadings } from "../src/testFixtures";
import { createSourcePreservingDraft } from "./generate-draft";

describe("source-preserving API fallback", () => {
  test("matches the local formatter for markdown titles, structural headings, and advice pivots", () => {
    const article = `### 城市选择怎么判断？

前面先交代城市选择的背景和个人条件，这一段保持连续论述，不应该因为空行本身就被切成很多部分。

先看你真正重视的生活条件。这里继续解释家庭距离、通勤、岗位数量和职业成长之间的取舍，也补充预算、体力、准备周期和跨城安排等现实问题，让这一部分拥有足够完整的上下文，再进入后面的行动建议。

如果你现在还拿不准，我建议先用一个月做试主攻，再根据复习结果和生活接受度决定是否继续。`;

    const localBlocks = createBlocksFromText(article).map(({ type, text }) => ({ type, text }));
    const fallbackBlocks = createSourcePreservingDraft(article).blocks.map(({ type, text }) => ({ type, text }));

    expect(fallbackBlocks).toEqual(localBlocks);
    expect(fallbackBlocks.slice(0, 2)).toEqual([
      { type: "h1", text: "城市选择怎么判断？" },
      { type: "hr", text: "" },
    ]);
    expect(fallbackBlocks.some((block) => block.type === "h3" && block.text === "先看你真正重视的生活条件。")).toBe(true);
  });

  test("keeps the Shenzhen fallback structure synchronized with the local formatter", () => {
    const localBlocks = createBlocksFromText(shenzhenArticle).map(({ type, text }) => ({ type, text }));
    const fallbackBlocks = createSourcePreservingDraft(shenzhenArticle).blocks.map(({ type, text }) => ({ type, text }));

    expect(fallbackBlocks).toEqual(localBlocks);
    expect(fallbackBlocks.filter((block) => block.type === "hr")).toHaveLength(7);
    expect(fallbackBlocks.filter((block) => block.type === "h3").map((block) => block.text)).toEqual(shenzhenHeadings);
  });
});

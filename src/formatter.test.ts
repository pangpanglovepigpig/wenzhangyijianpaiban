import { describe, expect, test } from "vitest";
import { createBlocksFromText } from "./formatter";

function types(blocks: ReturnType<typeof createBlocksFromText>) {
  return blocks.map((block) => block.type);
}

function hrCount(blocks: ReturnType<typeof createBlocksFromText>) {
  return blocks.filter((block) => block.type === "hr").length;
}

function paragraphText(blocks: ReturnType<typeof createBlocksFromText>) {
  return blocks
    .filter((block) => block.type === "p")
    .map((block) => block.text)
    .join("");
}

describe("createBlocksFromText", () => {
  test("keeps the first effective line as title and adds a divider after it", () => {
    const blocks = createBlocksFromText(`我的文章标题

第一段内容，说明这是一篇普通文章。`);

    expect(blocks[0]).toMatchObject({ type: "h1", text: "我的文章标题" });
    expect(blocks[1]).toMatchObject({ type: "hr" });
    expect(hrCount(blocks)).toBe(1);
  });

  test("does not add dividers between pieces split from one natural paragraph", () => {
    const blocks = createBlocksFromText(`日常观察

第一句内容很长，用来模拟正文的第一部分。第二句继续补充，没有开启新板块。第三句仍然是同一个自然段，不应该被分隔线切开。第四句只是继续解释前面的意思，不是新的标题。第五句收束这个自然段，保持连贯阅读。`);

    expect(hrCount(blocks)).toBe(1);
    expect(types(blocks).slice(0, 2)).toEqual(["h1", "hr"]);
    expect(paragraphText(blocks)).toContain("第一句内容很长");
    expect(paragraphText(blocks)).toContain("第五句收束这个自然段");
  });

  test("does not add dividers merely because blank-separated paragraphs continue the same idea", () => {
    const blocks = createBlocksFromText(`日常观察

家长晚上发来一大段消息，明明已经洗漱躺下了，还是撑着眼皮回。

学生一撒娇、一委屈，就想把所有问题都揽到自己身上。

同事临时拜托，也不好意思拒绝，最后只能把自己的安排往后放。

这些内容虽然分成了几段，但说的还是同一种状态，不应该被分隔线切开。`);

    expect(hrCount(blocks)).toBe(1);
  });

  test("adds a divider when content shifts from scene description to advice", () => {
    const blocks = createBlocksFromText(`日常观察

家长晚上发来一大段消息，明明已经洗漱躺下了，还是撑着眼皮回。

学生一撒娇、一委屈，就想把所有问题都揽到自己身上。

真正要调整的，是你对责任边界的判断。

具体做法是，先判断这件事是不是必须马上回复，再决定要不要立刻接住。`);

    expect(types(blocks)).toEqual(["h1", "hr", "p", "p", "hr", "p", "p"]);
  });

  test("treats consecutive non-empty soft-wrapped lines as one natural paragraph", () => {
    const blocks = createBlocksFromText(`日常观察
家长晚上发来一大段消息，
明明已经洗漱躺下了，
还是撑着眼皮回；
学生一撒娇、一委屈，
就想把所有问题都揽到自己身上。`);

    expect(hrCount(blocks)).toBe(1);
    expect(paragraphText(blocks)).toContain(
      "家长晚上发来一大段消息，明明已经洗漱躺下了，还是撑着眼皮回；学生一撒娇、一委屈，就想把所有问题都揽到自己身上。",
    );
  });

  test("keeps manual dividers without leading, trailing, or duplicate dividers", () => {
    const blocks = createBlocksFromText(`标题

第一段内容。

---

第二段内容。

---
---`);

    expect(types(blocks)).toEqual(["h1", "hr", "p", "hr", "p"]);
  });

  test("keeps obvious subheadings as separate sections", () => {
    const blocks = createBlocksFromText(`主标题

前面先交代一段背景，帮助读者进入语境。

发布前检查

一定要检查每一页是否有文字截断，标题是否醒目，提醒句是否足够清楚。`);

    expect(types(blocks)).toEqual(["h1", "hr", "p", "hr", "h2", "p"]);
    expect(blocks.find((block) => block.type === "h2")?.text).toBe("发布前检查");
  });
});

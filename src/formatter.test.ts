import { describe, expect, test } from "vitest";
import { createBlocksFromText, makeBlock, stabilizeAiDraftBlocks } from "./formatter";
import { shenzhenArticle, shenzhenHeadings } from "./testFixtures";

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

const zhuhaiArticle = `### 珠海教师编到底值不值得考？

很多人把珠海放进教招名单，最先想到的是海边、城市不算太大、生活看起来舒服。可真要决定把它当主攻城市时，心里又会打鼓：机会够不够，跑一趟值不值，考上以后是不是自己想要的生活？

我先说我的看法。珠海教师编值得认真考虑，但不适合只凭城市好感就重仓。所谓“值不值得”，不是给珠海打一个统一分数，而是看你愿意投入多少准备、能不能适应跑招节奏，以及以后想过怎样的日子。有人把珠海当主线很合适，有人更适合把它放在珠三角多城计划里，这两种选择都不丢人。

先看你喜欢的是珠海本身，还是想象里的珠海。把一座城市当旅行目的地，看到的是天气、街道和周末；把它当教招主线，面对的却是持续几个月的信息整理、复习安排和跨城奔波。你愿不愿意认真研究不同区域，机会来自最初没关注的片区时还会不会考虑，一场没有结果后是否仍愿意继续准备？这些问题比“珠海好不好考”更接近真实选择。

再看你的考试底盘能不能适应变化。珠海的公开招聘信息并不只来自一个地方，近年能看到不同区域、不同招聘主体分别推进的记录。对考生来说，这意味着不能把全部准备押在一种想象中的固定考法上。教综、学科和基本的面试表达，至少要有可以切换的底子。你可以有强项，但不能只有一个模块能拿得出手，其他内容完全空白。

第三笔账是跑招成本。珠海在地图上看起来不远，真正参加一次招聘，付出的却不只是车票。你要留出看公告、核条件、准备材料、订住宿、赶路、候考和恢复状态的时间。如果你同时准备深圳、广州、佛山等地，每追一座城市，都会增加一次切换。有人很能跑，换城市也不影响复习；有人一出门两天，回来要缓三天。承认自己的体力和预算，是在保护机会，不是胆小。

然后才是大家最关心的生活。你喜欢来珠海旅游，不等于你一定适合在这里长期工作。真正的教师生活会落到具体学校、具体片区和每天的通勤里。你更在意城市规模、与家人的距离，还是学校平台、职业成长和可选择的岗位数量？你能不能接受最终工作的区域与最初想象不同？这些问题没有标准答案，但必须由你自己回答。

如果你现在还拿不准，我建议用一个月做“试主攻”，而不是马上做终身决定。这个月里，按珠海方向安排一次完整的教综和学科摸底，整理近年不同区域的信息节奏，查清从自己所在地出发的大致行程，再想象一下如果机会来自香洲之外，你是否仍愿意去。一个月后，如果复习内容、跑招成本和生活接受度都能对上，珠海就可以从“喜欢的城市”升级成真正的主线。

什么样的人更适合把珠海放在前面？我觉得是这几类：对珠海有长期生活意愿，不只迷恋城市滤镜；愿意逐份看岗位，不等一场想象中的统一考试；笔试准备能兼顾基础与变化；跨城成本可承受，而且不会因为一场失利就全盘推翻计划。

如果你只是听说珠海舒服，却没有认真想过复习投入、跑招节奏和长期生活，那现在还不能说它值不值得。先把这几笔账算清楚，答案会比评论区里任何一句“很香”或“太难了”都可靠。城市选择不是表白，最后要靠你的投入能力和生活愿望一起落地。`;

function comparableSourceText(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^-{3,}$/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, ""))
    .join("")
    .replace(/\s/g, "");
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

  test("uses any first markdown heading level as the title and keeps the title divider", () => {
    const blocks = createBlocksFromText(`### 三级写法的主标题

第一段正文，用来确认标题后的分隔线不会遗漏。`);

    expect(blocks.slice(0, 2)).toMatchObject([
      { type: "h1", text: "三级写法的主标题" },
      { type: "hr" },
    ]);
  });

  test("matches the approved Zhuhai section structure without changing source text", () => {
    const blocks = createBlocksFromText(zhuhaiArticle);
    const headings = blocks.filter((block) => block.type === "h3").map((block) => block.text);
    const reconstructed = blocks
      .filter((block) => block.type !== "hr")
      .map((block) => block.text)
      .join("")
      .replace(/\s/g, "");

    expect(blocks.slice(0, 2)).toMatchObject([
      { type: "h1", text: "珠海教师编到底值不值得考？" },
      { type: "hr" },
    ]);
    expect(headings).toEqual([
      "先看你喜欢的是珠海本身，还是想象里的珠海。",
      "再看你的考试底盘能不能适应变化。",
      "第三笔账是跑招成本。",
      "然后才是大家最关心的生活。",
    ]);
    expect(hrCount(blocks)).toBe(7);
    expect(reconstructed).toBe(comparableSourceText(zhuhaiArticle));
  });

  test("keeps the Zhuhai emphasis budget while prioritizing the explicit stance", () => {
    const blocks = createBlocksFromText(zhuhaiArticle);
    const highlighted = blocks.filter((block) => block.highlight);
    const underlined = blocks.filter((block) => block.underline);
    const stance = blocks.find((block) => block.text.includes("珠海教师编值得认真考虑"));
    const uncertainty = blocks.find((block) => block.text.includes("能不能适应跑招节奏"));

    expect(highlighted.length).toBeLessThanOrEqual(3);
    expect(underlined.length).toBeLessThanOrEqual(3);
    expect(stance?.highlight).toBe(true);
    expect(uncertainty?.underline).toBe(false);
    expect(blocks.every((block) => !(block.highlight && block.underline))).toBe(true);
  });

  test("promotes high-confidence paragraph openings but leaves ordinary questions as body text", () => {
    const blocks = createBlocksFromText(`结构判断

前面先交代足够长的背景信息，说明事情为什么值得讨论，也让后面的建议拥有完整语境。

首先，把目标范围缩小。正文继续解释具体做法和判断标准。

最后，把准备成本和长期生活放在一起判断。正文补充最终的取舍依据。

你能不能接受最终结果与最初设想不同？这是需要自己回答的问题。`);

    expect(blocks.some((block) => block.type === "h3" && block.text === "首先，把目标范围缩小。")).toBe(true);
    expect(blocks.some((block) => block.type === "h3" && block.text === "最后，把准备成本和长期生活放在一起判断。")).toBe(true);
    expect(blocks.find((block) => block.text.includes("你能不能接受"))?.type).toBe("p");
    expect(blocks.find((block) => block.text.includes("你能不能接受"))?.underline).toBe(false);
  });

  test("creates the approved Shenzhen sections and keeps every source character", () => {
    const blocks = createBlocksFromText(shenzhenArticle);
    const headings = blocks.filter((block) => block.type === "h3").map((block) => block.text);
    const reconstructed = blocks
      .filter((block) => block.type !== "hr")
      .map((block) => block.text)
      .join("")
      .replace(/\s/g, "");

    expect(headings).toEqual(shenzhenHeadings);
    expect(hrCount(blocks)).toBe(7);
    expect(reconstructed).toBe(comparableSourceText(shenzhenArticle));
    expect(blocks.filter((block) => block.highlight)).toHaveLength(3);
    expect(blocks.filter((block) => block.underline)).toHaveLength(3);
  });

  test("uses local structure for AI drafts with missing or misplaced dividers while keeping AI styles", () => {
    const localBlocks = createBlocksFromText(shenzhenArticle);
    const expectedStructure = localBlocks.map(({ type, text }) => ({ type, text }));

    [false, true].forEach((includeMisplacedDividers) => {
      const aiBlocks = createUnstructuredAiBlocks(includeMisplacedDividers);
      const stabilized = stabilizeAiDraftBlocks(aiBlocks, shenzhenArticle);
      const boldBlock = stabilized.find((block) => block.text.includes("问题往往不在努力本身"));
      const blueBlock = stabilized.find((block) => block.text.includes("会做但太慢"));

      expect(stabilized.map(({ type, text }) => ({ type, text }))).toEqual(expectedStructure);
      expect(boldBlock?.segments?.some((segment) => segment.bold && segment.text.includes("问题往往不在努力本身"))).toBe(
        true,
      );
      expect(blueBlock?.segments?.some((segment) => segment.color === "blue" && segment.text.includes("会做但太慢"))).toBe(
        true,
      );
    });
  });

  test("falls back to the source-derived structure when AI text cannot be mapped safely", () => {
    const localBlocks = createBlocksFromText(shenzhenArticle);
    const stabilized = stabilizeAiDraftBlocks([makeBlock("p", "被改写过的错误内容")], shenzhenArticle);

    expect(stabilized.map(({ type, text }) => ({ type, text }))).toEqual(
      localBlocks.map(({ type, text }) => ({ type, text })),
    );
  });
});

function createUnstructuredAiBlocks(includeMisplacedDividers: boolean) {
  const lines = shenzhenArticle
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^#{1,3}\s+/, ""));
  const boldPhrase = "问题往往不在努力本身";
  const bluePhrase = "会做但太慢，要通过限时练习固定步骤；";

  return lines.flatMap((text, index) => {
    const segments = createStyledSegments(text, boldPhrase, { bold: true }) ??
      createStyledSegments(text, bluePhrase, { bold: true, color: "blue" as const });
    const textBlock = makeBlock(index === 3 ? "h2" : "p", text, false, false, segments);

    return includeMisplacedDividers && index > 0 ? [makeBlock("hr"), textBlock] : [textBlock];
  });
}

function createStyledSegments(
  text: string,
  phrase: string,
  style: { bold?: boolean; color?: "red" | "blue" },
) {
  const start = text.indexOf(phrase);
  if (start === -1) return undefined;

  return [
    { text: text.slice(0, start) },
    { text: phrase, ...style },
    { text: text.slice(start + phrase.length) },
  ].filter((segment) => segment.text);
}

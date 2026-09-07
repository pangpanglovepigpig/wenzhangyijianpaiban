import { describe, expect, test } from "vitest";
import { createBlocksFromText, formatArticle, layoutPreservesSource, validateLayoutResult } from "./articleStructure.js";
import { huizhouArticle, shenzhenArticle, xiaomianArticle } from "../src/testFixtures";

const bodyText = (source: string) => createBlocksFromText(source).filter(b => b.type !== "hr").map(b => b.text).join("");
const body = (source: string) => createBlocksFromText(source).filter(b => b.type === "p");
const marked = (source: string) => body(source).flatMap(b => b.segments ?? []).filter(s => s.color || s.bold || s.highlight || s.underline);

describe("local layout regressions", () => {
  test("does not invent a title from a long or multi-sentence opening", () => {
    for (const source of ["这是第一句。这是第二句。\n\n继续讨论正文。", "这是一段没有标题的正文，".repeat(8) + "正文结束。", "今天我整理了复习资料。\n\n继续讨论正文。"])
      expect(createBlocksFromText(source).every(b => b.type === "p")).toBe(true);
  });
  test("a question title is allowed but an unmarked later short sentence isn't a heading", () => {
    const blocks = createBlocksFromText("你真的准备好了吗？\n\n这里是第一段正文，继续交代背景。\n\n那就这样\n\n这里接着说正文。");
    expect(blocks[0].type).toBe("h1");
    expect(blocks.find(b => b.text === "那就这样")?.type).toBe("p");
  });
  test("preserves explicit heading levels without turning the first heading into h1", () => {
    expect(createBlocksFromText("## 二级\n正文。\n### 三级\n后文。\n# 一级\n结尾。").filter(b => /^h[123]$/.test(b.type)).map(b => b.type))
      .toEqual(["h2", "h3", "h1"]);
  });
  test("keeps bullets and consecutive numbered items as body, including their markers", () => {
    for (const prefix of ["- ", "* ", "+ ", "• "]) {
      const source = `材料准备\n\n${prefix}身份证\n${prefix}毕业证\n${prefix}学位证\n\n这些材料需要提前整理。`;
      expect(body(source).map(b => b.text)).toEqual([`${prefix}身份证`, `${prefix}毕业证`, `${prefix}学位证`, "这些材料需要提前整理。"]);
      expect(layoutPreservesSource(createBlocksFromText(source), source)).toBe(true);
    }
    expect(body("材料\n\n1. 身份证\n2. 毕业证\n3. 学位证").map(b => b.text)).toEqual(["1. 身份证", "2. 毕业证", "3. 学位证"]);
    expect(createBlocksFromText("材料\n\n1. 身份证\n2. 毕业证\n3. 学位证\n\n这里用一个完整的自然段来解释材料提交的注意事项。").filter(b => b.type === "h2")).toEqual([]);
  });
  test("a numbered heading needs a following explanation", () => {
    expect(createBlocksFromText("材料准备\n\n一、核对资格\n\n这里具体解释如何核对报名条件。\n\n二、整理文件\n\n这里继续介绍需要准备的文件。").filter(b => b.type === "h2").map(b => b.text))
      .toEqual(["一、核对资格", "二、整理文件"]);
  });
  test("does not emphasize ordinary narratives with 可以、最后、真正", () => {
    const source = "复习记录\n\n今天可以在家看书，也可以去图书馆。\n\n最后我回到家里，整理好桌子就休息了。\n\n这才是真正的周末，我和朋友喝了一杯茶。";
    expect(marked(source + "\n\n" + "窗外天气很好，树上的叶子随风摇动。".repeat(30))).toEqual([]);
    expect(body(source).some(b => b.highlight || b.underline)).toBe(false);
  });
  test("keeps nested closing quotes and brackets attached, even in long sentences", () => {
    const source = `讨论记录\n\n老师说：“不要着急。先读完整段材料，再回答问题。”随后大家开始阅读。\n\n他提醒：“记住‘先看题。再回答。’这句话。”\n\n${"背景文字，".repeat(24)}（里面有逗号，还有提示；以及数字3.14）。后面继续。`;
    expect(body(source).every(b => !/^[”’」』）)]/.test(b.text))).toBe(true);
    expect(layoutPreservesSource(createBlocksFromText(source), source)).toBe(true);
    expect(bodyText(source)).toContain("‘先看题。再回答。’");
  });
  test("keeps inline quoted sentences together rather than splitting the quotation", () => {
    const quote = '“先想一想。再开始说。”';
    const source = "标题\n\n" + "铺垫内容。".repeat(14) + "比如把" + quote + "作为提示。";
    expect(body(source).some(b => b.text.includes(quote))).toBe(true);
  });
  test("preserves decimal numbers, dates, URLs, emoji and repeated sentences", () => {
    const source = "内容检查\n\n" + "背景内容，".repeat(25) + "比例3.14%，预算1,200元，时间09:30，日期2026-09-07，网址https://example.com/a?x=1&y=2。重复一句。重复一句。😀👨‍👩‍👧‍👦 English words。";
    const blocks = createBlocksFromText(source);
    expect(layoutPreservesSource(blocks, source)).toBe(true);
    for (const fragment of ["3.14%", "1,200", "09:30", "2026-09-07", "https://example.com/a?x=1&y=2", "👨‍👩‍👧‍👦"])
      expect(blocks.some(b => b.text.includes(fragment))).toBe(true);
    expect(bodyText(source).match(/重复一句。/g)).toHaveLength(2);
  });
  test("merges copying wraps without merging real WPS paragraphs", () => {
    const source = "复习安排\n我先介绍一段较长的\n背景内容，再接着解释。\n这是第二个完整自然段。";
    expect(body(source).map(b => b.text)).toEqual(["我先介绍一段较长的背景内容，再接着解释。", "这是第二个完整自然段。"]);
  });
  test("does not create sections without enough preceding context", () => {
    const source = "复习安排\n\n一句背景。\n\n具体做法是先检查材料，再决定安排。";
    expect(createBlocksFromText(source).filter(b => b.type === "hr")).toHaveLength(1);
  });
  test.each([huizhouArticle, shenzhenArticle, xiaomianArticle])("retains real article content and bounds emphasis", source => {
    const blocks = createBlocksFromText(source);
    expect(layoutPreservesSource(blocks, source)).toBe(true);
    expect(blocks).toEqual(createBlocksFromText(source));
    let totalCount = 0, markedChars = 0, bodyChars = 0;
    for (const block of blocks) {
      if (block.type !== "p") continue;
      bodyChars += Array.from(block.text.replace(/\s/g, "")).length;
      const marks = block.segments?.filter(s => s.color || s.bold || s.highlight || s.underline) ?? [];
      expect(marks.length).toBeLessThanOrEqual(1);
      expect(block.highlight || block.underline).toBe(false);
      for (const mark of marks) {
        expect(mark.bold).toBeUndefined();
        markedChars += Array.from(mark.text.replace(/\s/g, "")).length;
        totalCount += 1;
        expect([mark.color, mark.highlight, mark.underline].filter(Boolean)).toHaveLength(1);
      }
    }
    expect(totalCount).toBeGreaterThan(0);
    expect(totalCount).toBeLessThanOrEqual(Math.ceil(bodyChars / 240) * 3);
    expect(markedChars).toBeLessThanOrEqual(Math.floor(bodyChars * 0.3));
  });
  test("falls back to original lines with a notice if text or styled segments change", () => {
    const source = "# 标题\n\n- 项目\n\n原文，保留标点。";
    for (const corrupted of [[{ type: "p" as const, text: "改写", highlight: false, underline: false }],
      createBlocksFromText(source).map(b => b.type === "p" ? { ...b, segments: [{ text: "错误" }] } : b)]) {
      const result = validateLayoutResult(corrupted, source);
      expect(result.notice).toContain("已保留原段落");
      expect(layoutPreservesSource(result.blocks, source)).toBe(true);
    }
  });
  test("empty input stays empty instead of substituting the sample", () => {
    expect(formatArticle(" \n\t")).toEqual({ blocks: [] });
  });
});

test("promotes explicit action openings but not ordinary narrated sequences", () => {
  const blocks = createBlocksFromText("准备安排\n\n先从自己这里划边界。后面逐项解释如何确定资格与方向。\n\n接着把学校放进待了解区。这里继续解释下一步的操作。\n\n最后，我回到家里。窗外的树叶缓缓落下。");
  expect(blocks.filter(b => b.type === "h3").map(b => b.text)).toEqual(["先从自己这里划边界。", "接着把学校放进待了解区。"]);
});

test("finds method changes and viewpoint headings without changing their wording", () => {
  const headings = ["挑一个最影响课堂的五分钟。", "逐字稿也不必立刻扔掉。", "真正进入重点范围的学校，不需要很多。", "普通学校也可以放进重点范围。", "名单建立以后，每次投递都留下原因和状态。"];
  const source = "# 标题\n\n" + headings.map(h => h + "这里继续解释具体操作，以及这样安排的原因和后续步骤。").join("\n\n");
  const blocks = createBlocksFromText(source);
  expect(blocks.filter(b => b.type === "h3").map(b => b.text)).toEqual(headings);
  for (const [index, block] of blocks.entries()) {
    if (block.type === "h3") expect(blocks[index - 1]?.type).toBe("hr");
  }
  expect(layoutPreservesSource(blocks, source)).toBe(true);
});

test("keeps a heading candidate as body when the following sentence would also be a heading", () => {
  const source = "# 标题\n\n挑一个最重要的练习。\n\n先从自己的问题开始。后面解释具体的方法。";
  expect(createBlocksFromText(source).find(b => b.text === "挑一个最重要的练习。")?.type).toBe("p");
});

test("uses more than six marks on a long article and retains a thirty-percent character budget", () => {
  const source = "# 标题\n\n" + Array.from({length: 8}, (_, i) => `## 第${i+1}部分\n\n这里交代一段完整背景，让后面的判断具备充分依据。窗外的天气依然晴朗，讨论还在继续。\n\n关键在于先明确目标。\n\n不要把所有时间花在纠结上。\n\n这里还会补充具体情境，帮助读者理解问题，并把这一部分的来龙去脉解释清楚。`).join("\n\n");
  const blocks = body(source), marks = marked(source);
  expect(marks.length).toBeGreaterThan(6);
  expect(marks.some(s => s.highlight)).toBe(true);
  expect(marks.some(s => s.underline)).toBe(true);
  expect(marks.reduce((n,s)=>n+s.text.replace(/\s/g, "").length,0)).toBeLessThanOrEqual(blocks.reduce((n,b)=>n+b.text.replace(/\s/g, "").length,0)*0.3);
});

import { blocksToMarkdown, normalizeTextSegments, applyRuleBasedEmphasis, makeBlock } from "./articleStructure.js";
test("retains exact inline mark boundaries in normalization and Markdown", () => {
  const segments = [{text:"普通文字。"}, {text:"黄色高亮。",highlight:true}, {text:"继续普通文字。"}, {text:"红色划线。",underline:true}];
  const block = makeBlock("p", "", false, false, segments);
  expect(normalizeTextSegments(segments)).toHaveLength(4);
  const markdown = blocksToMarkdown([block]);
  expect(markdown).toContain("普通文字。<mark>黄色高亮。</mark>继续普通文字。");
  expect(markdown).toContain('红色划线。</span>');
  expect(applyRuleBasedEmphasis([block])).toEqual([block]);
  const manual = { ...block, highlight: true };
  expect(blocksToMarkdown([manual]).match(/<mark>/g)).toHaveLength(1);
  expect(blocksToMarkdown([manual])).not.toContain("wavy");
});


test("adds one divider before explicit h3 headings, including the first block", () => {
  const source = "### 开头的三级标题\n\n这里是开头的正文解释。\n\n---\n\n### 后续的三级标题\n\n这里是后续的正文解释。";
  const blocks = createBlocksFromText(source);
  expect(blocks.map(b => b.type)).toEqual(["hr", "h3", "p", "hr", "h3", "p"]);
  expect(blocks[3].dividerSource).toBe("manual");
  expect(layoutPreservesSource(blocks, source)).toBe(true);
});

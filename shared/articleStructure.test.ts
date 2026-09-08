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
  const blocks = createBlocksFromText("准备安排\n\n先从自己这里划边界。后面逐项解释如何确定资格与方向。这一段继续解释具体背景、处理方法和判断依据，让读者理解这一步为什么需要这样安排。这一段继续解释具体背景、处理方法和判断依据，让读者理解这一步为什么需要这样安排。\n\n接着把学校放进待了解区。这里继续解释下一步的操作。\n\n最后，我回到家里。窗外的树叶缓缓落下。");
  expect(blocks.filter(b => b.type === "h3").map(b => b.text)).toEqual(["先从自己这里划边界。", "接着把学校放进待了解区。"]);
});

test("finds method changes and viewpoint headings without changing their wording", () => {
  const headings = ["挑一个最影响课堂的五分钟。", "逐字稿也不必立刻扔掉。", "真正进入重点范围的学校，不需要很多。", "普通学校也可以放进重点范围。", "名单建立以后，每次投递都留下原因和状态。"];
  const source = "# 标题\n\n" + headings.map(h => h + "这里继续解释具体操作，以及这样安排的原因和后续步骤。".repeat(3)).join("\n\n");
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

const explanation = "这里继续说明背景、操作方式与判断依据，帮助读者理解每个阶段为什么需要这样安排，并通过具体情境说明实际限制和后续处理方式，避免只看到一句结论。";
const headingTexts = (source: string) => createBlocksFromText(source).filter(b => b.type === "h3").map(b => b.text);

test.each([
  "开头用最短的时间交代身份。", "中间部分围绕主印象选两项证据。", "结尾不要突然拔高成口号。",
  "稿子写完后，先做三种长度。", "接下来才是练习。", "再看替代性。",
  "还有一个更现实的账：这一天原本要做什么。", "决定去以后，不要空着手坐到最后。",
  "回来以后，宣讲会才算完成。", "如果决定不去，也不用用一整天刷现场动态惩罚自己。",
  "收尾先核对关键数据。", "练习结束后，再整理记录。",
  "提交前先检查证明文件。", "每隔两周，用一次复盘检查计划。",
  "第二组则需要保持练习。", "文件编号至少核两次。", "优先解决最影响进度的问题。",
])("recognizes a major step with explanatory body: %s", heading => {
  const source = "# 标题\n\n" + heading + explanation;
  const blocks = createBlocksFromText(source);
  expect(headingTexts(source)).toEqual([heading]);
  expect(layoutPreservesSource(blocks, source)).toBe(true);
  expect(blocks.filter(b => b.type === "p").map(b => b.text).join("")).toBe(explanation);
});

test("keeps repeated rounds as details inside the practice section", () => {
  const source = "# 标题\n\n接下来才是练习。" + explanation + "\n\n第三遍练被打断。" + explanation + "\n\n第四遍把稿子放远。" + explanation;
  expect(headingTexts(source)).toEqual(["接下来才是练习。"]);
  expect(layoutPreservesSource(createBlocksFromText(source), source)).toBe(true);
});

test.each(["最后，我完成了报名。", "开头用了一张照片。", "昨天我检查了材料。", "第三遍我终于说顺了。", "接下来天气会晴朗。", "再看什么？", "天气很好。"])("does not promote narrative or ambiguous short sentences: %s", sentence => {
  expect(headingTexts("# 标题\n\n" + sentence + explanation)).toEqual([]);
});

test.each([59, 60])("requires sixty body characters between automatic headings: %i", count => {
  const first = "挑一个有用的练习。", second = "开头先交代讨论范围。";
  const source = "# 标题\n\n" + first + "文".repeat(count - 1) + "。\n\n" + second + explanation;
  expect(headingTexts(source)).toEqual(count < 60 ? [second] : [first, second]);
  expect(layoutPreservesSource(createBlocksFromText(source), source)).toBe(true);
});

test("explicit Markdown headings remain exempt from density filtering", () => {
  expect(headingTexts("### 甲\n\n一句解释。\n\n### 乙\n\n另一句解释。")).toEqual(["甲", "乙"]);
});

test("extracts only the opening sentence, keeps list items and repeated source text", () => {
  const source = "# 标题\n\n这里交代背景。开头先检查材料。" + explanation + "\n\n- 结尾先核对数据。\n- 中间部分要比较差别。\n\n开头先检查材料。" + explanation + "\n\n开头先检查材料。" + explanation + "\n\n记录数字3.14、https://example.com/a和😀👨‍👩‍👧‍👦。";
  const blocks = createBlocksFromText(source);
  expect(headingTexts(source)).toEqual(["开头先检查材料。", "开头先检查材料。"]);
  expect(layoutPreservesSource(blocks, source)).toBe(true);
  expect(blocks).toEqual(createBlocksFromText(source));
});

test("recognizes complete goal, result and requirement relationships without marking bare keywords", () => {
  const candidates = ["你的目标是把真实信息说清楚。", "材料越具体，你越清楚需要核对什么。", "只需要保证所有材料的基本事实一致。"];
  const source = "# 标题\n\n" + candidates.map(c => c + explanation.repeat(2)).join("\n\n");
  const marks = marked(source);
  for (const sentence of candidates) expect(marks.some(s => s.text.includes(sentence))).toBe(true);
  expect(marks.some(s => s.highlight)).toBe(true);
  expect(marks.some(s => s.underline)).toBe(true);
  expect(marked("# 标题\n\n目标、关键和结果写在黑板上。" + explanation.repeat(2))).toEqual([]);
});

// v17: one classification pipeline for ordered actions, list items and prose.
describe("step/list classification conflicts", () => {
  const explain = "这里解释当前任务涉及的范围，以及为什么需要这样处理。再记录已经完成的部分，方便之后检查。相关资料应当按实际情况整理，每一次决定都应有对应依据。";
  test("extracts seven ordered actions and splits every explanation", () => {
    const steps = ["第一步先确认表头和附件。", "第二步用岗位代码定位，而不是只记名称。", "第三步看对象和类别。", "第四步核学历和学位。", "第五步核专业，而且要抄原字。", "第六步看需要提供的其他证明。", "第七步读备注和脚注。"];
    const source = "# 阅读流程\n\n" + steps.map(s => s + explain.repeat(2)).join("\n\n");
    const blocks = createBlocksFromText(source);
    expect(headingTexts(source)).toEqual(steps);
    expect(blocks.filter(b => b.type === "p").every(b => Array.from(b.text).length <= 80)).toBe(true);
    blocks.forEach((b, i) => { if (b.type === "h3") expect(blocks[i - 1].type).toBe("hr"); });
    expect(layoutPreservesSource(blocks, source)).toBe(true);
  });
  test("splits rejected steps and long list items without repeating markers", () => {
    for (const prefix of ["- ", "• ", "1. ", "第一步我写了记录。"]){
      const source = "# 记录\n\n" + prefix + "材料信息包括报名需要提交的各项证明。" + explain.repeat(2);
      const blocks = createBlocksFromText(source);
      expect(headingTexts(source)).toEqual([]);
      expect(blocks.filter(b => b.type === "p").every(b => Array.from(b.text).length <= 80)).toBe(true);
      expect(blocks.filter(b => b.text.startsWith(prefix))).toHaveLength(1);
      expect(layoutPreservesSource(blocks, source)).toBe(true);
    }
  });
  test("distinguishes task passes from repeated rehearsal and uncertain passes", () => {
    const phases = ["第一遍只做资格筛选。", "第二遍看考试匹配。", "第三遍看时间和路程。", "第四遍才讨论个人意愿。"];
    const source = "# 流程练习\n\n" + phases.map(s => s + "每一遍都核对同一份岗位表。" + explain.repeat(2)).join("\n\n");
    expect(headingTexts(source)).toEqual(phases);
    const practice = "# 表达训练\n\n接下来才是练习。" + explain.repeat(2) + "\n\n" + ["第一遍检查开头。请看同一份自我介绍的录音。", "第二遍整理证据。请修改稿子里的表述。", "第三遍练被打断。", "第四遍把稿子放远。"].map(s => s + explain.repeat(2)).join("\n\n");
    expect(headingTexts(practice)).toEqual(["接下来才是练习。"]);
    expect(headingTexts("# 记录\n\n第三遍检查未知内容。" + explain.repeat(2))).toEqual([]);
    expect(layoutPreservesSource(createBlocksFromText(practice), practice)).toBe(true);
  });
  test.each(["先判断哪个环节最需要处理。", "把最重要的任务放进完整的时段。", "另一项设置最低维护，保证进度不断。", "每周只调整一次比例。", "资料也要跟着收窄。", "整理材料前，先确认提交要求。", "读文件的第一步，应该先确认用途。", "第一层看时间成本。"])("accepts action structures with explanations: %s", sentence => {
    const source = "# 操作\n\n" + sentence + "\n\n" + explain.repeat(2);
    expect(headingTexts(source)).toEqual([sentence]);
    expect(layoutPreservesSource(createBlocksFromText(source), source)).toBe(true);
  });
  test.each(["第一场之后，别人很容易变成一面放大镜。", "点开以后，先看见的是表情僵，声音也不一样。", "第一步我写完了记录。", "第一步天气一直很好。", "第一遍我终于读完了文件。", "材料越具体，你越清楚需要核对什么。", "先判断什么？"])("keeps descriptions, relations and questions in the body: %s", sentence => {
    expect(headingTexts("# 记录\n\n" + sentence + explain.repeat(2))).toEqual([]);
  });
  test("recovers wrapped numbered actions and preserves list punctuation and repeated text", () => {
    const opening = "1. 确认需要提交的资料和具体要求。";
    const source = "# 准备\n\n1. 确认需要提交的\n资料和具体要求。" + explain.repeat(2) + "\n\n2. 身份证\n3. 毕业证\n\n- " + "材料说明，".repeat(8) + "\n附注含数字3.14、网址https://example.com/a?x=1&y=2和😀。老师说：“外层‘内层。’仍然完整。”重复一句。重复一句。";
    const blocks = createBlocksFromText(source);
    expect(headingTexts(source)).toEqual([opening]);
    expect(layoutPreservesSource(blocks, source)).toBe(true);
    expect(blocks).toEqual(createBlocksFromText(source));
    for (const fragment of ["2. 身份证", "3. 毕业证", "3.14", "https://example.com/a?x=1&y=2", "“外层‘内层。’仍然完整。”"]) expect(blocks.some(b => b.text.includes(fragment))).toBe(true);
    expect(blocks.map(b => b.text).join("").match(/重复一句。/g)).toHaveLength(2);
  });
});

 test("packs safe clauses by length instead of treating two commas as two sentences", () => {
    const source = "# 分层说明\n\n" + "先按规则整理各类信息，包括基本条件、现实安排、通勤时间、学习意愿、时间成本，再记录需要确认的事项，包括具体要求、证明材料、报名入口、时间节点，最后按先后顺序处理，保证每项信息都能对应原来的来源。";
    const paragraphs = body(source);
    expect(paragraphs.every(p => Array.from(p.text).length >= 20 && Array.from(p.text).length <= 80)).toBe(true);
    expect(paragraphs.length).toBeLessThanOrEqual(3);
    expect(layoutPreservesSource(createBlocksFromText(source), source)).toBe(true);
 });

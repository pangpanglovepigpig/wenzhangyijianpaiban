import { afterEach, describe, expect, test, vi } from "vitest";
import { createBlocksFromText } from "../src/formatter";
import { buildSentenceIndex } from "../shared/articleStructure.js";
import {
  shenzhenArticle,
  shenzhenHeadings,
  xiaomianAiHeadings,
  xiaomianArticle,
  xiaomianLocalHeadings,
} from "../src/testFixtures";
import handler, {
  applyStructureSuggestions as applyBySentenceId,
  applyStyleSuggestions,
  createSourcePreservingDraft,
  parseDraftEnhancements,
} from "./generate-draft";

// Existing article expectations are expressed as quotes for readability only;
// the actual model/API contract now exclusively uses stable sentence IDs.
function idsFor(source, suggestions) {
  const index = buildSentenceIndex(source);
  return suggestions.map(({ quote, action }) => ({
    sentenceId: index.find((sentence) => sentence.text === quote)?.sentenceId ?? "missing",
    action,
  }));
}
function applyStructureSuggestions(blocks, suggestions, source) {
  return applyBySentenceId(blocks, idsFor(source, suggestions), source);
}

function createResponseRecorder() {
  let payload;
  return {
    response: {
      statusCode: 0,
      setHeader: vi.fn(),
      end(value) {
        payload = JSON.parse(value);
      },
    },
    getPayload: () => payload,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_TIMEOUT_MS;
});

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

  test("promotes an ordered group of numbered matters but not isolated or broken sequences", () => {
    const localBlocks = createBlocksFromText(xiaomianArticle).map(({ type, text }) => ({ type, text }));
    const fallbackBlocks = createSourcePreservingDraft(xiaomianArticle).blocks.map(({ type, text }) => ({ type, text }));

    expect(fallbackBlocks).toEqual(localBlocks);
    expect(fallbackBlocks.filter((block) => block.type === "h3").map((block) => block.text)).toEqual(
      xiaomianLocalHeadings,
    );

    [
      `### 单独序号\n\n第一件事，是先处理眼前的问题。后面继续解释。`,
      `### 断裂序号\n\n第一件事，是先处理眼前的问题。后面继续解释。\n\n第三件事，是再检查结果。后面继续解释。`,
    ].forEach((source) => {
      expect(createSourcePreservingDraft(source).blocks.filter((block) => block.type === "h3")).toHaveLength(0);
    });
  });
});

describe("compact AI structure suggestions", () => {
  const structureSuggestions = [
    ...xiaomianAiHeadings.map((quote) => ({ quote, action: "h3" })),
    {
      quote: "小面有机会价值，也有练习价值，但不要把一次积极反馈当成最终结果。",
      action: "section",
    },
    {
      quote:
        "所以，小面提前准备的不是神秘题库，而是三个随时能拿出来的东西：说得清自己，听得懂问题，知道怎样了解一所学校。",
      action: "section",
    },
  ];

  test("applies six source-exact headings and two section-only dividers", () => {
    const localBlocks = createSourcePreservingDraft(xiaomianArticle).blocks;
    const structured = applyStructureSuggestions(localBlocks, structureSuggestions, xiaomianArticle);
    const reconstructed = structured
      .filter((block) => block.type !== "hr")
      .map((block) => block.text)
      .join("")
      .replace(/\s/g, "");
    const expected = xiaomianArticle
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^#{1,3}\s+/, ""))
      .filter(Boolean)
      .join("")
      .replace(/\s/g, "");

    expect(structured.filter((block) => block.type === "h3").map((block) => block.text)).toEqual(xiaomianAiHeadings);
    expect(structured.filter((block) => block.type === "hr")).toHaveLength(9);
    expect(reconstructed).toBe(expected);
  });

  test("drops one invalid suggestion without affecting valid structure and removes styles from promoted headings", () => {
    const localBlocks = createSourcePreservingDraft(xiaomianArticle).blocks;
    const heading = "学校相关信息也要提前学会查。";
    const structured = applyStructureSuggestions(
      localBlocks,
      [
        { quote: "学校资料也应该尽早开始查询。", action: "h3" },
        { quote: heading, action: "h3" },
      ],
      xiaomianArticle,
    );
    const styled = applyStyleSuggestions(
      structured,
      [{ quote: heading, bold: true, color: "blue" }],
      xiaomianArticle,
    );

    expect(styled.some((block) => block.type === "h3" && block.text === heading)).toBe(true);
    expect(styled.find((block) => block.type === "h3" && block.text === heading)?.segments).toBeUndefined();
  });

  test.each([
    ["a question", { quote: "为什么选择教师、为什么考虑这所学校或这个学段、你怎样理解一堂好课、遇到暂时不会的问题如何处理。", action: "h3" }],
    ["a rewritten sentence", { quote: "学校资料也应该尽早开始查询。", action: "h3" }],
    ["an unknown action", { quote: "学校相关信息也要提前学会查。", action: "h2" }],
    ["a cross-paragraph quote", { quote: "形容词。\n\n你可以先做一版六十秒", action: "h3" }],
  ])("rejects %s", (_label, suggestion) => {
    const blocks = createSourcePreservingDraft(xiaomianArticle).blocks;
    expect(applyStructureSuggestions(blocks, [suggestion], xiaomianArticle)).toEqual(blocks);
  });

  test("rejects overlong sentences, while repeated sentences are unambiguous by ID", () => {
    const repeated = "这一句开场内容在全文重复出现。";
    const longQuote = `${"长".repeat(60)}。`;
    const source = `### 校验测试\n\n${repeated}后面补充甲。\n\n${repeated}后面补充乙。\n\n${longQuote}后面补充丙。`;
    const blocks = createSourcePreservingDraft(source).blocks;

    expect(
      applyStructureSuggestions(
        blocks,
        [
          { quote: longQuote, action: "h3" },
        ],
        source,
      ),
    ).toEqual(blocks);
  });

  test("does not turn an ordinary personal stance or a question into a heading", () => {
    const stance = "我认为这座城市值得认真考虑。";
    const question = "你是否真的愿意长期留在这里？";
    const source = `### 语义边界\n\n${stance}后面补充个人判断。\n\n${question}后面继续说明需要权衡的条件。`;
    const blocks = createSourcePreservingDraft(source).blocks;

    expect(
      applyStructureSuggestions(
        blocks,
        [
          { quote: stance, action: "h3" },
          { quote: question, action: "h3" },
        ],
        source,
      ),
    ).toEqual(blocks);
  });

  test("caps accepted additions at six headings and three pure sections", () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, index) => `编号${String(index + 1).padStart(2, "0")}对应一个独立的新主题句。后面继续解释这一主题的具体内容。`,
    );
    const source = `### 数量测试\n\n${paragraphs.join("\n\n")}`;
    const blocks = createSourcePreservingDraft(source).blocks;
    const suggestions = paragraphs.map((paragraph, index) => ({
      quote: paragraph.slice(0, paragraph.indexOf("。") + 1),
      action: index % 2 === 0 ? "h3" : "section",
    }));
    const structured = applyStructureSuggestions(blocks, suggestions, source);

    expect(structured.filter((block) => block.type === "h3")).toHaveLength(6);
    expect(structured.filter((block) => block.type === "hr")).toHaveLength(9);
  });
});

describe("compact AI style suggestions", () => {
  const article = `### 测试标题

这是一段需要强调的正文内容，后面继续补充说明。

另一段正文专门用于验证本地排版样式能够完整保留。`;

  test("applies one exact unique quote inside a paragraph", () => {
    const blocks = createSourcePreservingDraft(article).blocks;
    const quote = "需要强调的正文内容";
    const styled = applyStyleSuggestions(blocks, [{ quote, bold: true, color: "red" }], article);
    const paragraph = styled.find((block) => block.type === "p" && block.text.includes(quote));

    expect(paragraph.segments).toContainEqual({ text: quote, bold: true, color: "red" });
    expect(styled.filter((block) => block.type !== "hr").map((block) => block.text).join(""))
      .toBe(blocks.filter((block) => block.type !== "hr").map((block) => block.text).join(""));
  });

  test.each([
    ["a repeated quote", `### 标题\n\n重复引用文字出现在这里。重复引用文字又出现了。`, { quote: "重复引用文字", bold: true, color: "red" }],
    ["a quote crossing blocks", article, { quote: "补充说明。\n\n另一段正文", bold: true, color: "blue" }],
    ["a title quote", article, { quote: "测试标题", bold: true, color: "blue" }],
    ["a quote shorter than six characters", article, { quote: "正文", bold: true, color: "red" }],
    ["an unknown color", article, { quote: "需要强调的正文内容", bold: true, color: "green" }],
  ])("rejects %s", (_label, source, style) => {
    const blocks = createSourcePreservingDraft(source).blocks;
    expect(applyStyleSuggestions(blocks, [style], source)).toEqual(blocks);
  });

  test("rejects quotes longer than 60 characters", () => {
    const quote = "长".repeat(61);
    const source = `### 标题\n\n${quote}。`;
    const blocks = createSourcePreservingDraft(source).blocks;

    expect(applyStyleSuggestions(blocks, [{ quote, bold: true, color: "red" }], source)).toEqual(blocks);
  });

  test("caps AI styles at 14 entries", () => {
    const paragraphs = Array.from(
      { length: 15 },
      (_, index) => `这里是编号${String(index + 1).padStart(2, "0")}的独特正文内容，用来测试样式数量上限。`,
    );
    const source = `### 数量测试\n\n${paragraphs.join("\n\n")}`;
    const blocks = createSourcePreservingDraft(source).blocks;
    const styles = paragraphs.map((text, index) => ({
      quote: text.slice(3, 17),
      bold: true,
      color: index % 2 === 0 ? "red" : "blue",
    }));
    const styled = applyStyleSuggestions(blocks, styles, source);
    const coloredCount = styled.reduce(
      (total, block) => total + (block.segments?.filter((segment) => segment.color).length ?? 0),
      0,
    );

    expect(coloredCount).toBe(14);
  });

  test("parses compact enhancements and never evaluates malicious content", () => {
    expect(parseDraftEnhancements('{"styles":"not-an-array","__proto__":{"polluted":true}}')).toBeNull();
    expect(
      parseDraftEnhancements(
        '```json\n{"structure":[{"quote":"安全的段首完整句。","action":"h3"}],"styles":[{"quote":"安全的原文引用","bold":true,"color":"blue"}]}\n```',
      ),
    ).toEqual({
      structure: [{ quote: "安全的段首完整句。", action: "h3" }],
      styles: [{ quote: "安全的原文引用", bold: true, color: "blue" }],
    });
    expect({}.polluted).toBeUndefined();
  });
});

describe("AI endpoint degradation", () => {
  test("aborts at 25 seconds and returns the complete local layout without leaking source or keys", async () => {
    vi.useFakeTimers();
    process.env.DEEPSEEK_API_KEY = "secret-do-not-log";
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(Object.assign(new Error("abort"), { name: "AbortError" })));
    })));
    const recorder = createResponseRecorder();
    const run = handler({ method: "POST", body: { text: shenzhenArticle } }, recorder.response);
    await vi.advanceTimersByTimeAsync(24999);
    expect(recorder.getPayload()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await run;
    expect(recorder.response.statusCode).toBe(200);
    expect(recorder.getPayload().blocks).toEqual(createSourcePreservingDraft(shenzhenArticle).blocks);
    expect(recorder.getPayload().notice).toContain("本地排版");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-do-not-log");
    expect(JSON.stringify(log.mock.calls)).not.toContain("深圳");
    log.mockRestore();
  });

  test("reports all-rejected structure while keeping a valid style", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        structure: [{ sentenceId: "bad", action: "h3" }],
        styles: [{ quote: "这是一段没有特殊关键词的文字", bold: true, color: "blue" }],
      }) } }],
    }))));
    const source = "### 校验提示\n这是一段没有特殊关键词的文字，接着说明内容。";
    const recorder = createResponseRecorder();
    await handler({ method: "POST", body: { text: source } }, recorder.response);
    expect(recorder.getPayload().notice).toContain("安全校验");
    expect(recorder.getPayload().blocks.some((b) => b.segments?.some((s) => s.color === "blue"))).toBe(true);
  });

  test.each([408, 429, 500, 501, 502, 503, 504, 599])("degrades transient HTTP %i", async (status) => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status })));
    const recorder = createResponseRecorder();
    await handler({ method: "POST", body: { text: shenzhenArticle } }, recorder.response);
    expect(recorder.response.statusCode).toBe(200);
    expect(recorder.getPayload().notice).toContain("本地排版");
  });

  test.each([401, 403])("keeps configuration HTTP %i as an error without echoing provider content", async (status) => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("sensitive provider content", { status })));
    const recorder = createResponseRecorder();
    await handler({ method: "POST", body: { text: shenzhenArticle } }, recorder.response);
    expect(recorder.response.statusCode).toBe(502);
    expect(recorder.getPayload().error).not.toContain("sensitive");
  });
  test("returns the complete local Shenzhen layout when AI JSON is invalid", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 }),
      ),
    );
    const recorder = createResponseRecorder();

    await handler({ method: "POST", body: { text: shenzhenArticle } }, recorder.response);

    const payload = recorder.getPayload();
    expect(recorder.response.statusCode).toBe(200);
    expect(payload.notice).toContain("本地排版");
    expect(payload.blocks.filter((block) => block.type === "hr")).toHaveLength(7);
    expect(payload.blocks.filter((block) => block.type === "h3").map((block) => block.text)).toEqual(shenzhenHeadings);
  });

  test("returns local blocks when the DeepSeek request times out", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    const recorder = createResponseRecorder();

    await handler({ method: "POST", body: { text: articleForTimeout } }, recorder.response);

    expect(recorder.response.statusCode).toBe(200);
    expect(recorder.getPayload().notice).toContain("本地排版");
    expect(recorder.getPayload().blocks[0]).toMatchObject({ type: "h1", text: "超时测试" });
  });

  test("uses the compact request contract and fixed output budget", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"structure":[],"styles":[{"quote":"这是一段可以标蓝的正文内容","bold":true,"color":"blue"}]}' } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const recorder = createResponseRecorder();
    const source = "### 紧凑请求测试\n\n这是一段可以标蓝的正文内容，用来检查请求体。";

    await handler({ method: "POST", body: { text: source } }, recorder.response);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.max_tokens).toBe(1600);
    expect(requestBody.thinking).toEqual({ type: "disabled" });
    expect(requestBody.messages[0].content).toContain('"structure"');
    expect(requestBody.messages[0].content).toContain('"sentenceId"');
    expect(JSON.parse(requestBody.messages[1].content)[1]).toMatchObject({ sentenceId: "s2", kind: "body", complete: true });
    expect(requestBody.messages[0].content).toContain('"styles"');
    expect(requestBody.messages[0].content).not.toContain('"blocks"');
    expect(recorder.getPayload().blocks.some((block) => block.segments?.some((segment) => segment.color === "blue")))
      .toBe(true);
  });

  test("returns validated AI structure without changing the public response shape", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ structure: idsFor(xiaomianArticle, structureForEndpoint), styles: [] }) } }],
          }),
          { status: 200 },
        ),
      ),
    );
    const recorder = createResponseRecorder();

    await handler({ method: "POST", body: { text: xiaomianArticle } }, recorder.response);

    const payload = recorder.getPayload();
    expect(Object.keys(payload)).toEqual(["blocks"]);
    expect(payload.blocks.filter((block) => block.type === "h3").map((block) => block.text)).toEqual(xiaomianAiHeadings);
    expect(payload.blocks.filter((block) => block.type === "hr")).toHaveLength(9);
  });
});

const structureForEndpoint = [
  ...xiaomianAiHeadings.map((quote) => ({ quote, action: "h3" })),
  {
    quote: "小面有机会价值，也有练习价值，但不要把一次积极反馈当成最终结果。",
    action: "section",
  },
  {
    quote:
      "所以，小面提前准备的不是神秘题库，而是三个随时能拿出来的东西：说得清自己，听得懂问题，知道怎样了解一所学校。",
    action: "section",
  },
];

const articleForTimeout = `### 超时测试

这是一段用于验证超时降级的正文内容。`;

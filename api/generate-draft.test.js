import { afterEach, describe, expect, test, vi } from "vitest";
import { createBlocksFromText } from "../src/formatter";
import { shenzhenArticle, shenzhenHeadings } from "../src/testFixtures";
import handler, { applyStyleSuggestions, createSourcePreservingDraft, parseStyleContent } from "./generate-draft";

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

  test("parses only a styles array and never evaluates malicious content", () => {
    expect(parseStyleContent('{"styles":"not-an-array","__proto__":{"polluted":true}}')).toBeNull();
    expect(parseStyleContent('```json\n{"styles":[{"quote":"安全的原文引用","bold":true,"color":"blue"}]}\n```'))
      .toEqual({ styles: [{ quote: "安全的原文引用", bold: true, color: "blue" }] });
    expect({}.polluted).toBeUndefined();
  });
});

describe("AI endpoint degradation", () => {
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
          choices: [{ message: { content: '{"styles":[{"quote":"这是一段可以标蓝的正文内容","bold":true,"color":"blue"}]}' } }],
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
    expect(requestBody.messages[0].content).toContain('"styles"');
    expect(requestBody.messages[0].content).not.toContain('"blocks"');
    expect(recorder.getPayload().blocks.some((block) => block.segments?.some((segment) => segment.color === "blue")))
      .toBe(true);
  });
});

const articleForTimeout = `### 超时测试

这是一段用于验证超时降级的正文内容。`;

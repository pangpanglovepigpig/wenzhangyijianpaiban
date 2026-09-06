import { afterEach, describe, expect, test, vi } from "vitest";
import { generateDraftWithDeepSeek, getAiDraftEndpoint } from "./draftApi";
import { shenzhenArticle, shenzhenHeadings } from "./testFixtures";

describe("generateDraftWithDeepSeek", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("uses a configured remote endpoint for the GitHub Pages build", async () => {
    vi.stubEnv("VITE_AI_DRAFT_ENDPOINT", "https://wenzhangyijianpaiban.vercel.app/api/generate-draft");
    const responseBlocks = [{ type: "p" as const, text: "标题" }, { type: "p" as const, text: "正文内容足够长。" }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ blocks: responseBlocks }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateDraftWithDeepSeek("标题\n\n正文内容足够长。");

    expect(getAiDraftEndpoint()).toBe("https://wenzhangyijianpaiban.vercel.app/api/generate-draft");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://wenzhangyijianpaiban.vercel.app/api/generate-draft");
  });

  test("keeps the same-origin endpoint as the default", () => {
    vi.stubEnv("VITE_AI_DRAFT_ENDPOINT", "");
    expect(getAiDraftEndpoint()).toBe("/api/generate-draft");
  });

  test("applies the source-derived structure when a successful AI response has no dividers", async () => {
    const responseBlocks = shenzhenArticle
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ type: "p" as const, text: line.replace(/^#{1,3}\s+/, "") }));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ blocks: responseBlocks }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateDraftWithDeepSeek(shenzhenArticle);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.blocks.filter((block) => block.type === "hr")).toHaveLength(7);
    expect(result.blocks.filter((block) => block.type === "h3").map((block) => block.text)).toEqual(shenzhenHeadings);
  });

  test("forwards an AbortSignal so stale requests can be cancelled", async () => {
    const responseBlocks = [{ type: "p" as const, text: "标题" }, { type: "p" as const, text: "正文内容足够长。" }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ blocks: responseBlocks }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await generateDraftWithDeepSeek("标题\n\n正文内容足够长。", controller.signal);

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});

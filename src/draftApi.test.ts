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

describe("transport failures under the request deadline", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  test.each(["request", "response_body"])("ends a stalled %s without committing local content", async (phase) => {
    vi.useFakeTimers();
    const { DraftRequest } = await import("./draftRequest");
    const request = new DraftRequest();
    const commit = vi.fn();
    const fail = vi.fn();
    const busy = vi.fn();
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn(() => phase === "request"
      ? new Promise<Response>(() => {})
      : new Promise<Response>((resolve) => setTimeout(() => resolve(new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('{"blocks":')); },
      }))), 40000)));
    vi.stubGlobal("fetch", fetchMock);
    const run = request.run((signal) => generateDraftWithDeepSeek(shenzhenArticle, signal), commit, fail, busy);
    await vi.advanceTimersByTimeAsync(59999);
    expect(fail).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await run;
    expect(fail.mock.calls[0][0].message).toBe("AI 排版超时，请重试");
    expect(commit).not.toHaveBeenCalled();
    expect(request.pending).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("article_layout_transport", expect.objectContaining({
      reason: "timeout", phase, durationMs: 60000,
    }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("深圳");
  });

  test.each(["offline", "http", "invalid_json"])("preserves the previous result on %s failure and permits retry", async (mode) => {
    const { DraftRequest } = await import("./draftRequest");
    const request = new DraftRequest();
    let current = "previous layout";
    const commit = vi.fn(() => { current = "new layout"; });
    const fail = vi.fn();
    const fetchMock = mode === "offline"
      ? vi.fn().mockRejectedValue(new TypeError("network disconnected"))
      : vi.fn().mockResolvedValue(mode === "http"
        ? new Response(JSON.stringify({ error: "AI 排版超时，请重试" }), { status: 504 })
        : new Response("not JSON"));
    vi.stubGlobal("fetch", fetchMock);
    await request.run((signal) => generateDraftWithDeepSeek(shenzhenArticle, signal), commit, fail, vi.fn());
    expect(current).toBe("previous layout");
    expect(fail).toHaveBeenCalledOnce();
    expect(request.pending).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ blocks: [{ type: "p", text: "标题" }, { type: "p", text: "正文内容足够长。" }] })));
    await request.run((signal) => generateDraftWithDeepSeek("标题\n\n正文内容足够长。", signal), commit, fail, vi.fn());
    expect(current).toBe("new layout");
  });

  test("logs only safe timings and the server correlation ID", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const requestId = "01234567-0123-0123-0123-0123456789ab";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ blocks: [{ type: "p", text: "标题" }] }), {
      headers: { "Server-Timing": "layout;dur=6543", "X-Layout-Request-Id": requestId },
    })));
    await generateDraftWithDeepSeek("不应记录的私密文章正文");
    expect(log).toHaveBeenCalledWith("article_layout_transport", expect.objectContaining({ serverMs: 6543, requestId, outcome: "success" }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("私密文章");
  });
});

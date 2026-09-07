import { makeBlockFromDraft, stabilizeAiDraftBlocks } from "./formatter";
import type { ContentBlock, DraftBlock } from "./types";

type GenerateDraftResponse = {
  blocks?: DraftBlock[];
  error?: string;
  notice?: string;
};

export type GenerateDraftResult = {
  blocks: ContentBlock[];
  notice?: string;
};

export function getAiDraftEndpoint() {
  return import.meta.env.VITE_AI_DRAFT_ENDPOINT?.trim() || "/api/generate-draft";
}

export async function generateDraftWithDeepSeek(text: string, signal?: AbortSignal): Promise<GenerateDraftResult> {
  const started = Date.now();
  let phase = "request";
  let reason = "network_error";
  let headersMs: number | undefined;
  let status: number | undefined;
  let serverMs: number | undefined;
  let requestId: string | undefined;
  let logged = false;
  const log = (outcome: string) => {
    if (logged) return;
    logged = true;
    console.info("article_layout_transport", {
      outcome, phase, reason, durationMs: Date.now() - started,
      headersMs, status, serverMs, requestId,
    });
  };
  const onAbort = () => {
    reason = signal?.reason?.name === "DraftTimeoutError" ? "timeout" : "cancelled";
    log(reason);
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal?.aborted) { onAbort(); throw signal.reason; }
    const response = await fetch(getAiDraftEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    headersMs = Date.now() - started;
    status = response.status;
    const timing = /(?:^|,\s*)layout;dur=(\d+(?:\.\d+)?)/.exec(response.headers.get("Server-Timing") || "");
    serverMs = timing ? Number(timing[1]) : undefined;
    const id = response.headers.get("X-Layout-Request-Id") || "";
    requestId = /^[a-f0-9-]{36}$/.test(id) ? id : undefined;
    phase = "response_body";
    reason = "invalid_response";
    let data: GenerateDraftResponse;
    try {
      data = await response.json();
    } catch {
      if (signal?.aborted) throw signal.reason;
      throw new Error("AI 排版响应读取失败，请重试。");
    }
    if (signal?.aborted) throw signal.reason;
    if (!response.ok) {
      reason = "http_error";
      throw new Error(typeof data?.error === "string" ? data.error : "AI 排版失败，请稍后再试。");
    }
    phase = "validation";
    if (!Array.isArray(data?.blocks) || data.blocks.length === 0) {
      throw new Error("AI 没有返回可用的排版内容，请重试。");
    }
    const draftBlocks = data.blocks.map((block) =>
      makeBlockFromDraft({
        type: block.type,
        text: block.text,
        segments: block.segments,
        highlight: block.highlight === true,
        underline: block.underline === true,
      }),
    );
    const result = { blocks: stabilizeAiDraftBlocks(draftBlocks, text), notice: data.notice };
    phase = "complete";
    reason = "ok";
    log("success");
    return result;
  } catch (error) {
    if (signal?.aborted) onAbort();
    else log("error");
    if (error instanceof TypeError && phase === "request" && !signal?.aborted) {
      throw new Error("AI 连接失败，请检查网络后重试。");
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

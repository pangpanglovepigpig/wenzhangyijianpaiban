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

export async function generateDraftWithDeepSeek(text: string): Promise<GenerateDraftResult> {
  const response = await fetch("/api/generate-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const data = (await response.json().catch(() => ({}))) as GenerateDraftResponse;

  if (!response.ok) {
    throw new Error(data.error || "DeepSeek 生成失败，请稍后再试。");
  }

  if (!Array.isArray(data.blocks) || data.blocks.length === 0) {
    throw new Error("DeepSeek 没有返回可用的初稿内容。");
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

  return {
    blocks: stabilizeAiDraftBlocks(draftBlocks),
    notice: data.notice,
  };
}

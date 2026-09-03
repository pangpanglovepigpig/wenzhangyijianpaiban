import type { ContentBlock, TextSegment } from "../src/types";

export type ArticleBlock = Omit<ContentBlock, "id">;
export type Sentence = {
  sentenceId: string;
  text: string;
  start: number;
  end: number;
  complete: boolean;
  kind: "body" | "heading";
};
export type StructureSuggestion = { sentenceId: string; action: "h3" | "section" };
export type StructureDiagnostics = { accepted: number; rejected: number; reasons: Record<string, number> };
export const sampleArticle: string;
export function createBlocksFromText(input: string): ArticleBlock[];
export function stabilizeAiDraftBlocks(blocks: ArticleBlock[], source: string): ArticleBlock[];
export function makeBlock(type: ContentBlock["type"], text?: string, highlight?: boolean, underline?: boolean, segments?: TextSegment[]): ArticleBlock;
export function blocksToMarkdown(blocks: ArticleBlock[]): string;
export function normalizeTextSegments(segments?: TextSegment[]): TextSegment[] | undefined;
export function textFromSegments(segments: TextSegment[]): string;
export function buildSentenceIndex(source: string): Sentence[];
export function applyStructureSuggestions(blocks: ArticleBlock[], suggestions: unknown, source: string, diagnostics?: StructureDiagnostics): ArticleBlock[];
export function applyRuleBasedEmphasis(blocks: ArticleBlock[]): ArticleBlock[];
export function draftPreservesSource(blocks: ArticleBlock[], source: string): boolean;

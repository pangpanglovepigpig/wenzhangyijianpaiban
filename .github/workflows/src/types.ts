export type BlockType = "h1" | "h3" | "p" | "hr";

export interface ContentBlock {
  id: string;
  type: BlockType;
  text: string;
  highlight: boolean;
  underline: boolean;
}

export interface RenderConfig {
  markdown: string;
  themeMode: string;
  theme: "apple-notes";
  overHiddenMode: boolean;
  mdxMode: boolean;
  width: number;
  height: number;
  splitMode: "autoSplit";
  background: string;
  shadowUrl: string;
  weChatMode: boolean;
}

export interface PageModel {
  id: string;
  blocks: ContentBlock[];
}

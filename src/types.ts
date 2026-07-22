export type BlockType = "h1" | "h2" | "h3" | "p" | "hr";
export type ThemeId =
  | "apple-notes"
  | "bytedance"
  | "alibaba"
  | "turquoise-green"
  | "rouge-red"
  | "taro-purple"
  | "ink-scroll"
  | "cream-coffee";
export type FontFamilyId = "system" | "hei" | "song" | "kai";
export type InlineColor = "red" | "blue";

export interface CardStyleSettings {
  themeId: ThemeId;
  fontFamilyId: FontFamilyId;
  baseFontSize: number;
}

export interface ContentBlock {
  id: string;
  type: BlockType;
  text: string;
  segments?: TextSegment[];
  highlight: boolean;
  underline: boolean;
}

export interface TextSegment {
  text: string;
  bold?: boolean;
  color?: InlineColor;
}

export interface DraftBlock {
  type: BlockType;
  text: string;
  segments?: TextSegment[];
  highlight?: boolean;
  underline?: boolean;
}

export interface RenderConfig {
  markdown: string;
  themeMode: string;
  theme: ThemeId;
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

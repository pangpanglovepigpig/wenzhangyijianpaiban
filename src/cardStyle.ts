import type { CardStyleSettings, FontFamilyId, ThemeId } from "./types";

export const CARD_WIDTH = 440;
export const CARD_HEIGHT = 586;

export type TextRoleStyle = {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  marginBottom: number;
  color: string;
  backgroundColor: string;
  borderLeftColor: string;
  borderLeftWidth: number;
  borderBottomColor: string;
  borderBottomWidth: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
};

type FontOption = {
  id: FontFamilyId;
  label: string;
  cssFamily: string;
  canvasFamily: string;
};

type ThemeOption = {
  id: ThemeId;
  label: string;
  exportName: string;
  swatches: string[];
};

type ThemeConfig = ThemeOption & {
  pageBackground: string;
  textColor: string;
  titleColor: string;
  subtitleColor: string;
  accentColor: string;
  accentAltColor: string;
  mutedColor: string;
  dividerColor: string;
  highlightColor: string;
  underlineColor: string;
  shadow: string;
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
  dividerHeight: number;
  dividerMarginTop: number;
  dividerMarginBottom: number;
  titleWeight: number;
  headingWeight: number;
  subtitleWeight: number;
  paragraphWeight: number;
};

export type ResolvedCardStyle = {
  settings: CardStyleSettings;
  theme: ThemeConfig;
  font: FontOption;
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
  title: TextRoleStyle;
  heading: TextRoleStyle;
  subtitle: TextRoleStyle;
  paragraph: TextRoleStyle;
  divider: {
    height: number;
    marginTop: number;
    marginBottom: number;
    color: string;
  };
  highlight: {
    color: string;
  };
  underline: {
    color: string;
    thickness: number;
    offset: number;
  };
};

export const DEFAULT_CARD_STYLE: CardStyleSettings = {
  themeId: "apple-notes",
  fontFamilyId: "system",
  baseFontSize: 16.5,
};

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "system",
    label: "系统字体",
    cssFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    canvasFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  {
    id: "hei",
    label: "常用黑体",
    cssFamily: '"PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif',
    canvasFamily: "'PingFang SC', 'Microsoft YaHei', 'Heiti SC', sans-serif",
  },
  {
    id: "song",
    label: "宋体",
    cssFamily: '"Songti SC", SimSun, serif',
    canvasFamily: "'Songti SC', SimSun, serif",
  },
  {
    id: "kai",
    label: "楷体",
    cssFamily: '"Kaiti SC", KaiTi, serif',
    canvasFamily: "'Kaiti SC', KaiTi, serif",
  },
];

const THEME_CONFIGS: Record<ThemeId, ThemeConfig> = {
  "apple-notes": {
    id: "apple-notes",
    label: "苹果备忘录",
    exportName: "apple-notes",
    swatches: ["#ffffff", "#f5be2e", "#2d2d2f"],
    pageBackground: "#ffffff",
    textColor: "#2d2d2f",
    titleColor: "#2d2d2f",
    subtitleColor: "#2d2d2f",
    accentColor: "#f5be2e",
    accentAltColor: "#f2d84f",
    mutedColor: "#7a7a80",
    dividerColor: "#a6a6ad",
    highlightColor: "rgba(255, 226, 85, 0.62)",
    underlineColor: "#d93025",
    shadow: "0 18px 42px rgba(29, 29, 31, 0.14)",
    paddingX: 20,
    paddingTop: 72,
    paddingBottom: 24,
    dividerHeight: 2,
    dividerMarginTop: 12,
    dividerMarginBottom: 18,
    titleWeight: 800,
    headingWeight: 800,
    subtitleWeight: 800,
    paragraphWeight: 400,
  },
  bytedance: {
    id: "bytedance",
    label: "字节范",
    exportName: "bytedance",
    swatches: ["#1677ff", "#00d5d8", "#ff2b21"],
    pageBackground: "#ffffff",
    textColor: "#596273",
    titleColor: "#202226",
    subtitleColor: "#1677ff",
    accentColor: "#1677ff",
    accentAltColor: "#09c9d5",
    mutedColor: "#596273",
    dividerColor: "#edf0f4",
    highlightColor: "rgba(255, 226, 85, 0.62)",
    underlineColor: "#ff3b30",
    shadow: "0 18px 42px rgba(48, 76, 122, 0.12)",
    paddingX: 24,
    paddingTop: 76,
    paddingBottom: 54,
    dividerHeight: 1,
    dividerMarginTop: 6,
    dividerMarginBottom: 28,
    titleWeight: 900,
    headingWeight: 900,
    subtitleWeight: 900,
    paragraphWeight: 650,
  },
  alibaba: {
    id: "alibaba",
    label: "阿里橙",
    exportName: "alibaba",
    swatches: ["#ff6a00", "#fff3e3", "#24211d"],
    pageBackground: "#ffffff",
    textColor: "#5b5f66",
    titleColor: "#191b1f",
    subtitleColor: "#30343a",
    accentColor: "#ff6a00",
    accentAltColor: "#ff8f1f",
    mutedColor: "#6c7078",
    dividerColor: "#edf0f4",
    highlightColor: "rgba(255, 226, 85, 0.62)",
    underlineColor: "#ff6a00",
    shadow: "0 18px 42px rgba(176, 83, 12, 0.14)",
    paddingX: 24,
    paddingTop: 76,
    paddingBottom: 54,
    dividerHeight: 1,
    dividerMarginTop: 6,
    dividerMarginBottom: 28,
    titleWeight: 900,
    headingWeight: 900,
    subtitleWeight: 850,
    paragraphWeight: 650,
  },
};

export const THEME_OPTIONS: ThemeOption[] = Object.values(THEME_CONFIGS).map(
  ({ id, label, exportName, swatches }) => ({
    id,
    label,
    exportName,
    swatches,
  }),
);

export function resolveCardStyle(settings: CardStyleSettings): ResolvedCardStyle {
  const theme = THEME_CONFIGS[settings.themeId] ?? THEME_CONFIGS["apple-notes"];
  const font = FONT_OPTIONS.find((option) => option.id === settings.fontFamilyId) ?? FONT_OPTIONS[0];
  const baseFontSize = clamp(settings.baseFontSize, 14, 20);
  const themeScale = getThemeScale(theme.id);
  const titleFontSize = roundHalf(baseFontSize + themeScale.titleOffset);
  const headingFontSize = roundHalf(baseFontSize + themeScale.headingOffset);
  const subtitleFontSize = roundHalf(baseFontSize + themeScale.subtitleOffset);
  const paragraphFontSize = roundHalf(baseFontSize);
  const contentHeight = CARD_HEIGHT - theme.paddingTop - theme.paddingBottom - 14;

  return {
    settings: {
      themeId: theme.id,
      fontFamilyId: font.id,
      baseFontSize,
    },
    theme,
    font,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    contentWidth: CARD_WIDTH - theme.paddingX * 2,
    contentHeight,
    paddingX: theme.paddingX,
    paddingTop: theme.paddingTop,
    paddingBottom: theme.paddingBottom,
    title: {
      fontSize: titleFontSize,
      fontWeight: theme.titleWeight,
      lineHeight: roundHalf(titleFontSize + themeScale.titleLineOffset),
      marginBottom: themeScale.titleMarginBottom,
      color: theme.titleColor,
      ...getTitleDecoration(theme.id),
    },
    heading: {
      fontSize: headingFontSize,
      fontWeight: theme.headingWeight,
      lineHeight: roundHalf(headingFontSize + themeScale.headingLineOffset),
      marginBottom: themeScale.headingMarginBottom,
      color: getHeadingColor(theme.id, theme),
      ...getHeadingDecoration(theme.id, theme),
    },
    subtitle: {
      fontSize: subtitleFontSize,
      fontWeight: theme.subtitleWeight,
      lineHeight: roundHalf(subtitleFontSize + themeScale.subtitleLineOffset),
      marginBottom: themeScale.subtitleMarginBottom,
      color: theme.subtitleColor,
      ...getSubtitleDecoration(theme.id, theme),
    },
    paragraph: {
      fontSize: paragraphFontSize,
      fontWeight: theme.paragraphWeight,
      lineHeight: roundHalf(paragraphFontSize + 10.5),
      marginBottom: 10,
      color: theme.textColor,
      ...emptyDecoration(),
    },
    divider: {
      height: theme.dividerHeight,
      marginTop: theme.dividerMarginTop,
      marginBottom: theme.dividerMarginBottom,
      color: theme.dividerColor,
    },
    highlight: {
      color: theme.highlightColor,
    },
    underline: {
      color: theme.underlineColor,
      thickness: theme.id === "apple-notes" ? 1.2 : 1.35,
      offset: 4,
    },
  };
}

export function getThemeLabel(themeId: ThemeId) {
  return THEME_CONFIGS[themeId]?.label ?? THEME_CONFIGS["apple-notes"].label;
}

export function getFontLabel(fontFamilyId: FontFamilyId) {
  return FONT_OPTIONS.find((option) => option.id === fontFamilyId)?.label ?? FONT_OPTIONS[0].label;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function getThemeScale(themeId: ThemeId) {
  if (themeId === "bytedance") {
    return {
      titleOffset: 4.5,
      headingOffset: 3.5,
      subtitleOffset: 1.5,
      titleLineOffset: 10,
      headingLineOffset: 9,
      subtitleLineOffset: 10,
      titleMarginBottom: 18,
      headingMarginBottom: 20,
      subtitleMarginBottom: 15,
    };
  }

  if (themeId === "alibaba") {
    return {
      titleOffset: 4,
      headingOffset: 3,
      subtitleOffset: 1.5,
      titleLineOffset: 10,
      headingLineOffset: 8.5,
      subtitleLineOffset: 10,
      titleMarginBottom: 18,
      headingMarginBottom: 22,
      subtitleMarginBottom: 18,
    };
  }

  return {
    titleOffset: 2.5,
    headingOffset: 1,
    subtitleOffset: 0,
    titleLineOffset: 9,
    headingLineOffset: 8,
    subtitleLineOffset: 7.5,
    titleMarginBottom: 16,
    headingMarginBottom: 12,
    subtitleMarginBottom: 11,
  };
}

function getTitleDecoration(themeId: ThemeId): Omit<
  TextRoleStyle,
  "fontSize" | "fontWeight" | "lineHeight" | "marginBottom" | "color"
> {
  if (themeId === "bytedance") {
    return emptyDecoration();
  }

  if (themeId === "alibaba") {
    return emptyDecoration();
  }

  return emptyDecoration();
}

function getHeadingColor(themeId: ThemeId, theme: ThemeConfig) {
  if (themeId === "bytedance") return "#ffffff";
  if (themeId === "alibaba") return "#ffffff";
  return theme.titleColor;
}

function getHeadingDecoration(themeId: ThemeId, theme: ThemeConfig): Omit<
  TextRoleStyle,
  "fontSize" | "fontWeight" | "lineHeight" | "marginBottom" | "color"
> {
  if (themeId === "bytedance") {
    return {
      ...emptyDecoration(),
      backgroundColor: "linear-gradient(135deg, #1677ff 0%, #09c9d5 100%)",
      paddingTop: 7,
      paddingRight: 16,
      paddingBottom: 8,
      paddingLeft: 16,
    };
  }

  if (themeId === "alibaba") {
    return {
      ...emptyDecoration(),
      backgroundColor: "linear-gradient(135deg, #ff6a00 0%, #ff8f1f 100%)",
      paddingTop: 6,
      paddingRight: 8,
      paddingBottom: 7,
      paddingLeft: 8,
    };
  }

  return emptyDecoration();
}

function getSubtitleDecoration(themeId: ThemeId, theme: ThemeConfig): Omit<
  TextRoleStyle,
  "fontSize" | "fontWeight" | "lineHeight" | "marginBottom" | "color"
> {
  if (themeId === "bytedance") {
    return {
      ...emptyDecoration(),
      backgroundColor: "#f5f9ff",
      borderLeftColor: theme.accentColor,
      borderLeftWidth: 4,
      paddingTop: 8,
      paddingRight: 13,
      paddingBottom: 8,
      paddingLeft: 12,
    };
  }

  if (themeId === "alibaba") {
    return {
      ...emptyDecoration(),
      borderLeftColor: theme.accentColor,
      borderLeftWidth: 4,
      paddingLeft: 12,
    };
  }

  return emptyDecoration();
}

function emptyDecoration() {
  return {
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderLeftWidth: 0,
    borderBottomColor: "transparent",
    borderBottomWidth: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  };
}

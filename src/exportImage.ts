import { CARD_HEIGHT, CARD_WIDTH, type ResolvedCardStyle, type TextRoleStyle } from "./cardStyle";
import type { ContentBlock, InlineColor, PageModel, TextSegment } from "./types";

const EXPORT_SCALE = 2;
const INLINE_COLORS: Record<InlineColor, string> = {
  red: "#d93025",
  blue: "#1677ff",
};

type DrawTextOptions = {
  blockType: ContentBlock["type"];
  themeId: ResolvedCardStyle["theme"]["id"];
  font: string;
  fontFamily: string;
  fontSize: number;
  roleStyle: TextRoleStyle;
  color: string;
  lineHeight: number;
  marginBottom: number;
  maxWidth: number;
  x: number;
  y: number;
  highlight?: boolean;
  underline?: boolean;
  highlightColor: string;
  underlineColor: string;
  underlineThickness: number;
  underlineOffset: number;
};

type TextRun = {
  text: string;
  bold?: boolean;
  color?: InlineColor;
};

type RichLine = {
  runs: TextRun[];
  text: string;
  width: number;
};

export type ExportedImage = {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  file: File;
};

export async function exportPagesToPng(pages: PageModel[], cardStyle: ResolvedCardStyle) {
  return Promise.all(
    pages.map(async (page, index) => {
      const name = `xiaohongshu-${cardStyle.theme.exportName}-${String(index + 1).padStart(2, "0")}.png`;
      const blob = await drawPage(page, cardStyle);

      return {
        id: page.id,
        name,
        url: URL.createObjectURL(blob),
        blob,
        file: new File([blob], name, { type: "image/png" }),
      };
    }),
  );
}

export function measureBlocksForPng(blocks: ContentBlock[], cardStyle: ResolvedCardStyle) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Map<string, number>();

  return new Map(blocks.map((block) => [block.id, measureBlockHeight(ctx, block, cardStyle)]));
}

function measureBlockHeight(
  ctx: CanvasRenderingContext2D,
  block: ContentBlock,
  cardStyle: ResolvedCardStyle,
) {
  if (block.type === "hr") {
    return cardStyle.divider.marginTop + cardStyle.divider.height + cardStyle.divider.marginBottom;
  }

  const options = getTextOptions(block, 0, cardStyle);
  return measureWrappedText(ctx, block, options) + options.marginBottom;
}

async function drawPage(page: PageModel, cardStyle: ResolvedCardStyle): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = cardStyle.width * EXPORT_SCALE;
  canvas.height = cardStyle.height * EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  paintBackground(ctx, cardStyle);
  drawThemeChrome(ctx, cardStyle);

  let y = cardStyle.paddingTop;
  page.blocks.forEach((block) => {
    if (block.type === "hr") {
      y += cardStyle.divider.marginTop;
      ctx.fillStyle = cardStyle.divider.color;
      ctx.fillRect(cardStyle.paddingX, y, cardStyle.contentWidth, cardStyle.divider.height);
      y += cardStyle.divider.height + cardStyle.divider.marginBottom;
      return;
    }

    const options = getTextOptions(block, y, cardStyle);
    const usedHeight = drawWrappedText(ctx, block, options);
    y += usedHeight + options.marginBottom;
  });

  return canvasToBlob(canvas);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("PNG export failed."));
    }, "image/png");
  });
}

function paintBackground(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.fillStyle = cardStyle.theme.pageBackground;
  ctx.fillRect(0, 0, cardStyle.width, cardStyle.height);

  if (cardStyle.theme.id === "bytedance") {
    const gradient = ctx.createLinearGradient(0, 0, cardStyle.width, 0);
    gradient.addColorStop(0, "#1677ff");
    gradient.addColorStop(0.5, "#7662d6");
    gradient.addColorStop(1, "#ff2b21");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cardStyle.width, 8);

    ctx.fillStyle = "#eef3ff";
    roundRect(ctx, cardStyle.width - 56, 32, 36, 36, 18);
    ctx.fill();

    drawFooterBand(ctx, cardStyle, "#ffffff");
  }

  if (cardStyle.theme.id === "alibaba") {
    const gradient = ctx.createLinearGradient(0, 0, cardStyle.width, 0);
    gradient.addColorStop(0, "#ff6a00");
    gradient.addColorStop(1, "#ff8b2d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cardStyle.width, 8);

    ctx.fillStyle = "rgba(255, 106, 0, 0.08)";
    ctx.beginPath();
    ctx.arc(cardStyle.width - 30, 72, 39, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 106, 0, 0.05)";
    ctx.beginPath();
    ctx.arc(cardStyle.width - 1, 100, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 106, 0, 0.09)";
    ctx.beginPath();
    ctx.arc(cardStyle.width - 48, 114, 17, 0, Math.PI * 2);
    ctx.fill();

    drawAlibabaArc(ctx, cardStyle);
    drawFooterBand(ctx, cardStyle, "#fffdfb");
    ctx.fillStyle = "rgba(255, 106, 0, 0.12)";
    ctx.fillRect(0, cardStyle.height - 10, cardStyle.width, 10);
  }
}

function drawFooterBand(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle, color: string) {
  const y = cardStyle.height - 38;
  ctx.fillStyle = color;
  ctx.fillRect(0, y, cardStyle.width, 38);
  ctx.fillStyle = "#edf0f4";
  ctx.fillRect(0, y, cardStyle.width, 1);
}

function drawAlibabaArc(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 106, 0, 0.08)";
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.ellipse(cardStyle.width - 102, cardStyle.height - 70, 150, 62, 0.18, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawThemeChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  if (cardStyle.theme.id === "apple-notes") {
    drawAppleChrome(ctx, cardStyle);
    return;
  }

  if (cardStyle.theme.id === "bytedance") {
    drawByteDanceChrome(ctx, cardStyle);
    return;
  }

  drawAlibabaChrome(ctx, cardStyle);
}

function drawAppleChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  const shareX = cardStyle.width - 88;
  const moreX = cardStyle.width - 32;

  ctx.save();
  ctx.strokeStyle = cardStyle.theme.accentColor;
  ctx.fillStyle = cardStyle.theme.accentColor;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(35, 24);
  ctx.lineTo(27, 33);
  ctx.lineTo(35, 42);
  ctx.stroke();

  ctx.font = canvasFont(700, 16, cardStyle.font.canvasFamily);
  ctx.textBaseline = "top";
  ctx.fillText("备忘录", 50, 24);

  ctx.beginPath();
  ctx.moveTo(shareX, 25);
  ctx.lineTo(shareX, 39);
  ctx.moveTo(shareX, 25);
  ctx.lineTo(shareX - 6, 31);
  ctx.moveTo(shareX, 25);
  ctx.lineTo(shareX + 6, 31);
  ctx.moveTo(shareX - 8, 35);
  ctx.lineTo(shareX - 8, 46);
  ctx.lineTo(shareX + 8, 46);
  ctx.lineTo(shareX + 8, 35);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(moreX, 34, 11, 0, Math.PI * 2);
  ctx.stroke();

  [moreX - 6, moreX, moreX + 6].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 34, 1.25, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawByteDanceChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();

  ["#ffb6ad", "#ff8e83", "#ff655d", "#ff2b21"].forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cardStyle.width - 54 + index * 14, 17.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#8d96a6";
  ctx.beginPath();
  ctx.arc(28, cardStyle.height - 22, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#707986";
  ctx.beginPath();
  ctx.arc(36, cardStyle.height - 16, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAlibabaChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();

  ["#ffad63", "#ff9340", "#ff7d1a"].forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cardStyle.width - 41 + index * 12, 17.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#ff6a00";
  ctx.beginPath();
  ctx.arc(34, cardStyle.height - 19, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(31, cardStyle.height - 22, 1.35, 0, Math.PI * 2);
  ctx.arc(37, cardStyle.height - 22, 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(34, cardStyle.height - 19, 4, 0.28 * Math.PI, 0.72 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function getTextOptions(block: ContentBlock, y: number, cardStyle: ResolvedCardStyle): DrawTextOptions {
  const roleStyle = getRoleStyle(block, cardStyle);

  return {
    blockType: block.type,
    themeId: cardStyle.theme.id,
    font: canvasFont(roleStyle.fontWeight, roleStyle.fontSize, cardStyle.font.canvasFamily),
    fontFamily: cardStyle.font.canvasFamily,
    fontSize: roleStyle.fontSize,
    roleStyle,
    color: roleStyle.color,
    lineHeight: roleStyle.lineHeight,
    marginBottom: roleStyle.marginBottom,
    maxWidth: cardStyle.contentWidth,
    x: cardStyle.paddingX,
    y,
    highlight: block.type === "p" && block.highlight,
    underline: block.type === "p" && block.underline,
    highlightColor: cardStyle.highlight.color,
    underlineColor: cardStyle.underline.color,
    underlineThickness: cardStyle.underline.thickness,
    underlineOffset: cardStyle.underline.offset,
  };
}

function getRoleStyle(block: ContentBlock, cardStyle: ResolvedCardStyle): TextRoleStyle {
  if (block.type === "h1") return cardStyle.title;
  if (block.type === "h2") return cardStyle.heading;
  if (block.type === "h3") return cardStyle.subtitle;
  return cardStyle.paragraph;
}

function drawWrappedText(ctx: CanvasRenderingContext2D, block: ContentBlock, options: DrawTextOptions) {
  ctx.font = options.font;
  ctx.fillStyle = options.color;
  ctx.textBaseline = "top";

  const box = getTextBox(options);
  const textX = box.x + options.roleStyle.borderLeftWidth + options.roleStyle.paddingLeft;
  const textY = options.y + options.roleStyle.paddingTop;
  const textMaxWidth =
    box.width -
    options.roleStyle.borderLeftWidth -
    options.roleStyle.paddingLeft -
    options.roleStyle.paddingRight;
  const lines = wrapRichText(ctx, block, options, textMaxWidth);
  const textHeight = lines.length * options.lineHeight;
  const textBoxHeight =
    textHeight + options.roleStyle.paddingTop + options.roleStyle.paddingBottom + options.roleStyle.borderBottomWidth;
  const afterHeight = getAfterDecorationHeight(options);
  const totalHeight = textBoxHeight + afterHeight;

  if (options.roleStyle.backgroundColor !== "transparent") {
    ctx.fillStyle = getRoleBackground(ctx, options, box.x, box.width);
    if (box.radius > 0) {
      roundRect(ctx, box.x, options.y, box.width, textBoxHeight, box.radius);
      ctx.fill();
    } else {
      ctx.fillRect(box.x, options.y, box.width, textBoxHeight);
    }
  }

  if (options.themeId === "bytedance" && options.blockType === "h3") {
    ctx.strokeStyle = "#d9e8ff";
    ctx.lineWidth = 1;
    roundRect(ctx, box.x, options.y, box.width, textBoxHeight, 5);
    ctx.stroke();
    ctx.fillStyle = "rgba(9, 201, 213, 0.45)";
    ctx.fillRect(box.x + box.width - 7, options.y + textBoxHeight - 7, 7, 7);
  }

  if (options.roleStyle.borderLeftWidth > 0) {
    ctx.fillStyle = options.roleStyle.borderLeftColor;
    ctx.fillRect(box.x, options.y, options.roleStyle.borderLeftWidth, textBoxHeight);
  }

  if (options.roleStyle.borderBottomWidth > 0) {
    ctx.fillStyle = options.roleStyle.borderBottomColor;
    ctx.fillRect(
      box.x,
      options.y + textBoxHeight - options.roleStyle.borderBottomWidth,
      box.width,
      options.roleStyle.borderBottomWidth,
    );
  }

  ctx.fillStyle = options.color;
  if (options.highlight) {
    ctx.fillStyle = options.highlightColor;
    lines.forEach((line, index) => {
      const lineY = textY + index * options.lineHeight;
      const highlightRect = getHighlightRect(ctx, line.text, lineY, options);
      ctx.fillRect(
        textX - 3,
        highlightRect.y,
        Math.min(line.width + 6, textMaxWidth + 6),
        highlightRect.height,
      );
    });
    ctx.fillStyle = options.color;
  }

  lines.forEach((line, index) => {
    const lineY = textY + index * options.lineHeight;
    const lineWidth = Math.min(line.width, textMaxWidth);
    const lineX = box.align === "center" ? textX + (textMaxWidth - lineWidth) / 2 : textX;
    drawRichLine(ctx, line, lineX, lineY, options);
    if (options.underline) {
      drawWavyUnderline(
        ctx,
        lineX,
        lineY + options.lineHeight - options.underlineOffset,
        lineWidth,
        options.underlineColor,
        options.underlineThickness,
      );
    }
  });

  drawAfterTextDecoration(ctx, options, box.x, box.width, textBoxHeight);

  return totalHeight;
}

function getHighlightRect(
  ctx: CanvasRenderingContext2D,
  line: string,
  lineY: number,
  options: DrawTextOptions,
) {
  ctx.font = options.font;
  const metrics = ctx.measureText(line);
  const fallbackTop = lineY + Math.max(0, (options.lineHeight - options.fontSize) / 2);
  const fallbackBottom = fallbackTop + options.fontSize;
  const measuredTop = lineY - metrics.actualBoundingBoxAscent;
  const measuredBottom = lineY + metrics.actualBoundingBoxDescent;
  const hasUsableMetrics =
    Number.isFinite(measuredTop) &&
    Number.isFinite(measuredBottom) &&
    measuredBottom > measuredTop &&
    measuredTop >= lineY - options.lineHeight &&
    measuredBottom <= lineY + options.lineHeight * 1.5;
  const glyphTop = hasUsableMetrics ? measuredTop : fallbackTop;
  const glyphBottom = hasUsableMetrics ? measuredBottom : fallbackBottom;
  const glyphCenter = (glyphTop + glyphBottom) / 2;
  const verticalPadding = Math.max(3, Math.min(4, options.fontSize * 0.22));
  const height = Math.min(
    options.lineHeight - 1,
    Math.max(options.fontSize + 6, glyphBottom - glyphTop + verticalPadding * 2),
  );

  return {
    y: glyphCenter - height / 2,
    height,
  };
}

function measureWrappedText(ctx: CanvasRenderingContext2D, block: ContentBlock, options: DrawTextOptions) {
  ctx.font = options.font;

  const box = getTextBox(options);
  const textMaxWidth =
    box.width -
    options.roleStyle.borderLeftWidth -
    options.roleStyle.paddingLeft -
    options.roleStyle.paddingRight;
  const lines = wrapRichText(ctx, block, options, textMaxWidth);
  const textHeight = lines.length * options.lineHeight;
  const textBoxHeight =
    textHeight + options.roleStyle.paddingTop + options.roleStyle.paddingBottom + options.roleStyle.borderBottomWidth;

  return textBoxHeight + getAfterDecorationHeight(options);
}

function getTextBox(options: DrawTextOptions) {
  let x = options.x;
  let width = options.maxWidth;
  let radius = 0;
  let align: "left" | "center" = "left";

  if (options.themeId === "bytedance" && options.blockType === "h1") {
    align = "center";
  }

  if (options.themeId === "bytedance" && options.blockType === "h2") {
    x += 11;
    width -= 22;
    radius = 13;
    align = "center";
  }

  if (options.themeId === "bytedance" && options.blockType === "h3") {
    radius = 5;
  }

  if (options.themeId === "alibaba" && options.blockType === "h2") {
    radius = 999;
    align = "center";
  }

  return { x, width, radius, align };
}

function getAfterDecorationHeight(options: DrawTextOptions) {
  return options.blockType === "h1" && options.themeId !== "apple-notes" ? 16 : 0;
}

function drawAfterTextDecoration(
  ctx: CanvasRenderingContext2D,
  options: DrawTextOptions,
  boxX: number,
  boxWidth: number,
  textBoxHeight: number,
) {
  if (getAfterDecorationHeight(options) === 0) return;

  const width = 40;
  const height = 4;
  const y = options.y + textBoxHeight + 12;
  const x = options.themeId === "bytedance" ? boxX + (boxWidth - width) / 2 : boxX;

  ctx.fillStyle = getTitleAccentPaint(ctx, options.themeId, x, width);
  roundRect(ctx, x, y, width, height, 2);
  ctx.fill();
}

function getRoleBackground(
  ctx: CanvasRenderingContext2D,
  options: DrawTextOptions,
  x: number,
  width: number,
) {
  if (!options.roleStyle.backgroundColor.startsWith("linear-gradient")) {
    return options.roleStyle.backgroundColor;
  }

  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  if (options.themeId === "bytedance") {
    gradient.addColorStop(0, "#1677ff");
    gradient.addColorStop(1, "#09c9d5");
    return gradient;
  }

  gradient.addColorStop(0, "#ff6a00");
  gradient.addColorStop(1, "#ff8f1f");
  return gradient;
}

function getTitleAccentPaint(
  ctx: CanvasRenderingContext2D,
  themeId: ResolvedCardStyle["theme"]["id"],
  x: number,
  width: number,
) {
  if (themeId === "bytedance") {
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, "#1677ff");
    gradient.addColorStop(0.48, "#8164d9");
    gradient.addColorStop(1, "#ff2b21");
    return gradient;
  }

  return "#ff6a00";
}

function drawWavyUnderline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
  thickness: number,
) {
  const amplitude = 1.35;
  const halfWave = 4;
  const endX = x + width;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);

  for (let currentX = x; currentX < endX; currentX += halfWave * 2) {
    const midX = Math.min(currentX + halfWave, endX);
    const nextX = Math.min(currentX + halfWave * 2, endX);
    ctx.quadraticCurveTo(currentX + halfWave / 2, y - amplitude, midX, y);
    ctx.quadraticCurveTo(currentX + halfWave * 1.5, y + amplitude, nextX, y);
  }

  ctx.stroke();
  ctx.restore();
}

function wrapRichText(
  ctx: CanvasRenderingContext2D,
  block: ContentBlock,
  options: DrawTextOptions,
  maxWidth: number,
): RichLine[] {
  const lines: RichLine[] = [];
  let runs: TextRun[] = [];
  let width = 0;

  getBlockSegments(block).forEach((segment) => {
    Array.from(segment.text).forEach((char) => {
      const charWidth = measureRunText(ctx, { ...segment, text: char }, options);
      if (runs.length > 0 && width + charWidth > maxWidth) {
        lines.push(makeRichLine(runs, width));
        runs = [];
        width = 0;
      }

      appendRun(runs, { ...segment, text: char });
      width += charWidth;
    });
  });

  if (runs.length > 0) {
    lines.push(makeRichLine(runs, width));
  }

  return lines.length ? lines : [makeRichLine([{ text: "" }], 0)];
}

function drawRichLine(
  ctx: CanvasRenderingContext2D,
  line: RichLine,
  x: number,
  y: number,
  options: DrawTextOptions,
) {
  let currentX = x;

  line.runs.forEach((run) => {
    ctx.font = getRunFont(run, options);
    ctx.fillStyle = run.color ? INLINE_COLORS[run.color] : options.color;
    ctx.fillText(run.text, currentX, y);
    currentX += ctx.measureText(run.text).width;
  });
}

function getBlockSegments(block: ContentBlock): TextSegment[] {
  const segments = block.segments?.length ? block.segments : [{ text: block.text }];

  return segments
    .map((segment) => ({
      text: segment.text,
      bold: segment.bold || undefined,
      color: segment.color === "red" || segment.color === "blue" ? segment.color : undefined,
    }))
    .filter((segment) => segment.text.length > 0);
}

function appendRun(runs: TextRun[], run: TextRun) {
  const previous = runs[runs.length - 1];
  if (previous && previous.bold === run.bold && previous.color === run.color) {
    previous.text += run.text;
    return;
  }

  runs.push({ ...run });
}

function makeRichLine(runs: TextRun[], width: number): RichLine {
  return {
    runs,
    text: runs.map((run) => run.text).join(""),
    width,
  };
}

function measureRunText(ctx: CanvasRenderingContext2D, run: TextRun, options: DrawTextOptions) {
  ctx.font = getRunFont(run, options);
  return ctx.measureText(run.text).width;
}

function getRunFont(run: TextRun, options: DrawTextOptions) {
  const weight = run.bold ? Math.max(options.roleStyle.fontWeight, 800) : options.roleStyle.fontWeight;
  return canvasFont(weight, options.fontSize, options.fontFamily);
}

function canvasFont(weight: number, size: number, family: string) {
  return `${weight} ${size}px ${family}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  radius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export const canvasPageSize = {
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  contentHeight: CARD_HEIGHT - 72 - 24 - 14,
};

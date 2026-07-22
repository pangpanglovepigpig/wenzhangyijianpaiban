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

type ThemeId = ResolvedCardStyle["theme"]["id"];

type TextBox = {
  x: number;
  width: number;
  radius: number;
  align: "left" | "center";
};

type ThemePainter = {
  paintBackdrop: (ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) => void;
  drawChrome: (ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) => void;
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

const THEME_PAINTERS: Record<ThemeId, ThemePainter> = {
  "apple-notes": { paintBackdrop: noopThemePaint, drawChrome: drawAppleChrome },
  bytedance: { paintBackdrop: paintByteDanceBackdrop, drawChrome: drawByteDanceChrome },
  alibaba: { paintBackdrop: paintAlibabaBackdrop, drawChrome: drawAlibabaChrome },
  "turquoise-green": { paintBackdrop: paintTurquoiseBackdrop, drawChrome: drawTurquoiseChrome },
  "rouge-red": { paintBackdrop: paintRougeBackdrop, drawChrome: drawRougeChrome },
  "taro-purple": { paintBackdrop: paintTaroBackdrop, drawChrome: drawTaroChrome },
  "ink-scroll": { paintBackdrop: paintInkBackdrop, drawChrome: drawInkChrome },
  "cream-coffee": { paintBackdrop: paintCreamBackdrop, drawChrome: drawCreamChrome },
};

function paintBackground(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.fillStyle = cardStyle.theme.pageBackground;
  ctx.fillRect(0, 0, cardStyle.width, cardStyle.height);
  THEME_PAINTERS[cardStyle.theme.id].paintBackdrop(ctx, cardStyle);
}

function drawThemeChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  THEME_PAINTERS[cardStyle.theme.id].drawChrome(ctx, cardStyle);
}

function noopThemePaint() {}

function paintByteDanceBackdrop(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
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

function paintAlibabaBackdrop(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  const gradient = ctx.createLinearGradient(0, 0, cardStyle.width, 0);
  gradient.addColorStop(0, "#ff6a00");
  gradient.addColorStop(1, "#ff8b2d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cardStyle.width, 8);

  [
    { x: cardStyle.width - 30, y: 72, radius: 39, color: "rgba(255, 106, 0, 0.08)" },
    { x: cardStyle.width - 1, y: 100, radius: 31, color: "rgba(255, 106, 0, 0.05)" },
    { x: cardStyle.width - 48, y: 114, radius: 17, color: "rgba(255, 106, 0, 0.09)" },
  ].forEach(({ x, y, radius, color }) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  drawAlibabaArc(ctx, cardStyle);
  drawFooterBand(ctx, cardStyle, "#fffdfb");
  ctx.fillStyle = "rgba(255, 106, 0, 0.12)";
  ctx.fillRect(0, cardStyle.height - 10, cardStyle.width, 10);
}

function paintTurquoiseBackdrop(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.fillStyle = "rgba(65, 191, 167, 0.12)";
  ctx.beginPath();
  ctx.arc(cardStyle.width + 6, -10, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(65, 191, 167, 0.08)";
  ctx.beginPath();
  ctx.arc(cardStyle.width + 6, -10, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(65, 191, 167, 0.1)";
  ctx.beginPath();
  ctx.arc(-18, cardStyle.height + 14, 105, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(23, 107, 91, 0.18)";
  ctx.lineWidth = 1.2;
  [72, 90, 108].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(cardStyle.width + 16, cardStyle.height + 8, radius, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  });
  drawDotGrid(ctx, cardStyle.width - 68, 21, 4, 4, 11, "rgba(23, 107, 91, 0.42)");
  ctx.restore();
}

function paintRougeBackdrop(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.strokeStyle = "rgba(216, 58, 86, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 36; x < cardStyle.width; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cardStyle.height);
    ctx.stroke();
  }
  for (let y = 42; y < cardStyle.height; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cardStyle.width, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(242, 107, 107, 0.14)";
  ctx.beginPath();
  ctx.arc(cardStyle.width + 10, 18, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(216, 58, 86, 0.08)";
  ctx.beginPath();
  ctx.arc(cardStyle.width - 18, -4, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(242, 107, 107, 0.12)";
  ctx.beginPath();
  ctx.arc(-10, cardStyle.height + 8, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintTaroBackdrop(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  const gradient = ctx.createLinearGradient(0, 0, cardStyle.width, cardStyle.height);
  gradient.addColorStop(0, "#fffefe");
  gradient.addColorStop(0.58, "#fbf8ff");
  gradient.addColorStop(1, "#f1e9ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cardStyle.width, cardStyle.height);

  ctx.save();
  ctx.fillStyle = "rgba(154, 123, 209, 0.13)";
  ctx.beginPath();
  ctx.ellipse(cardStyle.width - 26, 20, 88, 54, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(184, 155, 232, 0.16)";
  ctx.beginPath();
  ctx.ellipse(34, cardStyle.height - 16, 105, 64, 0.35, 0, Math.PI * 2);
  ctx.fill();
  drawDotGrid(ctx, 18, 26, 3, 3, 10, "rgba(108, 77, 178, 0.22)");
  ctx.strokeStyle = "rgba(108, 77, 178, 0.34)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardStyle.width - 112, 24);
  ctx.lineTo(cardStyle.width - 82, 15);
  ctx.lineTo(cardStyle.width - 54, 29);
  ctx.lineTo(cardStyle.width - 28, 13);
  ctx.stroke();
  [
    [cardStyle.width - 112, 24],
    [cardStyle.width - 82, 15],
    [cardStyle.width - 54, 29],
    [cardStyle.width - 28, 13],
  ].forEach(([x, y]) => {
    ctx.fillStyle = "#9a7bd1";
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function paintInkBackdrop(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.fillStyle = "rgba(47, 124, 117, 0.075)";
  [
    [cardStyle.width - 52, 45, 58, 22],
    [cardStyle.width - 12, 58, 48, 18],
    [54, cardStyle.height - 45, 68, 24],
    [8, cardStyle.height - 25, 48, 18],
  ].forEach(([x, y, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = "rgba(96, 91, 74, 0.08)";
  ctx.lineWidth = 0.7;
  [
    [48, 86, 63, 82],
    [136, 32, 151, 35],
    [252, 104, 268, 99],
    [342, 186, 359, 181],
    [89, 348, 104, 345],
    [210, 514, 228, 510],
    [319, 441, 337, 445],
  ].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  ctx.restore();
}

function paintCreamBackdrop(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  const gradient = ctx.createLinearGradient(0, 0, cardStyle.width, cardStyle.height);
  gradient.addColorStop(0, "#fffdf7");
  gradient.addColorStop(1, "#fff4e6");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cardStyle.width, cardStyle.height);

  ctx.save();
  ctx.fillStyle = "rgba(201, 134, 79, 0.11)";
  ctx.beginPath();
  ctx.arc(cardStyle.width + 10, -10, 94, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(184, 111, 54, 0.18)";
  ctx.lineWidth = 1.1;
  [65, 82, 99].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(-12, cardStyle.height + 4, radius, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();
  });
  ctx.fillStyle = "rgba(201, 134, 79, 0.08)";
  ctx.fillRect(0, 0, 10, cardStyle.height);
  ctx.restore();
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

function drawTurquoiseChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.strokeStyle = "rgba(23, 107, 91, 0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardStyle.width / 2 - 38, cardStyle.height - 20);
  ctx.lineTo(cardStyle.width / 2 - 10, cardStyle.height - 20);
  ctx.moveTo(cardStyle.width / 2 + 10, cardStyle.height - 20);
  ctx.lineTo(cardStyle.width / 2 + 38, cardStyle.height - 20);
  ctx.stroke();
  [-5, 0, 5].forEach((offset) => {
    ctx.fillStyle = offset === 0 ? "#176b5b" : "#69cdb9";
    ctx.beginPath();
    ctx.arc(cardStyle.width / 2 + offset * 2, cardStyle.height - 20, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawRougeChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.strokeStyle = "rgba(216, 58, 86, 0.34)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(68, cardStyle.height - 20);
  ctx.lineTo(cardStyle.width / 2 - 26, cardStyle.height - 20);
  ctx.moveTo(cardStyle.width / 2 + 26, cardStyle.height - 20);
  ctx.lineTo(cardStyle.width - 68, cardStyle.height - 20);
  ctx.stroke();
  [-12, 0, 12].forEach((offset) => {
    ctx.fillStyle = offset === 0 ? "#d83a56" : "#f3a0af";
    ctx.beginPath();
    ctx.arc(cardStyle.width / 2 + offset, cardStyle.height - 20, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawTaroChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.strokeStyle = "rgba(108, 77, 178, 0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardStyle.width / 2 - 48, cardStyle.height - 20);
  ctx.lineTo(cardStyle.width / 2 - 12, cardStyle.height - 20);
  ctx.moveTo(cardStyle.width / 2 + 12, cardStyle.height - 20);
  ctx.lineTo(cardStyle.width / 2 + 48, cardStyle.height - 20);
  ctx.stroke();
  drawFourPointStar(ctx, cardStyle.width / 2, cardStyle.height - 20, 5, "#6c4db2");
  ctx.restore();
}

function drawInkChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.strokeStyle = "rgba(22, 78, 74, 0.62)";
  ctx.lineWidth = 1;
  ctx.strokeRect(13, 13, cardStyle.width - 26, cardStyle.height - 26);
  ctx.strokeStyle = "rgba(22, 78, 74, 0.28)";
  ctx.strokeRect(17, 17, cardStyle.width - 34, cardStyle.height - 34);
  ctx.strokeStyle = "#c9483b";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(cardStyle.width - 54, cardStyle.height - 54, 24, 24);
  ctx.strokeRect(cardStyle.width - 51, cardStyle.height - 51, 18, 18);
  ctx.fillStyle = "#2f7c75";
  [-8, 0, 8].forEach((offset) => {
    ctx.beginPath();
    ctx.arc(cardStyle.width / 2 + offset, cardStyle.height - 20, offset === 0 ? 2.5 : 1.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawCreamChrome(ctx: CanvasRenderingContext2D, cardStyle: ResolvedCardStyle) {
  ctx.save();
  ctx.fillStyle = "#c9864f";
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(42, 0);
  ctx.lineTo(42, 38);
  ctx.lineTo(34, 46);
  ctx.lineTo(14, 46);
  ctx.closePath();
  ctx.fill();
  drawFourPointStar(ctx, 28, 18, 4.5, "#fff9ef");
  ctx.strokeStyle = "rgba(184, 111, 54, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, cardStyle.height - 20);
  ctx.lineTo(cardStyle.width / 2 - 18, cardStyle.height - 20);
  ctx.moveTo(cardStyle.width / 2 + 18, cardStyle.height - 20);
  ctx.lineTo(cardStyle.width - 72, cardStyle.height - 20);
  ctx.stroke();
  drawFourPointStar(ctx, cardStyle.width / 2, cardStyle.height - 20, 4.5, "#b86f36");
  ctx.restore();
}

function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  columns: number,
  rows: number,
  gap: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      ctx.beginPath();
      ctx.arc(startX + column * gap, startY + row * gap, 1.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius * 0.28, y - radius * 0.28);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x + radius * 0.28, y + radius * 0.28);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius * 0.28, y + radius * 0.28);
  ctx.lineTo(x - radius, y);
  ctx.lineTo(x - radius * 0.28, y - radius * 0.28);
  ctx.closePath();
  ctx.fill();
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fill();
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

  drawTextBoxBackground(ctx, options, box, textBoxHeight);
  drawTextBoxFrame(ctx, options, box, textBoxHeight);

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

function drawTextBoxBackground(
  ctx: CanvasRenderingContext2D,
  options: DrawTextOptions,
  box: TextBox,
  height: number,
) {
  if (drawCustomTextBoxBackground(ctx, options, box, height)) return;
  if (options.roleStyle.backgroundColor === "transparent") return;

  ctx.fillStyle = getRoleBackground(ctx, options, box.x, box.width);
  if (box.radius > 0) {
    roundRect(ctx, box.x, options.y, box.width, height, box.radius);
    ctx.fill();
  } else {
    ctx.fillRect(box.x, options.y, box.width, height);
  }
}

function drawCustomTextBoxBackground(
  ctx: CanvasRenderingContext2D,
  options: DrawTextOptions,
  box: TextBox,
  height: number,
) {
  const y = options.y;

  if (options.themeId === "turquoise-green") {
    if (options.blockType === "h2") {
      const gradient = ctx.createLinearGradient(box.x, 0, box.x + box.width, 0);
      gradient.addColorStop(0, "#176b5b");
      gradient.addColorStop(0.78, "#176b5b");
      gradient.addColorStop(1, "#41bfa7");
      ctx.fillStyle = gradient;
      roundRect(ctx, box.x, y, box.width, height, 999);
      ctx.fill();
      return true;
    }
    if (options.blockType === "h3") {
      ctx.fillStyle = "#effaf7";
      roundRect(ctx, box.x, y, box.width, height, 9);
      ctx.fill();
      return true;
    }
  }

  if (options.themeId === "rouge-red") {
    if (options.blockType === "h2") {
      const fold = Math.min(34, height * 0.78);
      const gradient = ctx.createLinearGradient(box.x, 0, box.x + box.width, 0);
      gradient.addColorStop(0, "#d83a56");
      gradient.addColorStop(1, "#ef6677");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(box.x, y);
      ctx.lineTo(box.x + box.width - fold, y);
      ctx.lineTo(box.x + box.width, y + height / 2);
      ctx.lineTo(box.x + box.width - fold, y + height);
      ctx.lineTo(box.x, y + height);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(126, 24, 51, 0.42)";
      ctx.beginPath();
      ctx.moveTo(box.x + box.width - fold, y);
      ctx.lineTo(box.x + box.width - 7, y + height / 2);
      ctx.lineTo(box.x + box.width - fold, y + height * 0.72);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    if (options.blockType === "h3") {
      ctx.fillStyle = "rgba(255, 241, 243, 0.92)";
      roundRect(ctx, box.x, y, box.width, height, 9);
      ctx.fill();
      return true;
    }
  }

  if (options.themeId === "taro-purple") {
    if (options.blockType === "h1") {
      ctx.save();
      ctx.shadowColor = "rgba(86, 55, 132, 0.13)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
      roundRect(ctx, box.x, y, box.width, height, 10);
      ctx.fill();
      ctx.restore();
      return true;
    }
    if (options.blockType === "h2") return true;
    if (options.blockType === "h3") {
      const left = box.x + 12;
      const right = box.x + box.width - 12;
      ctx.fillStyle = "rgba(222, 208, 247, 0.7)";
      ctx.beginPath();
      ctx.moveTo(left, y + height * 0.3);
      ctx.lineTo(left + 48, y + height * 0.14);
      ctx.lineTo(right - 38, y + height * 0.23);
      ctx.lineTo(right, y + height * 0.42);
      ctx.lineTo(right - 25, y + height * 0.72);
      ctx.lineTo(left + 36, y + height * 0.84);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(184, 155, 232, 0.22)";
      ctx.fillRect(left + 10, y + height * 0.2, box.width - 42, height * 0.64);
      return true;
    }
  }

  if (options.themeId === "ink-scroll") {
    if (options.blockType === "h2") return true;
    if (options.blockType === "h3") {
      ctx.fillStyle = "rgba(226, 239, 234, 0.88)";
      ctx.beginPath();
      ctx.moveTo(box.x + 10, y + 2);
      ctx.lineTo(box.x + box.width - 8, y + 5);
      ctx.lineTo(box.x + box.width, y + height - 4);
      ctx.lineTo(box.x + 24, y + height);
      ctx.lineTo(box.x, y + height - 8);
      ctx.closePath();
      ctx.fill();
      return true;
    }
  }

  if (options.themeId === "cream-coffee") {
    if (options.blockType === "h2") {
      const radius = Math.min(18, height / 2);
      const gradient = ctx.createLinearGradient(box.x, 0, box.x + box.width, 0);
      gradient.addColorStop(0, "#b86f36");
      gradient.addColorStop(1, "#d39a66");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(box.x + 10, y);
      ctx.lineTo(box.x + box.width - radius, y);
      ctx.quadraticCurveTo(box.x + box.width, y, box.x + box.width, y + radius);
      ctx.lineTo(box.x + box.width, y + height - radius);
      ctx.quadraticCurveTo(
        box.x + box.width,
        y + height,
        box.x + box.width - radius,
        y + height,
      );
      ctx.lineTo(box.x + 10, y + height);
      ctx.lineTo(box.x, y + height - 10);
      ctx.lineTo(box.x, y + 10);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    if (options.blockType === "h3") {
      ctx.fillStyle = "rgba(245, 233, 217, 0.94)";
      ctx.beginPath();
      ctx.moveTo(box.x, y);
      ctx.lineTo(box.x + box.width - 16, y);
      ctx.lineTo(box.x + box.width, y + 16);
      ctx.lineTo(box.x + box.width, y + height);
      ctx.lineTo(box.x, y + height);
      ctx.closePath();
      ctx.fill();
      return true;
    }
  }

  return false;
}

function drawTextBoxFrame(
  ctx: CanvasRenderingContext2D,
  options: DrawTextOptions,
  box: TextBox,
  height: number,
) {
  const y = options.y;

  if (options.themeId === "bytedance" && options.blockType === "h3") {
    ctx.strokeStyle = "#d9e8ff";
    ctx.lineWidth = 1;
    roundRect(ctx, box.x, y, box.width, height, 5);
    ctx.stroke();
    ctx.fillStyle = "rgba(9, 201, 213, 0.45)";
    ctx.fillRect(box.x + box.width - 7, y + height - 7, 7, 7);
    return;
  }

  if (options.themeId === "turquoise-green") {
    if (options.blockType === "h1") {
      const markerHeight = Math.min(36, Math.max(28, height - 4));
      ctx.fillStyle = "#176b5b";
      ctx.beginPath();
      ctx.moveTo(box.x + 2, y + 2);
      ctx.lineTo(box.x + 27, y + 2);
      ctx.lineTo(box.x + 27, y + markerHeight);
      ctx.lineTo(box.x + 14.5, y + markerHeight - 9);
      ctx.lineTo(box.x + 2, y + markerHeight);
      ctx.closePath();
      ctx.fill();
    }
    if (options.blockType === "h2") {
      drawDotGrid(ctx, box.x + box.width - 48, y + height / 2 - 7, 3, 2, 9, "rgba(255,255,255,0.82)");
    }
    if (options.blockType === "h3") {
      ctx.fillStyle = "#176b5b";
      roundRect(ctx, box.x, y + 4, 5, Math.max(8, height - 8), 2.5);
      ctx.fill();
      [box.x + box.width - 30, box.x + box.width - 18].forEach((dotX, index) => {
        ctx.fillStyle = index === 0 ? "#13a88f" : "#79d5c1";
        ctx.beginPath();
        ctx.arc(dotX, y + height / 2, 3.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    return;
  }

  if (options.themeId === "rouge-red") {
    if (options.blockType === "h1") {
      ctx.strokeStyle = "#d83a56";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(box.x + 4, y + 30);
      ctx.lineTo(box.x + 4, y + 3);
      ctx.lineTo(box.x + 36, y + 3);
      ctx.stroke();
    }
    if (options.blockType === "h3") {
      ctx.strokeStyle = "rgba(216, 58, 86, 0.34)";
      ctx.lineWidth = 1;
      roundRect(ctx, box.x, y, box.width, height, 9);
      ctx.stroke();
      ctx.strokeStyle = "#d83a56";
      ctx.lineWidth = 1.5;
      [box.x + 12, box.x + 17].forEach((lineX) => {
        ctx.beginPath();
        ctx.moveTo(lineX, y + 7);
        ctx.lineTo(lineX, y + height - 7);
        ctx.stroke();
      });
      ctx.fillStyle = "#fff8f7";
      ctx.beginPath();
      ctx.arc(box.x + 25, y + height / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d83a56";
      ctx.stroke();
    }
    return;
  }

  if (options.themeId === "taro-purple") {
    if (options.blockType === "h1") {
      ctx.strokeStyle = "rgba(108, 77, 178, 0.7)";
      ctx.lineWidth = 1.2;
      roundRect(ctx, box.x, y, box.width, height, 10);
      ctx.stroke();
    }
    if (options.blockType === "h2") {
      ctx.strokeStyle = "#8a64cf";
      ctx.lineWidth = 1.5;
      roundRect(ctx, box.x, y, box.width, height, 10);
      ctx.stroke();
      ctx.fillStyle = "#6c4db2";
      ctx.beginPath();
      ctx.moveTo(box.x, y);
      ctx.lineTo(box.x + 40, y);
      ctx.lineTo(box.x + 50, y + height / 2);
      ctx.lineTo(box.x + 40, y + height);
      ctx.lineTo(box.x, y + height);
      ctx.closePath();
      ctx.fill();
    }
    if (options.blockType === "h3") {
      ctx.strokeStyle = "#6c4db2";
      ctx.lineWidth = 1.5;
      const size = 11;
      ctx.beginPath();
      ctx.moveTo(box.x + 5, y + size + 3);
      ctx.lineTo(box.x + 5, y + 3);
      ctx.lineTo(box.x + size + 5, y + 3);
      ctx.moveTo(box.x + box.width - size - 5, y + height - 3);
      ctx.lineTo(box.x + box.width - 5, y + height - 3);
      ctx.lineTo(box.x + box.width - 5, y + height - size - 3);
      ctx.stroke();
    }
    return;
  }

  if (options.themeId === "ink-scroll") {
    if (options.blockType === "h1") {
      ctx.strokeStyle = "#164e4a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(box.x + 42, y + 4);
      ctx.lineTo(box.x + box.width, y + 4);
      ctx.stroke();
      ctx.strokeStyle = "#c9483b";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(box.x + 3, y + 3, 26, 26);
    }
    if (options.blockType === "h2") {
      const centerY = y + height / 2;
      ctx.strokeStyle = "rgba(22, 78, 74, 0.72)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(box.x + 6, centerY);
      ctx.lineTo(box.x + 72, centerY);
      ctx.moveTo(box.x + box.width - 72, centerY);
      ctx.lineTo(box.x + box.width - 6, centerY);
      ctx.stroke();
      drawDiamond(ctx, box.x + 6, centerY, 4, "#164e4a");
      drawDiamond(ctx, box.x + box.width - 6, centerY, 4, "#164e4a");
    }
    if (options.blockType === "h3") {
      ctx.fillStyle = "rgba(22, 78, 74, 0.72)";
      ctx.fillRect(box.x + 4, y + 5, 6, Math.max(8, height - 10));
      ctx.fillStyle = "#c9483b";
      ctx.beginPath();
      ctx.arc(box.x + 30, y + height / 2, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (options.themeId === "cream-coffee") {
    if (options.blockType === "h2") {
      drawFourPointStar(ctx, box.x + 25, y + height / 2, 4.5, "#fff9ef");
    }
    if (options.blockType === "h3") {
      ctx.strokeStyle = "rgba(184, 111, 54, 0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(box.x, y);
      ctx.lineTo(box.x + box.width - 16, y);
      ctx.lineTo(box.x + box.width, y + 16);
      ctx.lineTo(box.x + box.width, y + height);
      ctx.lineTo(box.x, y + height);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = "#b86f36";
      ctx.lineWidth = 1.4;
      [box.x + 16, box.x + 21].forEach((lineX) => {
        ctx.beginPath();
        ctx.moveTo(lineX, y + 8);
        ctx.lineTo(lineX, y + height - 14);
        ctx.stroke();
      });
      ctx.fillStyle = "#b86f36";
      ctx.fillRect(box.x + 14, y + height - 11, 9, 9);
    }
  }
}

function getTextBox(options: DrawTextOptions): TextBox {
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

  if (options.themeId === "turquoise-green") {
    if (options.blockType === "h2") radius = 999;
    if (options.blockType === "h3") radius = 9;
  }

  if (options.themeId === "rouge-red") {
    if (options.blockType === "h2" || options.blockType === "h3") {
      x += 4;
      width -= 8;
    }
    if (options.blockType === "h3") radius = 9;
  }

  if (options.themeId === "taro-purple") {
    if (options.blockType === "h1" || options.blockType === "h2" || options.blockType === "h3") {
      x += 6;
      width -= 12;
    }
    if (options.blockType === "h1") align = "center";
    if (options.blockType === "h1" || options.blockType === "h2") radius = 10;
  }

  if (options.themeId === "ink-scroll" && options.blockType === "h2") {
    align = "center";
  }

  if (options.themeId === "cream-coffee") {
    if (options.blockType === "h2") {
      x += 2;
      width -= 4;
    }
    if (options.blockType === "h3") {
      x += 4;
      width -= 8;
    }
  }

  return { x, width, radius, align };
}

function getAfterDecorationHeight(options: DrawTextOptions) {
  if (options.blockType !== "h1") return 0;

  switch (options.themeId) {
    case "apple-notes":
      return 0;
    case "ink-scroll":
      return 10;
    case "turquoise-green":
    case "taro-purple":
    case "cream-coffee":
      return 14;
    default:
      return 16;
  }
}

function drawAfterTextDecoration(
  ctx: CanvasRenderingContext2D,
  options: DrawTextOptions,
  boxX: number,
  boxWidth: number,
  textBoxHeight: number,
) {
  if (getAfterDecorationHeight(options) === 0) return;

  const y = options.y + textBoxHeight;

  if (options.themeId === "bytedance" || options.themeId === "alibaba") {
    const width = 40;
    const lineY = y + 12;
    const x = options.themeId === "bytedance" ? boxX + (boxWidth - width) / 2 : boxX;
    ctx.fillStyle = getTitleAccentPaint(ctx, options.themeId, x, width);
    roundRect(ctx, x, lineY, width, 4, 2);
    ctx.fill();
    return;
  }

  if (options.themeId === "turquoise-green") {
    const x = boxX + 38;
    const width = Math.min(190, boxWidth - 52);
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, "#69cdb9");
    gradient.addColorStop(1, "#41bfa7");
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y + 7, width, 3, 1.5);
    ctx.fill();
    return;
  }

  if (options.themeId === "rouge-red") {
    const x = boxX + 18;
    const width = Math.min(boxWidth * 0.72, 250);
    ctx.save();
    ctx.strokeStyle = "#f05264";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.quadraticCurveTo(x + width * 0.45, y + 3, x + width, y + 7);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(216, 58, 86, 0.52)";
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 11);
    ctx.lineTo(x + width - 12, y + 10);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (options.themeId === "taro-purple") {
    const width = Math.min(160, boxWidth - 70);
    const x = boxX + (boxWidth - width) / 2;
    ctx.fillStyle = "#6c4db2";
    ctx.fillRect(x, y + 5, width, 2);
    ctx.fillStyle = "rgba(184, 155, 232, 0.8)";
    ctx.fillRect(x, y + 9, width, 2);
    [x - 12, x + width + 12].forEach((dotX) => {
      ctx.fillStyle = "#9a7bd1";
      ctx.beginPath();
      ctx.arc(dotX, y + 8, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }

  if (options.themeId === "ink-scroll") {
    const lineY = y + 5;
    ctx.strokeStyle = "rgba(22, 78, 74, 0.42)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxX + 42, lineY);
    ctx.lineTo(boxX + boxWidth, lineY);
    ctx.stroke();
    drawDiamond(ctx, boxX + boxWidth - 2, lineY, 3, "#c9483b");
    return;
  }

  if (options.themeId === "cream-coffee") {
    const lineY = y + 7;
    ctx.strokeStyle = "#c9864f";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(boxX + 30, lineY);
    ctx.lineTo(boxX + boxWidth - 8, lineY);
    ctx.stroke();
    drawFourPointStar(ctx, boxX + boxWidth - 8, lineY, 4, "#b86f36");
  }
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

  if (options.themeId === "turquoise-green") {
    gradient.addColorStop(0, "#176b5b");
    gradient.addColorStop(1, "#238b78");
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

  return themeId === "alibaba" ? "#ff6a00" : "#d83a56";
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

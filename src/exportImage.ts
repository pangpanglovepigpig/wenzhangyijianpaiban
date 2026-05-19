import type { ContentBlock, PageModel } from "./types";

const WIDTH = 440;
const HEIGHT = 586;
const EXPORT_SCALE = 2;
const PADDING_X = 20;
const PADDING_TOP = 72;
const PADDING_BOTTOM = 24;
const CONTENT_WIDTH = WIDTH - PADDING_X * 2;
const NOTES_YELLOW = "#f5be2e";

type DrawTextOptions = {
  font: string;
  color: string;
  lineHeight: number;
  maxWidth: number;
  x: number;
  y: number;
  highlight?: boolean;
  underline?: boolean;
};

export type ExportedImage = {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  file: File;
};

export async function exportPagesToPng(pages: PageModel[]) {
  return Promise.all(
    pages.map(async (page, index) => {
      const name = `xiaohongshu-note-${String(index + 1).padStart(2, "0")}.png`;
      const blob = await drawPage(page);

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

async function drawPage(page: PageModel): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * EXPORT_SCALE;
  canvas.height = HEIGHT * EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  paintBackground(ctx);
  drawNotesChrome(ctx);

  let y = PADDING_TOP;
  page.blocks.forEach((block) => {
    if (block.type === "hr") {
      y += 12;
      ctx.fillStyle = "#a6a6ad";
      ctx.fillRect(PADDING_X, y, CONTENT_WIDTH, 2);
      y += 18;
      return;
    }

    const options = getTextOptions(block, y);
    const usedHeight = drawWrappedText(ctx, block.text, options);
    y += usedHeight + getBlockGap(block);
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

function paintBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawNotesChrome(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = NOTES_YELLOW;
  ctx.fillStyle = NOTES_YELLOW;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(35, 24);
  ctx.lineTo(27, 33);
  ctx.lineTo(35, 42);
  ctx.stroke();

  ctx.font = "700 16px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("备忘录", 50, 24);

  ctx.beginPath();
  ctx.moveTo(352, 25);
  ctx.lineTo(352, 39);
  ctx.moveTo(352, 25);
  ctx.lineTo(346, 31);
  ctx.moveTo(352, 25);
  ctx.lineTo(358, 31);
  ctx.moveTo(344, 35);
  ctx.lineTo(344, 46);
  ctx.lineTo(360, 46);
  ctx.lineTo(360, 35);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(408, 34, 11, 0, Math.PI * 2);
  ctx.stroke();

  [402, 408, 414].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 34, 1.25, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function getTextOptions(block: ContentBlock, y: number): DrawTextOptions {
  if (block.type === "h1") {
    return {
      font: "700 19px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
      color: "#2d2d2f",
      lineHeight: 28,
      maxWidth: CONTENT_WIDTH,
      x: PADDING_X,
      y,
    };
  }

  if (block.type === "h3") {
    return {
      font: "700 16.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
      color: "#2d2d2f",
      lineHeight: 24,
      maxWidth: CONTENT_WIDTH,
      x: PADDING_X,
      y,
    };
  }

  return {
    font: "400 16.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
    color: "#2d2d2f",
    lineHeight: 27,
    maxWidth: CONTENT_WIDTH,
    x: PADDING_X,
    y,
    highlight: block.highlight,
    underline: block.underline,
  };
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, options: DrawTextOptions) {
  ctx.font = options.font;
  ctx.fillStyle = options.color;
  ctx.textBaseline = "top";

  const lines = wrapText(ctx, text, options.maxWidth);
  if (options.highlight) {
    ctx.fillStyle = "rgba(255, 226, 85, 0.62)";
    lines.forEach((line, index) => {
      const lineWidth = ctx.measureText(line).width;
      const y = options.y + index * options.lineHeight + 2;
      ctx.fillRect(options.x - 3, y, Math.min(lineWidth + 6, options.maxWidth + 6), 21);
    });
    ctx.fillStyle = options.color;
  }

  lines.forEach((line, index) => {
    const textY = options.y + index * options.lineHeight;
    ctx.fillText(line, options.x, textY);
    if (options.underline) {
      const width = Math.min(ctx.measureText(line).width, options.maxWidth);
      drawWavyUnderline(ctx, options.x, textY + options.lineHeight - 4, width);
    }
  });

  return lines.length * options.lineHeight;
}

function drawWavyUnderline(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  const amplitude = 1.35;
  const halfWave = 4;
  const endX = x + width;

  ctx.save();
  ctx.strokeStyle = "#d93025";
  ctx.lineWidth = 1.2;
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  Array.from(text).forEach((char) => {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function getBlockGap(block: ContentBlock): number {
  if (block.type === "h1") return 16;
  if (block.type === "h3") return 10;
  return 10;
}

export const canvasPageSize = {
  width: WIDTH,
  height: HEIGHT,
  contentHeight: HEIGHT - PADDING_TOP - PADDING_BOTTOM,
};

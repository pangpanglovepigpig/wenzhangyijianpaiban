import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileImage,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageDown,
  Minus,
  Plus,
  RefreshCcw,
  Rows3,
  Trash2,
  Underline,
} from "lucide-react";
import { exportPagesToPng, measureBlocksForPng, type ExportedImage } from "./exportImage";
import { downloadImage, downloadImagesSequentially, type DownloadProgress } from "./downloadImages";
import { blocksToMarkdown, createBlocksFromText, IMAGE_CONFIG, makeBlock, sampleArticle } from "./formatter";
import { paginateBlocks } from "./pagination";
import {
  DEFAULT_CARD_STYLE,
  FONT_OPTIONS,
  THEME_OPTIONS,
  resolveCardStyle,
  type ResolvedCardStyle,
} from "./cardStyle";
import type { CardStyleSettings, ContentBlock, FontFamilyId, PageModel } from "./types";

const ENABLE_AI_DRAFT = import.meta.env.VITE_ENABLE_AI_DRAFT === "true";

export function App() {
  const [sourceText, setSourceText] = useState(sampleArticle);
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => createBlocksFromText(sampleArticle));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageModel[]>([]);
  const [images, setImages] = useState<ExportedImage[]>([]);
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [isDraftGenerating, setIsDraftGenerating] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [previewRefreshNonce, setPreviewRefreshNonce] = useState(0);
  const [styleSettings, setStyleSettings] = useState<CardStyleSettings>(DEFAULT_CARD_STYLE);
  const previewRequestRef = useRef(0);
  const draftRequestRef = useRef(0);

  const markdown = useMemo(() => blocksToMarkdown(blocks), [blocks]);
  const cardStyle = useMemo(() => resolveCardStyle(styleSettings), [styleSettings]);
  const renderConfig = useMemo(
    () => ({ ...IMAGE_CONFIG, markdown, theme: cardStyle.theme.id, width: cardStyle.width, height: cardStyle.height }),
    [cardStyle.height, cardStyle.theme.id, cardStyle.width, markdown],
  );
  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;
  const canShareImages = images.length > 0 && canShareFiles(images);

  useEffect(() => {
    return () => {
      revokeImages(images);
    };
  }, [images]);

  useEffect(() => {
    if (!pages.length) {
      setImages([]);
      setIsPreviewRendering(false);
      return;
    }

    let isCancelled = false;
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setIsPreviewRendering(true);
    setPreviewError(null);

    const timeout = window.setTimeout(() => {
      exportPagesToPng(pages, cardStyle)
        .then((nextImages) => {
          if (isCancelled || previewRequestRef.current !== requestId) {
            revokeImages(nextImages);
            return;
          }

          setImages(nextImages);
          setIsPreviewRendering(false);
        })
        .catch(() => {
          if (isCancelled || previewRequestRef.current !== requestId) return;

          setPreviewError("预览生成失败，请再刷新一次。");
          setImages([]);
          setIsPreviewRendering(false);
        });
    }, 80);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [cardStyle, pages, previewRefreshNonce]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const nextHeights = measureBlocksForPng(blocks, cardStyle);
      setPages(paginateBlocks(blocks, nextHeights, cardStyle));
    });

    return () => cancelAnimationFrame(frame);
  }, [blocks, cardStyle]);

  function formatSourceText() {
    const nextBlocks = createBlocksFromText(sourceText);
    setBlocks(nextBlocks);
    setSelectedId(nextBlocks[0]?.id ?? null);
    setDraftError(null);
    setDraftNotice(null);
    clearImages();
  }

  async function generateDraft() {
    if (!ENABLE_AI_DRAFT) return;

    const requestId = draftRequestRef.current + 1;
    draftRequestRef.current = requestId;
    setIsDraftGenerating(true);
    setDraftError(null);
    setDraftNotice(null);

    try {
      const { generateDraftWithDeepSeek } = await import("./draftApi");
      const result = await generateDraftWithDeepSeek(sourceText);
      if (draftRequestRef.current !== requestId) return;

      setBlocks(result.blocks);
      setSelectedId(result.blocks[0]?.id ?? null);
      setDraftNotice(result.notice ?? null);
      clearImages();
    } catch (error) {
      if (draftRequestRef.current !== requestId) return;
      setDraftError(error instanceof Error ? error.message : "DeepSeek 生成失败，请稍后再试。");
    } finally {
      if (draftRequestRef.current === requestId) {
        setIsDraftGenerating(false);
      }
    }
  }

  function updateBlock(id: string, patch: Partial<ContentBlock>) {
    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== id) return block;
        const next = { ...block, ...patch };
        if (next.type !== "p") {
          next.highlight = false;
          next.underline = false;
        }
        return next;
      }),
    );
    clearImages();
  }

  function toggleType(type: ContentBlock["type"]) {
    if (!selectedBlock || type === "hr") return;
    updateBlock(selectedBlock.id, { type });
  }

  function toggleFlag(flag: "highlight" | "underline") {
    if (!selectedBlock || selectedBlock.type !== "p") return;
    updateBlock(
      selectedBlock.id,
      flag === "highlight"
        ? { highlight: !selectedBlock.highlight }
        : { underline: !selectedBlock.underline },
    );
  }

  function insertDividerAfter(id: string) {
    const divider = makeBlock("hr");
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      if (index === -1) return current;
      return [...current.slice(0, index + 1), divider, ...current.slice(index + 1)];
    });
    setSelectedId(divider.id);
    clearImages();
  }

  function insertTextBlockAfter(id: string) {
    const textBlock = makeBlock("p", "新的内容段落");
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      if (index === -1) return [...current, textBlock];
      return [...current.slice(0, index + 1), textBlock, ...current.slice(index + 1)];
    });
    setSelectedId(textBlock.id);
    clearImages();
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
    clearImages();
  }

  function updateStyleSettings(patch: Partial<CardStyleSettings>) {
    setStyleSettings((current) => ({ ...current, ...patch }));
    clearImages();
  }

  function exportImages() {
    setPreviewRefreshNonce((current) => current + 1);
  }

  function clearImages() {
    previewRequestRef.current += 1;
    setPreviewError(null);
    setImages([]);
  }

  async function saveAllImages() {
    if (!images.length || isDownloadingAll) return;

    setIsDownloadingAll(true);
    setDownloadProgress(null);

    try {
      if (canShareImages && (await shareImages(images))) return;
      await downloadImagesSequentially(images, setDownloadProgress);
    } finally {
      setIsDownloadingAll(false);
      window.setTimeout(() => setDownloadProgress(null), 1200);
    }
  }

  async function saveImage(image: ExportedImage) {
    if (await shareImages([image])) return;
    downloadImage(image);
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="input-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Article</p>
              <h1>小红书图文排版</h1>
            </div>
            <div className="input-actions">
              <button className="primary-button" onClick={formatSourceText} disabled={!sourceText.trim()}>
                <Rows3 size={18} />
                排版文章
              </button>
              {ENABLE_AI_DRAFT && (
                <button className="secondary-button" onClick={generateDraft} disabled={isDraftGenerating}>
                  <RefreshCcw size={18} />
                  {isDraftGenerating ? "AI生成中" : "生成初稿"}
                </button>
              )}
            </div>
          </div>

          <textarea
            className="source-input"
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              if (ENABLE_AI_DRAFT) {
                setDraftError(null);
                setDraftNotice(null);
              }
            }}
            aria-label="文章正文"
          />

          {ENABLE_AI_DRAFT && draftNotice && <div className="draft-notice">{draftNotice}</div>}
          {ENABLE_AI_DRAFT && draftError && <div className="draft-error">{draftError}</div>}

          <StyleSettingsPanel settings={styleSettings} cardStyle={cardStyle} onChange={updateStyleSettings} />

          <div className="config-strip">
            <span>{cardStyle.theme.label}</span>
            <span>{cardStyle.font.label}</span>
            <span>{cardStyle.settings.baseFontSize}px</span>
            <span>
              {renderConfig.width}×{renderConfig.height}
            </span>
            <span>{renderConfig.splitMode}</span>
          </div>
        </aside>

        <section className="editor-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Editor</p>
              <h2>排版编辑</h2>
            </div>
            <div className="toolbar" aria-label="排版工具">
              <button
                className={selectedBlock?.type === "h1" ? "tool active" : "tool"}
                onClick={() => toggleType("h1")}
                disabled={!selectedBlock || selectedBlock.type === "hr"}
                title="标题一"
              >
                <Heading1 size={18} />
              </button>
              <button
                className={selectedBlock?.type === "h2" ? "tool active" : "tool"}
                onClick={() => toggleType("h2")}
                disabled={!selectedBlock || selectedBlock.type === "hr"}
                title="标题二"
              >
                <Heading2 size={18} />
              </button>
              <button
                className={selectedBlock?.type === "h3" ? "tool active" : "tool"}
                onClick={() => toggleType("h3")}
                disabled={!selectedBlock || selectedBlock.type === "hr"}
                title="标题三"
              >
                <Heading3 size={18} />
              </button>
              <button
                className={selectedBlock?.highlight ? "tool active yellow" : "tool"}
                onClick={() => toggleFlag("highlight")}
                disabled={!selectedBlock || selectedBlock.type !== "p"}
                title="黄色高亮"
              >
                <Highlighter size={18} />
              </button>
              <button
                className={selectedBlock?.underline ? "tool active" : "tool"}
                onClick={() => toggleFlag("underline")}
                disabled={!selectedBlock || selectedBlock.type !== "p"}
                title="红色横线"
              >
                <Underline size={18} />
              </button>
            </div>
          </div>

          <div className="block-list">
            {blocks.map((block) => (
              <article
                key={block.id}
                className={selectedId === block.id ? "block-row selected" : "block-row"}
                onClick={() => setSelectedId(block.id)}
              >
                <div className="block-label">
                  {block.type === "h1" && <Heading1 size={16} />}
                  {block.type === "h2" && <Heading2 size={16} />}
                  {block.type === "h3" && <Heading3 size={16} />}
                  {block.type === "p" && <Rows3 size={16} />}
                  {block.type === "hr" && <Minus size={16} />}
                </div>

                {block.type === "hr" ? (
                  <div className="divider-editor" />
                ) : (
                  <textarea
                    className="block-text"
                    value={block.text}
                    onChange={(event) => updateBlock(block.id, { text: event.target.value, segments: undefined })}
                    onFocus={() => setSelectedId(block.id)}
                    rows={block.type === "h1" || block.type === "h2" ? 2 : 3}
                    aria-label="排版块文本"
                  />
                )}

                <div className="row-actions">
                  <button title="新增段落" onClick={() => insertTextBlockAfter(block.id)}>
                    <Plus size={16} />
                  </button>
                  <button title="新增分隔线" onClick={() => insertDividerAfter(block.id)}>
                    <Minus size={16} />
                  </button>
                  <button title="删除" onClick={() => removeBlock(block.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <details className="markdown-output">
            <summary>Markdown</summary>
            <textarea readOnly value={markdown} aria-label="Markdown 输出" />
          </details>
        </section>

        <section className="preview-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>{pages.length} 张图片</h2>
            </div>
            <div className="export-actions">
              <button className="primary-button" onClick={exportImages}>
                <FileImage size={18} />
                {isPreviewRendering ? "生成中" : "刷新预览"}
              </button>
              <button
                className="secondary-button"
                onClick={saveAllImages}
                disabled={!images.length || isPreviewRendering || isDownloadingAll}
              >
                <ImageDown size={18} />
                {isDownloadingAll
                  ? downloadProgress
                    ? `下载中 ${downloadProgress.current}/${downloadProgress.total}`
                    : canShareImages
                      ? "保存中"
                      : "准备中"
                  : canShareImages
                    ? "保存全部"
                    : "下载全部"}
              </button>
            </div>
          </div>

          <div className="preview-scroll" aria-busy={isPreviewRendering}>
            {previewError && <div className="preview-state error">{previewError}</div>}

            {images.length > 0 ? (
              images.map((image, index) => (
                <article className="preview-image-frame" key={image.id}>
                  <img
                    className="preview-image"
                    src={image.url}
                    width={cardStyle.width}
                    height={cardStyle.height}
                    alt={image.name}
                  />
                  <div className="preview-image-toolbar">
                    <span className="preview-image-number">{index + 1}</span>
                    <button className="download-link" onClick={() => saveImage(image)}>
                      <Download size={16} />
                      {canShareImages ? "保存" : "下载"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="preview-state">{isPreviewRendering ? "正在生成预览..." : "暂无预览"}</div>
            )}
          </div>
        </section>
      </section>

    </main>
  );
}

function revokeImages(images: ExportedImage[]) {
  images.forEach((image) => URL.revokeObjectURL(image.url));
}

function StyleSettingsPanel({
  settings,
  cardStyle,
  onChange,
}: {
  settings: CardStyleSettings;
  cardStyle: ResolvedCardStyle;
  onChange: (patch: Partial<CardStyleSettings>) => void;
}) {
  return (
    <section className="style-settings" aria-label="样式设置">
      <div className="style-setting-row">
        <span className="setting-label">主题</span>
        <div className="theme-segment" role="group" aria-label="主题">
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={settings.themeId === theme.id ? "theme-choice active" : "theme-choice"}
              onClick={() => onChange({ themeId: theme.id })}
            >
              <span className="theme-swatches" aria-hidden="true">
                {theme.swatches.map((color) => (
                  <span key={color} style={{ backgroundColor: color }} />
                ))}
              </span>
              <span>{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="style-setting-grid">
        <label className="field-control">
          <span className="setting-label">字体</span>
          <select
            value={settings.fontFamilyId}
            onChange={(event) => onChange({ fontFamilyId: event.target.value as FontFamilyId })}
            aria-label="字体"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-control">
          <span className="setting-label">
            字号 <strong>{cardStyle.settings.baseFontSize}px</strong>
          </span>
          <input
            type="range"
            min="14"
            max="20"
            step="0.5"
            value={settings.baseFontSize}
            onChange={(event) => onChange({ baseFontSize: Number(event.target.value) })}
            aria-label="字号"
          />
        </label>
      </div>
    </section>
  );
}

function canShareFiles(images: ExportedImage[]) {
  if (!images.length || typeof navigator.canShare !== "function") return false;
  return navigator.canShare({ files: images.map((image) => image.file) });
}

async function shareImages(images: ExportedImage[]) {
  if (!canShareFiles(images)) return false;

  try {
    await navigator.share({
      files: images.map((image) => image.file),
      title: images.length > 1 ? "小红书排版图片" : images[0].name,
    });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return true;
    return false;
  }
}

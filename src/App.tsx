import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Download,
  FileImage,
  Heading1,
  Heading3,
  Highlighter,
  ImageDown,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Rows3,
  Trash2,
  Underline,
  Upload,
} from "lucide-react";
import { exportPagesToPng, type ExportedImage } from "./exportImage";
import { blocksToMarkdown, createBlocksFromText, IMAGE_CONFIG, makeBlock, sampleArticle } from "./formatter";
import { paginateBlocks, PAGE_HEIGHT, PAGE_WIDTH } from "./pagination";
import type { ContentBlock, PageModel } from "./types";

export function App() {
  const [sourceText, setSourceText] = useState(sampleArticle);
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => createBlocksFromText(sampleArticle));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageModel[]>([]);
  const [images, setImages] = useState<ExportedImage[]>([]);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const markdown = useMemo(() => blocksToMarkdown(blocks), [blocks]);
  const renderConfig = useMemo(() => ({ ...IMAGE_CONFIG, markdown }), [markdown]);
  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;
  const canShareImages = images.length > 0 && canShareFiles(images);

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [images]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const nextHeights = new Map<string, number>();
      const nodes = measureRef.current?.querySelectorAll<HTMLElement>("[data-measure-id]");
      nodes?.forEach((node) => {
        nextHeights.set(node.dataset.measureId ?? "", Math.ceil(node.getBoundingClientRect().height) + 6);
      });
      setPages(paginateBlocks(blocks, nextHeights));
    });

    return () => cancelAnimationFrame(frame);
  }, [blocks]);

  function generateDraft() {
    const nextBlocks = createBlocksFromText(sourceText);
    setBlocks(nextBlocks);
    setSelectedId(nextBlocks[0]?.id ?? null);
    clearImages();
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

  async function exportImages() {
    const nextImages = await exportPagesToPng(pages);
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return nextImages;
    });
  }

  function clearImages() {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
  }

  async function saveAllImages() {
    if (await shareImages(images)) return;

    images.forEach((image, index) => {
      window.setTimeout(() => {
        downloadImage(image);
      }, index * 180);
    });
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
            <button className="primary-button" onClick={generateDraft}>
              <RefreshCcw size={18} />
              生成初稿
            </button>
          </div>

          <textarea
            className="source-input"
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            aria-label="文章正文"
          />

          <div className="config-strip">
            <span>{renderConfig.theme}</span>
            <span>{renderConfig.width}px</span>
            <span>{renderConfig.height}px</span>
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
                    onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                    onFocus={() => setSelectedId(block.id)}
                    rows={block.type === "h1" ? 2 : 3}
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
                生成图片
              </button>
              <button className="secondary-button" onClick={saveAllImages} disabled={!images.length}>
                <ImageDown size={18} />
                {canShareImages ? "保存全部" : "下载全部"}
              </button>
            </div>
          </div>

          <div className="page-grid">
            {pages.map((page, index) => (
              <div className="page-frame" key={page.id}>
                <NotePage blocks={page.blocks} />
                <span className="page-index">{index + 1}</span>
              </div>
            ))}
          </div>

          {images.length > 0 && (
            <div className="image-results">
              {images.map((image) => (
                <button key={image.id} className="download-link" onClick={() => saveImage(image)}>
                  <Download size={16} />
                  {canShareImages ? `保存 ${image.name}` : image.name}
                </button>
              ))}
            </div>
          )}
        </section>
      </section>

      <div className="measure-stage" aria-hidden="true" ref={measureRef}>
        {blocks.map((block) => (
          <MeasuredBlock key={block.id} block={block} />
        ))}
      </div>
    </main>
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

function downloadImage(image: ExportedImage) {
  const anchor = document.createElement("a");
  anchor.href = image.url;
  anchor.download = image.name;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function NotePage({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="note-page" style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}>
      <div className="apple-note-chrome" aria-hidden="true">
        <div className="apple-note-back">
          <ChevronLeft size={25} strokeWidth={2.6} />
          <span>备忘录</span>
        </div>
        <div className="apple-note-actions">
          <Upload size={22} strokeWidth={2.3} />
          <span className="apple-note-more">
            <MoreHorizontal size={18} strokeWidth={2.6} />
          </span>
        </div>
      </div>
      {blocks.map((block) => (
        <NoteBlock block={block} key={block.id} />
      ))}
    </div>
  );
}

function MeasuredBlock({ block }: { block: ContentBlock }) {
  return (
    <div className="note-page measure-page">
      <div data-measure-id={block.id}>
        <NoteBlock block={block} />
      </div>
    </div>
  );
}

function NoteBlock({ block }: { block: ContentBlock }) {
  if (block.type === "hr") return <hr className="note-divider" />;
  if (block.type === "h1") return <h1 className="note-title">{block.text}</h1>;
  if (block.type === "h3") return <h3 className="note-subtitle">{block.text}</h3>;

  return (
    <p className="note-paragraph">
      <span className={block.highlight ? "text-highlight" : undefined}>
        <span className={block.underline ? "text-underline" : undefined}>{block.text}</span>
      </span>
    </p>
  );
}

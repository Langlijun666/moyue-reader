import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { BookMeta, Progress } from "../types";
import { Icon } from "./Icons";
import { formatBytes } from "../lib/format";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfReaderProps {
  meta: BookMeta;
  data: ArrayBuffer;
  initialProgress?: Progress;
  onBack: () => void;
  onProgress: (progress: Progress) => void;
}

interface PdfTocItem {
  title: string;
  page: number;
  level: number;
}

interface PdfSearchResult {
  page: number;
  snippet: string;
}

interface HighlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SPREAD_KEY = "moyue.pdf.spread.v1";

function pageFromProgress(progress?: Progress): number {
  const match = progress?.cfi.match(/^pdf:(\d+)$/);
  return Math.max(1, Number(match?.[1] ?? 1));
}

async function resolveOutline(
  doc: PDFDocumentProxy,
  items: Array<{ title: string; dest?: unknown; items?: unknown[] }> | null,
  level = 0,
): Promise<PdfTocItem[]> {
  if (!items) return [];
  const result: PdfTocItem[] = [];
  for (const item of items) {
    let page: number | null = null;
    try {
      let destination = item.dest;
      if (typeof destination === "string") destination = await doc.getDestination(destination);
      if (Array.isArray(destination) && destination[0]) {
        page = (await doc.getPageIndex(destination[0] as Parameters<PDFDocumentProxy["getPageIndex"]>[0])) + 1;
      }
    } catch {
      // Ignore outline entries with a broken destination.
    }
    if (page) result.push({ title: item.title, page, level });
    result.push(
      ...(await resolveOutline(
        doc,
        (item.items as Array<{ title: string; dest?: unknown; items?: unknown[] }>) ?? [],
        level + 1,
      )),
    );
  }
  return result;
}

export function PdfReader({ meta, data, initialProgress, onBack, onProgress }: PdfReaderProps) {
  const canvasRefs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const renderTasksRef = useRef<{ cancel: () => void }[]>([]);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(() => pageFromProgress(initialProgress));
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [spread, setSpread] = useState(() => {
    try {
      return localStorage.getItem(SPREAD_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<PdfTocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<PdfSearchResult[]>([]);
  const [highlights, setHighlights] = useState<Record<number, HighlightBox[]>>({});
  const [highlightQuery, setHighlightQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ data: data.slice(0) });
    void task.promise
      .then((doc) => {
        if (cancelled) return;
        docRef.current = doc;
        setPageCount(doc.numPages);
        setPage((value) => Math.min(Math.max(1, value), doc.numPages));
        setLoading(false);
        void doc
          .getOutline()
          .then((outline) =>
            resolveOutline(
              doc,
              outline as Array<{ title: string; dest?: unknown; items?: unknown[] }> | null,
            ),
          )
          .then((items) => {
            if (!cancelled) setToc(items);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) {
          setError("无法打开这个 PDF");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      renderTasksRef.current.forEach((renderTask) => renderTask.cancel());
      void docRef.current?.cleanup();
      void task.destroy();
      docRef.current = null;
    };
  }, [data]);

  const renderPages = useCallback(async () => {
    const doc = docRef.current;
    if (!doc || loading) return;
    renderTasksRef.current.forEach((renderTask) => renderTask.cancel());
    renderTasksRef.current = [];
    const visible = spread ? [page, page + 1].filter((value) => value <= pageCount) : [page];
    try {
      for (let index = 0; index < visible.length; index += 1) {
        const canvas = canvasRefs[index].current;
        if (!canvas) continue;
        const rendered = await doc.getPage(visible[index]);
        const viewport = rendered.getViewport({ scale });
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d");
        if (!context) continue;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const task = rendered.render({ canvasContext: context, canvas, viewport });
        renderTasksRef.current.push(task);
        await task.promise;
        const boxes: HighlightBox[] = [];
        const query = highlightQuery.trim().toLowerCase();
        if (query) {
          const content = await rendered.getTextContent();
          for (const raw of content.items) {
            const item = raw as { str?: string; transform?: number[]; width?: number; height?: number };
            if (!item.str || !item.str.toLowerCase().includes(query)) continue;
            const transform = pdfjs.Util.transform(
              viewport.transform,
              (item.transform ?? [1, 0, 0, 1, 0, 0]) as [number, number, number, number, number, number],
            );
            const height = Math.max(8, Math.hypot(transform[2], transform[3]) || 12);
            boxes.push({
              left: transform[4],
              top: transform[5] - height,
              width: Math.max(8, (item.width ?? 0) * scale),
              height,
            });
          }
        }
        setHighlights((current) => ({ ...current, [visible[index]]: boxes }));
      }
      const lastPage = Math.min(pageCount, page + (spread ? 1 : 0));
      onProgress({
        cfi: `pdf:${page}`,
        percent: pageCount > 0 ? page / pageCount : 0,
        chapter: spread && lastPage > page ? `第 ${page}–${lastPage} 页` : `第 ${page} 页`,
        updatedAt: Date.now(),
      });
    } catch (renderError) {
      if ((renderError as { name?: string })?.name !== "RenderingCancelledException") {
        setError("这一页渲染失败");
      }
    }
  }, [highlightQuery, loading, onProgress, page, pageCount, scale, spread]);

  useEffect(() => {
    void renderPages();
  }, [renderPages]);

  useEffect(() => {
    try {
      localStorage.setItem(SPREAD_KEY, spread ? "1" : "0");
    } catch {
      // Preference persistence is optional.
    }
  }, [spread]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      const step = spread ? 2 : 1;
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setPage((value) => Math.max(1, value - step));
      } else if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        setPage((value) => Math.min(pageCount || 1, value + step));
      } else if (event.key === "Home") {
        event.preventDefault();
        setPage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        setPage(pageCount || 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageCount, spread]);

  const go = (delta: number) => {
    const step = spread ? 2 : 1;
    setPage((value) => Math.min(pageCount || 1, Math.max(1, value + delta * step)));
  };

  const searchPdf = async () => {
    const doc = docRef.current;
    const query = searchQuery.trim();
    if (!doc || !query || searching) return;
    setSearching(true);
    setSearchProgress(0);
    setSearchResults([]);
    setHighlightQuery(query);
    const results: PdfSearchResult[] = [];
    try {
      for (let current = 1; current <= pageCount; current += 1) {
        const pdfPage = await doc.getPage(current);
        const content = await pdfPage.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ");
        const lower = text.toLowerCase();
        let from = 0;
        const needle = query.toLowerCase();
        while (results.length < 200) {
          const index = lower.indexOf(needle, from);
          if (index < 0) break;
          results.push({
            page: current,
            snippet: text.slice(Math.max(0, index - 28), index + query.length + 48).trim(),
          });
          from = index + Math.max(1, query.length);
        }
        setSearchProgress(current / Math.max(1, pageCount));
        if (results.length >= 200) break;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
      setSearchResults(results);
      if (results.length > 0) {
        setPage(results[0].page);
      }
    } catch {
      setError("PDF 搜索失败");
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="pdf-reader">
      <header className="pdf-reader__head">
        <button className="icon-button" onClick={onBack} aria-label="回到书架">
          <Icon name="left" size={18} />
        </button>
        <div className="pdf-reader__title">
          <strong>{meta.title}</strong>
          <small>
            PDF · {formatBytes(meta.size)} · {pageCount > 0 ? `${page}/${pageCount} 页` : "正在载入"}
          </small>
        </div>
        <div className="pdf-reader__tools">
          <button
            className="pdf-reader__spread-button"
            onClick={() => setSpread((value) => !value)}
            title="切换单页 / 双页"
          >
            {spread ? "双页" : "单页"}
          </button>
          <button
            className="icon-button"
            onClick={() => setSearchOpen((value) => !value)}
            aria-label="搜索 PDF"
            title="全文搜索"
          >
            <Icon name="search" size={17} />
          </button>
          <button
            className="icon-button"
            onClick={() => setTocOpen((value) => !value)}
            disabled={toc.length === 0}
            aria-label="PDF 目录"
            title={toc.length > 0 ? "目录" : "这个 PDF 没有目录"}
          >
            <Icon name="list" size={17} />
          </button>
          <button className="icon-button" onClick={() => setScale((value) => Math.max(0.6, value - 0.15))} aria-label="缩小">
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button className="icon-button" onClick={() => setScale((value) => Math.min(3, value + 0.15))} aria-label="放大">
            +
          </button>
        </div>
      </header>

      {searchOpen ? (
        <aside className="pdf-reader__toc pdf-reader__search">
          <div className="pdf-reader__toc-head">
            <strong>全文搜索</strong>
            <button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="关闭搜索">
              <Icon name="x" size={15} />
            </button>
          </div>
          <div className="pdf-reader__search-row">
            <input
              autoFocus
              value={searchQuery}
              placeholder="输入关键词"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void searchPdf();
              }}
            />
            <button className="text-button" onClick={() => void searchPdf()} disabled={searching}>
              {searching ? "搜索中" : "搜索"}
            </button>
          </div>
          {searching ? (
            <div className="tts-progress pdf-reader__search-progress" aria-hidden="true">
              <span style={{ width: `${Math.round(searchProgress * 100)}%` }} />
            </div>
          ) : null}
          {searchResults.map((item, index) => (
            <button
              key={`${item.page}-${index}`}
              className="pdf-reader__search-result"
              onClick={() => {
                setPage(item.page);
                setSearchOpen(false);
              }}
            >
              <small>第 {item.page} 页</small>
              <span>{item.snippet}</span>
            </button>
          ))}
          {!searching && searchResults.length === 0 && searchQuery ? (
            <p className="pdf-reader__search-empty">没有找到匹配内容</p>
          ) : null}
        </aside>
      ) : null}

      {tocOpen ? (
        <aside className="pdf-reader__toc">
          <div className="pdf-reader__toc-head">
            <strong>目录</strong>
            <button className="icon-button" onClick={() => setTocOpen(false)} aria-label="关闭目录">
              <Icon name="x" size={15} />
            </button>
          </div>
          {toc.map((item, index) => (
            <button
              key={`${item.page}-${item.title}-${index}`}
              className={`pdf-reader__toc-item ${item.level > 0 ? "pdf-reader__toc-item--sub" : ""}`}
              onClick={() => {
                setPage(item.page);
                setTocOpen(false);
              }}
            >
              <span>{item.title}</span>
              <small>{item.page}</small>
            </button>
          ))}
        </aside>
      ) : null}

      <div className={`pdf-reader__viewport ${spread ? "pdf-reader__viewport--spread" : ""}`}>
        {loading ? <div className="pdf-reader__hint">正在打开 PDF…</div> : null}
        {error ? <div className="pdf-reader__hint pdf-reader__hint--error">{error}</div> : null}
        <div className="pdf-reader__pages">
          <div className="pdf-reader__page">
            <canvas ref={canvasRefs[0]} className="pdf-reader__canvas" />
            {(highlights[page] ?? []).map((box, index) => (
              <span
                key={index}
                className="pdf-reader__highlight"
                style={{
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                }}
              />
            ))}
          </div>
          {spread ? (
            <div className="pdf-reader__page">
              <canvas ref={canvasRefs[1]} className="pdf-reader__canvas" />
              {(highlights[page + 1] ?? []).map((box, index) => (
                <span
                  key={index}
                  className="pdf-reader__highlight"
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="pdf-reader__footer">
        <button className="page-button" onClick={() => go(-1)} disabled={page <= 1}>
          <Icon name="left" size={17} />
          <span>上一页</span>
        </button>
        <label className="pdf-reader__page">
          <input
            type="number"
            min={1}
            max={pageCount || 1}
            value={page}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) setPage(Math.min(pageCount || 1, Math.max(1, value)));
            }}
          />
          <span>/ {pageCount || "—"}</span>
        </label>
        <button className="page-button" onClick={() => go(1)} disabled={pageCount === 0 || page >= pageCount}>
          <span>下一页</span>
          <Icon name="right" size={17} />
        </button>
      </footer>
    </section>
  );
}

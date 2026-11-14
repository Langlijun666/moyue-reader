import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
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

function pageFromProgress(progress?: Progress): number {
  const match = progress?.cfi.match(/^pdf:(\d+)$/);
  return Math.max(1, Number(match?.[1] ?? 1));
}

export function PdfReader({ meta, data, initialProgress, onBack, onProgress }: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [page, setPage] = useState(() => pageFromProgress(initialProgress));
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ data: data.slice(0) });
    void task.promise
      .then((doc) => {
        if (cancelled) {
          return;
        }
        docRef.current = doc;
        setPageCount(doc.numPages);
        setPage((value) => Math.min(Math.max(1, value), doc.numPages));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("无法打开这个 PDF");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      void docRef.current?.cleanup();
      void task.destroy();
      docRef.current = null;
    };
  }, [data]);

  const renderPage = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loading) return;
    renderTaskRef.current?.cancel();
    try {
      const rendered = await doc.getPage(page);
      if (!canvasRef.current) return;
      pageRef.current = rendered;
      const viewport = rendered.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const task = rendered.render({ canvasContext: context, canvas, viewport });
      renderTaskRef.current = task;
      await task.promise;
      onProgress({
        cfi: `pdf:${page}`,
        percent: pageCount > 0 ? page / pageCount : 0,
        chapter: `第 ${page} 页`,
        updatedAt: Date.now(),
      });
    } catch (renderError) {
      if ((renderError as { name?: string })?.name !== "RenderingCancelledException") {
        setError("这一页渲染失败");
      }
    }
  }, [loading, onProgress, page, pageCount, scale]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  const go = (delta: number) => {
    setPage((value) => Math.min(pageCount || 1, Math.max(1, value + delta)));
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
          <button className="icon-button" onClick={() => setScale((value) => Math.max(0.6, value - 0.15))} aria-label="缩小">
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button className="icon-button" onClick={() => setScale((value) => Math.min(3, value + 0.15))} aria-label="放大">
            +
          </button>
        </div>
      </header>

      <div className="pdf-reader__viewport">
        {loading ? <div className="pdf-reader__hint">正在打开 PDF…</div> : null}
        {error ? <div className="pdf-reader__hint pdf-reader__hint--error">{error}</div> : null}
        <canvas ref={canvasRef} className="pdf-reader__canvas" />
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

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import {
  WENKU8_FEEDS,
  downloadWenku8Epub,
  loadWenku8Feed,
  readWenku8Source,
  searchWenku8,
  type Wenku8Book,
  type Wenku8FeedResult,
} from "../lib/wenku8Store";

interface Wenku8StoreProps {
  onImport: (file: File, open?: boolean) => Promise<void>;
}

const SKELETON_COUNT = 10;

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function Wenku8Store({ onImport }: Wenku8StoreProps) {
  const [feed, setFeed] = useState<string>(WENKU8_FEEDS[0].id);
  const [page, setPage] = useState(1);
  const [books, setBooks] = useState<Wenku8Book[]>([]);
  const [feedTitle, setFeedTitle] = useState("最近更新");
  const [hasNext, setHasNext] = useState(false);
  const [mode, setMode] = useState<"feed" | "search">("feed");
  const [term, setTerm] = useState("");
  const [appliedTerm, setAppliedTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Wenku8Book | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const applyResult = useCallback((result: Wenku8FeedResult) => {
    setBooks(result.books);
    setHasNext(result.hasNext);
    setPage(result.page);
  }, []);

  const loadFeed = useCallback(
    async (feedId: string, targetPage: number) => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      const definition = WENKU8_FEEDS.find((item) => item.id === feedId) ?? WENKU8_FEEDS[0];
      setMode("feed");
      setFeed(feedId);
      setFeedTitle(definition.label);
      setLoading(true);
      setError(null);
      setBooks([]);
      try {
        const result = await loadWenku8Feed(definition.path, targetPage);
        if (requestRef.current !== request) return;
        applyResult(result);
      } catch (loadError) {
        if (requestRef.current !== request) return;
        setError(errorMessage(loadError, "轻小说目录加载失败，请稍后再试"));
        setBooks([]);
      } finally {
        if (requestRef.current === request) setLoading(false);
      }
    },
    [applyResult],
  );

  const runSearch = useCallback(async (value: string) => {
    const keyword = value.trim();
    if (!keyword) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    setMode("search");
    setAppliedTerm(keyword);
    setFeedTitle(`“${keyword}”的搜索结果`);
    setLoading(true);
    setError(null);
    setBooks([]);
    try {
      const result = await searchWenku8(keyword);
      if (requestRef.current !== request) return;
      applyResult(result);
    } catch (searchError) {
      if (requestRef.current !== request) return;
      setError(errorMessage(searchError, "搜索轻小说失败，请稍后再试"));
      setBooks([]);
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    void loadFeed(WENKU8_FEEDS[0].id, 1);
  }, [loadFeed]);

  useEffect(() => {
    if (!detail) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail]);

  const changePage = (target: number) => {
    if (loading || target < 1 || target === page || (target > page && !hasNext)) return;
    void loadFeed(feed, target);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openDetail = (book: Wenku8Book) => {
    setDetail(book);
    setNotice(null);
    setDetailError(null);
    setProgress(null);
  };

  const startDownload = async (book: Wenku8Book, openAfter: boolean) => {
    if (downloading) return;
    setDownloading(book.id);
    setProgress(null);
    setDetailError(null);
    setNotice(null);
    try {
      const download = await downloadWenku8Epub(book, (done, total) => {
        setProgress(total > 0 ? done / total : null);
      });
      try {
        for (let index = 0; index < download.sources.length; index += 1) {
          const file = await readWenku8Source(download.sources[index]);
          await onImport(file, openAfter && index === 0);
        }
        if (openAfter) {
          setDetail(null);
        } else {
          setNotice(
            download.sources.length > 1
              ? `《${book.title}》已分成 ${download.sources.length} 卷并放进书架`
              : `《${book.title}》已经放进书架`,
          );
        }
      } finally {
        await download.finish();
      }
    } catch (downloadError) {
      setDetailError(
        errorMessage(
          downloadError,
          "EPUB 下载失败。这个服务偶尔需要先生成文件，可以稍后重试。",
        ),
      );
    } finally {
      setDownloading(null);
      setProgress(null);
    }
  };

  const progressLabel =
    progress === null
      ? "正在连接 EPUB 服务…"
      : `${Math.round(progress * 100)}%`;

  return (
    <div className="book-store wenku8-store">
      <div className="store-hero">
        <span className="eyebrow">WENKU8 · 轻小说文库</span>
        <h2>
          轻小说，
          <br />
          也放进书架。
        </h2>
        <form
          className="online-store__search store-search"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(term);
          }}
        >
          <input
            value={term}
            placeholder="搜索书名或作者"
            aria-label="搜索轻小说文库"
            onChange={(event) => setTerm(event.target.value)}
          />
          <button className="button button--primary" type="submit" disabled={loading}>
            <Icon name="search" size={16} />
            {mode === "search" && loading ? "正在搜索…" : "搜索"}
          </button>
        </form>
        <p className="store-hero__note">
          目录与 EPUB 由第三方 Wenku8 OPDS 服务提供，仅供个人阅读；版权受限的书目可能无法生成文件。
        </p>
      </div>

      <div className="store-cats" role="tablist" aria-label="轻小说榜单">
        {WENKU8_FEEDS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === "feed" && feed === item.id}
            className={mode === "feed" && feed === item.id ? "is-active" : ""}
            onClick={() => {
              if (mode === "feed" && feed === item.id) return;
              setTerm("");
              void loadFeed(item.id, 1);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="store-bar">
        <div className="store-bar__title">
          <h3>{feedTitle}</h3>
          <span>
            {loading
              ? "正在加载…"
              : mode === "search"
                ? `找到 ${books.length} 本`
                : `第 ${page} 页`}
          </span>
        </div>
        {mode === "feed" ? (
          <div className="store-pager">
            <button
              type="button"
              className="icon-button"
              aria-label="上一页"
              disabled={loading || page <= 1}
              onClick={() => changePage(page - 1)}
            >
              <Icon name="left" size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="下一页"
              disabled={loading || !hasNext}
              onClick={() => changePage(page + 1)}
            >
              <Icon name="right" size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-button store-bar__back"
            onClick={() => {
              setTerm("");
              void loadFeed(feed, 1);
            }}
          >
            返回榜单
          </button>
        )}
      </div>

      {error ? (
        <div className="store-error">
          <p>{error}</p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (mode === "search") void runSearch(appliedTerm);
              else void loadFeed(feed, page);
            }}
          >
            重新加载
          </button>
        </div>
      ) : null}

      <div className="online-store__grid" ref={gridRef}>
        {loading && books.length === 0
          ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <div
                className="online-book-card store-card store-card--skeleton"
                key={`skeleton-${index}`}
                aria-hidden="true"
              >
                <div className="online-book-card__cover" />
                <div className="online-book-card__body">
                  <span className="store-skeleton__line" />
                  <span className="store-skeleton__line store-skeleton__line--short" />
                </div>
              </div>
            ))
          : null}

        {books.map((book) => (
          <article
            key={book.id}
            className="online-book-card store-card"
            role="button"
            tabIndex={0}
            aria-label={`${book.title}${book.author ? `，${book.author}` : ""}`}
            onClick={() => openDetail(book)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDetail(book);
              }
            }}
          >
            <div className="online-book-card__cover store-card__cover">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <span className="store-card__fallback">{book.title}</span>
              )}
            </div>
            <div className="online-book-card__body">
              <strong title={book.title}>{book.title}</strong>
              <small>{book.author || "作者未知"}</small>
            </div>
          </article>
        ))}
      </div>

      {!loading && books.length === 0 && !error ? (
        <p className="online-store__empty">
          {mode === "search" ? "没有找到这本轻小说，换个书名或作者试试。" : "这个榜单暂时没有书。"}
        </p>
      ) : null}

      {mode === "feed" && !loading && !error && books.length > 0 ? (
        <div className="store-pager store-pager--bottom">
          <button
            type="button"
            className="button button--ghost"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
          >
            <Icon name="left" size={14} />
            上一页
          </button>
          <span className="store-pager__label">第 {page} 页</span>
          <button
            type="button"
            className="button button--ghost"
            disabled={!hasNext}
            onClick={() => changePage(page + 1)}
          >
            下一页
            <Icon name="right" size={14} />
          </button>
        </div>
      ) : null}

      {detail ? (
        <div
          className="store-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={`${detail.title} 详情`}
          onClick={() => setDetail(null)}
        >
          <div className="store-sheet__panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="icon-button store-sheet__close"
              aria-label="关闭详情"
              onClick={() => setDetail(null)}
            >
              <Icon name="x" size={18} />
            </button>

            <div className="store-sheet__cover">
              {detail.coverUrl ? <img src={detail.coverUrl} alt="" referrerPolicy="no-referrer" /> : <span>{detail.title}</span>}
            </div>

            <div className="store-sheet__body">
              <span className="eyebrow">
                轻小说文库
                {detail.updated ? ` · 更新 ${detail.updated}` : ""}
              </span>
              <h2>{detail.title}</h2>
              <p className="store-sheet__author">{detail.author || "作者未知"} 著</p>

              {detailError ? <p className="store-sheet__error">{detailError}</p> : null}
              {detail.summary ? (
                <p className="store-sheet__intro">{detail.summary}</p>
              ) : null}

              <div className="store-sheet__actions">
                <button
                  type="button"
                  className="button button--primary"
                  disabled={downloading !== null}
                  onClick={() => void startDownload(detail, true)}
                >
                  <Icon name="download" size={16} />
                  {downloading === detail.id ? "正在准备 EPUB…" : "下载 EPUB 并阅读"}
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={downloading !== null}
                  onClick={() => void startDownload(detail, false)}
                >
                  只放进书架
                </button>
              </div>

              {downloading === detail.id ? (
                <p className="store-sheet__notice">{progressLabel}</p>
              ) : null}
              {notice ? <p className="store-sheet__notice">{notice}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

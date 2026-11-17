import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import {
  STORE_CATEGORIES,
  downloadStoreBook,
  loadBookDetail,
  loadCategory,
  openStorePage,
  searchStore,
  type StoreBook,
} from "../lib/onlineStore";

interface BookStoreProps {
  onImport: (file: File, open?: boolean, coverUrl?: string) => Promise<void>;
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const SKELETON_COUNT = 10;

export function BookStore({ onImport }: BookStoreProps) {
  const [category, setCategory] = useState<string>(STORE_CATEGORIES[0].id);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [books, setBooks] = useState<StoreBook[]>([]);
  const [mode, setMode] = useState<"shelf" | "search">("shelf");
  const [term, setTerm] = useState("");
  const [appliedTerm, setAppliedTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<StoreBook | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<{ id: string; label: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestRef = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const loadShelf = useCallback(async (categoryId: string, targetPage: number) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setMode("shelf");
    setLoading(true);
    setError(null);
    setBooks([]);
    try {
      const shelf = await loadCategory(categoryId, targetPage);
      if (requestRef.current !== request) return;
      setBooks(shelf.books);
      setPage(shelf.page);
      setTotalPages(shelf.totalPages);
    } catch (loadError) {
      if (requestRef.current !== request) return;
      setError(errorMessage(loadError, "书城加载失败，请检查网络后重试"));
      setBooks([]);
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (value: string) => {
    const keyword = value.trim();
    if (!keyword) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    setMode("search");
    setAppliedTerm(keyword);
    setLoading(true);
    setError(null);
    setBooks([]);
    try {
      const results = await searchStore(keyword);
      if (requestRef.current !== request) return;
      setBooks(results);
    } catch (searchError) {
      if (requestRef.current !== request) return;
      setError(errorMessage(searchError, "搜索失败，请稍后再试"));
      setBooks([]);
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShelf(STORE_CATEGORIES[0].id, 1);
  }, [loadShelf]);

  useEffect(() => {
    if (!detail) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail]);

  const openDetail = async (book: StoreBook) => {
    setDetail(book);
    setDetailError(null);
    setNotice(null);
    setDetailBusy(true);
    try {
      const full = await loadBookDetail(book);
      setDetail((current) => (current && current.id === full.id ? full : current));
    } catch (loadError) {
      setDetailError(errorMessage(loadError, "简介加载失败，仍然可以尝试下载"));
    } finally {
      setDetailBusy(false);
    }
  };

  const startDownload = async (book: StoreBook, openAfter: boolean) => {
    if (downloading) return;
    setDetailError(null);
    setNotice(null);
    setDownloading({ id: book.id, label: "正在准备下载…" });
    try {
      const file = await downloadStoreBook(book, (done, total) => {
        setDownloading({
          id: book.id,
          label: total > 1 ? `正在下载 ${done}/${total} 段…` : "正在下载…",
        });
      });
      // Search results carry no cover, and the detail request may still be in
      // flight when the user clicks download right away.
      let cover = book.cover;
      if (!cover) {
        try {
          cover = (await loadBookDetail(book)).cover;
        } catch {
          cover = undefined;
        }
      }
      setDownloading({ id: book.id, label: "正在放进书架…" });
      await onImport(file, openAfter, cover);
      if (openAfter) {
        setDetail(null);
      } else {
        setNotice(`《${book.title}》已经放进书架`);
      }
    } catch (downloadError) {
      setDetailError(errorMessage(downloadError, "下载失败，请稍后再试"));
    } finally {
      setDownloading(null);
    }
  };

  const changePage = (targetPage: number) => {
    if (loading || targetPage < 1 || targetPage > totalPages || targetPage === page) return;
    void loadShelf(category, targetPage);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const categoryName =
    STORE_CATEGORIES.find((item) => item.id === category)?.name ?? "全部";
  const title = mode === "search" ? `“${appliedTerm}”的搜索结果` : `${categoryName} · 最新`;

  return (
    <div className="book-store">
      <div className="store-hero">
        <span className="eyebrow">ONLINE STORE · 线上书城</span>
        <h2>
          把热榜上的书，
          <br />
          放进自己的书架。
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
            placeholder="搜索书名（需完整书名，例如 文豪1978）"
            aria-label="搜索线上书城"
            onChange={(event) => setTerm(event.target.value)}
          />
          <button className="button button--primary" type="submit" disabled={loading}>
            <Icon name="search" size={16} />
            {mode === "search" && loading ? "正在搜索…" : "搜索"}
          </button>
        </form>
        <p className="store-hero__note">
          内容来自第三方站点，仅供个人阅读；下载后会自动转成 TXT 保存到本地书架。
        </p>
      </div>

      <div className="store-cats" role="tablist" aria-label="小说分类">
        {STORE_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === "shelf" && category === item.id}
            className={mode === "shelf" && category === item.id ? "is-active" : ""}
            onClick={() => {
              if (category === item.id && mode === "shelf") return;
              setCategory(item.id);
              void loadShelf(item.id, 1);
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="store-bar">
        <div className="store-bar__title">
          <h3>{title}</h3>
          <span>
            {loading
              ? "正在加载…"
              : mode === "search"
                ? `找到 ${books.length} 本`
                : `第 ${page} / ${totalPages} 页`}
          </span>
        </div>
        {mode === "shelf" ? (
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
              disabled={loading || page >= totalPages}
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
              void loadShelf(category, 1);
            }}
          >
            返回分类
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
              else void loadShelf(category, page);
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
            key={book.key}
            className="online-book-card store-card"
            role="button"
            tabIndex={0}
            aria-label={`${book.title}${book.author ? `，${book.author}` : ""}`}
            onClick={() => void openDetail(book)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void openDetail(book);
              }
            }}
          >
            <div
              className={`online-book-card__cover store-card__cover${
                book.cover ? "" : " is-fallback"
              }`}
            >
              {book.cover ? (
                <img src={book.cover} alt="" loading="lazy" />
              ) : (
                <span className="store-card__fallback">{book.title}</span>
              )}
              {book.status ? (
                <em
                  className={`store-card__status${book.status === "已完结" ? " is-done" : ""}`}
                >
                  {book.status}
                </em>
              ) : null}
            </div>
            <div className="online-book-card__body">
              <strong title={book.title}>{book.title}</strong>
              <small>
                {book.author}
                {book.category ? ` · ${book.category.replace(/小说$/, "")}` : ""}
              </small>
            </div>
          </article>
        ))}
      </div>

      {!loading && books.length === 0 && !error ? (
        <p className="online-store__empty">
          {mode === "search" ? "没有找到这本书，站点只支持完整书名搜索。" : "这个分类暂时没有书。"}
        </p>
      ) : null}

      {mode === "shelf" && !loading && !error && books.length > 0 ? (
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
          <span className="store-pager__label">
            第 {page} / {totalPages} 页
          </span>
          <button
            type="button"
            className="button button--ghost"
            disabled={page >= totalPages}
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
              {detail.cover ? (
                <img src={detail.cover} alt="" />
              ) : (
                <span>{detail.title}</span>
              )}
            </div>

            <div className="store-sheet__body">
              <span className="eyebrow">
                {detail.category || "线上书城"}
                {detail.status ? ` · ${detail.status}` : ""}
              </span>
              <h2>{detail.title}</h2>
              <p className="store-sheet__author">{detail.author} 著</p>
              <p className="store-sheet__meta">
                {detail.chapterCount
                  ? `目录 ${detail.chapterCount >= 1000 ? "1000+" : detail.chapterCount} 章`
                  : detailBusy
                    ? "目录读取中…"
                    : "目录未知"}
                {detail.latest ? ` · 最新 ${detail.latest}` : ""}
              </p>

              {detailError ? <p className="store-sheet__error">{detailError}</p> : null}
              {detail.intro ? <p className="store-sheet__intro">{detail.intro}</p> : null}

              <div className="store-sheet__actions">
                <button
                  type="button"
                  className="button button--primary"
                  disabled={downloading !== null}
                  onClick={() => void startDownload(detail, true)}
                >
                  <Icon name="download" size={16} />
                  {downloading?.id === detail.id ? downloading.label : "下载并阅读"}
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={downloading !== null}
                  onClick={() => void startDownload(detail, false)}
                >
                  只放进书架
                </button>
                <button
                  type="button"
                  className="button button--ghost desktop-only"
                  onClick={() => void openStorePage(detail.url)}
                >
                  在原站打开
                </button>
              </div>

              {notice ? <p className="store-sheet__notice">{notice}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

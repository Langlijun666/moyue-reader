import { useCallback, useEffect, useRef, useState } from "react";
import ePub from "epubjs";
import type { BookMeta, Progress, ReaderSettings, TocEntry } from "../types";
import { percentLabel } from "../lib/format";
import { decodeTxt, txtToEpub } from "../lib/txt";
import { Icon } from "./Icons";
import { SettingsPanel } from "./SettingsPanel";
import { TocPanel } from "./TocPanel";
import { TtsPlayer } from "./TtsPlayer";

interface ReaderProps {
  meta: BookMeta;
  data: ArrayBuffer;
  settings: ReaderSettings;
  initialProgress?: Progress;
  onBack: () => void;
  onProgress: (progress: Progress) => void;
  onSettingsChange: (patch: Partial<ReaderSettings>) => void;
  onChangeCover: () => void;
  sidebarHidden: boolean;
  showSidebarToggle: boolean;
  onToggleSidebar: () => void;
  onOpenMusic: () => void;
}

interface RawNavItem {
  id?: string;
  href?: string;
  label?: string;
  subitems?: RawNavItem[];
}

const palettes = {
  paper: {
    background: "#f7f1e7",
    text: "#312b24",
    muted: "#9a8b78",
    accent: "#a4542f",
    selection: "rgba(164, 84, 47, .18)",
  },
  sepia: {
    background: "#eee0c5",
    text: "#3c3021",
    muted: "#988467",
    accent: "#965428",
    selection: "rgba(150, 84, 40, .2)",
  },
  night: {
    background: "#191715",
    text: "#d9d0c1",
    muted: "#8f8476",
    accent: "#d18b5c",
    selection: "rgba(209, 139, 92, .2)",
  },
} as const;

export function Reader({
  meta,
  data,
  settings,
  initialProgress,
  onBack,
  onProgress,
  onSettingsChange,
  onChangeCover,
  sidebarHidden,
  showSidebarToggle,
  onToggleSidebar,
  onOpenMusic,
}: ReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const tocRef = useRef<TocEntry[]>([]);
  const flatTocRef = useRef<TocEntry[]>([]);
  const percentRef = useRef(initialProgress?.percent ?? 0);
  const settingsRef = useRef(settings);
  const onProgressRef = useRef(onProgress);
  const initialCfiRef = useRef(initialProgress?.cfi);
  const currentCfiRef = useRef(initialProgress?.cfi);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [currentHref, setCurrentHref] = useState("");
  const [currentLabel, setCurrentLabel] = useState(initialProgress?.chapter || "正文");
  const [percent, setPercent] = useState(initialProgress?.percent ?? 0);
  const [ready, setReady] = useState(false);
  const [locationsReady, setLocationsReady] = useState(false);
  const locationsReadyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ttsOpen, setTtsOpen] = useState(false);
  const [flip, setFlip] = useState<"prev" | "next" | null>(null);
  const [flipNonce, setFlipNonce] = useState(0);
  const flipTimerRef = useRef<number | null>(null);
  const turningRef = useRef(false);
  const turnPageRef = useRef<(direction: "prev" | "next") => void>(() => {});
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  const panelOpenRef = useRef(false);
  const wheelLockRef = useRef(0);
  const isScrollMode = settings.readingMode === "scroll";

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    tocRef.current = toc;
    flatTocRef.current = flattenToc(toc);
  }, [toc]);

  useEffect(() => {
    panelOpenRef.current = tocOpen || settingsOpen || ttsOpen;
    if (tocOpen || settingsOpen) {
      // Close the page-turn overlay when a drawer opens.
      setFlip(null);
    }
  }, [tocOpen, settingsOpen, ttsOpen]);

  useEffect(() => {
    let disposed = false;
    const viewer = viewerRef.current;
    if (!viewer) return;

    setReady(false);
    setError(null);
    setLocationsReady(false);
    locationsReadyRef.current = false;
    setToc([]);
    tocRef.current = [];
    if (flipTimerRef.current !== null) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
    turningRef.current = false;
    setFlip(null);

    // epub.js mutates its input while unpacking; keep the stored copy clean.
    // TXT books are converted to a small in-memory EPUB so the same reader,
    // TOC, themes and progress tracking can be reused.
    let book: any = null;
    let removeViewerWheel: (() => void) | null = null;
    let removeScrollListener: (() => void) | null = null;
    let scrollTimer = 0;
    let lastProgressAt = 0;

    const boot = async () => {
      try {
        const source =
          meta.format === "txt"
            ? await txtToEpub(decodeTxt(data), meta.title, meta.author, meta.id)
            : data.slice(0);
        if (disposed) return;

        book = ePub(source);
        bookRef.current = book;
        await book.ready;
        if (disposed) return;

        const rendition = book.renderTo(viewer, {
          width: "100%",
          height: "100%",
          flow: isScrollMode ? "scrolled-continuous" : "paginated",
          ...(isScrollMode ? { manager: "continuous" } : {}),
          spread: "none",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        applyReaderTheme(rendition, settingsRef.current);

        const wheelDocs = new WeakSet<Document>();
        const onWheel = (event: WheelEvent) => {
          if (panelOpenRef.current || event.ctrlKey || event.metaKey) return;
          const multiplier =
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
              ? 16
              : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? 100
                : 1;
          const delta = event.deltaY * multiplier;
          if (Math.abs(delta) < 18) return;

          if (settingsRef.current.readingMode === "scroll") {
            const scroller = viewer.querySelector<HTMLElement>(".epub-container") ?? viewer;
            event.preventDefault();
            scroller.scrollTop += delta;
            return;
          }

          event.preventDefault();
          const now = Date.now();
          if (now - wheelLockRef.current < 520) return;
          wheelLockRef.current = now;
          turnPageRef.current(delta > 0 ? "next" : "prev");
        };

        rendition.hooks.content.register((contents: any) => {
          const document = contents?.document as Document | undefined;
          if (!document || wheelDocs.has(document)) return;
          wheelDocs.add(document);
          document.addEventListener("wheel", onWheel, { passive: false });
          // Key events inside the epub.js iframe do not bubble to the parent
          // window, so forward them to the same reader shortcut handler.
          document.addEventListener("keydown", (event: KeyboardEvent) => {
            keyHandlerRef.current(event);
          });
        });
        viewer.addEventListener("wheel", onWheel, { passive: false });
        removeViewerWheel = () => viewer.removeEventListener("wheel", onWheel);

        const navigation = await book.loaded.navigation;
        if (!disposed) {
          const entries = mapToc(navigation?.toc ?? []);
          setToc(entries);
          tocRef.current = entries;
          flatTocRef.current = flattenToc(entries);
        }

        const startCfi = currentCfiRef.current || initialCfiRef.current;
        try {
          await rendition.display(startCfi || undefined);
        } catch {
          await rendition.display();
        }
        if (disposed) return;

        setReady(true);

        const updateFromLocation = (location: any, allowZero = false) => {
          const href = location?.start?.href ?? "";
          const label = findLabel(tocRef.current, href) || "正文";
          let nextPercent = percentRef.current;
          try {
            if (locationsReadyRef.current && book.locations.length() > 0) {
              nextPercent = book.locations.percentageFromCfi(location?.start?.cfi ?? "");
            } else {
              const chapters = flatTocRef.current;
              const index = chapters.findIndex(
                (entry) => entry.href.split("#")[0] === href.split("#")[0],
              );
              if (index >= 0) {
                nextPercent = chapters.length > 1 ? index / (chapters.length - 1) : 0;
              } else if (allowZero) {
                nextPercent = 0;
              }
            }
          } catch {
            // An unknown CFI should not interrupt reading.
          }
          if (Number.isFinite(nextPercent)) {
            percentRef.current = nextPercent;
            setPercent(nextPercent);
          }
          setCurrentHref(href);
          setCurrentLabel(label);
          if (location?.start?.cfi) {
            currentCfiRef.current = location.start.cfi;
            onProgressRef.current({
              cfi: location.start.cfi,
              percent: percentRef.current,
              chapter: label,
              updatedAt: Date.now(),
            });
          }
        };

        const findVisibleChapter = (scroller: HTMLElement): string | undefined => {
          const scrollerRect = scroller.getBoundingClientRect();
          const probe = scrollerRect.top + scrollerRect.height * 0.35;
          const frames = Array.from(viewer.querySelectorAll("iframe"));
          let fallback: string | undefined;

          for (const frame of frames) {
            const rect = frame.getBoundingClientRect();
            if (rect.bottom <= scrollerRect.top || rect.top >= scrollerRect.bottom) continue;
            try {
              const heading = frame.contentDocument
                ?.querySelector("h1, h2, h3")
                ?.textContent?.replace(/\s+/g, " ")
                .trim();
              if (heading && rect.top <= probe && rect.bottom >= probe) return heading;
              if (heading && !fallback) fallback = heading;
            } catch {
              // Ignore inaccessible frames; the next section may still work.
            }
          }
          return fallback;
        };

        const restoreScrollPosition = () => {
          const scroller = viewer.querySelector<HTMLElement>(".epub-container");
          if (!scroller) return;
          const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          const target = Math.min(maxScroll, Math.max(0, percentRef.current * maxScroll));
          if (Math.abs(scroller.scrollTop - target) > 3) {
            scroller.scrollTop = target;
          }
        };

        const updateScrollLocation = () => {
          if (!isScrollMode || disposed) return;
          const scroller = viewer.querySelector<HTMLElement>(".epub-container");
          if (!scroller) return;

          const maxScroll = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
          const ratio = Math.min(1, Math.max(0, scroller.scrollTop / maxScroll));
          const label = findVisibleChapter(scroller) || currentLabel || "正文";
          let cfi = currentCfiRef.current || "";

          try {
            if (locationsReadyRef.current && book.locations.length() > 0) {
              cfi = book.locations.cfiFromPercentage(ratio) || cfi;
            }
          } catch {
            // Keep the last known CFI if location lookup fails.
          }

          percentRef.current = ratio;
          setPercent(ratio);
          setCurrentLabel(label);
          const href = findHrefByLabel(tocRef.current, label);
          if (href) setCurrentHref(href);

          if (cfi) {
            currentCfiRef.current = cfi;
            const now = Date.now();
            if (now - lastProgressAt > 300 || ratio >= 1) {
              lastProgressAt = now;
              onProgressRef.current({
                cfi,
                percent: ratio,
                chapter: label,
                updatedAt: now,
              });
            }
          }
        };

        const attachScrollListener = () => {
          const scroller = viewer.querySelector<HTMLElement>(".epub-container");
          if (!scroller) return;
          const onScroll = () => {
            if (scrollTimer) return;
            scrollTimer = window.setTimeout(() => {
              scrollTimer = 0;
              updateScrollLocation();
            }, 90);
          };
          scroller.addEventListener("scroll", onScroll, { passive: true });
          removeScrollListener = () => {
            scroller.removeEventListener("scroll", onScroll);
            if (scrollTimer) {
              window.clearTimeout(scrollTimer);
              scrollTimer = 0;
            }
          };
        };

        if (isScrollMode) {
          attachScrollListener();
          window.requestAnimationFrame(() => {
            restoreScrollPosition();
            updateScrollLocation();
          });
        } else {
          rendition.on("relocated", (location: any) => updateFromLocation(location));
          window.requestAnimationFrame(() => {
            if (disposed) return;
            const current = rendition.currentLocation?.();
            if (current) updateFromLocation(current);
          });
        }

        // epub.js waits 100ms after every spine section by default. For a
        // 1000+ chapter TXT that keeps the progress bar disabled for minutes.
        // Remove the artificial pause so locations are ready quickly.
        book.locations.pause = 0;
        book.locations
          .generate(1600)
          .then(() => {
            if (disposed) return;
            locationsReadyRef.current = true;
            setLocationsReady(true);
            if (isScrollMode) {
              updateScrollLocation();
            } else {
              const current = rendition.currentLocation?.();
              if (current) updateFromLocation(current, true);
            }
          })
          .catch(() => {
            if (!disposed) setLocationsReady(false);
          });
      } catch (err) {
        if (disposed) return;
        console.error(err);
        setError(
          meta.format === "txt"
            ? "这段文字暂时打不开。TXT 文件可能为空，或编码无法识别。"
            : "这本书暂时打不开。文件可能损坏，或不是标准的 EPUB。",
        );
      }
    };

    void boot();

    return () => {
      disposed = true;
      removeViewerWheel?.();
      removeScrollListener?.();
      if (scrollTimer) {
        window.clearTimeout(scrollTimer);
        scrollTimer = 0;
      }
      const liveLocation = isScrollMode ? null : renditionRef.current?.currentLocation?.();
      if (liveLocation?.start?.cfi) {
        currentCfiRef.current = liveLocation.start.cfi;
      }
      try {
        renditionRef.current?.destroy();
      } catch {
        // Ignore teardown races.
      }
      try {
        book?.destroy();
      } catch {
        // Ignore teardown races.
      }
      renditionRef.current = null;
      bookRef.current = null;
    };
    // The reader is intentionally tied to a book identity and reading mode,
    // not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, isScrollMode]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    applyReaderTheme(rendition, settings);
  }, [settings]);

  const turnPage = useCallback(async (direction: "prev" | "next") => {
    const rendition = renditionRef.current;
    if (!rendition || turningRef.current) return;

    turningRef.current = true;
    setFlip(direction);
    setFlipNonce((value) => value + 1);
    if (flipTimerRef.current !== null) {
      window.clearTimeout(flipTimerRef.current);
    }
    flipTimerRef.current = window.setTimeout(() => {
      setFlip(null);
      turningRef.current = false;
    }, 520);

    try {
      if (direction === "prev") await rendition.prev();
      else await rendition.next();
    } catch {
      // At the first or last page there is simply nowhere to go.
      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
      }
      setFlip(null);
      turningRef.current = false;
    }
  }, []);

  useEffect(() => {
    turnPageRef.current = turnPage;
  }, [turnPage]);

  const extractCurrentChapterText = useCallback(async (): Promise<string | null> => {
    const rendition = renditionRef.current;
    if (!rendition) return null;

    const location = rendition.currentLocation?.();
    const href = (location?.start?.href ?? "").split("#")[0];
    const rawContents = rendition.getContents?.() ?? [];
    const contents = Array.isArray(rawContents) ? rawContents : [rawContents];
    const holder =
      contents.find((item: any) => (item?.section?.href ?? "").split("#")[0] === href) ??
      contents[0];
    let documentElement = holder?.document as Document | undefined;

    if (!documentElement) {
      const frame = viewerRef.current?.querySelector<HTMLIFrameElement>("iframe");
      documentElement = frame?.contentDocument ?? undefined;
    }

    try {
      const raw = documentElement?.body?.innerText ?? documentElement?.body?.textContent ?? "";
      const text = raw.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
      return text.length > 5 ? text : null;
    } catch {
      return null;
    }
  }, []);

  const loadCurrentChapterText = useCallback(async (): Promise<string | null> => {
    return extractCurrentChapterText();
  }, [extractCurrentChapterText]);

  const loadNextChapterText = useCallback(async (): Promise<string | null> => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return null;

    const currentHref = (rendition.currentLocation?.()?.start?.href ?? "").split("#")[0];
    const items = book.spine?.spineItems ?? [];
    const index = items.findIndex(
      (item: any) => (item.href ?? "").split("#")[0] === currentHref,
    );
    if (index < 0) return null;

    for (let nextIndex = index + 1; nextIndex < items.length; nextIndex += 1) {
      const item = items[nextIndex];
      if (item.linear === false) continue;
      try {
        await rendition.display(item.href);
        await new Promise((resolve) => window.setTimeout(resolve, 260));
        const text = await extractCurrentChapterText();
        if (text && text.length > 20) return text;
      } catch {
        // Try the following section if this one cannot be displayed.
      }
    }
    return null;
  }, [extractCurrentChapterText]);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === "Escape") {
        if (ttsOpen) setTtsOpen(false);
        else if (tocOpen) setTocOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        return;
      }
      if (!ready || tocOpen || settingsOpen || ttsOpen) return;

      if (settings.readingMode === "scroll") {
        const scroller = viewerRef.current?.querySelector<HTMLElement>(".epub-container") ?? viewerRef.current;
        if (!scroller) return;
        const isDown = ["ArrowDown", "PageDown", " "].includes(event.key);
        const isUp = ["ArrowUp", "PageUp"].includes(event.key);
        if (!isDown && !isUp) return;
        event.preventDefault();
        const amount = event.key === "PageDown" || event.key === " " ? scroller.clientHeight * 0.85 : 90;
        scroller.scrollTop += isDown ? amount : -amount;
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        void turnPage("prev");
      }
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        void turnPage("next");
      }
    },
    [ready, tocOpen, settingsOpen, ttsOpen, settings.readingMode, turnPage],
  );

  useEffect(() => {
    keyHandlerRef.current = handleKeyDown;
  }, [handleKeyDown]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const jumpTo = (href: string) => {
    setTocOpen(false);
    void renditionRef.current?.display(href).catch(() => undefined);
  };

  const seek = (value: number) => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return;
    try {
      if (locationsReadyRef.current && book.locations.length() > 0) {
        const cfi = book.locations.cfiFromPercentage(value / 1000);
        if (cfi) {
          void rendition.display(cfi);
          return;
        }
      }

      // Before epub.js finishes generating locations, fall back to the
      // chapter list so the slider still works immediately.
      const chapters = flatTocRef.current;
      if (chapters.length === 0) return;
      const index = Math.min(
        chapters.length - 1,
        Math.max(0, Math.round((value / 1000) * (chapters.length - 1))),
      );
      const href = chapters[index]?.href;
      if (href) void rendition.display(href);
    } catch {
      // Ignore a slider move before the book is ready.
    }
  };

  return (
    <section className={`reader reader--${settings.readingMode}`}>
      <header className="reader__topbar">
        <button className="icon-button icon-button--quiet" onClick={onBack} aria-label="回到书架">
          <Icon name="arrow-left" size={20} />
        </button>
        {showSidebarToggle ? (
          <button
            className={`icon-button icon-button--quiet ${sidebarHidden ? "icon-button--active" : ""}`}
            onClick={onToggleSidebar}
            aria-label={sidebarHidden ? "显示书架" : "隐藏书架"}
            title={sidebarHidden ? "显示书架 (Ctrl+B)" : "隐藏书架 (Ctrl+B)"}
          >
            <Icon name="sidebar" size={19} />
          </button>
        ) : null}
        <div className="reader__identity">
          <span className="reader__title">{meta.title}</span>
          <span className="reader__author">{meta.author}</span>
        </div>
        <div className="reader__chapter-label">
          <span>{currentLabel}</span>
        </div>
        <div className="reader__tools">
          <button
            className="icon-button"
            onClick={onOpenMusic}
            title="音乐"
            aria-label="打开音乐"
          >
            <Icon name="music" size={19} />
          </button>
          <button
            className={`icon-button ${ttsOpen ? "icon-button--active" : ""}`}
            onClick={() => {
              setTocOpen(false);
              setSettingsOpen(false);
              setTtsOpen((open) => !open);
            }}
            aria-label="听书"
            title="听书"
            disabled={!ready}
          >
            <Icon name="headphones" size={19} />
          </button>
          <button
            className="icon-button"
            onClick={onChangeCover}
            title="更换封面"
            aria-label="更换封面"
          >
            <Icon name="image" size={19} />
          </button>
          <button
            className={`icon-button ${tocOpen ? "icon-button--active" : ""}`}
            onClick={() => {
              setSettingsOpen(false);
              setTtsOpen(false);
              setTocOpen((open) => !open);
            }}
            aria-label="目录"
            title="目录"
          >
            <Icon name="list" size={19} />
          </button>
          <button
            className={`icon-button ${settingsOpen ? "icon-button--active" : ""}`}
            onClick={() => {
              setTocOpen(false);
              setTtsOpen(false);
              setSettingsOpen((open) => !open);
            }}
            aria-label="阅读设置"
            title="阅读设置"
          >
            <Icon name="settings" size={19} />
          </button>
        </div>
      </header>

      <div className={`reader__stage ${flip ? `is-turning is-turning--${flip}` : ""}`}>
        <div ref={viewerRef} className="reader__viewport" />

        {flip ? (
          <div
            key={`${flip}-${flipNonce}`}
            className={`page-flip page-flip--${flip}`}
            aria-hidden="true"
          />
        ) : null}

        {!ready && !error ? (
          <div className="reader__loading">
            <span className="spinner" />
            <p>正在展开书页…</p>
          </div>
        ) : null}

        {error ? (
          <div className="reader__error">
            <Icon name="book" size={34} />
            <h3>书页没有展开</h3>
            <p>{error}</p>
            <button className="button button--primary" onClick={onBack}>
              回到书架
            </button>
          </div>
        ) : null}

        {tocOpen ? (
          <>
            <div className="drawer-backdrop" onClick={() => setTocOpen(false)} />
            <TocPanel
              toc={toc}
              currentHref={currentHref}
              onSelect={jumpTo}
              onClose={() => setTocOpen(false)}
            />
          </>
        ) : null}

        {settingsOpen ? (
          <>
            <div className="drawer-backdrop" onClick={() => setSettingsOpen(false)} />
            <SettingsPanel
              settings={settings}
              onChange={onSettingsChange}
              onClose={() => setSettingsOpen(false)}
            />
          </>
        ) : null}
      </div>

      <footer className="reader__footer">
        {isScrollMode ? (
          <span className="reader__scroll-hint">
            <Icon name="chevron-down" size={15} />
            一镜到底
          </span>
        ) : (
          <button className="page-button" onClick={() => void turnPage("prev")} aria-label="上一页">
            <Icon name="left" size={18} />
            <span>上一页</span>
          </button>
        )}

        <div className="reader__progress">
          <span className="reader__percent">{percentLabel(percent)}</span>
          <input
            className="progress-range"
            type="range"
            min={0}
            max={1000}
            value={Math.round(percent * 1000)}
            onChange={(event) => seek(Number(event.target.value))}
            disabled={!locationsReady && toc.length === 0}
            aria-label="阅读进度"
          />
          <span className="reader__chapter-small">{currentLabel}</span>
        </div>

        {isScrollMode ? (
          <span className="reader__scroll-hint reader__scroll-hint--right">
            滚轮 / 触控板
          </span>
        ) : (
          <button className="page-button" onClick={() => void turnPage("next")} aria-label="下一页">
            <span>下一页</span>
            <Icon name="right" size={18} />
          </button>
        )}
      </footer>

      <TtsPlayer
        open={ttsOpen}
        onOpen={() => setTtsOpen(true)}
        onClose={() => setTtsOpen(false)}
        chapterLabel={currentLabel}
        loadCurrentChapter={loadCurrentChapterText}
        loadNextChapter={loadNextChapterText}
      />
    </section>
  );
}

function mapToc(items: RawNavItem[]): TocEntry[] {
  return items
    .filter((item) => Boolean(item.href))
    .map((item) => ({
      href: item.href ?? "",
      label: cleanLabel(item.label ?? ""),
      children: item.subitems?.length ? mapToc(item.subitems) : undefined,
    }));
}

function flattenToc(items: TocEntry[]): TocEntry[] {
  const flat: TocEntry[] = [];
  const walk = (entries: TocEntry[]) => {
    for (const entry of entries) {
      flat.push(entry);
      if (entry.children?.length) walk(entry.children);
    }
  };
  walk(items);
  return flat;
}

function cleanLabel(label: string): string {
  if (!label) return "";
  try {
    const doc = new DOMParser().parseFromString(label, "text/html");
    return (doc.body.textContent ?? label).replace(/\s+/g, " ").trim();
  } catch {
    return label.replace(/<[^>]*>/g, "").trim();
  }
}

function findLabel(items: TocEntry[], href: string): string | undefined {
  const base = href.split("#")[0];
  for (const item of items) {
    if (item.href.split("#")[0] === base) return item.label;
    const child = findLabel(item.children ?? [], href);
    if (child) return child;
  }
  return undefined;
}

function findHrefByLabel(items: TocEntry[], label: string): string | undefined {
  for (const item of items) {
    if (item.label === label) return item.href;
    const child = findHrefByLabel(item.children ?? [], label);
    if (child) return child;
  }
  return undefined;
}

function applyReaderTheme(rendition: any, settings: ReaderSettings): void {
  if (!rendition?.themes) return;
  const palette = palettes[settings.theme] ?? palettes.paper;
  const family =
    settings.fontFamily === "sans"
      ? '"Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif'
      : '"Noto Serif CJK SC", "Songti SC", "Source Han Serif SC", SimSun, Georgia, serif';

  // Many Chinese system fonts only ship regular and bold faces. Intermediate
  // weights would otherwise look identical, so use a light text color for
  // "细" and a tiny text stroke to make "中等" visibly different.
  const thinText =
    settings.fontWeight === 300
      ? `color-mix(in srgb, ${palette.text} 82%, ${palette.background})`
      : palette.text;
  const weightStroke = settings.fontWeight === 500 ? "0.35px" : "0px";

  const rules = {
    "html, body": {
      "background-color": `${palette.background} !important`,
      "color": `${palette.text} !important`,
    },
    body: {
      "font-family": `${family} !important`,
      "font-weight": `${settings.fontWeight} !important`,
      "line-height": `${settings.lineHeight} !important`,
      "padding": "0 4px !important",
    },
    p: {
      "line-height": `${settings.lineHeight} !important`,
      "margin-bottom": "1em !important",
    },
    "p, li, blockquote, td": {
      "font-weight": `${settings.fontWeight} !important`,
      "color": `${thinText} !important`,
      "-webkit-text-stroke": `${weightStroke} currentColor !important`,
    },
    "a, a:visited": {
      "color": `${palette.accent} !important`,
    },
    "::selection": {
      "background": palette.selection,
    },
    "img, svg": {
      "max-width": "100% !important",
      "height": "auto !important",
    },
    "h1, h2, h3, h4": {
      "color": `${palette.text} !important`,
      "line-height": "1.4 !important",
    },
    "blockquote": {
      "color": `${palette.muted} !important`,
      "border-left-color": `${palette.accent} !important`,
    },
  };

  rendition.themes.register("moyue", rules);
  rendition.themes.select("moyue");
  rendition.themes.fontSize(`${settings.fontSize}px`);
}

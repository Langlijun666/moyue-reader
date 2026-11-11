import { useCallback, useEffect, useRef, useState } from "react";
import ePub from "epubjs";
import type { BookMeta, Progress, ReaderSettings, SearchResult, TocEntry } from "../types";
import { percentLabel } from "../lib/format";
import { recordReading } from "../lib/stats";
import { decodeTxt, txtToEpub } from "../lib/txt";
import {
  loadBookmarks,
  newBookmarkId,
  saveBookmarks,
  type Bookmark,
} from "../lib/bookmarks";
import {
  highlightFill,
  loadHighlights,
  newHighlightId,
  saveHighlights,
  type Highlight,
  type HighlightColor,
} from "../lib/highlights";
import { Icon } from "./Icons";
import { SelectionToolbar } from "./SelectionToolbar";
import { SettingsPanel } from "./SettingsPanel";
import { TocPanel } from "./TocPanel";
import { TtsPlayer, type TtsChapter } from "./TtsPlayer";
import { ReaderToolsPanel } from "./ReaderToolsPanel";

interface SelectionDraft {
  cfi: string;
  text: string;
  chapter: string;
  percent: number;
  left: number;
  top: number;
}

type ToolsTab = "search" | "bookmarks" | "highlights";

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
  onToggleTheme: () => void;
}

interface RawNavItem {
  id?: string;
  href?: string;
  label?: string;
  subitems?: RawNavItem[];
}

interface SearchIndexSection {
  index: number;
  href: string;
  chapter: string;
  text: string;
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
  onToggleTheme,
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState<ToolsTab>("search");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selection, setSelection] = useState<SelectionDraft | null>(null);
  const highlightsRef = useRef<Highlight[]>([]);
  const applyHighlightsRef = useRef<() => void>(() => {});
  const openHighlightRef = useRef<(id: string) => void>(() => {});
  const currentLabelRef = useRef(initialProgress?.chapter || "正文");
  const readingActivityRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchHasRun, setSearchHasRun] = useState(false);
  const [searchTotalHits, setSearchTotalHits] = useState(0);
  const searchIndexRef = useRef<SearchIndexSection[] | null>(null);
  const searchRunRef = useRef(0);
  const [flip, setFlip] = useState<"prev" | "next" | null>(null);
  const [flipNonce, setFlipNonce] = useState(0);
  const flipTimerRef = useRef<number | null>(null);
  const turningRef = useRef(false);
  const turnPageRef = useRef<(direction: "prev" | "next") => void>(() => {});
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  const panelOpenRef = useRef(false);
  const wheelLockRef = useRef(0);
  const isScrollMode = settings.readingMode === "scroll";
  const themeLabel =
    settings.theme === "night" ? "夜墨" : settings.theme === "sepia" ? "茶褐" : "纸白";
  const themeIcon =
    settings.theme === "night" ? "moon" : settings.theme === "sepia" ? "book" : "sun";

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let pending = 0;
    let lastTick = Date.now();
    let disposed = false;
    readingActivityRef.current = Date.now();
    const markActive = () => {
      readingActivityRef.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
    for (const event of events) {
      window.addEventListener(event, markActive, { passive: true });
    }
    const flush = () => {
      if (pending >= 1) {
        recordReading(meta.id, meta.title, Math.round(pending), 0);
        pending = 0;
      }
    };
    const timer = window.setInterval(() => {
      if (disposed) return;
      const now = Date.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;
      const active =
        document.visibilityState === "visible" &&
        now - readingActivityRef.current < 10 * 60_000;
      if (active) pending += Math.max(0, Math.min(delta, 30));
      if (pending >= 20) flush();
    }, 15_000);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", flush);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      for (const event of events) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [meta.id, meta.title]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    tocRef.current = toc;
    flatTocRef.current = flattenToc(toc);
  }, [toc]);

  useEffect(() => {
    panelOpenRef.current = tocOpen || settingsOpen || ttsOpen || toolsOpen;
    if (tocOpen || settingsOpen || toolsOpen) {
      // Close the page-turn overlay when a drawer opens.
      setFlip(null);
    }
  }, [tocOpen, settingsOpen, ttsOpen, toolsOpen]);

  useEffect(() => {
    currentLabelRef.current = currentLabel;
  }, [currentLabel]);

  useEffect(() => {
    highlightsRef.current = highlights;
    applyHighlightsRef.current?.();
  }, [highlights]);

  useEffect(() => {
    setBookmarks(loadBookmarks(meta.id));
    const savedHighlights = loadHighlights(meta.id);
    highlightsRef.current = savedHighlights;
    setHighlights(savedHighlights);
    setSelection(null);
    searchIndexRef.current = null;
    setSearchResults([]);
    setSearchHasRun(false);
    setSearchTotalHits(0);
    setSearchQuery("");
    setToolsOpen(false);
  }, [meta.id]);

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
          document.addEventListener(
            "pointerdown",
            () => {
              readingActivityRef.current = Date.now();
            },
            { passive: true },
          );
          document.addEventListener(
            "wheel",
            () => {
              readingActivityRef.current = Date.now();
            },
            { passive: true },
          );
          // Key events inside the epub.js iframe do not bubble to the parent
          // window, so forward them to the same reader shortcut handler.
          document.addEventListener("keydown", (event: KeyboardEvent) => {
            readingActivityRef.current = Date.now();
            keyHandlerRef.current(event);
          });

          const showSelection = () => {
            window.setTimeout(() => {
              const sel = document.getSelection();
              if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
                setSelection(null);
                return;
              }
              const range = sel.getRangeAt(0);
              const text = sel.toString().replace(/\s+/g, " ").trim();
              if (!text) {
                setSelection(null);
                return;
              }
              let cfi = "";
              try {
                cfi =
                  contents.section?.cfiFromRange?.(range) ??
                  contents.cfiFromRange?.(range) ??
                  "";
              } catch {
                cfi = "";
              }
              if (!cfi) {
                setSelection(null);
                return;
              }
              const rect = range.getBoundingClientRect();
              const frame = document.defaultView?.frameElement as HTMLElement | null;
              const frameRect = frame?.getBoundingClientRect();
              if (!frameRect) return;
              const rawLeft = frameRect.left + rect.left;
              const left = Math.min(
                Math.max(12, rawLeft),
                Math.max(12, window.innerWidth - 286),
              );
              const rawTop = frameRect.top + rect.top - 52;
              const top =
                rawTop < 76 ? frameRect.top + rect.bottom + 10 : rawTop;
              const href = contents.section?.href ?? "";
              setSelection({
                cfi,
                text: text.slice(0, 400),
                chapter: findLabel(tocRef.current, href) || currentLabelRef.current,
                percent: percentRef.current,
                left,
                top,
              });
            }, 10);
          };

          document.addEventListener("mouseup", showSelection);
          document.addEventListener("touchend", showSelection);
          document.addEventListener("mousedown", () => setSelection(null));
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

        const applyHighlights = () => {
          const annotations = rendition.annotations;
          if (!annotations) return;
          for (const highlight of highlightsRef.current) {
            try {
              annotations.remove(highlight.cfi, "highlight");
              annotations.highlight(
                highlight.cfi,
                { id: highlight.id },
                () => openHighlightRef.current(highlight.id),
                "moyue-highlight",
                {
                  fill: highlightFill(highlight.color),
                  "fill-opacity": "0.3",
                },
              );
            } catch {
              // The section may not be rendered yet.
            }
          }
        };
        applyHighlightsRef.current = applyHighlights;
        openHighlightRef.current = () => {
          setToolsTab("highlights");
          setToolsOpen(true);
        };
        rendition.on("rendered", applyHighlights);
        applyHighlights();

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
      applyHighlightsRef.current = () => {};
      openHighlightRef.current = () => {};
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

    setSelection(null);
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
      else {
        await rendition.next();
        recordReading(meta.id, meta.title, 0, 1);
      }
    } catch {
      // At the first or last page there is simply nowhere to go.
      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
      }
      setFlip(null);
      turningRef.current = false;
    }
  }, [meta.id, meta.title]);

  useEffect(() => {
    turnPageRef.current = turnPage;
  }, [turnPage]);

  const loadCurrentChapterText = useCallback(async (): Promise<TtsChapter | null> => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return null;

    const location = rendition.currentLocation?.();
    const href = (location?.start?.href ?? "").split("#")[0];
    const sections = book.spine?.spineItems ?? [];
    const sectionIndex = sections.findIndex(
      (item: any) => (item.href ?? "").split("#")[0] === href,
    );
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

    const { text, nodes } = collectTextNodes(documentElement);
    if (text.trim().length <= 5) return null;

    let startOffset = getVisibleTextOffset(documentElement, nodes) ?? 0;
    if (startOffset === 0) {
      try {
        const range = await book.getRange(location?.start?.cfi);
        let startContainer = range?.startContainer;
        let startNodeOffset = range?.startOffset ?? 0;
        if (startContainer && startContainer.nodeType !== Node.TEXT_NODE) {
          const walker = documentElement?.createTreeWalker(
            startContainer,
            NodeFilter.SHOW_TEXT,
          );
          const firstText = walker?.nextNode();
          if (firstText) {
            startContainer = firstText;
            startNodeOffset = 0;
          }
        }
        if (startContainer) {
          const entry = nodes.find((node) => node.node === startContainer);
          if (entry) {
            startOffset = Math.min(text.length, entry.start + startNodeOffset);
          }
        }
      } catch {
        // Fall back to the chapter start if the visible range cannot be resolved.
      }
    }

    return {
      text,
      startOffset,
      sectionIndex: Math.max(0, sectionIndex),
      href,
    };
  }, []);

  const loadNextChapterText = useCallback(async (): Promise<TtsChapter | null> => {
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
        const { text } = collectTextNodes(item.document);
        if (text.trim().length > 20) {
          return {
            text,
            startOffset: 0,
            sectionIndex: nextIndex,
            href: item.href,
          };
        }
      } catch {
        // Try the following section if this one cannot be displayed.
      }
    }
    return null;
  }, []);

  const ttsHighlightRef = useRef<string | null>(null);

  const clearTtsHighlight = useCallback(() => {
    const rendition = renditionRef.current;
    const cfi = ttsHighlightRef.current;
    if (rendition && cfi) {
      try {
        rendition.annotations?.remove(cfi, "highlight");
      } catch {
        // The iframe may have been torn down already.
      }
    }
    ttsHighlightRef.current = null;
  }, []);

  const highlightTtsSentence = useCallback(
    async (chapter: TtsChapter, start: number, length: number) => {
      const book = bookRef.current;
      const rendition = renditionRef.current;
      if (!book || !rendition) return;
      const item = book.spine?.spineItems?.[chapter.sectionIndex];
      if (!item) return;

      try {
        if (!item.document) {
          await item.load(book.load.bind(book));
        }
        const { nodes } = collectTextNodes(item.document);
        const startPosition = locateOffset(nodes, start);
        const endPosition = locateOffset(nodes, start + length);
        if (!startPosition || !endPosition) return;

        const range = item.document.createRange();
        range.setStart(startPosition.node, startPosition.offset);
        range.setEnd(endPosition.node, endPosition.offset);
        const cfi = item.cfiFromRange(range);

        clearTtsHighlight();
        rendition.annotations?.highlight(
          cfi,
          {},
          undefined,
          "tts-highlight",
          { fill: "#d9a441", "fill-opacity": "0.28" },
        );
        ttsHighlightRef.current = cfi;
        void rendition.display(cfi).catch(() => undefined);
      } catch {
        // TTS audio is more important than a highlight failure.
      }
    },
    [clearTtsHighlight],
  );

  useEffect(() => {
    return () => clearTtsHighlight();
  }, [clearTtsHighlight]);

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

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSelection(null);
        setTocOpen(false);
        setSettingsOpen(false);
        setTtsOpen(false);
        setToolsTab("search");
        setToolsOpen(true);
        return;
      }

      if (event.key === "Escape") {
        if (selection) setSelection(null);
        else if (toolsOpen) setToolsOpen(false);
        else if (ttsOpen) setTtsOpen(false);
        else if (tocOpen) setTocOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        return;
      }
      if (!ready || tocOpen || settingsOpen || ttsOpen || toolsOpen) return;

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
    [ready, tocOpen, settingsOpen, ttsOpen, toolsOpen, selection, settings.readingMode, turnPage],
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

  const openTools = (tab: ToolsTab) => {
    setTocOpen(false);
    setSettingsOpen(false);
    setTtsOpen(false);
    setToolsTab(tab);
    setToolsOpen(true);
  };

  const getSearchIndex = async (): Promise<SearchIndexSection[]> => {
    if (searchIndexRef.current) return searchIndexRef.current;
    const book = bookRef.current;
    if (!book) return [];
    const items = book.spine?.spineItems ?? [];
    const currentHref = (renditionRef.current?.currentLocation?.()?.start?.href ?? "").split("#")[0];
    const sections: SearchIndexSection[] = [];
    setSearchTotal(items.length);
    setSearchDone(0);

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      try {
        await item.load(book.load.bind(book));
        const text = collectSectionText(item.document);
        if (text.trim().length > 0) {
          sections.push({
            index,
            href: item.href,
            chapter: findLabel(tocRef.current, item.href) || "正文",
            text,
          });
        }
        if (item.href.split("#")[0] !== currentHref && typeof item.unload === "function") {
          item.unload();
        }
      } catch {
        // A single broken section should not stop the whole search.
      }
      setSearchDone(index + 1);
      if (index % 8 === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }

    searchIndexRef.current = sections;
    return sections;
  };

  const runSearch = async () => {
    const term = searchQuery.trim();
    if (term.length < 2 || !bookRef.current) return;
    const runId = ++searchRunRef.current;
    setSearching(true);
    setSearchHasRun(false);
    setSearchResults([]);
    setSearchTotalHits(0);

    try {
      const sections = await getSearchIndex();
      if (runId !== searchRunRef.current) return;
      const needle = term.toLowerCase();
      const results: SearchResult[] = [];
      let total = 0;

      for (const section of sections) {
        const haystack = section.text.toLowerCase();
        let from = 0;
        let occurrence = 0;
        while (from < haystack.length) {
          const position = haystack.indexOf(needle, from);
          if (position < 0) break;
          total += 1;
          if (results.length < 100) {
            const start = Math.max(0, position - 34);
            const end = Math.min(section.text.length, position + term.length + 54);
            results.push({
              id: `${section.index}-${occurrence}`,
              sectionIndex: section.index,
              href: section.href,
              chapter: section.chapter,
              snippet: section.text.slice(start, end).replace(/\s+/g, " ").trim(),
              occurrence,
              query: term,
            });
          }
          occurrence += 1;
          from = position + Math.max(1, needle.length);
          if (total >= 2000) break;
        }
        if (total >= 2000) break;
      }

      if (runId !== searchRunRef.current) return;
      setSearchResults(results);
      setSearchTotalHits(total);
      setSearchHasRun(true);
    } catch {
      if (runId === searchRunRef.current) {
        setSearchHasRun(true);
        setSearchTotalHits(0);
      }
    } finally {
      if (runId === searchRunRef.current) setSearching(false);
    }
  };

  const jumpToSearchResult = async (result: SearchResult) => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return;
    try {
      const item = book.spine?.spineItems?.[result.sectionIndex];
      if (item) {
        await item.load(book.load.bind(book));
        const { text, nodes } = collectTextNodes(item.document);
        const position = findNthMatch(text, result.query, result.occurrence);
        if (position >= 0) {
          const start = locateOffset(nodes, position);
          const end = locateOffset(nodes, position + result.query.length);
          if (start && end) {
            const range = item.document.createRange();
            range.setStart(start.node, start.offset);
            range.setEnd(end.node, end.offset);
            const cfi = item.cfiFromRange(range);
            await rendition.display(cfi);
            setToolsOpen(false);
            return;
          }
        }
      }
      await rendition.display(result.href);
      setToolsOpen(false);
    } catch {
      await rendition.display(result.href).catch(() => undefined);
      setToolsOpen(false);
    }
  };

  const addBookmark = () => {
    const rendition = renditionRef.current;
    const location = rendition?.currentLocation?.();
    const cfi = location?.start?.cfi;
    if (!cfi) return;
    if (bookmarks.some((bookmark) => bookmark.cfi === cfi)) {
      setToolsTab("bookmarks");
      return;
    }
    const next = [
      ...bookmarks,
      {
        id: newBookmarkId(),
        cfi,
        percent: percentRef.current,
        chapter: currentLabel,
        createdAt: Date.now(),
      },
    ];
    setBookmarks(next);
    saveBookmarks(meta.id, next);
    setToolsTab("bookmarks");
  };

  const jumpToBookmark = async (bookmark: Bookmark) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    setToolsOpen(false);
    await rendition.display(bookmark.cfi).catch(() => undefined);
  };

  const deleteBookmark = (id: string) => {
    const next = bookmarks.filter((bookmark) => bookmark.id !== id);
    setBookmarks(next);
    saveBookmarks(meta.id, next);
  };

  const clearIframeSelection = () => {
    const rendition = renditionRef.current;
    const contents = rendition?.getContents?.() ?? [];
    for (const content of Array.isArray(contents) ? contents : [contents]) {
      try {
        content?.document?.getSelection?.()?.removeAllRanges();
      } catch {
        // Ignore selections from detached sections.
      }
    }
  };

  const addHighlight = (color: HighlightColor, note: string) => {
    if (!selection) return;
    const now = Date.now();
    const existing = highlights.find((item) => item.cfi === selection.cfi);
    const next = existing
      ? highlights.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                color,
                note: note || item.note,
                text: selection.text,
                chapter: selection.chapter,
                updatedAt: now,
              }
            : item,
        )
      : [
          ...highlights,
          {
            id: newHighlightId(),
            cfi: selection.cfi,
            text: selection.text,
            chapter: selection.chapter,
            percent: selection.percent,
            color,
            note,
            createdAt: now,
            updatedAt: now,
          },
        ];
    highlightsRef.current = next;
    setHighlights(next);
    saveHighlights(meta.id, next);
    setSelection(null);
    clearIframeSelection();
    window.setTimeout(() => applyHighlightsRef.current?.(), 30);
    setToolsTab("highlights");
    if (note) setToolsOpen(true);
  };

  const deleteHighlight = (id: string) => {
    const target = highlights.find((item) => item.id === id);
    if (!target) return;
    const next = highlights.filter((item) => item.id !== id);
    highlightsRef.current = next;
    setHighlights(next);
    saveHighlights(meta.id, next);
    try {
      renditionRef.current?.annotations?.remove(target.cfi, "highlight");
    } catch {
      // The section may already be closed.
    }
  };

  const saveHighlightNote = (id: string, note: string) => {
    const next = highlights.map((item) =>
      item.id === id ? { ...item, note: note.trim(), updatedAt: Date.now() } : item,
    );
    highlightsRef.current = next;
    setHighlights(next);
    saveHighlights(meta.id, next);
  };

  const jumpToHighlight = async (highlight: Highlight) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    setToolsOpen(false);
    setSelection(null);
    await rendition.display(highlight.cfi).catch(() => undefined);
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
            className={`icon-button ${toolsOpen ? "icon-button--active" : ""}`}
            onClick={() => {
              if (toolsOpen) setToolsOpen(false);
              else openTools("search");
            }}
            title="全文搜索 (Ctrl+F)"
            aria-label="全文搜索"
          >
            <Icon name="search" size={19} />
          </button>
          <button
            className={`icon-button ${toolsOpen && toolsTab === "highlights" ? "icon-button--active" : ""}`}
            onClick={() => {
              if (toolsOpen && toolsTab === "highlights") setToolsOpen(false);
              else openTools("highlights");
            }}
            title="划线与笔记"
            aria-label="划线与笔记"
          >
            <Icon name="pen" size={18} />
          </button>
          <button
            className="icon-button"
            onClick={onToggleTheme}
            title={`切换主题（当前：${themeLabel}）`}
            aria-label={`切换主题，当前${themeLabel}`}
          >
            <Icon name={themeIcon} size={19} />
          </button>
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

        {toolsOpen ? (
          <>
            <div className="drawer-backdrop" onClick={() => setToolsOpen(false)} />
            <ReaderToolsPanel
              open={toolsOpen}
              tab={toolsTab}
              onTabChange={setToolsTab}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSearch={() => void runSearch()}
              searching={searching}
              searchDone={searchDone}
              searchTotal={searchTotal}
              searchResults={searchResults}
              searchHasRun={searchHasRun}
              searchTotalHits={searchTotalHits}
              currentChapter={currentLabel}
              bookmarks={bookmarks}
              highlights={highlights}
              onJumpSearch={(result) => void jumpToSearchResult(result)}
              onAddBookmark={addBookmark}
              onJumpBookmark={(bookmark) => void jumpToBookmark(bookmark)}
              onDeleteBookmark={deleteBookmark}
              onJumpHighlight={(highlight) => void jumpToHighlight(highlight)}
              onDeleteHighlight={deleteHighlight}
              onSaveHighlightNote={saveHighlightNote}
              onClose={() => setToolsOpen(false)}
            />
          </>
        ) : null}
      </div>

      {selection ? (
        <SelectionToolbar
          left={selection.left}
          top={selection.top}
          onHighlight={addHighlight}
          onClose={() => setSelection(null)}
        />
      ) : null}

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
        onSentence={(chapter, start, length) =>
          void highlightTtsSentence(chapter, start, length)
        }
        onStop={clearTtsHighlight}
      />
    </section>
  );
}

function collectSectionText(document?: Document): string {
  return collectTextNodes(document).text;
}

interface TextNodePosition {
  node: Text;
  start: number;
  end: number;
}

function collectTextNodes(document?: Document): { text: string; nodes: TextNodePosition[] } {
  if (!document?.body) return { text: "", nodes: [] };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent && ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: TextNodePosition[] = [];
  let text = "";
  let current = walker.nextNode();
  while (current) {
    const value = current.textContent ?? "";
    if (value) {
      nodes.push({
        node: current as Text,
        start: text.length,
        end: text.length + value.length,
      });
      text += value;
    }
    current = walker.nextNode();
  }
  return { text, nodes };
}

function findNthMatch(text: string, query: string, occurrence: number): number {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return -1;
  let from = 0;
  let count = 0;
  while (from < haystack.length) {
    const position = haystack.indexOf(needle, from);
    if (position < 0) return -1;
    if (count === occurrence) return position;
    count += 1;
    from = position + Math.max(1, needle.length);
  }
  return -1;
}

function locateOffset(
  nodes: TextNodePosition[],
  offset: number,
): { node: Text; offset: number } | null {
  for (const entry of nodes) {
    if (offset >= entry.start && offset <= entry.end) {
      return { node: entry.node, offset: Math.min(entry.end - entry.start, offset - entry.start) };
    }
  }
  return null;
}

function getVisibleTextOffset(
  document: Document | undefined,
  nodes: TextNodePosition[],
): number | null {
  const view = document?.defaultView;
  if (!document || !view) return null;
  const frame = view.frameElement as HTMLIFrameElement | null;
  const frameRect = frame?.getBoundingClientRect();
  const viewport = frame?.closest(".reader__viewport")?.getBoundingClientRect();
  const left = frameRect
    ? Math.max(0, (viewport?.left ?? frameRect.left) - frameRect.left)
    : 0;
  const right = frameRect
    ? Math.min(frameRect.width, (viewport?.right ?? frameRect.right) - frameRect.left)
    : view.innerWidth;
  const top = frameRect
    ? Math.max(0, (viewport?.top ?? frameRect.top) - frameRect.top)
    : 0;
  const bottom = frameRect
    ? Math.min(frameRect.height, (viewport?.bottom ?? frameRect.bottom) - frameRect.top)
    : view.innerHeight;
  if (right <= left || bottom <= top) return null;

  const visible: { entry: TextNodePosition; rect: DOMRect }[] = [];
  for (const entry of nodes) {
    try {
      const range = document.createRange();
      range.selectNodeContents(entry.node);
      for (const rect of Array.from(range.getClientRects())) {
        if (
          rect.width > 1 &&
          rect.height > 1 &&
          rect.bottom > top &&
          rect.top < bottom &&
          rect.right > left &&
          rect.left < right
        ) {
          visible.push({ entry, rect });
        }
      }
    } catch {
      // Ignore detached or non-renderable nodes.
    }
  }
  visible.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

  for (const item of visible) {
    const x = Math.max(left, Math.min(right - 1, item.rect.left + 2));
    const y = Math.max(top, Math.min(bottom - 1, item.rect.top + item.rect.height / 2));
    const caret = document.caretRangeFromPoint(x, y);
    if (caret?.startContainer.nodeType === Node.TEXT_NODE) {
      const entry = nodes.find((node) => node.node === caret.startContainer);
      if (entry) return entry.start + caret.startOffset;
    }
  }
  return null;
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

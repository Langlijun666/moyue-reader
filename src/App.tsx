import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookMeta, BookRecord, Progress, ReaderSettings } from "./types";
import { deleteBook, getBook, listBooks, putBook } from "./lib/db";
import { inspectEpub } from "./lib/epub";
import { inspectTxt } from "./lib/txt";
import { imageFileToCover } from "./lib/cover";
import { formatFromFileName } from "./lib/format";
import { invoke } from "@tauri-apps/api/core";
import { createBackupBase64, readBackupFile } from "./lib/backup";
import {
  loadCategoryData,
  newCategoryId,
  saveCategoryData,
  type Category,
  type CategoryData,
} from "./lib/categories";
import { loadProgressMap, loadSettings, saveProgress, saveSettings } from "./lib/storage";
import { Sidebar } from "./components/Sidebar";
import { EmptyState } from "./components/EmptyState";
import { Reader } from "./components/Reader";
import { FullShelf } from "./components/FullShelf";
import { MusicPlayer } from "./components/MusicPlayer";
import { CategoryManager } from "./components/CategoryManager";
import { AssignCategories } from "./components/AssignCategories";
import { AppSettingsPanel } from "./components/AppSettingsPanel";
import { UninstallDialog } from "./components/UninstallDialog";
import { Icon } from "./components/Icons";

const AUTO_BACKUP_KEY = "moyue.backup.auto.v1";
const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000;
const APP_VERSION = "0.6.0";

export default function App() {
  const [library, setLibrary] = useState<BookMeta[]>([]);
  const [active, setActive] = useState<BookRecord | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const fullShelf = settings.shelfView === "full";
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>(loadProgressMap);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [categoryData, setCategoryData] = useState<CategoryData>(loadCategoryData);
  const [viewMode, setViewMode] = useState<"all" | "categories">(() => {
    try {
      return localStorage.getItem("moyue.libraryView.v1") === "categories" ? "categories" : "all";
    } catch {
      return "all";
    }
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [assignBook, setAssignBook] = useState<BookMeta | null>(null);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupDir, setBackupDir] = useState("");
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      return localStorage.getItem("moyue.sidebarHidden.v1") === "1";
    } catch {
      return false;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverTargetRef = useRef<BookMeta | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const autoBackupStarted = useRef(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    let cancelled = false;
    listBooks()
      .then((books) => {
        if (!cancelled) setLibrary(books);
      })
      .catch(() => {
        if (!cancelled) setToast("本地书库初始化失败，请刷新后重试");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.colorScheme = settings.theme === "night" ? "dark" : "light";
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveCategoryData(categoryData);
  }, [categoryData]);

  useEffect(() => {
    try {
      localStorage.setItem("moyue.libraryView.v1", viewMode);
    } catch {
      // The view preference is optional.
    }
  }, [viewMode]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let cancelled = false;
    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        if (cancelled) return;
        return getCurrentWindow().setTheme(settings.theme === "night" ? "dark" : "light");
      })
      .catch(() => {
        // The web preview has no native window; a theme failure is harmless.
      });
    return () => {
      cancelled = true;
    };
  }, [settings.theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("moyue.sidebarHidden.v1", sidebarHidden ? "1" : "0");
    } catch {
      // The preference is optional; reading must not depend on it.
    }
  }, [sidebarHidden]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!active || fullShelf) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarHidden((hidden) => !hidden);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, fullShelf]);

  const shelf = useMemo(
    () => library.map((book) => ({ ...book, progress: progressMap[book.id] })),
    [library, progressMap],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const category of categoryData.categories) counts[category.id] = 0;
    const bookIds = new Set(library.map((book) => book.id));
    for (const [bookId, categoryIds] of Object.entries(categoryData.assignments)) {
      if (!bookIds.has(bookId)) continue;
      for (const categoryId of categoryIds) {
        if (categoryId in counts) counts[categoryId] += 1;
      }
    }
    return counts;
  }, [categoryData, library]);

  const importFile = useCallback(
    async (file: File) => {
      if (!/\.(epub|txt)$/i.test(file.name)) {
        setToast("请选择 .epub 或 .txt 格式的书籍");
        return;
      }
      if (file.size > 250 * 1024 * 1024) {
        setToast("这本书超过 250 MB，暂时无法导入");
        return;
      }

      setBusy(true);
      try {
        const data = await file.arrayBuffer();
        const format = formatFromFileName(file.name);
        const info =
          format === "txt"
            ? await inspectTxt(data, file.name)
            : await inspectEpub(data, file.name);
        const existing = library.find((book) => book.id === info.id);
        const now = Date.now();
        const record: BookRecord = {
          ...info,
          fileName: file.name,
          size: file.size,
          addedAt: existing?.addedAt ?? now,
          lastOpenedAt: now,
          data,
        };
        await putBook(record);
        setLibrary((books) => [stripData(record), ...books.filter((book) => book.id !== record.id)]);
        setActive(record);
        setToast(existing ? "已更新书架中的这本书" : `《${record.title}》已放上书架`);
      } catch (error) {
        console.error(error);
        setToast("导入失败：文件可能损坏，或不是有效的 EPUB / TXT");
      } finally {
        setBusy(false);
      }
    },
    [library],
  );

  const onPickFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void importFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const requestCoverChange = (book: BookMeta) => {
    coverTargetRef.current = book;
    coverInputRef.current?.click();
  };

  const onPickCover = async (files: FileList | null) => {
    const file = files?.[0];
    const target = coverTargetRef.current;
    coverTargetRef.current = null;
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (!file || !target) return;

    setBusy(true);
    try {
      const cover = await imageFileToCover(file);
      const record = active?.id === target.id ? active : await getBook(target.id);
      if (!record) throw new Error("找不到这本书，请重新导入");

      const updated = { ...record, cover };
      await putBook(updated);
      setLibrary((books) =>
        books.map((book) => (book.id === updated.id ? { ...book, cover } : book)),
      );
      if (active?.id === updated.id) setActive(updated);
      setToast("封面已更新");
    } catch (error) {
      console.error(error);
      setToast(error instanceof Error ? error.message : "封面更新失败");
    } finally {
      setBusy(false);
    }
  };

  const openBook = async (book: BookMeta) => {
    if (busy) return;
    setBusy(true);
    try {
      const record = await getBook(book.id);
      if (!record) {
        setLibrary((books) => books.filter((item) => item.id !== book.id));
        setToast("这本书的本地文件不见了，请重新导入");
        return;
      }
      const openedAt = Date.now();
      const updated = { ...record, lastOpenedAt: openedAt };
      await putBook(updated);
      setActive(updated);
      setLibrary((books) => [
        stripData(updated),
        ...books.filter((item) => item.id !== updated.id),
      ]);
    } catch (error) {
      console.error(error);
      setToast("打开失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("sample.epub");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], "慢读的理由.epub", { type: "application/epub+zip" });
      await importFile(file);
    } catch (error) {
      console.error(error);
      setToast("示例书加载失败，请直接导入一本 EPUB 或 TXT");
    } finally {
      setBusy(false);
    }
  };

  const removeBook = async (book: BookMeta) => {
    const confirmed = window.confirm(`把《${book.title}》从书架移除？\n本地文件不会被删除。`);
    if (!confirmed) return;
    try {
      await deleteBook(book.id);
      setLibrary((books) => books.filter((item) => item.id !== book.id));
      setCategoryData((current) => {
        if (!current.assignments[book.id]) return current;
        const assignments = { ...current.assignments };
        delete assignments[book.id];
        return { ...current, assignments };
      });
      if (active?.id === book.id) setActive(null);
      setToast("已从书架移除");
    } catch {
      setToast("移除失败，请重试");
    }
  };

  const handleProgress = useCallback(
    (progress: Progress) => {
      if (!active) return;
      saveProgress(active.id, progress);
      setProgressMap((map) => ({ ...map, [active.id]: progress }));
    },
    [active],
  );

  const updateSettings = (patch: Partial<ReaderSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const toggleTheme = () => {
    setSettings((current) => {
      const order: ReaderSettings["theme"][] = ["paper", "sepia", "night"];
      const index = order.indexOf(current.theme);
      return {
        ...current,
        theme: order[(index + 1) % order.length] ?? "paper",
      };
    });
  };

  const createCategory = (name: string): boolean => {
    const value = name.trim();
    if (!value) return false;
    if (
      categoryData.categories.some(
        (category) => category.name.toLowerCase() === value.toLowerCase(),
      )
    ) {
      return false;
    }
    const category: Category = {
      id: newCategoryId(),
      name: value,
      createdAt: Date.now(),
    };
    setCategoryData((current) => ({
      ...current,
      categories: [...current.categories, category],
    }));
    setToast(`已创建分类「${value}」`);
    return true;
  };

  const deleteCategory = (category: Category) => {
    if (!window.confirm(`删除分类「${category.name}」？\n书籍不会被删除。`)) return;
    setCategoryData((current) => {
      const assignments: Record<string, string[]> = {};
      for (const [bookId, ids] of Object.entries(current.assignments)) {
        const remaining = ids.filter((id) => id !== category.id);
        if (remaining.length > 0) assignments[bookId] = remaining;
      }
      return {
        categories: current.categories.filter((item) => item.id !== category.id),
        assignments,
      };
    });
    if (selectedCategoryId === category.id) setSelectedCategoryId("all");
    setToast(`已删除分类「${category.name}」`);
  };

  const toggleBookCategory = (bookId: string, categoryId: string) => {
    setCategoryData((current) => {
      const currentIds = current.assignments[bookId] ?? [];
      const nextIds = currentIds.includes(categoryId)
        ? currentIds.filter((id) => id !== categoryId)
        : [...currentIds, categoryId];
      return {
        ...current,
        assignments: {
          ...current.assignments,
          [bookId]: nextIds,
        },
      };
    });
  };

  const saveBackup = useCallback(
    async (kind: "manual" | "auto" | "pre-restore", silent = false) => {
      if (!("__TAURI_INTERNALS__" in window)) {
        throw new Error("备份功能仅在桌面版可用");
      }
      if (library.length === 0) {
        throw new Error("书架为空，没有需要备份的内容");
      }
      const dataBase64 = await createBackupBase64(
        library,
        progressMap,
        categoryData,
        settings,
        APP_VERSION,
      );
      const path = await invoke<string>("write_backup", { dataBase64, kind });
      try {
        localStorage.setItem(AUTO_BACKUP_KEY, String(Date.now()));
      } catch {
        // The backup itself is already written.
      }
      setBackupMessage(path);
      if (!silent) setToast(`备份已保存：${path}`);
      return path;
    },
    [categoryData, library, progressMap, settings],
  );

  const backupNow = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      await saveBackup("manual");
    } catch (backupError) {
      setToast(backupError instanceof Error ? backupError.message : "备份失败");
    } finally {
      setBackupBusy(false);
    }
  };

  const backupNowRef = useRef(saveBackup);
  useEffect(() => {
    backupNowRef.current = saveBackup;
  }, [saveBackup]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void invoke<string>("backup_dir")
      .then(setBackupDir)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (
      !("__TAURI_INTERNALS__" in window) ||
      library.length === 0 ||
      autoBackupStarted.current
    ) {
      return;
    }
    let last = 0;
    try {
      last = Number(localStorage.getItem(AUTO_BACKUP_KEY)) || 0;
    } catch {
      last = 0;
    }
    if (Date.now() - last < AUTO_BACKUP_INTERVAL) return;
    autoBackupStarted.current = true;
    const timer = window.setTimeout(() => {
      void backupNowRef.current("auto", true).catch(() => undefined);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [library.length]);

  const restoreBackup = async (file: File) => {
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      const parsed = await readBackupFile(file);
      if (parsed.records.length === 0) {
        throw new Error("备份中没有书籍");
      }
      const confirmed = window.confirm(
        `将恢复 ${parsed.records.length} 本书，并合并阅读进度、分类和设置。\n\n现有书籍不会被删除；恢复前会先自动备份当前书库。`,
      );
      if (!confirmed) return;

      if (library.length > 0) {
        try {
          await backupNowRef.current("pre-restore", true);
        } catch {
          throw new Error("恢复前自动备份失败，已取消恢复");
        }
      }

      for (const record of parsed.records) {
        await putBook(record);
      }

      const mergedProgress = { ...progressMap, ...parsed.manifest.progress };
      for (const [id, progress] of Object.entries(parsed.manifest.progress)) {
        saveProgress(id, progress);
      }
      setProgressMap(mergedProgress);

      const categoryMap = new Map(
        categoryData.categories.map((category) => [category.id, category]),
      );
      for (const category of parsed.manifest.categories.categories) {
        categoryMap.set(category.id, category);
      }
      const assignments = { ...categoryData.assignments };
      for (const record of parsed.records) {
        const ids = parsed.manifest.categories.assignments?.[record.id];
        if (Array.isArray(ids)) assignments[record.id] = [...new Set(ids)];
      }
      setCategoryData({
        categories: [...categoryMap.values()],
        assignments,
      });

      if (parsed.manifest.settings) {
        setSettings((current) => ({ ...current, ...parsed.manifest.settings }));
      }

      setLibrary(await listBooks());
      setActive(null);
      setBackupMessage(`已恢复 ${parsed.records.length} 本书`);
      setToast(`已恢复 ${parsed.records.length} 本书`);
    } catch (restoreError) {
      setToast(restoreError instanceof Error ? restoreError.message : "恢复备份失败");
    } finally {
      setBackupBusy(false);
    }
  };

  const openBackupFolder = async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    try {
      await invoke("open_backup_folder");
    } catch {
      setToast("无法打开备份文件夹");
    }
  };

  const confirmUninstall = async (_reason: string, deleteData: boolean) => {
    if (!("__TAURI_INTERNALS__" in window)) {
      throw new Error("自动卸载仅在安装版中可用");
    }
    await invoke("uninstall_app", { deleteData });
  };

  return (
    <div
      className={`app ${active && sidebarHidden && !fullShelf ? "app--sidebar-hidden" : ""} ${fullShelf ? "app--full-shelf" : ""}`}
      data-theme={settings.theme}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void onPickFile(event.dataTransfer.files);
      }}
    >
      {!fullShelf ? (
        <Sidebar
          books={shelf}
          activeId={active?.id}
          query={query}
          settings={settings}
          busy={busy}
          hidden={Boolean(active && sidebarHidden)}
          onQueryChange={setQuery}
          onImport={() => fileInputRef.current?.click()}
          onOpen={(book) => void openBook(book)}
          onDelete={(book) => void removeBook(book)}
          onChangeCover={requestCoverChange}
          onSample={() => void loadSample()}
          onToggleTheme={toggleTheme}
          onOpenMusic={() => setMusicOpen(true)}
          onOpenSettings={() => setAppSettingsOpen(true)}
          categories={categoryData.categories}
          assignments={categoryData.assignments}
          categoryCounts={categoryCounts}
          viewMode={viewMode}
          selectedCategoryId={selectedCategoryId}
          onViewModeChange={(mode) => {
            setViewMode(mode);
            if (mode === "all") setSelectedCategoryId("all");
          }}
          onCategorySelect={setSelectedCategoryId}
          onManageCategories={() => setCategoryManagerOpen(true)}
          onAssignCategories={(book) => setAssignBook(book)}
        />
      ) : null}

      <main className="workspace">
        {active ? (
          <Reader
            key={active.id}
            meta={active}
            data={active.data}
            settings={settings}
            initialProgress={progressMap[active.id]}
            onBack={() => setActive(null)}
            onProgress={handleProgress}
            onSettingsChange={updateSettings}
            onChangeCover={() => requestCoverChange(active)}
            sidebarHidden={fullShelf ? true : sidebarHidden}
            showSidebarToggle={!fullShelf}
            onToggleSidebar={() => setSidebarHidden((hidden) => !hidden)}
            onOpenMusic={() => setMusicOpen(true)}
            onToggleTheme={toggleTheme}
          />
        ) : fullShelf ? (
          <FullShelf
            books={shelf}
            query={query}
            onQueryChange={setQuery}
            categories={categoryData.categories}
            assignments={categoryData.assignments}
            categoryCounts={categoryCounts}
            viewMode={viewMode}
            selectedCategoryId={selectedCategoryId}
            onViewModeChange={(mode) => {
              setViewMode(mode);
              if (mode === "all") setSelectedCategoryId("all");
            }}
            onCategorySelect={setSelectedCategoryId}
            onManageCategories={() => setCategoryManagerOpen(true)}
            onAssignCategories={(book) => setAssignBook(book)}
            onOpen={(book) => void openBook(book)}
            onDelete={(book) => void removeBook(book)}
            onChangeCover={requestCoverChange}
            onImport={() => fileInputRef.current?.click()}
            onSample={() => void loadSample()}
            busy={busy}
            theme={settings.theme}
            onToggleTheme={toggleTheme}
            onOpenMusic={() => setMusicOpen(true)}
            onOpenSettings={() => setAppSettingsOpen(true)}
          />
        ) : (
          <EmptyState
            recent={shelf[0]}
            onContinue={() => {
              if (shelf[0]) void openBook(shelf[0]);
            }}
            busy={busy}
            onImport={() => fileInputRef.current?.click()}
            onSample={() => void loadSample()}
            onChangeCover={
              shelf[0] ? () => requestCoverChange(shelf[0]) : undefined
            }
          />
        )}
      </main>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".epub,.txt,application/epub+zip,text/plain"
        onChange={(event) => onPickFile(event.target.files)}
      />

      <input
        ref={coverInputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => void onPickCover(event.target.files)}
      />

      <input
        ref={backupInputRef}
        className="visually-hidden"
        type="file"
        accept=".zip,application/zip"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void restoreBackup(file);
        }}
      />

      {dragging ? (
        <div className="drop-veil">
          <div className="drop-veil__card">
            <Icon name="plus" size={30} />
            <h3>松手，把书放上书架</h3>
            <p>支持 EPUB 2 / EPUB 3 / TXT</p>
          </div>
        </div>
      ) : null}

      {busy ? (
        <div className="busy-pill">
          <span className="spinner spinner--small" />
          正在整理书页…
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      <MusicPlayer
        open={musicOpen}
        onOpen={() => setMusicOpen(true)}
        onClose={() => setMusicOpen(false)}
      />

      <CategoryManager
        open={categoryManagerOpen}
        categories={categoryData.categories}
        counts={categoryCounts}
        onClose={() => setCategoryManagerOpen(false)}
        onCreate={createCategory}
        onDelete={deleteCategory}
      />

      <AssignCategories
        open={Boolean(assignBook)}
        book={assignBook}
        categories={categoryData.categories}
        assignedIds={assignBook ? categoryData.assignments[assignBook.id] ?? [] : []}
        onToggle={(categoryId) => {
          if (assignBook) toggleBookCategory(assignBook.id, categoryId);
        }}
        onClose={() => setAssignBook(null)}
        onManage={() => {
          setAssignBook(null);
          setCategoryManagerOpen(true);
        }}
      />

      <AppSettingsPanel
        open={appSettingsOpen}
        theme={settings.theme}
        onClose={() => setAppSettingsOpen(false)}
        onThemeChange={(theme) => updateSettings({ theme })}
        shelfView={settings.shelfView}
        onShelfViewChange={(shelfView) => {
          updateSettings({ shelfView });
          if (shelfView === "sidebar") setSidebarHidden(false);
        }}
        onBackupNow={() => void backupNow()}
        onRestoreBackup={() => backupInputRef.current?.click()}
        onOpenBackupFolder={() => void openBackupFolder()}
        backupBusy={backupBusy}
        backupMessage={backupMessage}
        backupDir={backupDir}
        onUninstall={() => {
          setAppSettingsOpen(false);
          setUninstallOpen(true);
        }}
      />

      <UninstallDialog
        open={uninstallOpen}
        onClose={() => setUninstallOpen(false)}
        onConfirm={confirmUninstall}
      />
    </div>
  );
}

function stripData(record: BookRecord): BookMeta {
  const { data: _data, ...meta } = record;
  return meta;
}

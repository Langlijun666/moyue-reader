import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ShelfView, ThemeName } from "../types";
import { Icon } from "./Icons";

interface AppSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  shelfView: ShelfView;
  onShelfViewChange: (view: ShelfView) => void;
  onUninstall: () => void;
}

const themes: { id: ThemeName; label: string; hint: string }[] = [
  { id: "paper", label: "纸白", hint: "温润米白" },
  { id: "sepia", label: "茶褐", hint: "旧书页" },
  { id: "night", label: "夜墨", hint: "低光环境" },
];

const REPO_URL = "https://github.com/Langlijun666/moyue-reader";

export function AppSettingsPanel({
  open,
  onClose,
  theme,
  onThemeChange,
  shelfView,
  onShelfViewChange,
  onUninstall,
}: AppSettingsPanelProps) {
  const [version, setVersion] = useState("0.4.1");
  const [dataDir, setDataDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  useEffect(() => {
    if (!open || !isTauri) return;
    let cancelled = false;
    void (async () => {
      try {
        const [info, folder] = await Promise.all([
          invoke<{ version: string }>("app_info"),
          invoke<string>("data_dir"),
        ]);
        if (!cancelled) {
          setVersion(info.version);
          setDataDir(folder);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "读取设置信息失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isTauri]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      event.stopPropagation();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  if (!open) return null;

  const openDataFolder = async () => {
    if (!isTauri) {
      setError("数据文件夹仅在桌面版可用");
      return;
    }
    try {
      await invoke("open_data_folder");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "无法打开数据文件夹");
    }
  };

  const copyRepo = async () => {
    try {
      await navigator.clipboard.writeText(REPO_URL);
      setCopied(true);
    } catch {
      setError("复制失败，请手动打开 GitHub 仓库地址");
    }
  };

  return (
    <>
      <div className="app-settings-backdrop" onClick={onClose} />
      <aside className="app-settings" role="dialog" aria-label="软件设置">
        <header className="app-settings__header">
          <div>
            <span className="eyebrow">SETTINGS</span>
            <h3>软件设置</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭软件设置">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="app-settings__body">
          <section className="settings-section">
            <div className="settings-section__title">
              <span>外观主题</span>
              <small>同步阅读界面</small>
            </div>
            <div className="app-theme-options">
              {themes.map((item) => (
                <button
                  key={item.id}
                  className={`app-theme-option ${theme === item.id ? "app-theme-option--active" : ""}`}
                  onClick={() => onThemeChange(item.id)}
                >
                  <span className={`app-theme-option__swatch app-theme-option__swatch--${item.id}`} />
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__title">
              <span>书架视图</span>
              <small>下次打开也生效</small>
            </div>
            <div className="app-shelf-options">
              <button
                className={`app-shelf-option ${shelfView === "sidebar" ? "app-shelf-option--active" : ""}`}
                onClick={() => onShelfViewChange("sidebar")}
              >
                <span className="app-shelf-option__preview app-shelf-option__preview--sidebar">
                  <i />
                  <i />
                </span>
                <strong>左侧书架</strong>
                <small>阅读时保留左侧书架</small>
              </button>
              <button
                className={`app-shelf-option ${shelfView === "full" ? "app-shelf-option--active" : ""}`}
                onClick={() => onShelfViewChange("full")}
              >
                <span className="app-shelf-option__preview app-shelf-option__preview--full">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <strong>全屏书架</strong>
                <small>书架占满窗口，阅读时正文全宽</small>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__title">
              <span>阅读排版</span>
              <small>在阅读界面调整</small>
            </div>
            <p className="settings-note settings-note--compact">
              打开一本书后，点击右上角的设置按钮，可以调整字号、字重、行距和宋体 / 黑体。
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section__title">
              <span>本机数据</span>
              <small>不上传云端</small>
            </div>
            <p className="settings-note settings-note--compact">
              书库、阅读进度、分类和设置都保存在这台电脑上。卸载时默认保留这些数据。
            </p>
            <div className="app-data-path" title={dataDir}>
              <Icon name="folder" size={14} />
              <code>{dataDir || "桌面版会显示数据目录"}</code>
            </div>
            <button className="text-button app-settings__link" onClick={() => void openDataFolder()}>
              打开数据文件夹
            </button>
          </section>

          <section className="settings-section">
            <div className="settings-section__title">
              <span>关于</span>
              <small>v{version}</small>
            </div>
            <div className="app-about">
              <div>
                <strong>墨阅 · Moyue</strong>
                <p>本地优先的 EPUB / TXT 阅读器，带书架分类和本地音乐播放。</p>
              </div>
              <button className="button button--ghost" onClick={() => void copyRepo()}>
                {copied ? "已复制" : "复制仓库地址"}
              </button>
            </div>
            <p className="app-repo-url">{REPO_URL}</p>
            <p className="app-license">MIT License · 2026 Moyue contributors</p>
          </section>

          <section className="app-settings__danger">
            <div className="settings-section__title">
              <span>危险操作</span>
              <small>DANGER</small>
            </div>
            <p className="settings-note settings-note--compact">
              卸载会删除程序本身，但默认保留书库、阅读进度和分类。音乐文件夹中的歌曲不会被删除。
            </p>
            <button className="button button--danger" onClick={onUninstall}>
              <Icon name="trash" size={16} />
              卸载墨阅
            </button>
          </section>

          {error ? <p className="settings-error">{error}</p> : null}
        </div>
      </aside>
    </>
  );
}

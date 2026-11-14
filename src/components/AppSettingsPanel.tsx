import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ReaderSettings, ShelfView, ThemeName } from "../types";
import { Icon } from "./Icons";
import { THEME_PRESETS, themePreset } from "../lib/themes";
import type { UpdatePhase } from "../lib/useUpdater";
import {
  copyDiagnosticReport,
  exportDiagnosticReport,
  FEEDBACK_EMAIL,
  getRecentDiagnostics,
  openDiagnosticFolder,
  openFeedback,
} from "../lib/diagnostics";

interface AppSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  settings: ReaderSettings;
  onSettingsChange: (patch: Partial<ReaderSettings>) => void;
  shelfView: ShelfView;
  onShelfViewChange: (view: ShelfView) => void;
  onBackupNow: () => void;
  onRestoreBackup: () => void;
  onOpenBackupFolder: () => void;
  backupBusy: boolean;
  backupMessage: string | null;
  backupDir: string;
  onOpenSponsor: () => void;
  onUninstall: () => void;
  updatePhase: UpdatePhase;
  updateVersion: string;
  updateProgress: number;
  updateError: string | null;
  autoCheck: boolean;
  autoDownload: boolean;
  updateSource: "auto" | "mirror" | "github";
  onAutoCheckChange: (value: boolean) => void;
  onAutoDownloadChange: (value: boolean) => void;
  onUpdateSourceChange: (value: "auto" | "mirror" | "github") => void;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  onOpenChangelog: () => void;
}

const themes: { id: ThemeName; label: string; hint: string }[] = [
  ...THEME_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    hint: preset.hint,
  })),
  { id: "custom", label: "自定义", hint: "自己的颜色" },
];

const REPO_URL = "https://github.com/Langlijun666/moyue-reader";

export function AppSettingsPanel({
  open,
  onClose,
  theme,
  onThemeChange,
  settings,
  onSettingsChange,
  shelfView,
  onShelfViewChange,
  onBackupNow,
  onRestoreBackup,
  onOpenBackupFolder,
  backupBusy,
  backupMessage,
  backupDir,
  onOpenSponsor,
  onUninstall,
  updatePhase,
  updateVersion,
  updateProgress,
  updateError,
  autoCheck,
  autoDownload,
  updateSource,
  onAutoCheckChange,
  onAutoDownloadChange,
  onUpdateSourceChange,
  onCheckUpdate,
  onInstallUpdate,
  onOpenChangelog,
}: AppSettingsPanelProps) {
  const [version, setVersion] = useState("0.28.1");
  const [dataDir, setDataDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const diagnostics = getRecentDiagnostics();
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
                  <span
                    className={`app-theme-option__swatch app-theme-option__swatch--${item.id}`}
                    style={{
                      background:
                        item.id === "custom"
                          ? "linear-gradient(135deg,#e8f0e9 0 35%,#f6eaea 35% 55%,#e8f0f4 55% 75%,#2a2635 75% 100%)"
                          : `linear-gradient(135deg, ${themePreset(item.id).app.bg} 0 62%, ${themePreset(item.id).app.surface} 62% 80%, ${themePreset(item.id).app.accent} 80% 100%)`,
                    }}
                  />
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
            {theme === "custom" ? (
              <div className="app-custom-colors">
                {[
                  ["背景", "customBackground"],
                  ["文字", "customText"],
                  ["强调", "customAccent"],
                ].map(([label, key]) => (
                  <label className="app-custom-color" key={key}>
                    <span>{label}</span>
                    <input
                      type="color"
                      value={
                        settings[
                          key as "customBackground" | "customText" | "customAccent"
                        ]
                      }
                      onChange={(event) =>
                        onSettingsChange({ [key]: event.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}
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
              <span>书库备份</span>
              <small>每天自动备份</small>
            </div>
            <p className="settings-note settings-note--compact">
              备份包含书籍、封面、进度、分类、书签、划线与笔记、阅读统计、主题、字体和背景。自动保留最近 8 份，只保存在本机。
            </p>
            <div className="backup-actions">
              <button
                className="button button--primary"
                onClick={onBackupNow}
                disabled={backupBusy}
              >
                <Icon name="download" size={15} />
                {backupBusy ? "正在备份…" : "立即备份"}
              </button>
              <button
                className="button button--ghost"
                onClick={onRestoreBackup}
                disabled={backupBusy}
              >
                <Icon name="upload" size={15} />
                恢复备份
              </button>
            </div>
            <div className="app-data-path" title={backupDir}>
              <Icon name="folder" size={14} />
              <code>{backupDir || "桌面版会显示备份目录"}</code>
            </div>
            <button className="text-button app-settings__link" onClick={onOpenBackupFolder}>
              打开备份文件夹
            </button>
            {backupMessage ? (
              <p className="backup-status" title={backupMessage}>
                {backupMessage}
              </p>
            ) : null}
          </section>

          <section className="settings-section">
            <div className="settings-section__title">
              <span>帮助与反馈</span>
              <small>{diagnostics.length > 0 ? `${diagnostics.length} 条记录` : "需要帮助时"}</small>
            </div>
            <div className="feedback-actions">
              <button
                className="button button--ghost"
                onClick={() => void openFeedback("bug")}
              >
                反馈问题
              </button>
              <button
                className="button button--ghost"
                onClick={() => void openFeedback("feature")}
              >
                功能建议
              </button>
              <button
                className="button button--ghost"
                onClick={() => void openFeedback("email")}
              >
                邮件反馈
              </button>
              <button
                className="button button--ghost"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(FEEDBACK_EMAIL)
                    .then(() => setFeedbackStatus(`邮箱已复制：${FEEDBACK_EMAIL}`))
                    .catch(() => setFeedbackStatus(FEEDBACK_EMAIL));
                }}
              >
                复制邮箱
              </button>
              <button
                className="button button--ghost"
                onClick={() => {
                  void copyDiagnosticReport()
                    .then(() => setFeedbackStatus("诊断信息已复制，可粘贴到反馈里"))
                    .catch(() => setFeedbackStatus("复制失败，请尝试导出诊断文件"));
                }}
              >
                复制诊断
              </button>
              <button
                className="button button--ghost"
                onClick={() => {
                  void exportDiagnosticReport()
                    .then((path) => setFeedbackStatus(`诊断报告已保存：${path}`))
                    .catch((error) =>
                      setFeedbackStatus(
                        error instanceof Error ? error.message : "导出诊断失败",
                      ),
                    );
                }}
              >
                导出诊断
              </button>
              <button
                className="button button--ghost"
                onClick={() => setShowDiagnostics((value) => !value)}
              >
                {showDiagnostics ? "收起最近错误" : "查看最近错误"}
              </button>
              <button
                className="button button--ghost"
                onClick={() => void openDiagnosticFolder()}
              >
                打开日志目录
              </button>
            </div>
            {feedbackStatus ? <p className="settings-field-hint">{feedbackStatus}</p> : null}
            {showDiagnostics ? (
              <pre className="diagnostic-preview">
                {diagnostics.length > 0
                  ? diagnostics
                      .map(
                        (entry) =>
                          `[${new Date(entry.time).toLocaleString("zh-CN")}] ${entry.message}`,
                      )
                      .join("\n")
                  : "暂无错误记录"}
              </pre>
            ) : null}
            <p className="settings-field-hint">
              反馈会打开 GitHub Issue。诊断报告不包含书籍正文、笔记和搜索内容。
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section__title">
              <span>软件更新</span>
              <small>
                {updatePhase === "checking"
                  ? "正在检查"
                  : updatePhase === "downloading"
                    ? `下载 ${updateProgress}%`
                    : updatePhase === "ready"
                      ? `v${updateVersion} 已就绪`
                      : updatePhase === "installing"
                        ? "正在安装"
                        : "自动更新"}
              </small>
            </div>
            <div className="update-preferences">
              <label>
                <input
                  type="checkbox"
                  checked={autoCheck}
                  onChange={(event) => onAutoCheckChange(event.target.checked)}
                />
                <span>自动检查更新</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={autoDownload}
                  onChange={(event) => onAutoDownloadChange(event.target.checked)}
                />
                <span>自动下载更新</span>
              </label>
              <div className="update-source">
                <span className="update-source__label">更新线路</span>
                <div className="update-source__options">
                  {[
                    ["auto", "自动"],
                    ["mirror", "国内镜像"],
                    ["github", "GitHub"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={updateSource === value ? "is-active" : ""}
                      onClick={() =>
                        onUpdateSourceChange(value as "auto" | "mirror" | "github")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <small>
                  {updateSource === "auto"
                    ? "国内镜像优先，失败后自动尝试 GitHub"
                    : updateSource === "mirror"
                      ? "只从阿里云 OSS 检查更新"
                      : "只从 GitHub 检查更新"}
                </small>
              </div>
            </div>
            <div className="update-settings-actions">
              <button
                className="button button--ghost"
                onClick={onCheckUpdate}
                disabled={updatePhase === "checking" || updatePhase === "downloading"}
              >
                <Icon name="refresh" size={14} />
                检查更新
              </button>
              {updatePhase === "ready" ? (
                <button className="button button--primary" onClick={onInstallUpdate}>
                  重启更新
                </button>
              ) : null}
            </div>
            {updateError ? <p className="settings-field-hint">{updateError}</p> : null}
            <p className="settings-field-hint">
              更新包会校验签名；离线语音模型和书库数据不会被覆盖。
            </p>
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
              <button className="button button--ghost" onClick={onOpenChangelog}>
                更新日志
              </button>
            </div>
            <p className="app-repo-url">{REPO_URL}</p>
            <p className="app-license">MIT License · 2026 Moyue contributors</p>
          </section>

          <section className="sponsor-support">
            <div className="sponsor-support__copy">
              <span>
                <Icon name="spark" size={15} />
              </span>
              <div>
                <strong>支持墨阅</strong>
                <p>如果它帮你省下了一点时间，可以请我喝杯咖啡。</p>
              </div>
            </div>
            <button className="button button--ghost" onClick={onOpenSponsor}>
              支持开发
            </button>
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

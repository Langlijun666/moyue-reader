import { formatBytes } from "../lib/format";
import type { UpdatePhase } from "../lib/useUpdater";
import { Icon } from "./Icons";

interface UpdateNoticeProps {
  phase: UpdatePhase;
  version: string;
  body: string;
  progress: number;
  downloaded: number;
  total: number;
  error: string | null;
  onDownload: () => void;
  onInstall: () => void;
  onSkip: () => void;
  onLater: () => void;
  onRetry: () => void;
}

export function UpdateNotice({
  phase,
  version,
  body,
  progress,
  downloaded,
  total,
  error,
  onDownload,
  onInstall,
  onSkip,
  onLater,
  onRetry,
}: UpdateNoticeProps) {
  if (phase === "idle" || phase === "checking") return null;

  if (phase === "downloading") {
    return (
      <div className="update-pill" role="status" aria-live="polite">
        <span className="spinner spinner--small" />
        <span>正在下载更新 {progress > 0 ? `${progress}%` : ""}</span>
        <span className="update-pill__bar">
          <i style={{ width: `${progress}%` }} />
        </span>
      </div>
    );
  }

  if (phase === "installing") {
    return (
      <div className="update-card" role="status">
        <div className="update-card__head">
          <span className="update-card__icon"><Icon name="refresh" size={16} /></span>
          <div>
            <strong>正在安装更新</strong>
            <small>应用即将重启</small>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="update-card update-card--error" role="alert">
        <div className="update-card__head">
          <span className="update-card__icon"><Icon name="refresh" size={16} /></span>
          <div>
            <strong>更新没有完成</strong>
            <small>{error || "请稍后再试"}</small>
          </div>
        </div>
        <div className="update-card__actions">
          <button className="update-button update-button--ghost" onClick={onLater}>
            关闭
          </button>
          <button className="update-button" onClick={onRetry}>
            重试
          </button>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="update-card" role="status">
        <div className="update-card__head">
          <span className="update-card__icon"><Icon name="download" size={16} /></span>
          <div>
            <strong>新版本 {version} 已准备好</strong>
            <small>
              {total > 0 ? `${formatBytes(downloaded)} / ${formatBytes(total)}` : "下载完成"}
            </small>
          </div>
        </div>
        {body ? <p className="update-card__body">{body}</p> : null}
        <div className="update-card__actions">
          <button className="update-button update-button--ghost" onClick={onLater}>
            稍后
          </button>
          <button className="update-button update-button--ghost" onClick={onSkip}>
            跳过
          </button>
          <button className="update-button" onClick={onInstall}>
            重启更新
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="update-card" role="status">
      <div className="update-card__head">
        <span className="update-card__icon"><Icon name="download" size={16} /></span>
        <div>
          <strong>发现新版本 {version}</strong>
          <small>{body || "可以静默下载，准备好后再重启更新"}</small>
        </div>
      </div>
      <div className="update-card__actions">
        <button className="update-button update-button--ghost" onClick={onSkip}>
          跳过
        </button>
        <button className="update-button update-button--ghost" onClick={onLater}>
          稍后
        </button>
        <button className="update-button" onClick={onDownload}>
          下载更新
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Icon } from "./Icons";

interface UninstallDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, deleteData: boolean) => Promise<void>;
}

const reasons = [
  { id: "unused", label: "不再需要这个软件" },
  { id: "alternative", label: "找到了更合适的替代品" },
  { id: "missing", label: "缺少我需要功能" },
  { id: "problem", label: "遇到问题或无法正常使用" },
  { id: "space", label: "占用空间" },
  { id: "other", label: "其他原因" },
];

export function UninstallDialog({ open, onClose, onConfirm }: UninstallDialogProps) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [deleteData, setDeleteData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setDetail("");
      setDeleteData(false);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      event.stopPropagation();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, busy, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (!reason) {
      setError("请先选择一个卸载原因");
      return;
    }
    if (reason === "other" && !detail.trim()) {
      setError("请补充一下具体原因");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(detail.trim() || reason, deleteData);
    } catch (confirmError) {
      setBusy(false);
      setError(confirmError instanceof Error ? confirmError.message : "卸载失败，请重试");
    }
  };

  return (
    <div className="modal-backdrop uninstall-backdrop" onClick={() => !busy && onClose()}>
      <section
        className="category-dialog uninstall-dialog"
        role="dialog"
        aria-label="卸载墨阅"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="category-dialog__header">
          <div>
            <span className="eyebrow">UNINSTALL</span>
            <h3>卸载墨阅</h3>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="取消卸载"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        {busy ? (
          <div className="uninstall-progress">
            <span className="spinner" />
            <h4>正在退出墨阅…</h4>
            <p>卸载程序即将启动。书库和阅读数据默认会保留。</p>
          </div>
        ) : (
          <>
            <div className="uninstall-warning">
              <Icon name="trash" size={18} />
              <p>
                卸载会关闭墨阅并删除程序本身。书库、阅读进度和分类默认保留；
                音乐文件夹里的歌曲不会被删除。
              </p>
            </div>

            <div className="uninstall-body">
              <div className="uninstall-section">
                <span className="uninstall-section__title">可以告诉我们卸载原因吗？</span>
                <div className="uninstall-reasons">
                  {reasons.map((item) => (
                    <button
                      key={item.id}
                      className={`uninstall-reason ${reason === item.id ? "uninstall-reason--active" : ""}`}
                      onClick={() => {
                        setReason(item.id);
                        setError(null);
                      }}
                    >
                      <span className="uninstall-reason__check">
                        {reason === item.id ? <Icon name="check" size={11} /> : null}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={detail}
                  onChange={(event) => {
                    setDetail(event.target.value);
                    setError(null);
                  }}
                  placeholder={reason === "other" ? "请补充具体原因…" : "还有什么想说的？（选填）"}
                  maxLength={300}
                  rows={3}
                />
                <small className="uninstall-hint">原因只在本机显示，不会自动上传。</small>
              </div>

              <button
                className={`uninstall-data ${deleteData ? "uninstall-data--active" : ""}`}
                role="checkbox"
                aria-checked={deleteData}
                onClick={() => setDeleteData((value) => !value)}
              >
                <span className="uninstall-data__check">
                  {deleteData ? <Icon name="check" size={11} /> : null}
                </span>
                <span>
                  <strong>同时删除本地书库和阅读数据</strong>
                  <small>包括书库、阅读进度、分类和设置，不可恢复；不会删除音乐文件。</small>
                </span>
              </button>

              {deleteData ? (
                <p className="uninstall-danger-note">
                  已选择删除本地数据。卸载后将无法恢复书库和阅读进度。
                </p>
              ) : null}
            </div>

            {error ? <p className="category-error">{error}</p> : null}

            <footer className="category-dialog__footer uninstall-footer">
              <button className="button button--ghost" onClick={onClose} disabled={busy}>
                取消
              </button>
              <button className="button button--danger" onClick={() => void submit()} disabled={busy}>
                <Icon name="trash" size={15} />
                确认卸载
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

import { changelog } from "../lib/changelog";
import { Icon } from "./Icons";
import { Modal } from "./Modal";

interface ChangelogDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChangelogDialog({ open, onClose }: ChangelogDialogProps) {
  if (!open) return null;
  const [latest, ...older] = changelog;

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="更新日志"
      layerClassName="changelog-backdrop"
      className="changelog-dialog"
    >
        <header className="changelog-dialog__header">
          <div>
            <span className="eyebrow">WHAT'S NEW</span>
            <h3>更新日志</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭更新日志">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="changelog-dialog__body">
          {latest ? (
            <article className="changelog-latest">
              <span className="changelog-version">v{latest.version}</span>
              <h4>当前版本</h4>
              <ul>
                {latest.items.map((item, index) => (
                  <li key={`${item.text}-${index}`} data-depth={item.depth}>
                    {item.text}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          {older.map((entry) => (
            <article className="changelog-entry" key={entry.version}>
              <h4>v{entry.version}</h4>
              <ul>
                {entry.items.map((item, index) => (
                  <li key={`${item.text}-${index}`} data-depth={item.depth}>
                    {item.text}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
    </Modal>
  );
}

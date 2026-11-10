import type { BookMeta, Progress } from "../types";
import { percentLabel } from "../lib/format";
import { BookCover } from "./BookCover";
import { Icon } from "./Icons";

interface EmptyStateProps {
  recent?: BookMeta & { progress?: Progress };
  onContinue?: () => void;
  onImport: () => void;
  onSample: () => void;
  onChangeCover?: () => void;
  busy: boolean;
}

export function EmptyState({
  recent,
  onContinue,
  onImport,
  onSample,
  onChangeCover,
  busy,
}: EmptyStateProps) {
  if (recent) {
    const percent = recent.progress?.percent ?? 0;
    return (
      <section className="empty-state empty-state--continue">
        <div className="empty-state__glow" aria-hidden="true" />
        <div className="empty-state__art empty-state__art--cover">
          <BookCover title={recent.title} author={recent.author} cover={recent.cover} size="large" />
        </div>
        <div className="empty-state__copy">
          <span className="eyebrow">
            <Icon name="book" size={14} />
            继续上次的阅读
          </span>
          <h2 className="continue-title">{recent.title}</h2>
          <p className="continue-author">{recent.author}</p>
          {onChangeCover ? (
            <button className="cover-edit-link" onClick={onChangeCover}>
              <Icon name="image" size={13} />
              更换封面
            </button>
          ) : null}
          <div className="continue-progress">
            <div className="continue-progress__track">
              <span style={{ width: `${Math.round(percent * 100)}%` }} />
            </div>
            <span>{percentLabel(percent)}</span>
          </div>
          <p className="continue-note">
            {percent > 0
              ? "书签已经夹在原来的那一页，接着读就好。"
              : "这本书还没有翻开，从第一页开始吧。"}
          </p>
          <div className="empty-state__actions">
            <button className="button button--primary button--large" onClick={onContinue} disabled={busy}>
              <Icon name="book" size={18} />
              {percent > 0 ? "继续阅读" : "开始阅读"}
            </button>
            <button className="button button--ghost button--large" onClick={onImport} disabled={busy}>
              <Icon name="plus" size={17} />
              导入另一本
            </button>
          </div>
          <div className="feature-row">
            <span><Icon name="check" size={13} /> 进度自动保存</span>
            <span><Icon name="check" size={13} /> 本地书库</span>
            <span><Icon name="check" size={13} /> 离线可读</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="empty-state">
      <div className="empty-state__glow" aria-hidden="true" />
      <div className="empty-state__art" aria-hidden="true">
        <div className="book-stack book-stack--back" />
        <div className="book-stack book-stack--middle" />
        <div className="book-stack book-stack--front">
          <span>慢读</span>
          <small>MOYUE</small>
        </div>
        <div className="empty-state__leaf empty-state__leaf--one" />
        <div className="empty-state__leaf empty-state__leaf--two" />
      </div>

      <div className="empty-state__copy">
        <span className="eyebrow">
          <Icon name="spark" size={14} />
          一间只属于你的书房
        </span>
        <h2>把下一本书，<br />放进你的书架。</h2>
        <p>
          导入 EPUB 或 TXT，墨阅会记住你读到的位置。没有账号，没有打扰，
          书和进度都留在这台电脑上。
        </p>
        <div className="empty-state__actions">
          <button className="button button--primary button--large" onClick={onImport} disabled={busy}>
            <Icon name="plus" size={18} />
            选择一本书
          </button>
          <button className="button button--ghost button--large" onClick={onSample} disabled={busy}>
            先读示例书
            <Icon name="right" size={16} />
          </button>
        </div>
        <div className="feature-row">
          <span><Icon name="check" size={13} /> EPUB 2 / 3</span>
          <span><Icon name="check" size={13} /> TXT 纯文本</span>
          <span><Icon name="check" size={13} /> 自动续读</span>
        </div>
      </div>
    </section>
  );
}

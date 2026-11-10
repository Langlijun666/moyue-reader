import type { TocEntry } from "../types";
import { Icon } from "./Icons";

interface TocPanelProps {
  toc: TocEntry[];
  currentHref: string;
  onSelect: (href: string) => void;
  onClose: () => void;
}

export function TocPanel({ toc, currentHref, onSelect, onClose }: TocPanelProps) {
  return (
    <div className="drawer drawer--left" role="dialog" aria-label="目录">
      <div className="drawer__header">
        <div>
          <span className="eyebrow">CONTENTS</span>
          <h3>目录</h3>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭目录">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="toc-list">
        {toc.length === 0 ? (
          <p className="toc-list__empty">这本书没有提供目录信息。</p>
        ) : (
          toc.map((entry) => <TocBranch key={entry.href + entry.label} entry={entry} depth={0} currentHref={currentHref} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function TocBranch({
  entry,
  depth,
  currentHref,
  onSelect,
}: {
  entry: TocEntry;
  depth: number;
  currentHref: string;
  onSelect: (href: string) => void;
}) {
  const active = hrefMatches(entry.href, currentHref);
  return (
    <>
      <button
        className={`toc-item ${active ? "toc-item--active" : ""}`}
        style={{ paddingLeft: `${18 + depth * 16}px` }}
        onClick={() => onSelect(entry.href)}
      >
        <span>{entry.label || "未命名章节"}</span>
        {active ? <span className="toc-item__dot" aria-hidden="true" /> : null}
      </button>
      {entry.children?.map((child) => (
        <TocBranch
          key={child.href + child.label}
          entry={child}
          depth={depth + 1}
          currentHref={currentHref}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function hrefMatches(a: string, b: string): boolean {
  return a.split("#")[0] === b.split("#")[0];
}

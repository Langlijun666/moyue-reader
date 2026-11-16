import type { ThemeName } from "../types";
import { Icon } from "./Icons";

interface AppRailProps {
  online: boolean;
  storeActive: boolean;
  theme: ThemeName;
  onLibrary: () => void;
  onStore: () => void;
  onStats: () => void;
  onSettings: () => void;
  onManager: () => void;
  onMusic: () => void;
  onToggleTheme: () => void;
}

export function AppRail({
  online,
  storeActive,
  theme,
  onLibrary,
  onStore,
  onStats,
  onSettings,
  onManager,
  onMusic,
  onToggleTheme,
}: AppRailProps) {
  return (
    <aside className="app-rail">
      <div className="app-rail__brand" aria-label="墨阅">
        <span>墨</span>
      </div>

      <nav className="app-rail__nav" aria-label="主导航">
        <button
          className={!storeActive ? "is-active" : ""}
          onClick={onLibrary}
          title="书架"
        >
          <Icon name="book" size={19} />
          <span>书架</span>
        </button>
        {online ? (
          <button
            className={storeActive ? "is-active" : ""}
            onClick={onStore}
            title="书城"
          >
            <Icon name="folder" size={19} />
            <span>书城</span>
          </button>
        ) : null}
      </nav>

      <div className="app-rail__bottom">
        <button onClick={onStats} title="阅读统计" aria-label="阅读统计">
          <Icon name="chart" size={18} />
        </button>
        <button className="desktop-only" onClick={onMusic} title="音乐" aria-label="音乐">
          <Icon name="music" size={18} />
        </button>
        <button onClick={onManager} title="书库管理" aria-label="书库管理">
          <Icon name="folder" size={18} />
        </button>
        <button onClick={onToggleTheme} title="切换主题" aria-label="切换主题">
          <Icon name={theme === "night" ? "sun" : "moon"} size={18} />
        </button>
        <button onClick={onSettings} title="设置" aria-label="设置">
          <Icon name="settings" size={18} />
        </button>
      </div>
    </aside>
  );
}

import type { FontFamily, FontWeight, ReaderSettings, ThemeName } from "../types";
import { Icon } from "./Icons";

interface SettingsPanelProps {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
  onClose: () => void;
}

const themes: { id: ThemeName; label: string; hint: string }[] = [
  { id: "paper", label: "纸白", hint: "温润的米白" },
  { id: "sepia", label: "茶褐", hint: "像旧书页" },
  { id: "night", label: "夜墨", hint: "低光环境" },
];

const fontOptions: { id: FontFamily; label: string; sample: string }[] = [
  { id: "serif", label: "宋体", sample: "读书" },
  { id: "sans", label: "黑体", sample: "读书" },
];

const weightOptions: { value: FontWeight; label: string }[] = [
  { value: 300, label: "细" },
  { value: 400, label: "常规" },
  { value: 500, label: "中等" },
  { value: 700, label: "加粗" },
];

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  return (
    <div className="drawer drawer--right" role="dialog" aria-label="阅读设置">
      <div className="drawer__header">
        <div>
          <span className="eyebrow">READING</span>
          <h3>阅读设置</h3>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭设置">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="settings-body">
        <section className="settings-section">
          <div className="settings-section__title">
            <span>翻页方式</span>
            <small>阅读节奏</small>
          </div>
          <div className="reading-mode-options">
            <button
              className={`reading-mode-option ${settings.readingMode === "paginated" ? "reading-mode-option--active" : ""}`}
              onClick={() => onChange({ readingMode: "paginated" })}
            >
              <Icon name="book" size={18} />
              <span>左右翻页</span>
              <small>像纸书一样</small>
            </button>
            <button
              className={`reading-mode-option ${settings.readingMode === "scroll" ? "reading-mode-option--active" : ""}`}
              onClick={() => onChange({ readingMode: "scroll" })}
            >
              <Icon name="chevron-down" size={18} />
              <span>上下滚动</span>
              <small>一镜到底</small>
            </button>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>纸张</span>
            <small>阅读背景</small>
          </div>
          <div className="theme-options">
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`theme-option theme-option--${theme.id} ${settings.theme === theme.id ? "theme-option--active" : ""}`}
                onClick={() => onChange({ theme: theme.id })}
              >
                <span className="theme-option__swatch" />
                <span className="theme-option__label">{theme.label}</span>
                <span className="theme-option__hint">{theme.hint}</span>
                {settings.theme === theme.id ? (
                  <span className="theme-option__check"><Icon name="check" size={12} /></span>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>字号</span>
            <small>{settings.fontSize} px</small>
          </div>
          <div className="stepper-row">
            <button
              className="stepper-button stepper-button--small"
              onClick={() => onChange({ fontSize: Math.max(14, settings.fontSize - 1) })}
              aria-label="减小字号"
            >
              A
            </button>
            <input
              type="range"
              min={14}
              max={30}
              step={1}
              value={settings.fontSize}
              onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
            />
            <button
              className="stepper-button stepper-button--large"
              onClick={() => onChange({ fontSize: Math.min(30, settings.fontSize + 1) })}
              aria-label="增大字号"
            >
              A
            </button>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>字重</span>
            <small>笔画粗细</small>
          </div>
          <div className="weight-options">
            {weightOptions.map((option) => (
              <button
                key={option.value}
                className={`weight-option ${settings.fontWeight === option.value ? "weight-option--active" : ""}`}
                onClick={() => onChange({ fontWeight: option.value })}
                aria-label={`字重：${option.label}`}
              >
                <span style={{ fontWeight: option.value }}>读</span>
                <small>{option.label}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>行距</span>
            <small>{settings.lineHeight.toFixed(1)}</small>
          </div>
          <input
            type="range"
            min={1.4}
            max={2.4}
            step={0.1}
            value={settings.lineHeight}
            onChange={(event) => onChange({ lineHeight: Number(event.target.value) })}
          />
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>字体</span>
            <small>正文</small>
          </div>
          <div className="segmented">
            {fontOptions.map((font) => (
              <button
                key={font.id}
                className={`segmented__item segmented__item--${font.id} ${settings.fontFamily === font.id ? "segmented__item--active" : ""}`}
                onClick={() => onChange({ fontFamily: font.id })}
              >
                {font.sample}
                <small>{font.label}</small>
              </button>
            ))}
          </div>
        </section>

        <p className="settings-note">
          设置会自动保存。左右翻页时可用鼠标滚轮或方向键；上下滚动模式直接滚动阅读。
          主题、字号和字重只影响阅读区域，不改变书本身的排版。
        </p>
      </div>
    </div>
  );
}

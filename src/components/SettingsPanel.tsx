import { useRef, useState } from "react";
import type {
  FontFamily,
  FontWeight,
  PageEffect,
  ReaderSettings,
  ThemeName,
} from "../types";
import { Icon } from "./Icons";
import { THEME_PRESETS, themePreset } from "../lib/themes";

interface SettingsPanelProps {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
  onImportFont: (file: File) => Promise<void>;
  onRemoveFont: () => void;
  onImportBackground: (file: File) => Promise<void>;
  onRemoveBackground: () => void;
  onClose: () => void;
}

const themes: { id: ThemeName; label: string; hint: string }[] = [
  ...THEME_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    hint: preset.hint,
  })),
  { id: "custom", label: "自定义", hint: "自己的颜色" },
];

const customPresets = THEME_PRESETS.filter((preset) => !preset.dark).map(
  (preset) => ({
    label: preset.label,
    background: preset.reader.background,
    text: preset.reader.text,
    accent: preset.reader.accent,
  }),
);

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

const pageEffects: { id: PageEffect; label: string; hint: string }[] = [
  { id: "sweep", label: "纸页扫光", hint: "轻盈" },
  { id: "curl", label: "3D 翻页", hint: "立体" },
  { id: "slide", label: "横向滑动", hint: "利落" },
  { id: "fade", label: "淡入", hint: "安静" },
  { id: "zoom", label: "轻微缩放", hint: "柔和" },
  { id: "none", label: "无动画", hint: "最快" },
];

export function SettingsPanel({
  settings,
  onChange,
  onImportFont,
  onRemoveFont,
  onImportBackground,
  onRemoveBackground,
  onClose,
}: SettingsPanelProps) {
  const fontInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [fontBusy, setFontBusy] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);

  const importFont = async (file: File | undefined) => {
    if (!file || fontBusy) return;
    setFontError(null);
    setFontBusy(true);
    try {
      await onImportFont(file);
    } catch (error) {
      setFontError(error instanceof Error ? error.message : "字体导入失败");
    } finally {
      setFontBusy(false);
      if (fontInputRef.current) fontInputRef.current.value = "";
    }
  };

  const importBackground = async (file: File | undefined) => {
    if (!file || backgroundBusy) return;
    setBackgroundError(null);
    setBackgroundBusy(true);
    try {
      await onImportBackground(file);
    } catch (error) {
      setBackgroundError(error instanceof Error ? error.message : "背景导入失败");
    } finally {
      setBackgroundBusy(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = "";
    }
  };

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
              onClick={() =>
                onChange({
                  readingMode: "scroll",
                  ...(settings.vertical ? { vertical: false } : {}),
                })
              }
            >
              <Icon name="chevron-down" size={18} />
              <span>上下滚动</span>
              <small>一镜到底</small>
            </button>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>翻页动效</span>
            <small>左右翻页时</small>
          </div>
          <div className="page-effect-options">
            {pageEffects.map((effect) => (
              <button
                key={effect.id}
                className={
                  settings.pageEffect === effect.id
                    ? "page-effect-option page-effect-option--active"
                    : "page-effect-option"
                }
                onClick={() => onChange({ pageEffect: effect.id })}
              >
                <span className={`page-effect-option__preview page-effect-option__preview--${effect.id}`} />
                <span>{effect.label}</span>
                <small>{effect.hint}</small>
              </button>
            ))}
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
                <span
                  className="theme-option__swatch"
                  style={{
                    background:
                      theme.id === "custom"
                        ? "linear-gradient(135deg, #e8f0e9 0 35%, #f6eaea 35% 55%, #e8f0f4 55% 75%, #2a2635 75% 100%)"
                        : `linear-gradient(135deg, ${themePreset(theme.id).app.bg} 0 62%, ${themePreset(theme.id).app.surface} 62% 80%, ${themePreset(theme.id).app.accent} 80% 100%)`,
                  }}
                />
                <span className="theme-option__label">{theme.label}</span>
                <span className="theme-option__hint">{theme.hint}</span>
                {settings.theme === theme.id ? (
                  <span className="theme-option__check"><Icon name="check" size={12} /></span>
                ) : null}
              </button>
            ))}
          </div>

          {settings.theme === "custom" ? (
            <div className="custom-theme-panel">
              <div className="custom-presets">
                {customPresets.map((preset) => (
                  <button
                    key={preset.label}
                    className="custom-preset"
                    title={preset.label}
                    onClick={() =>
                      onChange({
                        theme: "custom",
                        customBackground: preset.background,
                        customText: preset.text,
                        customAccent: preset.accent,
                      })
                    }
                  >
                    <span
                      className="custom-preset__swatch"
                      style={{
                        background: preset.background,
                        borderColor: preset.accent,
                        color: preset.text,
                      }}
                    >
                      阅
                    </span>
                    <small>{preset.label}</small>
                  </button>
                ))}
              </div>
              <div className="custom-colors">
                {[
                  ["背景", "customBackground"],
                  ["文字", "customText"],
                  ["强调", "customAccent"],
                ].map(([label, key]) => (
                  <label className="custom-color" key={key}>
                    <span>{label}</span>
                    <input
                      type="color"
                      value={settings[key as "customBackground" | "customText" | "customAccent"]}
                      onChange={(event) => onChange({ [key]: event.target.value })}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>背景图片</span>
            <small>阅读区域</small>
          </div>
          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden-file-input"
            onChange={(event) => void importBackground(event.target.files?.[0])}
          />
          {settings.backgroundImageId ? (
            <div className="custom-font-row">
              <span className="custom-font-row__name">
                <Icon name="image" size={13} />
                {settings.backgroundImageName || "自定义背景"}
              </span>
              <button className="text-button" onClick={onRemoveBackground}>
                移除
              </button>
            </div>
          ) : null}
          <button
            className="button button--ghost settings-font-button"
            onClick={() => backgroundInputRef.current?.click()}
            disabled={backgroundBusy}
          >
            <Icon name="image" size={14} />
            {backgroundBusy ? "正在导入…" : "导入背景图片"}
          </button>
          <p className="settings-field-hint">支持 JPG / PNG / WebP / GIF，建议不超过 20MB。</p>
          {settings.backgroundImageId ? (
            <div className="settings-inline-range">
              <span>图片浓度</span>
              <input
                type="range"
                min={0}
                max={75}
                step={1}
                value={Math.round(settings.backgroundDim * 100)}
                onChange={(event) =>
                  onChange({ backgroundDim: Number(event.target.value) / 100 })
                }
              />
              <small>{Math.round(settings.backgroundDim * 100)}%</small>
            </div>
          ) : null}
          {backgroundError ? <p className="settings-error">{backgroundError}</p> : null}
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
                className={`segmented__item segmented__item--${font.id} ${!settings.customFontId && settings.fontFamily === font.id ? "segmented__item--active" : ""}`}
                onClick={() =>
                  onChange({
                    fontFamily: font.id,
                    customFontId: undefined,
                    customFontName: undefined,
                  })
                }
              >
                {font.sample}
                <small>{font.label}</small>
              </button>
            ))}
          </div>

          <input
            ref={fontInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
            className="hidden-file-input"
            onChange={(event) => void importFont(event.target.files?.[0])}
          />
          {settings.customFontId ? (
            <div className="custom-font-row">
              <span className="custom-font-row__name" title={settings.customFontName}>
                <Icon name="pen" size={13} />
                {settings.customFontName || "自定义字体"}
              </span>
              <button
                className="text-button"
                onClick={onRemoveFont}
                aria-label="移除自定义字体"
              >
                移除
              </button>
            </div>
          ) : null}
          <button
            className="button button--ghost settings-font-button"
            onClick={() => fontInputRef.current?.click()}
            disabled={fontBusy}
          >
            <Icon name="upload" size={14} />
            {fontBusy ? "正在导入…" : "导入本地字体"}
          </button>
          <p className="settings-field-hint">支持 TTF / OTF / WOFF / WOFF2，建议不超过 30MB。</p>
          {fontError ? <p className="settings-error">{fontError}</p> : null}
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>页边距</span>
            <small>{settings.margin} px</small>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={settings.margin}
            onChange={(event) => onChange({ margin: Number(event.target.value) })}
          />
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>段间距</span>
            <small>{settings.paragraphSpacing.toFixed(1)} em</small>
          </div>
          <input
            type="range"
            min={0.2}
            max={2.4}
            step={0.1}
            value={settings.paragraphSpacing}
            onChange={(event) =>
              onChange({ paragraphSpacing: Number(event.target.value) })
            }
          />
        </section>

        <section className="settings-section">
          <div className="settings-section__title">
            <span>版式</span>
            <small>栏数与方向</small>
          </div>
          <div className="layout-options">
            <div className="layout-option">
              <span>分栏</span>
              <div className="segmented segmented--compact">
                <button
                  className={`segmented__item ${settings.columns === 1 ? "segmented__item--active" : ""}`}
                  onClick={() => onChange({ columns: 1 })}
                >
                  单栏
                </button>
                <button
                  className={`segmented__item ${settings.columns === 2 ? "segmented__item--active" : ""}`}
                  onClick={() => onChange({ columns: 2, vertical: false })}
                >
                  双栏
                </button>
              </div>
            </div>
            <div className="layout-option">
              <span>方向</span>
              <div className="segmented segmented--compact">
                <button
                  className={`segmented__item ${!settings.vertical ? "segmented__item--active" : ""}`}
                  onClick={() =>
                    onChange({ vertical: false, readingMode: "paginated" })
                  }
                >
                  横排
                </button>
                <button
                  className={`segmented__item ${settings.vertical ? "segmented__item--active" : ""}`}
                  onClick={() =>
                    onChange({
                      vertical: true,
                      columns: 1,
                      readingMode: "paginated",
                    })
                  }
                >
                  竖排
                </button>
              </div>
            </div>
          </div>
          <p className="settings-field-hint">
            竖排仅支持单栏左右翻页；双栏和上下滚动会自动切回横排。
          </p>
        </section>

        <p className="settings-note">
          设置会自动保存。左右翻页时可用鼠标滚轮或方向键；上下滚动模式直接滚动阅读。
          排版设置只影响阅读区域，不改写书文件。
        </p>
      </div>
    </div>
  );
}

import type { CSSProperties } from "react";
import type { ReaderSettings, ThemeName } from "../types";

export interface ThemePreset {
  id: ThemeName;
  label: string;
  hint: string;
  dark: boolean;
  app: {
    bg: string;
    surface: string;
    surface2: string;
    ink: string;
    muted: string;
    line: string;
    accent: string;
    accentInk: string;
    readerBg: string;
    shadow: string;
    flipHighlight: string;
    flipShadow: string;
  };
  reader: {
    background: string;
    text: string;
    muted: string;
    accent: string;
    selection: string;
  };
  gradient: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "paper",
    label: "纸白",
    hint: "温润的米白",
    dark: false,
    app: {
      bg: "#f2ece1",
      surface: "#faf6ed",
      surface2: "#efe6d7",
      ink: "#2f2a23",
      muted: "#8d806f",
      line: "rgba(47, 42, 35, 0.12)",
      accent: "#a5522d",
      accentInk: "#fff8ee",
      readerBg: "#f7f1e7",
      shadow: "rgba(54, 43, 28, 0.13)",
      flipHighlight: "rgba(255, 255, 255, 0.42)",
      flipShadow: "rgba(69, 48, 28, 0.12)",
    },
    reader: {
      background: "#f7f1e7",
      text: "#312b24",
      muted: "#9a8b78",
      accent: "#a4542f",
      selection: "rgba(164, 84, 47, .18)",
    },
    gradient:
      "radial-gradient(circle at 8% 0%, rgba(255,255,255,.5), transparent 34%), radial-gradient(circle at 92% 100%, rgba(165,82,45,.06), transparent 32%)",
  },
  {
    id: "sepia",
    label: "茶褐",
    hint: "像旧书页",
    dark: false,
    app: {
      bg: "#e5d6bb",
      surface: "#f0e3cb",
      surface2: "#e2d1b2",
      ink: "#3b3021",
      muted: "#8f7c61",
      line: "rgba(59, 48, 33, 0.15)",
      accent: "#955126",
      accentInk: "#fff8ee",
      readerBg: "#eee0c5",
      shadow: "rgba(74, 55, 30, 0.16)",
      flipHighlight: "rgba(255, 248, 230, 0.4)",
      flipShadow: "rgba(88, 61, 30, 0.16)",
    },
    reader: {
      background: "#eee0c5",
      text: "#3c3021",
      muted: "#988467",
      accent: "#965428",
      selection: "rgba(150, 84, 40, .2)",
    },
    gradient:
      "radial-gradient(circle at 10% 0%, rgba(255,248,230,.5), transparent 35%), radial-gradient(circle at 92% 100%, rgba(120,73,32,.08), transparent 35%)",
  },
  {
    id: "night",
    label: "夜墨",
    hint: "低光环境",
    dark: true,
    app: {
      bg: "#121110",
      surface: "#1b1917",
      surface2: "#24211d",
      ink: "#e5dccd",
      muted: "#998d7d",
      line: "rgba(229, 220, 205, 0.11)",
      accent: "#d38a58",
      accentInk: "#1b120c",
      readerBg: "#191715",
      shadow: "rgba(0, 0, 0, 0.45)",
      flipHighlight: "rgba(255, 255, 255, 0.1)",
      flipShadow: "rgba(0, 0, 0, 0.38)",
    },
    reader: {
      background: "#191715",
      text: "#d9d0c1",
      muted: "#8f8476",
      accent: "#d18b5c",
      selection: "rgba(209, 139, 92, .2)",
    },
    gradient:
      "radial-gradient(circle at 8% 0%, rgba(255,255,255,.035), transparent 34%), radial-gradient(circle at 92% 100%, rgba(211,138,88,.07), transparent 32%)",
  },
  {
    id: "jade",
    label: "青瓷",
    hint: "清润的绿",
    dark: false,
    app: {
      bg: "#e4ede6",
      surface: "#f4faf5",
      surface2: "#d8e7db",
      ink: "#2b4033",
      muted: "#6f8575",
      line: "rgba(43, 64, 51, 0.13)",
      accent: "#557d64",
      accentInk: "#f7fff8",
      readerBg: "#edf5ef",
      shadow: "rgba(43, 64, 51, 0.14)",
      flipHighlight: "rgba(255, 255, 255, 0.4)",
      flipShadow: "rgba(43, 64, 51, 0.13)",
    },
    reader: {
      background: "#edf5ef",
      text: "#2b4033",
      muted: "#7c927f",
      accent: "#557d64",
      selection: "rgba(85, 125, 100, .2)",
    },
    gradient:
      "radial-gradient(circle at 10% 0%, rgba(255,255,255,.5), transparent 36%), radial-gradient(circle at 92% 100%, rgba(85,125,100,.1), transparent 34%)",
  },
  {
    id: "rose",
    label: "樱粉",
    hint: "柔和的粉",
    dark: false,
    app: {
      bg: "#f4e8e8",
      surface: "#fdf7f6",
      surface2: "#efdede",
      ink: "#493234",
      muted: "#987b7d",
      line: "rgba(73, 50, 52, 0.12)",
      accent: "#b16f7b",
      accentInk: "#fffafa",
      readerBg: "#fbf1f1",
      shadow: "rgba(73, 50, 52, 0.13)",
      flipHighlight: "rgba(255, 255, 255, 0.45)",
      flipShadow: "rgba(73, 50, 52, 0.12)",
    },
    reader: {
      background: "#fbf1f1",
      text: "#493234",
      muted: "#9b7d7f",
      accent: "#b16f7b",
      selection: "rgba(177, 111, 123, .2)",
    },
    gradient:
      "radial-gradient(circle at 8% 0%, rgba(255,255,255,.6), transparent 36%), radial-gradient(circle at 92% 100%, rgba(177,111,123,.09), transparent 34%)",
  },
  {
    id: "ocean",
    label: "海盐",
    hint: "清透的蓝",
    dark: false,
    app: {
      bg: "#e5eef3",
      surface: "#f5fafc",
      surface2: "#d9e7ee",
      ink: "#293f4a",
      muted: "#6f8793",
      line: "rgba(41, 63, 74, 0.12)",
      accent: "#4f7d93",
      accentInk: "#f8fdff",
      readerBg: "#edf5f8",
      shadow: "rgba(41, 63, 74, 0.13)",
      flipHighlight: "rgba(255, 255, 255, 0.5)",
      flipShadow: "rgba(41, 63, 74, 0.11)",
    },
    reader: {
      background: "#edf5f8",
      text: "#293f4a",
      muted: "#78929e",
      accent: "#4f7d93",
      selection: "rgba(79, 125, 147, .2)",
    },
    gradient:
      "radial-gradient(circle at 8% 0%, rgba(255,255,255,.55), transparent 36%), radial-gradient(circle at 92% 100%, rgba(79,125,147,.1), transparent 34%)",
  },
  {
    id: "dusk",
    label: "暮紫",
    hint: "安静的紫",
    dark: false,
    app: {
      bg: "#eae4ef",
      surface: "#f8f4fa",
      surface2: "#e0d7e9",
      ink: "#3a3047",
      muted: "#887a97",
      line: "rgba(58, 48, 71, 0.12)",
      accent: "#80669a",
      accentInk: "#fcf8ff",
      readerBg: "#f1ebf6",
      shadow: "rgba(58, 48, 71, 0.14)",
      flipHighlight: "rgba(255, 255, 255, 0.42)",
      flipShadow: "rgba(58, 48, 71, 0.12)",
    },
    reader: {
      background: "#f1ebf6",
      text: "#3a3047",
      muted: "#8d7e9c",
      accent: "#80669a",
      selection: "rgba(128, 102, 154, .2)",
    },
    gradient:
      "radial-gradient(circle at 8% 0%, rgba(255,255,255,.5), transparent 36%), radial-gradient(circle at 92% 100%, rgba(128,102,154,.1), transparent 34%)",
  },
  {
    id: "forest",
    label: "松烟",
    hint: "深绿夜色",
    dark: true,
    app: {
      bg: "#141e19",
      surface: "#1d2a22",
      surface2: "#27382d",
      ink: "#dce7dc",
      muted: "#91a394",
      line: "rgba(220, 231, 220, 0.11)",
      accent: "#9fba91",
      accentInk: "#142018",
      readerBg: "#19261e",
      shadow: "rgba(0, 0, 0, 0.42)",
      flipHighlight: "rgba(255, 255, 255, 0.1)",
      flipShadow: "rgba(0, 0, 0, 0.35)",
    },
    reader: {
      background: "#19261e",
      text: "#dce7dc",
      muted: "#91a394",
      accent: "#9fba91",
      selection: "rgba(159, 186, 145, .22)",
    },
    gradient:
      "radial-gradient(circle at 8% 0%, rgba(255,255,255,.04), transparent 34%), radial-gradient(circle at 92% 100%, rgba(159,186,145,.07), transparent 34%)",
  },
  {
    id: "midnight",
    label: "深海",
    hint: "深蓝夜色",
    dark: true,
    app: {
      bg: "#121923",
      surface: "#1b2432",
      surface2: "#263445",
      ink: "#dce6f1",
      muted: "#8a9bae",
      line: "rgba(220, 230, 241, 0.11)",
      accent: "#88aeca",
      accentInk: "#121a24",
      readerBg: "#182333",
      shadow: "rgba(0, 0, 0, 0.44)",
      flipHighlight: "rgba(255, 255, 255, 0.1)",
      flipShadow: "rgba(0, 0, 0, 0.4)",
    },
    reader: {
      background: "#182333",
      text: "#dce6f1",
      muted: "#8a9bae",
      accent: "#88aeca",
      selection: "rgba(136, 174, 202, .22)",
    },
    gradient:
      "radial-gradient(circle at 8% 0%, rgba(255,255,255,.04), transparent 34%), radial-gradient(circle at 92% 100%, rgba(136,174,202,.09), transparent 34%)",
  },
];

export function themePreset(id: ThemeName): ThemePreset {
  return THEME_PRESETS.find((item) => item.id === id) ?? THEME_PRESETS[0];
}

export function themeLabel(id: ThemeName): string {
  return id === "custom" ? "自定义" : themePreset(id).label;
}

export function isDarkTheme(id: ThemeName): boolean {
  return id === "custom" ? false : themePreset(id).dark;
}

export function readerPalette(settings: ReaderSettings) {
  if (settings.theme !== "custom") return themePreset(settings.theme).reader;
  return {
    background: settings.customBackground,
    text: settings.customText,
    muted: hexToRgba(settings.customText, 0.58),
    accent: settings.customAccent,
    selection: hexToRgba(settings.customAccent, 0.2),
  };
}

export function appThemeStyle(
  settings: ReaderSettings,
  backgroundUrl?: string | null,
): CSSProperties {
  const preset = themePreset(settings.theme);
  const custom = settings.theme === "custom";
  const dark = custom ? luminance(settings.customBackground) < 0.45 : preset.dark;
  const bg = custom ? settings.customBackground : preset.app.bg;
  const ink = custom ? settings.customText : preset.app.ink;
  const accent = custom ? settings.customAccent : preset.app.accent;
  const surface = custom
    ? mixHex(bg, "#ffffff", dark ? 0.08 : 0.52)
    : preset.app.surface;
  const surface2 = custom
    ? mixHex(bg, dark ? "#ffffff" : "#000000", dark ? 0.13 : 0.06)
    : preset.app.surface2;
  const readerBg = custom ? bg : preset.app.readerBg;
  const line = custom ? hexToRgba(ink, 0.12) : preset.app.line;
  const shadow = custom
    ? `rgba(0, 0, 0, ${dark ? 0.42 : 0.13})`
    : preset.app.shadow;
  const accentInk = custom
    ? luminance(accent) > 0.55
      ? "#1f1b16"
      : "#fffaf5"
    : preset.app.accentInk;
  const gradient = custom
    ? `radial-gradient(circle at 8% 0%, rgba(255,255,255,${dark ? 0.045 : 0.5}), transparent 36%), radial-gradient(circle at 92% 100%, ${hexToRgba(accent, dark ? 0.12 : 0.1)}, transparent 35%)`
    : preset.gradient;
  const style: Record<string, string> = {
    "--bg": bg,
    "--surface": surface,
    "--surface-2": surface2,
    "--ink": ink,
    "--muted": custom ? hexToRgba(ink, 0.62) : preset.app.muted,
    "--line": line,
    "--accent": accent,
    "--accent-ink": accentInk,
    "--reader-bg": readerBg,
    "--shadow": shadow,
    "--flip-highlight": dark ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.42)",
    "--flip-shadow": dark ? "rgba(0,0,0,.38)" : "rgba(69,48,28,.12)",
    "backgroundImage": backgroundUrl
      ? `linear-gradient(${hexToRgba(bg, Math.max(0.55, 1 - settings.backgroundDim))}, ${hexToRgba(bg, Math.max(0.55, 1 - settings.backgroundDim))}), url("${backgroundUrl}")`
      : gradient,
    "backgroundSize": "cover",
    "backgroundPosition": "center",
    "colorScheme": dark ? "dark" : "light",
  };
  return style as CSSProperties;
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const normalized =
    value.length === 3
      ? value.split("").map((part) => part + part).join("")
      : value;
  const number = Number.parseInt(normalized, 16);
  if (!Number.isFinite(number)) return `rgba(49, 43, 36, ${alpha})`;
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function mixHex(a: string, b: string, amount: number): string {
  const first = parseHex(a);
  const second = parseHex(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * amount);
  return `#${[mix(first[0], second[0]), mix(first[1], second[1]), mix(first[2], second[2])]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const normalized =
    value.length === 3
      ? value.split("").map((part) => part + part).join("")
      : value;
  const number = Number.parseInt(normalized, 16);
  if (!Number.isFinite(number)) return [49, 43, 36];
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function luminance(hex: string): number {
  const [red, green, blue] = parseHex(hex).map((value) => value / 255);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

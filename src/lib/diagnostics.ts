import { invoke } from "@tauri-apps/api/core";

export type DiagnosticLevel = "info" | "warn" | "error";

export interface DiagnosticEntry {
  time: number;
  level: DiagnosticLevel;
  message: string;
  detail?: string;
}

const BUFFER_KEY = "moyue.diagnostics.buffer.v1";
const MAX_BUFFER = 40;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function loadBuffer(): DiagnosticEntry[] {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiagnosticEntry[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_BUFFER) : [];
  } catch {
    return [];
  }
}

let buffer = loadBuffer();

function persistBuffer(): void {
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer.slice(-MAX_BUFFER)));
  } catch {
    // Diagnostics are optional; never let logging break the app.
  }
}

export function redactSensitive(text: string): string {
  return text
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "<USER>")
    .replace(/\/Users\/[^/\s]+/g, "<USER>")
    .replace(/\/home\/[^/\s]+/g, "<USER>")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<IP>");
}

export function recordDiagnostic(
  level: DiagnosticLevel,
  message: string,
  detail?: string,
): void {
  const entry: DiagnosticEntry = {
    time: Date.now(),
    level,
    message: redactSensitive(message).slice(0, 2000),
    detail: detail ? redactSensitive(detail).slice(0, 12000) : undefined,
  };
  buffer = [...buffer, entry].slice(-MAX_BUFFER);
  persistBuffer();
  if (isTauri()) {
    void invoke("append_diagnostic", {
      level: entry.level,
      message: entry.message,
      detail: entry.detail ?? "",
    }).catch(() => undefined);
  }
}

export function getRecentDiagnostics(): DiagnosticEntry[] {
  return [...buffer].reverse();
}

function formatEntry(entry: DiagnosticEntry): string {
  const time = new Date(entry.time).toLocaleString("zh-CN");
  const head = `[${time}] [${entry.level.toUpperCase()}] ${entry.message}`;
  return entry.detail ? `${head}\n${entry.detail}` : head;
}

export async function buildDiagnosticReport(): Promise<string> {
  let version = "unknown";
  try {
    version = (await invoke<{ version: string }>("app_info")).version;
  } catch {
    // Use a placeholder when running outside the desktop shell.
  }
  const lines = [
    "墨阅诊断报告",
    `生成时间: ${new Date().toLocaleString("zh-CN")}`,
    `应用版本: ${version}`,
    `系统: ${navigator.userAgent}`,
    `语言: ${navigator.language}`,
    "",
    "最近错误：",
    ...(buffer.length > 0
      ? [...buffer].reverse().map((entry) => formatEntry(entry))
      : ["（没有记录到错误）"]),
    "",
    "说明：报告不包含书籍正文、笔记、搜索内容和完整用户目录。",
  ];
  return redactSensitive(lines.join("\n"));
}

export async function copyDiagnosticReport(): Promise<string> {
  const report = await buildDiagnosticReport();
  await navigator.clipboard.writeText(report);
  return report;
}

export async function exportDiagnosticReport(): Promise<string> {
  const report = await buildDiagnosticReport();
  if (!isTauri()) throw new Error("导出诊断只在桌面版可用");
  return invoke<string>("write_diagnostic_report", { content: report });
}

export const FEEDBACK_EMAIL = "xuxinyang121@gmail.com";

export async function openFeedback(kind: "bug" | "feature" | "email"): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_feedback", { kind });
}

export async function openDiagnosticFolder(): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_diagnostics_folder");
}

export function installGlobalDiagnostics(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    recordDiagnostic(
      "error",
      event.message || "未捕获的脚本错误",
      event.error instanceof Error ? event.error.stack : undefined,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    recordDiagnostic(
      "error",
      "未处理的 Promise 异常",
      reason instanceof Error ? reason.stack ?? reason.message : String(reason),
    );
  });
  recordDiagnostic("info", "应用启动");
}

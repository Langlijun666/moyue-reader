import React from "react";
import { exit } from "@tauri-apps/plugin-process";
import {
  copyDiagnosticReport,
  exportDiagnosticReport,
  openFeedback,
  recordDiagnostic,
} from "../lib/diagnostics";
import { Icon } from "./Icons";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  status: string;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, status: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    recordDiagnostic(
      "error",
      error.message || "React 渲染错误",
      `${error.stack ?? ""}\n${info.componentStack ?? ""}`,
    );
  }

  private exportReport = async () => {
    try {
      const path = await exportDiagnosticReport();
      this.setState({ status: `诊断报告已保存：${path}` });
    } catch (error) {
      this.setState({
        status: error instanceof Error ? error.message : "导出诊断失败",
      });
    }
  };

  private copyReport = async () => {
    try {
      await copyDiagnosticReport();
      this.setState({ status: "诊断信息已复制，可以粘贴到反馈里" });
    } catch {
      this.setState({ status: "复制失败，请尝试导出诊断文件" });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash-screen">
        <div className="crash-card">
          <span className="crash-card__icon"><Icon name="spark" size={28} /></span>
          <span className="eyebrow">SOMETHING WENT WRONG</span>
          <h1>墨阅遇到了一点问题</h1>
          <p>
            阅读数据仍然保存在本机。可以先重新加载；如果反复出现，请把诊断信息发给开发者。
          </p>
          <pre className="crash-card__error">
            {this.state.error.message || "未知渲染错误"}
          </pre>
          {this.state.status ? <p className="crash-card__status">{this.state.status}</p> : null}
          <div className="crash-card__actions">
            <button className="button button--ghost" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={14} />
              重新加载
            </button>
            <button className="button button--ghost" onClick={() => void this.exportReport()}>
              <Icon name="download" size={14} />
              导出诊断
            </button>
            <button className="button button--ghost" onClick={() => void this.copyReport()}>
              <Icon name="copy" size={14} />
              复制诊断
            </button>
            <button className="button button--ghost" onClick={() => void openFeedback("bug")}>
              <Icon name="spark" size={14} />
              反馈问题
            </button>
            <button
              className="button button--ghost"
              onClick={() => {
                void exit(0).catch(() => window.close());
              }}
            >
              退出应用
            </button>
          </div>
          <small>报告不包含书籍正文、笔记和搜索内容。</small>
        </div>
      </div>
    );
  }
}

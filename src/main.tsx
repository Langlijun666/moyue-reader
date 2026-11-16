import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { installGlobalDiagnostics } from "./lib/diagnostics";
import { IS_ANDROID } from "./lib/platform";
import "./styles.css";

if (IS_ANDROID) {
  document.documentElement.dataset.platform = "android";
}

installGlobalDiagnostics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

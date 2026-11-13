import { useCallback, useEffect, useRef, useState } from "react";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "error";

const SKIP_KEY = "moyue.update.skipped.v1";
const AUTO_CHECK_KEY = "moyue.update.autoCheck.v1";
const AUTO_DOWNLOAD_KEY = "moyue.update.autoDownload.v1";

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}

function writeBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Preference persistence is optional.
  }
}

export function useUpdater() {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [version, setVersion] = useState("");
  const [body, setBody] = useState("");
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoCheck, setAutoCheckState] = useState(() =>
    readBoolean(AUTO_CHECK_KEY, true),
  );
  const [autoDownload, setAutoDownloadState] = useState(() =>
    readBoolean(AUTO_DOWNLOAD_KEY, true),
  );
  const updateRef = useRef<Update | null>(null);
  const busyRef = useRef(false);

  const setAutoCheck = useCallback((value: boolean) => {
    setAutoCheckState(value);
    writeBoolean(AUTO_CHECK_KEY, value);
  }, []);

  const setAutoDownload = useCallback((value: boolean) => {
    setAutoDownloadState(value);
    writeBoolean(AUTO_DOWNLOAD_KEY, value);
  }, []);

  const download = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    setPhase("downloading");
    setError(null);
    let received = 0;
    let expected = 0;
    try {
      await update.download((event: DownloadEvent) => {
        if (event.event === "Started") {
          expected = event.data.contentLength ?? 0;
          setTotal(expected);
        } else if (event.event === "Progress") {
          received += event.data.chunkLength;
          setDownloaded(received);
          if (expected > 0) {
            setProgress(Math.min(99, Math.round((received / expected) * 100)));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });
      setPhase("ready");
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : "更新下载失败",
      );
      setPhase("error");
    }
  }, []);

  const checkForUpdates = useCallback(
    async (manual = false) => {
      if (!isTauri || busyRef.current) return;
      busyRef.current = true;
      setError(null);
      setPhase("checking");
      try {
        const update = await check();
        if (!update) {
          setPhase("idle");
          if (manual) setError("已经是最新版本");
          return;
        }
        let skipped = "";
        try {
          skipped = localStorage.getItem(SKIP_KEY) ?? "";
        } catch {
          // Ignore storage errors.
        }
        if (!manual && skipped === update.version) {
          await update.close();
          setPhase("idle");
          return;
        }
        updateRef.current = update;
        setVersion(update.version);
        setBody(update.body ?? "");
        setProgress(0);
        setDownloaded(0);
        setTotal(0);
        setPhase("available");
        if (autoDownload) {
          void download();
        }
      } catch (checkError) {
        setPhase(manual ? "error" : "idle");
        if (manual) {
          setError(
            checkError instanceof Error ? checkError.message : "检查更新失败",
          );
        }
      } finally {
        busyRef.current = false;
      }
    },
    [autoDownload, download, isTauri],
  );

  const install = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    setPhase("installing");
    setError(null);
    try {
      await update.install({ restartAfterInstall: true });
    } catch (installError) {
      setError(
        installError instanceof Error ? installError.message : "安装更新失败",
      );
      setPhase("error");
    }
  }, []);

  const skip = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    try {
      localStorage.setItem(SKIP_KEY, update.version);
    } catch {
      // Skipping is best-effort.
    }
    await update.close().catch(() => undefined);
    updateRef.current = null;
    setPhase("idle");
    setError(null);
  }, []);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      void updateRef.current?.close().catch(() => undefined);
    };
  }, []);

  return {
    isTauri,
    phase,
    version,
    body,
    progress,
    downloaded,
    total,
    error,
    autoCheck,
    autoDownload,
    setAutoCheck,
    setAutoDownload,
    checkForUpdates,
    download,
    install,
    skip,
    dismiss,
  };
}

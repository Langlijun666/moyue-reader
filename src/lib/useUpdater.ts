import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "error";

export type UpdateSource = "auto" | "mirror" | "github";

const SKIP_KEY = "moyue.update.skipped.v1";
const AUTO_CHECK_KEY = "moyue.update.autoCheck.v1";
const AUTO_DOWNLOAD_KEY = "moyue.update.autoDownload.v1";
const SOURCE_KEY = "moyue.update.source.v1";

interface UpdateInfo {
  version: string;
  currentVersion: string;
  body: string;
}

interface UpdateProgress {
  downloaded: number;
  total: number;
}

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

function readSource(): UpdateSource {
  try {
    const value = localStorage.getItem(SOURCE_KEY);
    return value === "mirror" || value === "github" ? value : "auto";
  } catch {
    return "auto";
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
  const [updateSource, setUpdateSourceState] = useState<UpdateSource>(readSource);
  const busyRef = useRef(false);

  const setAutoCheck = useCallback((value: boolean) => {
    setAutoCheckState(value);
    writeBoolean(AUTO_CHECK_KEY, value);
  }, []);

  const setAutoDownload = useCallback((value: boolean) => {
    setAutoDownloadState(value);
    writeBoolean(AUTO_DOWNLOAD_KEY, value);
  }, []);

  const setUpdateSource = useCallback((value: UpdateSource) => {
    setUpdateSourceState(value);
    try {
      localStorage.setItem(SOURCE_KEY, value);
    } catch {
      // Preference persistence is optional.
    }
  }, []);

  const download = useCallback(async () => {
    if (!isTauri) return;
    setPhase("downloading");
    setError(null);
    let received = 0;
    let expected = 0;
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listen<UpdateProgress>("moyue-update-progress", (event) => {
        received = event.payload.downloaded;
        expected = event.payload.total;
        setDownloaded(received);
        if (expected > 0) {
          setTotal(expected);
          setProgress(Math.min(99, Math.round((received / expected) * 100)));
        }
      });
      await invoke("download_app_update");
      setProgress(100);
      setPhase("ready");
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : String(downloadError),
      );
      setPhase("error");
    } finally {
      unlisten?.();
    }
  }, [isTauri]);

  const checkForUpdates = useCallback(
    async (manual = false) => {
      if (!isTauri || busyRef.current) return;
      busyRef.current = true;
      setError(null);
      setPhase("checking");
      try {
        const info = await invoke<UpdateInfo | null>("check_app_update", {
          source: updateSource,
        });
        if (!info) {
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
        if (!manual && skipped === info.version) {
          setPhase("idle");
          return;
        }
        setVersion(info.version);
        setBody(info.body);
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
            checkError instanceof Error ? checkError.message : String(checkError),
          );
        }
      } finally {
        busyRef.current = false;
      }
    },
    [autoDownload, download, isTauri, updateSource],
  );

  const install = useCallback(async () => {
    if (!isTauri) return;
    setPhase("installing");
    setError(null);
    try {
      await invoke("install_app_update");
    } catch (installError) {
      setError(
        installError instanceof Error ? installError.message : String(installError),
      );
      setPhase("error");
    }
  }, [isTauri]);

  const skip = useCallback(async () => {
    try {
      localStorage.setItem(SKIP_KEY, version);
    } catch {
      // Skipping is best-effort.
    }
    setPhase("idle");
    setError(null);
  }, [version]);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setError(null);
  }, []);

  useEffect(() => {
    return () => undefined;
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
    updateSource,
    setAutoCheck,
    setAutoDownload,
    setUpdateSource,
    checkForUpdates,
    download,
    install,
    skip,
    dismiss,
  };
}

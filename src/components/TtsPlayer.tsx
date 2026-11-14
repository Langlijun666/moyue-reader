import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { formatBytes } from "../lib/format";
import { Icon } from "./Icons";

export interface TtsChapter {
  text: string;
  startOffset: number;
  sectionIndex: number;
  href: string;
}

interface TtsPlayerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  chapterLabel: string;
  loadCurrentChapter: () => Promise<TtsChapter | null>;
  loadNextChapter: () => Promise<TtsChapter | null>;
  onSentence: (chapter: TtsChapter, start: number, length: number) => void;
  onStop: () => void;
}

interface TtsChunk {
  text: string;
  start: number;
  end: number;
}

type TtsStatus = "idle" | "loading" | "playing" | "paused" | "ended";
type TtsStyle = "calm" | "story" | "suspense" | "brisk";
type TtsEngine = "system" | "neural";

interface NeuralStatus {
  installed: boolean;
  directory: string;
  bytes: number;
  message: string;
}

interface NeuralProgress {
  stage: string;
  downloaded: number;
  total: number;
  percent: number;
  message: string;
}

const VOICE_KEY = "moyue.tts.voice.v1";
const RATE_KEY = "moyue.tts.rate.v1";
const STYLE_KEY = "moyue.tts.style.v1";
const ENGINE_KEY = "moyue.tts.engine.v1";
const CHUNK_LIMIT = 180;

const styles: {
  id: TtsStyle;
  label: string;
  rate: number;
  pitch: number;
  pause: number;
}[] = [
  { id: "calm", label: "平静", rate: 0.9, pitch: 0.95, pause: 420 },
  { id: "story", label: "叙事", rate: 0.98, pitch: 0.97, pause: 260 },
  { id: "suspense", label: "悬疑", rate: 0.84, pitch: 0.9, pause: 560 },
  { id: "brisk", label: "轻快", rate: 1.12, pitch: 1.05, pause: 140 },
];

export function TtsPlayer({
  open,
  onOpen,
  onClose,
  chapterLabel,
  loadCurrentChapter,
  loadNextChapter,
  onSentence,
  onStop,
}: TtsPlayerProps) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const synth = supported ? window.speechSynthesis : null;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState(() => {
    try {
      return localStorage.getItem(VOICE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [rate, setRate] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(RATE_KEY));
      return Number.isFinite(saved) && saved >= 0.5 && saved <= 2 ? saved : 1;
    } catch {
      return 1;
    }
  });
  const [style, setStyle] = useState<TtsStyle>(() => {
    try {
      const saved = localStorage.getItem(STYLE_KEY) as TtsStyle | null;
      return styles.some((item) => item.id === saved) ? (saved as TtsStyle) : "story";
    } catch {
      return "story";
    }
  });
  const [engine, setEngine] = useState<TtsEngine>(() => {
    try {
      return localStorage.getItem(ENGINE_KEY) === "neural" ? "neural" : "system";
    } catch {
      return "system";
    }
  });
  const [neuralStatus, setNeuralStatus] = useState<NeuralStatus | null>(null);
  const [neuralBusy, setNeuralBusy] = useState(false);
  const [neuralProgress, setNeuralProgress] = useState<NeuralProgress | null>(null);
  const [neuralError, setNeuralError] = useState<string | null>(null);
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [chunkIndex, setChunkIndex] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sleepAt, setSleepAt] = useState(0);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);

  const runIdRef = useRef(0);
  const chunksRef = useRef<TtsChunk[]>([]);
  const chapterRef = useRef<TtsChapter | null>(null);
  const rateRef = useRef(rate);
  const styleRef = useRef<TtsStyle>(style);
  const engineRef = useRef<TtsEngine>(engine);
  const pauseTimerRef = useRef<number | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const neuralStatusRef = useRef<NeuralStatus | null>(null);
  const neuralAudioRef = useRef<HTMLAudioElement>(null);
  const neuralCacheRef = useRef<Map<number, string>>(new Map());  const neuralPromisesRef = useRef<Map<number, Promise<string>>>(new Map());
  const neuralIndexRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const neuralRunRef = useRef(0);
  const loadCurrentRef = useRef(loadCurrentChapter);
  const loadNextRef = useRef(loadNextChapter);
  const onSentenceRef = useRef(onSentence);
  const onStopRef = useRef(onStop);
  const statusRef = useRef(status);
  const stopRef = useRef<() => void>(() => {});
  const toggleRef = useRef<() => void>(() => {});
  const nextChunkRef = useRef<() => void>(() => {});
  const previousChunkRef = useRef<() => void>(() => {});
  const fadeVolumeRef = useRef(1);

  useEffect(() => {
    rateRef.current = rate;
    try {
      localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      // TTS still works without persistence.
    }
  }, [rate]);

  useEffect(() => {
    styleRef.current = style;
    try {
      localStorage.setItem(STYLE_KEY, style);
    } catch {
      // TTS still works without persistence.
    }
  }, [style]);

  useEffect(() => {
    engineRef.current = engine;
    try {
      localStorage.setItem(ENGINE_KEY, engine);
    } catch {
      // TTS still works without persistence.
    }
  }, [engine]);

  useEffect(() => {
    if (!open || !isTauri) return;
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void invoke<NeuralStatus>("neural_status")
      .then((status) => {
        if (cancelled) return;
        setNeuralStatus(status);
        neuralStatusRef.current = status;
      })
      .catch(() => undefined);
    void listen<NeuralProgress>("neural-progress", (event) => {
      if (cancelled) return;
      setNeuralProgress(event.payload);
      if (event.payload.stage === "done") {
        void invoke<NeuralStatus>("neural_status")
          .then((status) => {
            setNeuralStatus(status);
            neuralStatusRef.current = status;
          })
          .catch(() => undefined);
      }
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [open, isTauri]);

  useEffect(() => {
    loadCurrentRef.current = loadCurrentChapter;
    loadNextRef.current = loadNextChapter;
    onSentenceRef.current = onSentence;
    onStopRef.current = onStop;
  }, [loadCurrentChapter, loadNextChapter, onSentence, onStop]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const currentVoice =
    voices.find((voice) => voice.voiceURI === voiceURI) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) ||
    voices[0] ||
    null;

  useEffect(() => {
    voiceRef.current = currentVoice;
    if (currentVoice) {
      try {
        localStorage.setItem(VOICE_KEY, currentVoice.voiceURI);
      } catch {
        // Voice preference is optional.
      }
    }
  }, [currentVoice]);

  useEffect(() => {
    if (!synth) return;
    const refresh = () => {
      const next = [...synth.getVoices()].sort((a, b) => {
        const aZh = a.lang.toLowerCase().startsWith("zh") ? 0 : 1;
        const bZh = b.lang.toLowerCase().startsWith("zh") ? 0 : 1;
        return aZh - bZh || a.name.localeCompare(b.name);
      });
      setVoices(next);
    };
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, [synth]);

  useEffect(() => {
    if (!voices.length) return;
    if (!voices.some((voice) => voice.voiceURI === voiceURI)) {
      setVoiceURI(
        voices.find((voice) => voice.lang.toLowerCase().startsWith("zh"))?.voiceURI ??
          voices[0].voiceURI,
      );
    }
  }, [voices, voiceURI]);

  useEffect(() => {
    if (!sleepAt) {
      fadeVolumeRef.current = 1;
      if (neuralAudioRef.current) neuralAudioRef.current.volume = 1;
      setSleepLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, sleepAt - Date.now());
      setSleepLeft(left);
      if (left <= 0) {
        fadeVolumeRef.current = 1;
        setSleepAt(0);
        setSleepMinutes(0);
        stopRef.current();
        return;
      }
      if (engineRef.current === "neural" && statusRef.current === "playing") {
        const fade = Math.min(1, Math.max(0, left / 15_000));
        fadeVolumeRef.current = fade;
        if (neuralAudioRef.current) neuralAudioRef.current.volume = fade;
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [sleepAt]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      if (pauseTimerRef.current !== null) window.clearTimeout(pauseTimerRef.current);
      window.speechSynthesis?.cancel();
      onStopRef.current();
    };
  }, []);

  const stop = () => {
    runIdRef.current += 1;
    fadeVolumeRef.current = 1;
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (synth) synth.cancel();
    if (neuralAudioRef.current) {
      neuralAudioRef.current.volume = 1;
    }
    clearNeuralCache();
    chunksRef.current = [];
    chapterRef.current = null;
    setChunkCount(0);
    setChunkIndex(0);
    chunkIndexRef.current = 0;
    setStatus("idle");
    setSleepAt(0);
    setSleepMinutes(0);
    onStopRef.current();
  };
  stopRef.current = stop;

  const clearNeuralCache = () => {
    neuralCacheRef.current.clear();
    neuralPromisesRef.current.clear();
    neuralIndexRef.current = 0;
    neuralRunRef.current = 0;
    const audio = neuralAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  };

  const ensureNeuralChunk = (index: number): Promise<string> => {
    const cached = neuralCacheRef.current.get(index);
    if (cached) return Promise.resolve(cached);
    const pending = neuralPromisesRef.current.get(index);
    if (pending) return pending;
    const chunk = chunksRef.current[index];
    if (!chunk) return Promise.reject(new Error("朗读片段不存在"));
    const styleConfig = styles.find((item) => item.id === styleRef.current) ?? styles[1];
    const speed = Math.min(2, Math.max(0.5, rateRef.current * styleConfig.rate));
    const promise = invoke<string>("sherpa_speak", { text: chunk.text, speed })
      .then((path) => {
        neuralCacheRef.current.set(index, path);
        return path;
      })
      .finally(() => {
        neuralPromisesRef.current.delete(index);
      });
    neuralPromisesRef.current.set(index, promise);
    return promise;
  };

  const playNeuralChunk = async (index: number, runId: number) => {
    if (runId !== runIdRef.current) return;
    const chunks = chunksRef.current;
    if (index >= chunks.length) {
      void advanceChapter(runId);
      return;
    }
    const chapter = chapterRef.current;
    const chunk = chunks[index];
    const audio = neuralAudioRef.current;
    if (!chapter || !chunk || !audio) return;
    if (!neuralStatusRef.current?.installed) {
      setError("离线自然语音尚未下载");
      setStatus("idle");
      return;
    }

    neuralIndexRef.current = index;
    neuralRunRef.current = runId;
    setChunkIndex(index);
    chunkIndexRef.current = index;
    setError(null);
    onSentenceRef.current(chapter, chunk.start, chunk.text.length);
    try {
      setStatus("loading");
      const path = await ensureNeuralChunk(index);
      if (runId !== runIdRef.current) return;
      audio.src = convertFileSrc(path);
      audio.volume = fadeVolumeRef.current;
      setStatus("playing");
      await audio.play();
      if (runId === runIdRef.current) {
        void ensureNeuralChunk(index + 1).catch(() => undefined);
      }
    } catch (playError) {
      if (runId !== runIdRef.current) return;
      setError(
        typeof playError === "string"
          ? playError
          : playError instanceof Error
            ? playError.message
            : "离线语音播放失败",
      );
      setStatus("idle");
    }
  };

  const handleNeuralEnded = () => {
    const runId = neuralRunRef.current;
    if (runId !== runIdRef.current) return;
    void playNeuralChunk(neuralIndexRef.current + 1, runId);
  };

  const speakChunk = (index: number, runId: number) => {
    if (engineRef.current === "neural") {
      void playNeuralChunk(index, runId);
      return;
    }
    if (!synth || runId !== runIdRef.current) return;
    const chunks = chunksRef.current;
    if (index >= chunks.length) {
      void advanceChapter(runId);
      return;
    }

    const chunk = chunks[index];
    const chapter = chapterRef.current;
    if (!chapter) return;
    setChunkIndex(index);
    chunkIndexRef.current = index;
    onSentenceRef.current(chapter, chunk.start, chunk.text.length);
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    const voice = voiceRef.current;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "zh-CN";
    }
    const styleConfig = styles.find((item) => item.id === styleRef.current) ?? styles[1];
    const ending = chunk.text.trim().slice(-1);
    const question = ending === "？" || ending === "?";
    const exclaim = ending === "！" || ending === "!";
    const ellipsis = ending === "…";
    utterance.rate = Math.min(
      2,
      Math.max(0.5, rateRef.current * styleConfig.rate + (exclaim ? 0.04 : 0)),
    );
    utterance.pitch = Math.min(
      2,
      Math.max(0.5, styleConfig.pitch + (question ? 0.04 : exclaim ? 0.02 : 0)),
    );
    utterance.volume = 1;
    utterance.onend = () => {
      if (runId !== runIdRef.current) return;
      const nextIndex = index + 1;
      if (nextIndex >= chunks.length) {
        speakChunk(nextIndex, runId);
        return;
      }
      let delay = styleConfig.pause;
      if (ellipsis) delay += 180;
      if (question) delay += 80;
      if (exclaim) delay = Math.max(80, delay - 40);
      if (delay <= 0) {
        speakChunk(nextIndex, runId);
        return;
      }
      pauseTimerRef.current = window.setTimeout(() => {
        pauseTimerRef.current = null;
        if (runId === runIdRef.current) speakChunk(nextIndex, runId);
      }, delay);
    };
    utterance.onerror = (event) => {
      if (runId !== runIdRef.current) return;
      if (event.error === "interrupted" || event.error === "canceled") return;
      setError("朗读中断了，可以重新开始");
      setStatus("idle");
    };
    synth.speak(utterance);
  };

  const startChunks = (chapter: TtsChapter, runId: number) => {
    const chunks = splitIntoChunks(
      chapter.text,
      chapter.startOffset,
      engineRef.current === "neural" ? 90 : CHUNK_LIMIT,
    );
    if (chunks.length === 0) {
      setError("这一章没有可朗读的文字");
      setStatus("idle");
      return;
    }
    if (engineRef.current === "neural") {
      neuralCacheRef.current.clear();
      neuralPromisesRef.current.clear();
    }
    chapterRef.current = chapter;
    chunksRef.current = chunks;
    setChunkCount(chunks.length);
    setChunkIndex(0);
    chunkIndexRef.current = 0;
    setError(null);
    setStatus("playing");
    speakChunk(0, runId);
  };

  const advanceChapter = async (runId: number) => {
    setStatus("loading");
    try {
      const next = await loadNextRef.current();
      if (runId !== runIdRef.current) return;
      if (!next) {
        setStatus("ended");
        onStopRef.current();
        return;
      }
      startChunks(next, runId);
    } catch {
      if (runId !== runIdRef.current) return;
      setError("没有找到下一章");
      setStatus("ended");
      onStopRef.current();
    }
  };

  const begin = async () => {
    if (engineRef.current === "system" && !synth) {
      setError("当前环境不支持系统朗读");
      return;
    }
    if (engineRef.current === "neural" && !neuralStatusRef.current?.installed) {
      setError("请先下载离线自然语音");
      return;
    }
    const runId = ++runIdRef.current;
    setStatus("loading");
    setError(null);
    try {
      const chapter = await loadCurrentRef.current();
      if (runId !== runIdRef.current) return;
      if (!chapter) {
        setError("这一章没有可朗读的文字");
        setStatus("idle");
        return;
      }
      startChunks(chapter, runId);
    } catch {
      if (runId !== runIdRef.current) return;
      setError("读取这一章失败，请重试");
      setStatus("idle");
    }
  };

  const toggle = () => {
    if (engineRef.current === "neural") {
      const audio = neuralAudioRef.current;
      if (statusRef.current === "playing") {
        audio?.pause();
        setStatus("paused");
        return;
      }
      if (statusRef.current === "paused") {
        if (audio) void audio.play().catch(() => setError("继续播放失败"));
        setStatus("playing");
        return;
      }
      if (statusRef.current === "loading") return;
      void begin();
      return;
    }
    if (!synth) {
      setError("当前环境不支持系统朗读");
      return;
    }
    if (statusRef.current === "playing") {
      synth.pause();
      setStatus("paused");
      return;
    }
    if (statusRef.current === "paused") {
      synth.resume();
      setStatus("playing");
      return;
    }
    if (statusRef.current === "loading") return;
    void begin();
  };

  const skipChunk = (delta: number) => {
    if (statusRef.current === "loading" || chunksRef.current.length === 0) return;
    const next = Math.max(
      0,
      Math.min(chunksRef.current.length - 1, chunkIndexRef.current + delta),
    );
    if (next === chunkIndexRef.current) return;
    const runId = runIdRef.current;
    if (engineRef.current === "neural") {
      void playNeuralChunk(next, runId);
    } else if (synth) {
      synth.cancel();
      if (pauseTimerRef.current !== null) {
        window.clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      setStatus("playing");
      speakChunk(next, runId);
    }
  };
  toggleRef.current = toggle;
  nextChunkRef.current = () => skipChunk(1);
  previousChunkRef.current = () => skipChunk(-1);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (status === "idle" || status === "ended") {
      session.playbackState = "none";
      return;
    }
    try {
      session.metadata = new MediaMetadata({
        title: chapterLabel || "墨阅听书",
        artist: "墨阅",
        album: "把世界读慢一点",
      });
      session.playbackState =
        status === "playing" ? "playing" : status === "paused" ? "paused" : "none";
      const handlers: [MediaSessionAction, (() => void) | null][] = [
        ["play", () => toggleRef.current()],
        ["pause", () => toggleRef.current()],
        ["stop", () => stopRef.current()],
        ["nexttrack", () => nextChunkRef.current()],
        ["previoustrack", () => previousChunkRef.current()],
        ["seekforward", () => nextChunkRef.current()],
        ["seekbackward", () => previousChunkRef.current()],
      ];
      for (const [action, handler] of handlers) {
        session.setActionHandler(action, handler);
      }
      return () => {
        for (const [action] of handlers) {
          try {
            session.setActionHandler(action, null);
          } catch {
            // Some WebView versions do not support every action.
          }
        }
      };
    } catch {
      // Media Session is optional; playback still works.
    }
  }, [chapterLabel, status]);

  const setSleep = (minutes: number) => {
    setSleepMinutes(minutes);
    fadeVolumeRef.current = 1;
    if (neuralAudioRef.current) neuralAudioRef.current.volume = 1;
    if (minutes <= 0) {
      setSleepAt(0);
      setSleepLeft(0);
      return;
    }
    setSleepAt(Date.now() + minutes * 60_000);
  };

  const downloadNeural = async () => {
    if (!isTauri || neuralBusy) return;
    setNeuralBusy(true);
    setNeuralError(null);
    setNeuralProgress(null);
    try {
      await invoke("download_neural");
      const status = await invoke<NeuralStatus>("neural_status");
      setNeuralStatus(status);
      neuralStatusRef.current = status;
    } catch (downloadError) {
      setNeuralError(
        downloadError instanceof Error ? downloadError.message : "下载离线语音失败",
      );
    } finally {
      setNeuralBusy(false);
    }
  };

  const removeNeural = async () => {
    if (!isTauri || neuralBusy) return;
    if (!window.confirm("删除已下载的离线自然语音？之后可以重新下载。")) return;
    try {
      stop();
      await invoke("remove_neural");
      const status = await invoke<NeuralStatus>("neural_status");
      setNeuralStatus(status);
      neuralStatusRef.current = status;
      clearNeuralCache();
    } catch (removeError) {
      setNeuralError(
        removeError instanceof Error ? removeError.message : "删除离线语音失败",
      );
    }
  };

  const switchEngine = (next: TtsEngine) => {
    if (next === engine) return;
    stop();
    setError(null);
    setEngine(next);
  };

  const statusText =
    status === "idle"
      ? "准备朗读当前章节"
      : status === "loading"
        ? engine === "neural" && chunkCount > 0
          ? "正在生成离线语音…"
          : "正在准备章节…"
        : status === "paused"
          ? "已暂停"
          : status === "ended"
            ? "已到最后一章"
            : chunkCount > 0
              ? `正在朗读 · ${chunkIndex + 1} / ${chunkCount}`
              : "正在朗读";

  if (!open && (status === "idle" || status === "ended")) return null;

  return (
    <>
      {open ? (
        <section
          className="tts-panel"
          role="dialog"
          aria-label="听书"
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") onClose();
          }}
        >
          <header className="tts-panel__header">
            <div className="tts-panel__title">
              <span className="tts-panel__icon">
                <Icon name="headphones" size={18} />
              </span>
              <div>
                <strong>听书</strong>
                <small>{chapterLabel}</small>
              </div>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="关闭听书">
              <Icon name="x" size={17} />
            </button>
          </header>

          <div className="tts-engine-switch">
            <button
              className={engine === "system" ? "tts-engine-switch__active" : ""}
              onClick={() => switchEngine("system")}
            >
              系统语音
            </button>
            <button
              className={engine === "neural" ? "tts-engine-switch__active" : ""}
              onClick={() => switchEngine("neural")}
            >
              离线自然语音
            </button>
          </div>

          {engine === "neural" && !neuralStatus?.installed ? (
            <div className="tts-neural-setup">
              <p>
                下载离线自然语音后，不联网也能使用更自然的中文音色。
                需要下载语音引擎和中文模型，约 190MB；安装后约 245MB。
              </p>
              {neuralBusy ? (
                <>
                  <div className="tts-download-status">
                    {neuralProgress?.message ?? "正在下载…"}
                    <span>
                      {neuralProgress
                        ? `${formatBytes(neuralProgress.downloaded)} / ${formatBytes(neuralProgress.total)}`
                        : ""}
                    </span>
                  </div>
                  <div className="tts-progress" aria-hidden="true">
                    <span style={{ width: `${neuralProgress?.percent ?? 0}%` }} />
                  </div>
                </>
              ) : (
                <button
                  className="button button--primary tts-download-button"
                  onClick={() => void downloadNeural()}
                  disabled={!isTauri}
                >
                  <Icon name="download" size={15} />
                  下载离线自然语音
                </button>
              )}
              {neuralError ? <p className="tts-error">{neuralError}</p> : null}
            </div>
          ) : (
            <>
              {engine === "neural" ? (
                <div className="tts-neural-ready">
                  <span>
                    已安装 · {formatBytes(neuralStatus?.bytes ?? 0)}
                  </span>
                  <button className="text-button" onClick={() => void removeNeural()}>
                    删除
                  </button>
                </div>
              ) : null}

              <div className="tts-panel__status">{statusText}</div>
              {chunkCount > 0 ? (
                <div className="tts-progress" aria-hidden="true">
                  <span style={{ width: `${Math.round((chunkIndex / chunkCount) * 100)}%` }} />
                </div>
              ) : null}

              <div className="tts-controls">
                <button
                  className="tts-play"
                  onClick={toggle}
                  disabled={
                    status === "loading" ||
                    (engine === "system" && !synth) ||
                    (engine === "neural" && !neuralStatus?.installed)
                  }
                  aria-label={status === "playing" ? "暂停听书" : "开始听书"}
                >
                  <Icon name={status === "playing" ? "pause" : "play"} size={20} />
                </button>
                <button
                  className="tts-stop"
                  onClick={stop}
                  disabled={status === "idle" || status === "ended"}
                  aria-label="停止听书"
                  title="停止"
                >
                  <Icon name="x" size={16} />
                </button>
                <span className="tts-controls__hint">
                  {status === "playing"
                    ? "可以继续读正文"
                    : engine === "neural"
                      ? "离线自然语音"
                      : "使用系统中文语音"}
                </span>
              </div>

              <label className="tts-field">
                <span>语速</span>
                <input
                  type="range"
                  min={0.6}
                  max={2}
                  step={0.1}
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                  aria-label="朗读语速"
                />
                <small>{rate.toFixed(1)}x</small>
              </label>

              <div className="tts-style">
                <span>风格</span>
                <div className="tts-style__options">
                  {styles.map((item) => (
                    <button
                      key={item.id}
                      className={
                        style === item.id
                          ? "tts-style__option tts-style__option--active"
                          : "tts-style__option"
                      }
                      onClick={() => setStyle(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {engine === "system" ? (
                <label className="tts-field tts-field--select">
                  <span>音色</span>
                  <select
                    value={currentVoice?.voiceURI ?? ""}
                    onChange={(event) => setVoiceURI(event.target.value)}
                    aria-label="朗读音色"
                  >
                    {voices.length === 0 ? <option value="">系统默认语音</option> : null}
                    {voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} · {voice.lang}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="tts-field tts-field--neural-voice">
                  <span>音色</span>
                  <span>MeloTTS 中文 · 离线合成</span>
                </div>
              )}

              <div className="tts-sleep">
                <div className="tts-sleep__label">
                  <span>定时关闭</span>
                  {sleepLeft > 0 ? <small>{formatRemaining(sleepLeft)}</small> : null}
                </div>
                <div className="tts-sleep__options">
                  {[0, 15, 30, 60].map((minutes) => (
                    <button
                      key={minutes}
                      className={
                        sleepMinutes === minutes
                          ? "tts-sleep__option tts-sleep__option--active"
                          : "tts-sleep__option"
                      }
                      onClick={() => setSleep(minutes)}
                    >
                      {minutes === 0 ? "不定时" : `${minutes} 分钟`}
                    </button>
                  ))}
                </div>
                <p className="tts-hint tts-sleep__hint">
                  离线自然语音会在最后 15 秒逐渐淡出；系统语音到时停止。
                </p>
              </div>

              <p className="tts-hint">
                从当前位置开始朗读，当前句子会在正文中高亮；读完自动进入下一章。
              </p>
              {error ? <p className="tts-error">{error}</p> : null}
            </>
          )}
        </section>
      ) : null}

      <audio
        ref={neuralAudioRef}
        className="tts-audio"
        preload="auto"
        onEnded={handleNeuralEnded}
        onError={() => {
          if (statusRef.current === "playing" || statusRef.current === "loading") {
            setError("离线语音播放失败");
          }
        }}
      />

      {!open && status !== "idle" && status !== "ended" ? (
        <div className="tts-mini">
          <button className="tts-mini__main" onClick={onOpen} aria-label="打开听书面板">
            <span className="tts-mini__icon">
              <Icon name="headphones" size={15} />
            </span>
            <span>
              <strong>听书</strong>
              <small>{chapterLabel}</small>
            </span>
          </button>
          <button className="tts-mini__button" onClick={toggle} aria-label={status === "playing" ? "暂停听书" : "继续听书"}>
            <Icon name={status === "playing" ? "pause" : "play"} size={14} />
          </button>
          <button className="tts-mini__button" onClick={stop} aria-label="停止听书">
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : null}
    </>
  );
}

function splitIntoChunks(
  text: string,
  startOffset: number,
  limit: number = CHUNK_LIMIT,
): TtsChunk[] {
  if (!text.trim()) return [];
  const chunks: TtsChunk[] = [];
  let bufferStart = -1;

  const flush = (end: number) => {
    if (bufferStart < 0 || end <= bufferStart) return;
    const raw = text.slice(bufferStart, end);
    const leading = raw.search(/\S/);
    const trailing = raw.search(/\s*$/);
    const start = bufferStart + (leading >= 0 ? leading : 0);
    const stop = bufferStart + (trailing >= 0 ? trailing : raw.length);
    if (stop > start) {
      chunks.push({ text: text.slice(start, stop), start, end: stop });
    }
    bufferStart = -1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (bufferStart < 0) {
      if (/\s/.test(char)) continue;
      bufferStart = index;
    }
    if ("。！？!?…\n".includes(char) || index - bufferStart >= limit) {
      flush(index + 1);
    }
  }
  flush(text.length);

  return chunks
    .filter((chunk) => chunk.text.trim().length > 0)
    .filter((chunk) => /[\p{L}\p{N}]/u.test(chunk.text))
    .filter((chunk) => chunk.end > startOffset)
    .map((chunk, index) => {
      if (index > 0 || chunk.start >= startOffset) return chunk;
      const start = Math.min(chunk.end, startOffset);
      return {
        text: text.slice(start, chunk.end),
        start,
        end: chunk.end,
      };
    })
    .filter((chunk) => /[\p{L}\p{N}]/u.test(chunk.text));
}

function formatRemaining(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

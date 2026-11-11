import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";

interface TtsPlayerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  chapterLabel: string;
  loadCurrentChapter: () => Promise<string | null>;
  loadNextChapter: () => Promise<string | null>;
}

type TtsStatus = "idle" | "loading" | "playing" | "paused" | "ended";

const VOICE_KEY = "moyue.tts.voice.v1";
const RATE_KEY = "moyue.tts.rate.v1";
const CHUNK_LIMIT = 180;

export function TtsPlayer({
  open,
  onOpen,
  onClose,
  chapterLabel,
  loadCurrentChapter,
  loadNextChapter,
}: TtsPlayerProps) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
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
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [chunkIndex, setChunkIndex] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sleepAt, setSleepAt] = useState(0);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);

  const runIdRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  const rateRef = useRef(rate);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const loadCurrentRef = useRef(loadCurrentChapter);
  const loadNextRef = useRef(loadNextChapter);
  const statusRef = useRef(status);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    rateRef.current = rate;
    try {
      localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      // TTS still works without persistence.
    }
  }, [rate]);

  useEffect(() => {
    loadCurrentRef.current = loadCurrentChapter;
    loadNextRef.current = loadNextChapter;
  }, [loadCurrentChapter, loadNextChapter]);

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
      setSleepLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, sleepAt - Date.now());
      setSleepLeft(left);
      if (left <= 0) {
        setSleepAt(0);
        setSleepMinutes(0);
        stopRef.current();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [sleepAt]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = () => {
    runIdRef.current += 1;
    if (synth) synth.cancel();
    chunksRef.current = [];
    setChunkCount(0);
    setChunkIndex(0);
    setStatus("idle");
    setSleepAt(0);
    setSleepMinutes(0);
  };
  stopRef.current = stop;

  const speakChunk = (index: number, runId: number) => {
    if (!synth || runId !== runIdRef.current) return;
    const chunks = chunksRef.current;
    if (index >= chunks.length) {
      void advanceChapter(runId);
      return;
    }

    setChunkIndex(index);
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    const voice = voiceRef.current;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "zh-CN";
    }
    utterance.rate = rateRef.current;
    utterance.volume = 1;
    utterance.onend = () => {
      if (runId !== runIdRef.current) return;
      speakChunk(index + 1, runId);
    };
    utterance.onerror = (event) => {
      if (runId !== runIdRef.current) return;
      if (event.error === "interrupted" || event.error === "canceled") return;
      setError("朗读中断了，可以重新开始");
      setStatus("idle");
    };
    synth.speak(utterance);
  };

  const startChunks = (text: string, runId: number) => {
    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) {
      setError("这一章没有可朗读的文字");
      setStatus("idle");
      return;
    }
    chunksRef.current = chunks;
    setChunkCount(chunks.length);
    setChunkIndex(0);
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
        return;
      }
      startChunks(next, runId);
    } catch {
      if (runId !== runIdRef.current) return;
      setError("没有找到下一章");
      setStatus("ended");
    }
  };

  const begin = async () => {
    if (!synth) {
      setError("当前环境不支持系统朗读");
      return;
    }
    const runId = ++runIdRef.current;
    setStatus("loading");
    setError(null);
    try {
      const text = await loadCurrentRef.current();
      if (runId !== runIdRef.current) return;
      if (!text) {
        setError("这一章没有可朗读的文字");
        setStatus("idle");
        return;
      }
      startChunks(text, runId);
    } catch {
      if (runId !== runIdRef.current) return;
      setError("读取这一章失败，请重试");
      setStatus("idle");
    }
  };

  const toggle = () => {
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

  const setSleep = (minutes: number) => {
    setSleepMinutes(minutes);
    if (minutes <= 0) {
      setSleepAt(0);
      setSleepLeft(0);
      return;
    }
    setSleepAt(Date.now() + minutes * 60_000);
  };

  const statusText =
    status === "idle"
      ? "准备朗读当前章节"
      : status === "loading"
        ? "正在准备章节…"
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
              disabled={!synth || status === "loading"}
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
              {status === "playing" ? "可以继续读正文" : "使用系统中文语音"}
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
          </div>

          <p className="tts-hint">从当前章节开头朗读，读完自动进入下一章。</p>
          {error ? <p className="tts-error">{error}</p> : null}
        </section>
      ) : null}

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

function splitIntoChunks(text: string): string[] {
  const normalized = text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];

  let sentences: string[] = [];
  const Segmenter = (Intl as any).Segmenter;
  if (Segmenter) {
    try {
      const segmenter = new Segmenter("zh-CN", { granularity: "sentence" });
      sentences = Array.from(segmenter.segment(normalized), (item: any) => item.segment);
    } catch {
      sentences = [];
    }
  }
  if (sentences.length === 0) {
    sentences = normalized.match(/[^。！？!?…]+[。！？!?…]?/g) ?? [normalized];
  }

  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) chunks.push(buffer.trim());
    buffer = "";
  };

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (buffer.length + sentence.length > CHUNK_LIMIT) flush();
    if (sentence.length > CHUNK_LIMIT) {
      const pieces = sentence.match(/[^，,、；;：:]+[，,、；;：:]?/g) ?? [sentence];
      for (const piece of pieces) {
        if (piece.length > CHUNK_LIMIT) {
          flush();
          for (let index = 0; index < piece.length; index += CHUNK_LIMIT) {
            chunks.push(piece.slice(index, index + CHUNK_LIMIT));
          }
        } else {
          if (buffer.length + piece.length > CHUNK_LIMIT) flush();
          buffer += piece;
        }
      }
    } else {
      buffer += sentence;
    }
  }
  flush();
  return chunks;
}

function formatRemaining(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

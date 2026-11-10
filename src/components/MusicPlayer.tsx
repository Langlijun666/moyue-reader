import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { formatBytes } from "../lib/format";
import { Icon } from "./Icons";

interface MusicTrack {
  fileName: string;
  path: string;
  size: number;
  modified: number;
}

interface TrackView extends MusicTrack {
  title: string;
  artist: string;
}

interface MusicPlayerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const VOLUME_KEY = "moyue.music.volume.v1";

export function MusicPlayer({ open, onOpen, onClose }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentRef = useRef<TrackView | null>(null);
  const [folder, setFolder] = useState("");
  const [tracks, setTracks] = useState<TrackView[]>([]);
  const [current, setCurrent] = useState<TrackView | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(VOLUME_KEY));
      return Number.isFinite(saved) && saved > 0 ? Math.min(1, saved) : 0.8;
    } catch {
      return 0.8;
    }
  });

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const loadLibrary = useCallback(async () => {
    if (!isTauri) {
      setError("音乐播放目前仅在桌面版可用");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const musicFolder = await invoke<string>("music_dir");
      const list = await invoke<MusicTrack[]>("list_music");
      const nextTracks = list.map((track) => ({
        ...track,
        ...parseTrackName(track.fileName),
      }));
      setFolder(musicFolder);
      setTracks(nextTracks);

      const active = currentRef.current;
      if (active) {
        const nextIndex = nextTracks.findIndex((track) => track.path === active.path);
        if (nextIndex >= 0) {
          setCurrentIndex(nextIndex);
          setCurrent(nextTracks[nextIndex]);
          currentRef.current = nextTracks[nextIndex];
        } else {
          audioRef.current?.pause();
          setCurrent(null);
          setCurrentIndex(null);
          currentRef.current = null;
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "读取音乐文件夹失败");
    } finally {
      setLoading(false);
    }
  }, [isTauri]);

  useEffect(() => {
    if (open) void loadLibrary();
  }, [open, loadLibrary]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // Volume is best-effort.
    }
  }, [volume]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".music-panel")) {
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  const playIndex = (index: number) => {
    const track = tracks[index];
    const audio = audioRef.current;
    if (!track || !audio) return;
    if (!isTauri) {
      setError("音乐播放目前仅在桌面版可用");
      return;
    }

    try {
      setError(null);
      setCurrent(track);
      setCurrentIndex(index);
      currentRef.current = track;
      setProgress(0);
      setDuration(0);
      audio.src = convertFileSrc(track.path);
      audio.volume = volume;
      void audio.play().catch(() => {
        setPlaying(false);
        setError("这首歌无法播放，可能是不受支持的音频编码");
      });
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : "无法播放这首歌");
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) {
      if (tracks.length > 0) playIndex(0);
      return;
    }
    if (audio.paused) {
      void audio.play().catch(() => setError("播放失败，请检查音频文件"));
    } else {
      audio.pause();
    }
  };

  const playNext = () => {
    if (tracks.length === 0) return;
    const next = currentIndex === null ? 0 : (currentIndex + 1) % tracks.length;
    playIndex(next);
  };

  const playPrevious = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (tracks.length === 0) return;
    const previous =
      currentIndex === null ? 0 : (currentIndex - 1 + tracks.length) % tracks.length;
    playIndex(previous);
  };

  const handleOpenFolder = async () => {
    if (!isTauri) {
      setError("音乐播放目前仅在桌面版可用");
      return;
    }
    try {
      await invoke("open_music_folder");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "无法打开音乐文件夹");
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        className="music-audio"
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => {
          if (currentIndex !== null && currentIndex < tracks.length - 1) {
            playIndex(currentIndex + 1);
          } else {
            setPlaying(false);
            setProgress(0);
          }
        }}
        onError={() => {
          if (current) setError("这首歌无法播放，可能是不受支持的音频编码");
        }}
      />

      {open ? (
        <>
          <div className="music-backdrop" onClick={onClose} />
          <section className="music-panel" role="dialog" aria-label="音乐">
            <header className="music-panel__header">
              <div>
                <span className="eyebrow">LISTENING</span>
                <h3>音乐</h3>
              </div>
              <button className="icon-button" onClick={onClose} aria-label="关闭音乐">
                <Icon name="x" size={18} />
              </button>
            </header>

            <div className="music-folder">
              <div className="music-folder__path" title={folder}>
                <Icon name="folder" size={15} />
                <span>{folder || "音乐文件夹"}</span>
              </div>
              <div className="music-folder__actions">
                <button className="music-text-button" onClick={() => void handleOpenFolder()}>
                  打开文件夹
                </button>
                <button
                  className="icon-button icon-button--quiet"
                  onClick={() => void loadLibrary()}
                  disabled={loading}
                  aria-label="刷新音乐"
                  title="刷新"
                >
                  <Icon name="refresh" size={16} />
                </button>
              </div>
            </div>

            {error ? <p className="music-error">{error}</p> : null}

            <div className="music-list">
              {loading && tracks.length === 0 ? (
                <div className="music-empty">
                  <span className="spinner" />
                  <p>正在读取音乐文件夹…</p>
                </div>
              ) : tracks.length === 0 ? (
                <div className="music-empty">
                  <Icon name="music" size={32} />
                  <h4>音乐文件夹是空的</h4>
                  <p>
                    把 MP3、FLAC、WAV、M4A、AAC、OGG 或 OPUS 文件放进下面这个文件夹，
                    再点刷新。
                  </p>
                  <code>{folder || "桌面版会显示音乐文件夹路径"}</code>
                  <div className="music-empty__actions">
                    <button className="button button--primary" onClick={() => void handleOpenFolder()}>
                      <Icon name="folder" size={16} />
                      打开文件夹
                    </button>
                    <button className="button button--ghost" onClick={() => void loadLibrary()} disabled={loading}>
                      刷新
                    </button>
                  </div>
                </div>
              ) : (
                tracks.map((track, index) => (
                  <button
                    key={track.path}
                    className={`music-track ${currentIndex === index ? "music-track--active" : ""}`}
                    onClick={() => playIndex(index)}
                  >
                    <span className="music-track__index">
                      {currentIndex === index && playing ? (
                        <Icon name="pause" size={14} />
                      ) : (
                        <Icon name="play" size={14} />
                      )}
                    </span>
                    <span className="music-track__info">
                      <strong>{track.title}</strong>
                      <small>
                        {track.artist} · {formatBytes(track.size)}
                      </small>
                    </span>
                    <span className="music-track__type">
                      {track.fileName.split(".").pop()?.toUpperCase() || "AUDIO"}
                    </span>
                  </button>
                ))
              )}
            </div>

            {current ? (
              <div className="music-now-playing">
                <div className="music-now-playing__title">
                  <Icon name="music" size={17} />
                  <div>
                    <strong>{current.title}</strong>
                    <small>{current.artist}</small>
                  </div>
                </div>

                <div className="music-seek">
                  <span>{formatTime(progress)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(progress, duration || 0)}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (audioRef.current) audioRef.current.currentTime = value;
                      setProgress(value);
                    }}
                    aria-label="播放进度"
                  />
                  <span>{formatTime(duration)}</span>
                </div>

                <div className="music-controls">
                  <button className="music-control" onClick={playPrevious} aria-label="上一首">
                    <Icon name="skip-back" size={18} />
                  </button>
                  <button className="music-play" onClick={togglePlay} aria-label={playing ? "暂停" : "播放"}>
                    <Icon name={playing ? "pause" : "play"} size={20} />
                  </button>
                  <button className="music-control" onClick={playNext} aria-label="下一首">
                    <Icon name="skip-forward" size={18} />
                  </button>
                  <div className="music-volume">
                    <Icon name="volume" size={15} />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(event) => setVolume(Number(event.target.value))}
                      aria-label="音量"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {!open && current ? (
        <button className="music-mini" onClick={onOpen} aria-label="打开音乐播放器">
          <span className="music-mini__icon">
            <Icon name="music" size={16} />
          </span>
          <span className="music-mini__text">
            <strong>{current.title}</strong>
            <small>{current.artist}</small>
          </span>
          <span className="music-mini__state">
            <Icon name={playing ? "pause" : "play"} size={15} />
          </span>
        </button>
      ) : null}
    </>
  );
}

function parseTrackName(fileName: string): { title: string; artist: string } {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{1,3}[\s._-]+/, "")
    .trim();
  const dash = base.match(/^(.+?)\s+-\s+(.+)$/);
  if (dash) return { artist: dash[1].trim(), title: dash[2].trim() };
  const underscore = base.match(/^(.+?)[_＿](.+)$/);
  if (underscore) return { artist: underscore[1].trim(), title: underscore[2].trim() };
  return { title: base || fileName, artist: "本地音乐" };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

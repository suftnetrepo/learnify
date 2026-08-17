"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, CheckCircle2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  lectureId:       string;
  videoUrl:        string;
  title:           string;
  initialSeconds?: number;     // resume position
  onComplete?:     () => void; // called when 90% watched
  onProgress?:     (seconds: number) => void;
  className?:      string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({
  lectureId, videoUrl, title,
  initialSeconds = 0, onComplete, onProgress, className,
}: VideoPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef  = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const [playing,    setPlaying]    = useState(false);
  const [muted,      setMuted]      = useState(false);
  const [volume,     setVolume]     = useState(1);
  const [currentTime, setCurrentTime] = useState(initialSeconds);
  const [duration,   setDuration]   = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [completed,  setCompleted]  = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Save progress to API every 10 seconds
  const saveProgress = useCallback(async (seconds: number, isCompleted = false) => {
    try {
      await fetch(`/api/lectures/${lectureId}/progress`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ watchedSeconds: Math.floor(seconds), isCompleted }),
      });
    } catch { /* non-fatal */ }
  }, [lectureId]);

  // Set initial position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      video.currentTime = initialSeconds;
      setDuration(video.duration);
      setLoading(false);
    };
    video.addEventListener("loadedmetadata", handleLoaded);
    return () => video.removeEventListener("loadedmetadata", handleLoaded);
  }, [initialSeconds]);

  // Auto-save every 10s while playing
  useEffect(() => {
    if (playing) {
      saveTimerRef.current = setInterval(() => {
        const video = videoRef.current;
        if (video) {
          saveProgress(video.currentTime);
          onProgress?.(video.currentTime);
        }
      }, 10_000);
    }
    return () => clearInterval(saveTimerRef.current);
  }, [playing, saveProgress, onProgress]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      switch (e.key) {
        case " ":         e.preventDefault(); togglePlay(); break;
        case "ArrowRight": e.preventDefault(); video.currentTime += 10; break;
        case "ArrowLeft":  e.preventDefault(); video.currentTime -= 10; break;
        case "ArrowUp":    e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); break;
        case "ArrowDown":  e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
        case "m": case "M": setMuted((m) => !m); break;
        case "f": case "F": toggleFullscreen(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    if (playing) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setPlaying(true); }
    else              { video.pause(); setPlaying(false); }
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    // Trigger completion at 90% watched
    if (!completed && video.duration > 0 && video.currentTime / video.duration >= 0.9) {
      setCompleted(true);
      saveProgress(video.currentTime, true);
      onComplete?.();
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const video = videoRef.current;
    const bar   = progressRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * video.duration;
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn("relative bg-black select-none rounded-xl overflow-hidden group", className)}
      onMouseMove={resetControlsTimer}
      onClick={togglePlay}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        muted={muted}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); saveProgress(duration, true); }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
      />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 size={40} className="animate-spin text-white" />
        </div>
      )}

      {/* Completion badge */}
      {completed && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-white">
          <CheckCircle2 size={13} /> Completed
        </div>
      )}

      {/* Controls overlay */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 bg-black/60 px-4 pb-4 pt-16 transition-opacity duration-300",
        showControls ? "opacity-100" : "opacity-0"
      )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="mb-3 h-1 w-full cursor-pointer rounded-full bg-white/20"
          onClick={handleSeek}
        >
          <div
            className="h-1 rounded-full bg-brand-500 relative"
            style={{ width: `${progressPct}%` }}
          >
            <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow" />
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} className="text-white hover:text-brand-300 transition-colors">
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>

          {/* Skip forward */}
          <button
            onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }}
            className="text-white hover:text-brand-300 transition-colors"
            title="Skip 10s"
          >
            <SkipForward size={18} />
          </button>

          {/* Volume */}
          <button
            onClick={() => setMuted((m) => !m)}
            className="text-white hover:text-brand-300 transition-colors"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              if (videoRef.current) videoRef.current.volume = v;
              setMuted(v === 0);
            }}
            className="w-20 accent-brand-500"
          />

          {/* Time */}
          <span className="ml-1 text-xs text-white/70 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleFullscreen} className="text-white hover:text-brand-300 transition-colors">
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

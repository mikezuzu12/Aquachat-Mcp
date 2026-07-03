"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

type StatusItem = {
  id: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  bg_color?: string;
  created_at: string;
  viewed?: boolean;
};

type StatusUser = {
  id: string;
  full_name: string;
  avatar_url?: string;
  avatar_emoji?: string;
};

export default function StatusViewer({
  user,
  statuses,
  onClose,
  onViewed,
}: {
  user: StatusUser;
  statuses: StatusItem[];
  onClose: () => void;
  onViewed: (statusId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const TEXT_IMAGE_DURATION = 5000;

  const current = statuses[index];
  const isVideo = current?.media_type === "video";

  useEffect(() => {
    if (!current) { onClose(); return; }
    onViewed(current.id);
    setProgress(0);
    clearInterval(timerRef.current);

    if (isVideo) return; // video drives its own progress via onTimeUpdate

    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / TEXT_IMAGE_DURATION) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        advance();
      }
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [index]);

  function advance() {
    if (index < statuses.length - 1) setIndex((i) => i + 1);
    else onClose();
  }

  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }
  function next() {
    advance();
  }

  function onVideoTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  }

  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[70] flex flex-col"
    >
      <div className="flex gap-1 px-3 pt-3">
        {statuses.map((s, i) => (
          <div key={s.id} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.25)" }}>
            <div className="h-full bg-white transition-all" style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        {user.avatar_url ? (
          <img src={user.avatar_url} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
            style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
            {user.avatar_emoji || user.full_name?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <p className="text-white text-sm font-semibold">{user.full_name}</p>
          <p className="text-white/60 text-xs">
            {new Date(current.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button onClick={onClose} className="text-white p-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {!isVideo && (
          <>
            <button onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
            <button onClick={next} className="absolute right-0 top-0 bottom-0 w-1/3 z-10" />
          </>
        )}

        {isVideo ? (
          <video
            ref={videoRef}
            src={current.media_url}
            autoPlay
            playsInline
            onTimeUpdate={onVideoTimeUpdate}
            onEnded={advance}
            className="max-h-full max-w-full object-contain"
          />
        ) : current.media_url ? (
          <img src={current.media_url} alt="status" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-8" style={{ background: current.bg_color || "#25D366" }}>
            <p className="text-white text-2xl font-medium text-center leading-relaxed">{current.content}</p>
          </div>
        )}

        {current.media_url && current.content && (
          <div className="absolute bottom-6 left-0 right-0 text-center px-4">
            <p className="text-white text-sm bg-black/40 inline-block px-3 py-1.5 rounded-full">{current.content}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
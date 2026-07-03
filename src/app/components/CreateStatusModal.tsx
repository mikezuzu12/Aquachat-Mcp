"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";

const BG_COLORS = ["#25D366", "#128C7E", "#075E54", "#34495E", "#8E44AD", "#E74C3C", "#F39C12", "#2C3E50"];

export default function CreateStatusModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"text" | "media">("text");
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<"image" | "video" | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.type.startsWith("video/") && f.size > 50 * 1024 * 1024) {
      setError("Video must be under 50MB");
      return;
    }

    setFile(f);
    setFileKind(f.type.startsWith("video/") ? "video" : "image");
    setPreviewUrl(URL.createObjectURL(f));
    setMode("media");
    setError("");
  }

  async function post() {
    if (mode === "text" && !text.trim()) return;
    if (mode === "media" && !file) return;
    setPosting(true);
    setError("");

    try {
      let media_url = "";
      let media_type = "";

      if (mode === "media" && file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload/media", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.url) { setError(uploadData.error || "Upload failed"); setPosting(false); return; }
        media_url = uploadData.url;
        media_type = fileKind || "image";
      }

      const res = await fetch("/api/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: mode === "text" ? text.trim() : caption.trim(),
          media_url: media_url || null,
          media_type: media_type || null,
          bg_color: mode === "text" ? bgColor : null,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to post status");
        return;
      }
      onCreated();
    } catch {
      setError("Something went wrong");
    } finally {
      setPosting(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-50"
        onClick={() => !posting && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
        style={{ background: "#111827" }}
      >
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h3 className="font-bold text-white">New Status</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">✕</button>
        </div>

        <div className="p-5">
          {mode === "text" ? (
            <div className="w-full h-56 rounded-2xl flex items-center justify-center p-6 mb-4 transition" style={{ background: bgColor }}>
              <textarea
                autoFocus
                placeholder="Type a status..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                className="w-full h-full bg-transparent text-white text-xl font-medium text-center outline-none resize-none placeholder-white/60"
              />
            </div>
          ) : (
            <div className="mb-4">
              {fileKind === "video" ? (
                <video src={previewUrl} controls className="w-full max-h-64 rounded-2xl bg-black mb-3" />
              ) : (
                <img src={previewUrl} alt="preview" className="w-full max-h-64 object-contain rounded-2xl bg-black mb-3" />
              )}
              <input
                type="text"
                placeholder="Add a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full px-4 py-2 rounded-xl text-sm outline-none text-white placeholder-slate-500"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>
          )}

          {mode === "text" && (
            <div className="flex items-center gap-2 mb-4">
              {BG_COLORS.map((c) => (
                <button key={c} onClick={() => setBgColor(c)}
                  className="w-7 h-7 rounded-full flex-shrink-0 transition"
                  style={{ background: c, border: bgColor === c ? "2px solid white" : "2px solid transparent" }} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => { setMode("text"); setFile(null); setFileKind(null); }}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition"
              style={{
                background: mode === "text" ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.05)",
                color: mode === "text" ? "#25D366" : "#94a3b8",
                border: mode === "text" ? "1px solid rgba(37,211,102,0.3)" : "1px solid rgba(255,255,255,0.08)",
              }}>
              ✏️ Text
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition"
              style={{
                background: mode === "media" ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.05)",
                color: mode === "media" ? "#25D366" : "#94a3b8",
                border: mode === "media" ? "1px solid rgba(37,211,102,0.3)" : "1px solid rgba(255,255,255,0.08)",
              }}>
              📷 Photo / 🎥 Video
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
          </div>

          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          <button
            onClick={post}
            disabled={posting || (mode === "text" ? !text.trim() : !file)}
            className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
          >
            {posting ? "Posting..." : "Post Status"}
          </button>
        </div>
      </motion.div>
    </>
  );
}
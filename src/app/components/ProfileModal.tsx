"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { data: session, update } = useSession();
  const user = session?.user as any;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/users/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setFullName(data.user.full_name || "");
          setEmail(data.user.email || "");
          setPhone(data.user.phone || "");
          setAvatarUrl(data.user.avatar_url || "");
        }
      });
  }, []);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB"); return; }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) setAvatarUrl(data.url);
      else setError(data.error || "Upload failed.");
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError("");
    if (!fullName.trim()) { setError("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, phone, avatar_url: avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }

      await update();
      setSuccess(true);
      setTimeout(() => onClose(), 1000);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    
      <AnimatePresence>
      <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
        style={{ background: "#111827" }}
      >
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h3 className="font-bold text-white">Profile</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">✕</button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-3 rounded-xl mb-4">
              Profile updated ✓
            </div>
          )}

          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full mb-3 overflow-hidden border-4 border-green-500/30 flex items-center justify-center relative"
              style={{ background: "rgba(37,211,102,0.1)" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">{fullName?.[0]?.toUpperCase() || "?"}</span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-sm font-medium text-green-400 hover:text-green-300 transition disabled:opacity-50">
              {uploading ? "Uploading..." : "Change photo"}
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3 mb-6">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Phone number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 12 345 6789"
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition" />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
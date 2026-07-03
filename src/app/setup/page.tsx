"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const BACKGROUND_COLORS = [
  { name: "Dark Navy",    value: "#0A0E1A" },
  { name: "Forest",      value: "#0D1F0F" },
  { name: "Deep Purple", value: "#0F0A1A" },
  { name: "Dark Teal",   value: "#0A1A1F" },
  { name: "Charcoal",    value: "#111111" },
  { name: "Deep Red",    value: "#1A0A0A" },
  { name: "Midnight",    value: "#0A0F1F" },
  { name: "Olive Dark",  value: "#0F1A0A" },
];

const AVATAR_EMOJIS = ["😊", "😎", "🤩", "🥳", "🤗", "😄", "🙌", "✨", "🔥", "💫", "🌟", "🎯"];

type Step = "avatar" | "username" | "about" | "background" | "done";

export default function SetupPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<Step>("avatar");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("😊");
  const [avatarMode, setAvatarMode] = useState<"emoji" | "upload">("emoji");
  const [username, setUsername] = useState("");
  const [about, setAbout] = useState("Hey there! I am using AquaChat.");
  const [bgColor, setBgColor] = useState("#0A0E1A");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const steps: Step[] = ["avatar", "username", "about", "background", "done"];
  const stepIndex = steps.indexOf(step);
  const progress = ((stepIndex) / (steps.length - 1)) * 100;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setAvatarUrl(data.url);
        setAvatarMode("upload");
      }
    } catch {
      setError("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/users/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          about,
          avatar_url: avatarMode === "upload" ? avatarUrl : null,
          avatar_emoji: avatarMode === "emoji" ? avatarEmoji : null,
          bg_color: bgColor,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save profile.");
        return;
      }

      await update(); // refresh session
      setStep("done");

      setTimeout(() => router.push("/chat"), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const user = session?.user as any;

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0A0E1A 0%, #0D1B2A 100%)" }}>

      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #25D366, transparent)" }} />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #128C7E, transparent)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-xl"
            style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
            💬
          </div>
          <h1 className="text-2xl font-bold text-white">Set up your profile</h1>
          <p className="text-slate-400 text-sm mt-1">Let people know who you are</p>
        </div>

        {/* Progress bar */}
        {step !== "done" && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Step {stepIndex + 1} of {steps.length - 1}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #25D366, #128C7E)" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 p-8 backdrop-blur-xl"
          style={{ background: "rgba(17,24,39,0.95)" }}>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-5">
              {error}
            </motion.div>
          )}

          <AnimatePresence mode="wait">

            {/* ── STEP 1: AVATAR ── */}
            {step === "avatar" && (
              <motion.div key="avatar" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <h2 className="text-xl font-bold text-white mb-1">Profile picture</h2>
                <p className="text-slate-400 text-sm mb-6">Choose an emoji or upload a photo</p>

                {/* Mode toggle */}
                <div className="flex gap-2 mb-6">
                  {(["emoji", "upload"] as const).map((mode) => (
                    <button key={mode} onClick={() => setAvatarMode(mode)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition capitalize ${
                        avatarMode === mode ? "text-white" : "text-slate-400 bg-white/5"
                      }`}
                      style={avatarMode === mode ? { background: "linear-gradient(135deg, #25D366, #128C7E)" } : {}}>
                      {mode === "emoji" ? "😊 Emoji" : "📷 Photo"}
                    </button>
                  ))}
                </div>

                {avatarMode === "emoji" ? (
                  <>
                    {/* Big emoji preview */}
                    <div className="flex justify-center mb-6">
                      <div className="w-28 h-28 rounded-full flex items-center justify-center text-6xl border-4 border-green-500/30"
                        style={{ background: "rgba(37,211,102,0.1)" }}>
                        {avatarEmoji}
                      </div>
                    </div>
                    {/* Emoji picker */}
                    <div className="grid grid-cols-6 gap-2">
                      {AVATAR_EMOJIS.map((emoji) => (
                        <button key={emoji} onClick={() => setAvatarEmoji(emoji)}
                          className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition ${
                            avatarEmoji === emoji
                              ? "border-2 border-green-400 scale-110"
                              : "border border-white/10 hover:border-white/30"
                          }`}
                          style={{ background: avatarEmoji === emoji ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.03)" }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    {/* Upload preview */}
                    <div className="w-28 h-28 rounded-full mx-auto mb-4 overflow-hidden border-4 border-green-500/30 flex items-center justify-center"
                      style={{ background: "rgba(37,211,102,0.1)" }}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">📷</span>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                      {uploading ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Uploading...
                        </span>
                      ) : avatarUrl ? "Change Photo" : "Upload Photo"}
                    </button>
                  </div>
                )}

                <button onClick={() => setStep("username")}
                  className="w-full py-3.5 rounded-xl font-semibold text-white transition mt-6"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                  Continue →
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: USERNAME ── */}
            {step === "username" && (
              <motion.div key="username" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <h2 className="text-xl font-bold text-white mb-1">Your name</h2>
                <p className="text-slate-400 text-sm mb-6">This is how others will see you in chats</p>

                {/* Avatar preview */}
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl border-4 border-green-500/30 overflow-hidden"
                    style={{ background: "rgba(37,211,102,0.1)" }}>
                    {avatarMode === "upload" && avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      avatarEmoji
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={30}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500 mb-2"
                />
                <p className="text-xs text-slate-500 text-right mb-6">{username.length}/30</p>

                <div className="flex gap-3">
                  <button onClick={() => setStep("avatar")}
                    className="flex-1 py-3 rounded-xl font-medium text-slate-400 border border-white/10 hover:border-white/20 transition"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    Back
                  </button>
                  <button onClick={() => { if (username.trim()) setStep("about"); else setError("Please enter a name."); }}
                    className="flex-1 py-3 rounded-xl font-semibold text-white transition"
                    style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                    Continue →
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: ABOUT ── */}
            {step === "about" && (
              <motion.div key="about" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <h2 className="text-xl font-bold text-white mb-1">About</h2>
                <p className="text-slate-400 text-sm mb-6">Share a little about yourself</p>

                <textarea
                  placeholder="Hey there! I am using AquaChat."
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  maxLength={100}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500 resize-none mb-2"
                />
                <p className="text-xs text-slate-500 text-right mb-6">{about.length}/100</p>

                <div className="flex gap-3">
                  <button onClick={() => setStep("username")}
                    className="flex-1 py-3 rounded-xl font-medium text-slate-400 border border-white/10 hover:border-white/20 transition"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    Back
                  </button>
                  <button onClick={() => setStep("background")}
                    className="flex-1 py-3 rounded-xl font-semibold text-white transition"
                    style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                    Continue →
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: BACKGROUND ── */}
            {step === "background" && (
              <motion.div key="background" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <h2 className="text-xl font-bold text-white mb-1">Chat background</h2>
                <p className="text-slate-400 text-sm mb-6">Pick your preferred background colour</p>

                {/* Preview */}
                <div className="rounded-2xl p-4 mb-6 border border-white/10 transition-all" style={{ background: bgColor }}>
                  <div className="flex justify-end mb-2">
                    <div className="px-3 py-2 rounded-2xl rounded-tr-sm text-white text-sm max-w-[80%]"
                      style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                      Hey! How are you? 👋
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-2xl rounded-tl-sm text-white text-sm max-w-[80%]"
                      style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      I'm doing great, thanks! 😊
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                  {BACKGROUND_COLORS.map((color) => (
                    <button key={color.value} onClick={() => setBgColor(color.value)}
                      className="relative aspect-square rounded-2xl border-2 transition-all"
                      style={{
                        background: color.value,
                        borderColor: bgColor === color.value ? "#25D366" : "rgba(255,255,255,0.1)",
                        transform: bgColor === color.value ? "scale(1.08)" : "scale(1)",
                      }}>
                      {bgColor === color.value && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center text-xs text-white font-bold">✓</div>
                        </div>
                      )}
                      <p className="absolute bottom-1 left-0 right-0 text-center text-white/60 text-xs px-1 truncate">{color.name}</p>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep("about")}
                    className="flex-1 py-3 rounded-xl font-medium text-slate-400 border border-white/10 hover:border-white/20 transition"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    Back
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : "Finish Setup →"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── DONE ── */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                  {avatarMode === "upload" && avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover rounded-full" />
                  ) : avatarEmoji}
                </motion.div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome, {username}! 🎉</h2>
                <p className="text-slate-400 mb-2">Your profile is all set up.</p>
                <p className="text-slate-500 text-sm">Taking you to your chats...</p>
                <div className="flex justify-center mt-4">
                  <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
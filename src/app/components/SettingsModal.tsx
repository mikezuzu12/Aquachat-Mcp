"use client";

import { useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";

const BACKGROUND_COLORS = [
  { name: "Dark Navy",   value: "#0A0E1A" },
  { name: "Forest",      value: "#0D1F0F" },
  { name: "Deep Purple", value: "#0F0A1A" },
  { name: "Dark Teal",   value: "#0A1A1F" },
  { name: "Charcoal",    value: "#111111" },
  { name: "Deep Red",    value: "#1A0A0A" },
  { name: "Midnight",    value: "#0A0F1F" },
  { name: "Olive Dark",  value: "#0F1A0A" },
];

const AVATAR_EMOJIS = ["😊","😎","🤩","🥳","🤗","😄","🙌","✨","🔥","💫","🌟","🎯"];

type Section =
  | "menu"
  | "profile"
  | "chats"
  | "notifications"
  | "privacy"
  | "account"
  | "help";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data: session, update } = useSession();
  const user = session?.user as any;
  const fileRef = useRef<HTMLInputElement>(null);

  const [section, setSection] = useState<Section>("menu");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile
  const [name, setName] = useState(user?.name || "");
  const [about, setAbout] = useState(user?.about || "Hey there! I am using AquaChat.");
  const [avatarEmoji, setAvatarEmoji] = useState(user?.avatar_emoji || "😊");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [uploading, setUploading] = useState(false);

  // Chats
  const [bgColor, setBgColor] = useState(user?.bg_color || "#0A0E1A");
  const [fontSize, setFontSize] = useState(user?.font_size || "medium");

  // Notifications
  const [msgNotifs, setMsgNotifs] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibration, setVibration] = useState(true);

  // Privacy
  const [lastSeen, setLastSeen] = useState("everyone");
  const [onlineStatus, setOnlineStatus] = useState("everyone");
  const [readReceipts, setReadReceipts] = useState(true);

  // Account
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch("/api/users/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name,
          about,
          avatar_emoji: avatarEmoji,
          avatar_url: avatarUrl,
          bg_color: bgColor,
        }),
      });
      await update();
      flashSaved();
    } finally {
      setSaving(false);
    }
  }

  async function saveChats() {
    setSaving(true);
    try {
      await fetch("/api/users/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user?.name,
          bg_color: bgColor,
          font_size: fontSize,
        }),
      });
      await update();
      flashSaved();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPwError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError("Please fill in all fields."); return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords don't match."); return;
    }
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters."); return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || "Failed to change password."); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      flashSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) setAvatarUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const MENU_ITEMS = [
    { id: "profile",       icon: "👤", label: "Profile",       sub: "Change your name, photo, about" },
    { id: "chats",         icon: "💬", label: "Chats",         sub: "Wallpaper, font size, themes" },
    { id: "notifications", icon: "🔔", label: "Notifications", sub: "Message and group tones" },
    { id: "privacy",       icon: "🔒", label: "Privacy",       sub: "Last seen, read receipts" },
    { id: "account",       icon: "🔑", label: "Account",       sub: "Security, change password" },
    { id: "help",          icon: "❓", label: "Help",          sub: "FAQ, contact us, privacy policy" },
  ] as const;

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${value ? "bg-green-500" : "bg-slate-600"}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? "left-7" : "left-1"}`} />
    </button>
  );

  const RadioGroup = ({ value, onChange, options }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div className="space-y-2">
      {options.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/8 hover:bg-white/5 transition">
          <span className="text-sm text-slate-300">{opt.label}</span>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            value === opt.value ? "border-green-400" : "border-slate-500"
          }`}>
            {value === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-green-400" />}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div key="settings-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div key="settings-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col"
        style={{ background: "#111827", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3 flex-shrink-0">
          {section !== "menu" && (
            <button onClick={() => setSection("menu")}
              className="text-slate-400 hover:text-white transition p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <h3 className="font-bold text-white flex-1">
            {section === "menu" ? "Settings" : MENU_ITEMS.find(m => m.id === section)?.label || "Settings"}
          </h3>
          {saved && <span className="text-xs text-green-400 font-medium">✓ Saved</span>}
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ── MAIN MENU ── */}
            {section === "menu" && (
              <motion.div key="menu"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

                {/* Profile preview */}
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-4"
                  style={{ background: "rgba(37,211,102,0.05)" }}>
                  <div className="relative flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar"
                        className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                        style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                        {avatarEmoji}
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-400 border-2 border-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white">{user?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{about}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <button onClick={() => setSection("profile")}
                    className="p-2 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>

                {/* Menu items */}
                <div className="py-2">
                  {MENU_ITEMS.map((item) => (
                    <button key={item.id} onClick={() => setSection(item.id)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition text-left">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.06)" }}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.sub}</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>

                {/* Logout */}
                <div className="px-5 py-4 border-t border-white/8">
                  <button onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full py-3 rounded-xl font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── PROFILE ── */}
            {section === "profile" && (
              <motion.div key="profile"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="p-5 space-y-5">

                {/* Avatar */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
                        style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                        {avatarEmoji}
                      </div>
                    )}
                    <button onClick={() => fileRef.current?.click()}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-gray-900"
                      style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                      📷
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  {uploading && <p className="text-xs text-slate-400">Uploading...</p>}
                </div>

                {/* Emoji picker */}
                <div>
                  <p className="text-xs text-slate-400 mb-2 uppercase tracking-widest">Or choose an emoji</p>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATAR_EMOJIS.map((emoji) => (
                      <button key={emoji} onClick={() => { setAvatarEmoji(emoji); setAvatarUrl(""); }}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition ${
                          avatarEmoji === emoji && !avatarUrl
                            ? "border-2 border-green-400 scale-110"
                            : "border border-white/10 hover:border-white/30"
                        }`}
                        style={{ background: avatarEmoji === emoji && !avatarUrl ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.03)" }}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">Your Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={30}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition" />
                  <p className="text-xs text-slate-500 text-right mt-1">{name.length}/30</p>
                </div>

                {/* About */}
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">About</label>
                  <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={100} rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition resize-none" />
                  <p className="text-xs text-slate-500 text-right mt-1">{about.length}/100</p>
                </div>

                <button onClick={saveProfile} disabled={saving}
                  className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </motion.div>
            )}

            {/* ── CHATS ── */}
            {section === "chats" && (
              <motion.div key="chats"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="p-5 space-y-6">

                {/* Wallpaper */}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Chat Wallpaper</p>
                  <div className="grid grid-cols-4 gap-3">
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
                            <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center text-xs text-white font-bold">✓</div>
                          </div>
                        )}
                        <p className="absolute bottom-1 left-0 right-0 text-center text-white/50 text-xs truncate px-1">{color.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Preview</p>
                  <div className="rounded-2xl p-4 border border-white/10 transition-all" style={{ background: bgColor }}>
                    <div className="flex justify-end mb-2">
                      <div className="px-3 py-2 rounded-2xl rounded-tr-sm text-white text-xs"
                        style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                        Hey! How are you? 👋
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="px-3 py-2 rounded-2xl rounded-tl-sm text-white text-xs"
                        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        I'm doing great! 😊
                      </div>
                    </div>
                  </div>
                </div>

                {/* Font size */}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Font Size</p>
                  <div className="flex gap-2">
                    {["small", "medium", "large"].map((size) => (
                      <button key={size} onClick={() => setFontSize(size)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition capitalize border ${
                          fontSize === size
                            ? "border-green-500 text-green-400"
                            : "border-white/10 text-slate-400 hover:border-white/20"
                        }`}
                        style={{ background: fontSize === size ? "rgba(37,211,102,0.1)" : "rgba(255,255,255,0.03)" }}>
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={saveChats} disabled={saving}
                  className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </motion.div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {section === "notifications" && (
              <motion.div key="notifications"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="p-5 space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Messages</p>
                {[
                  { label: "Message notifications", sub: "Show notifications for new messages", value: msgNotifs, onChange: setMsgNotifs },
                  { label: "Sound", sub: "Play sound for new messages", value: soundEnabled, onChange: setSoundEnabled },
                  { label: "Vibration", sub: "Vibrate for new messages", value: vibration, onChange: setVibration },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between px-4 py-4 rounded-xl border border-white/8"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.sub}</p>
                    </div>
                    <Toggle value={item.value} onChange={item.onChange} />
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── PRIVACY ── */}
            {section === "privacy" && (
              <motion.div key="privacy"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="p-5 space-y-5">

                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Last Seen</p>
                  <RadioGroup value={lastSeen} onChange={setLastSeen} options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "contacts", label: "My Contacts" },
                    { value: "nobody",   label: "Nobody" },
                  ]} />
                </div>

                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Online Status</p>
                  <RadioGroup value={onlineStatus} onChange={setOnlineStatus} options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "nobody",   label: "Nobody" },
                  ]} />
                </div>

                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Read Receipts</p>
                  <div className="flex items-center justify-between px-4 py-4 rounded-xl border border-white/8"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div>
                      <p className="text-sm font-medium text-white">Read receipts</p>
                      <p className="text-xs text-slate-500">Show blue ticks when messages are read</p>
                    </div>
                    <Toggle value={readReceipts} onChange={setReadReceipts} />
                  </div>
                </div>

                <button onClick={flashSaved}
                  className="w-full py-3 rounded-xl font-semibold text-white transition"
                  style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                  Save Privacy Settings
                </button>
              </motion.div>
            )}

            {/* ── ACCOUNT ── */}
            {section === "account" && (
              <motion.div key="account"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="p-5 space-y-5">

                {/* Account info */}
                <div className="px-4 py-4 rounded-xl border border-white/8 space-y-3"
                  style={{ background: "rgba(255,255,255,0.03)" }}>
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Account Info</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Email</span>
                    <span className="text-white">{user?.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Name</span>
                    <span className="text-white">{user?.name}</span>
                  </div>
                </div>

                {/* Change password */}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Change Password</p>
                  {pwError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl mb-3">
                      {pwError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <input type="password" placeholder="Current password" value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500" />
                    <input type="password" placeholder="New password" value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500" />
                    <input type="password" placeholder="Confirm new password" value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500" />
                  </div>
                  <button onClick={changePassword} disabled={saving}
                    className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50 mt-3"
                    style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                    {saving ? "Saving..." : "Change Password"}
                  </button>
                </div>

                {/* Danger zone */}
                <div className="pt-2">
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Danger Zone</p>
                  <button className="w-full py-3 rounded-xl font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition">
                    Delete Account
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── HELP ── */}
            {section === "help" && (
              <motion.div key="help"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="p-5 space-y-2">
                {[
                  { icon: "📖", label: "FAQ",            sub: "Frequently asked questions" },
                  { icon: "📧", label: "Contact Us",     sub: "Get help from our team" },
                  { icon: "🔒", label: "Privacy Policy", sub: "How we handle your data" },
                  { icon: "📜", label: "Terms of Service",sub: "Our terms and conditions" },
                  { icon: "ℹ️",  label: "About AquaChat", sub: "Version 1.0.0" },
                ].map((item) => (
                  <button key={item.label}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/8 hover:bg-white/5 transition text-left"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.sub}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
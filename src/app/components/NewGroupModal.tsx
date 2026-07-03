"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type User = {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  avatar_emoji?: string;
};

function Avatar({ user }: { user: Partial<User> }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.full_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
      style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
      {user.avatar_emoji || user.full_name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

export default function NewGroupModal({
  users,
  onClose,
  onCreated,
  mode = "create",
  conversationId,
  excludeIds = [],
}: {
  users: User[];
  onClose: () => void;
  onCreated: (result: any) => void;
  mode?: "create" | "add";
  conversationId?: string;
  excludeIds?: string[];
}) {
  const [step, setStep] = useState<"members" | "name">("members");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const filtered = users.filter(
    (u) => !excludeIds.includes(u.id) && u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function createGroup() {
    if (!groupName.trim() || selected.length === 0) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/conversations/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), member_ids: selected }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create group"); return; }
      onCreated(data.conversation);
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function addMembers() {
    if (!conversationId || selected.length === 0) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${conversationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: selected }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to add members"); return; }
      onCreated(data);
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
        style={{ background: "#111827" }}
      >
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h3 className="font-bold text-white">
            {mode === "add" ? "Add members" : step === "members" ? "Add group members" : "Name your group"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">✕</button>
        </div>

        {step === "members" ? (
          <>
            <div className="px-4 py-3 border-b border-white/5">
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 rounded-xl text-sm outline-none text-white placeholder-slate-500"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>

            <div className="overflow-y-auto max-h-72">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No users found</div>
              ) : (
                filtered.map((u) => (
                  <button key={u.id} onClick={() => toggle(u.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left">
                    <Avatar user={u} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{u.full_name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: selected.includes(u.id) ? "#25D366" : "rgba(255,255,255,0.2)",
                        background: selected.includes(u.id) ? "#25D366" : "transparent",
                      }}
                    >
                      {selected.includes(u.id) && <span className="text-white text-xs">✓</span>}
                    </div>
                  </button>
                ))
              )}
            </div>

            {error && <p className="text-red-400 text-xs px-4 pt-2">{error}</p>}

            <div className="p-4 border-t border-white/8">
              <button
                onClick={() => (mode === "add" ? addMembers() : setStep("name"))}
                disabled={selected.length === 0 || creating}
                className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
              >
                {mode === "add"
                  ? creating ? "Adding..." : `Add ${selected.length} member${selected.length !== 1 ? "s" : ""}`
                  : `Next (${selected.length} selected)`}
              </button>
            </div>
          </>
        ) : (
          <div className="p-5">
            <input
              type="text"
              autoFocus
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none text-white placeholder-slate-500 mb-4"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep("members")}
                className="flex-1 py-3 rounded-xl font-medium text-slate-400 border border-white/10 hover:border-white/20 transition"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                Back
              </button>
              <button onClick={createGroup} disabled={!groupName.trim() || creating}
                className="flex-1 py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                {creating ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
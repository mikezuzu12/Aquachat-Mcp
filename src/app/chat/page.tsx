"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import ProfileModal from "@/app/components/ProfileModal";
import SettingsModal from "@/app/components/SettingsModal";
import NewGroupModal from "@/app/components/NewGroupModal";
import CreateStatusModal from "@/app/components/CreateStatusModal";
import StatusViewer from "@/app/components/StatusViewer";

type User = {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  avatar_emoji?: string;
  bg_color?: string;
  about?: string;
  is_online: boolean;
  last_seen: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  message_type: string;
  status: string;
  reply_to?: string;
  created_at: string;
  sender?: User;
  is_view_once?: boolean;
  viewed_at?: string | null;
};

type Conversation = {
  id: string;
  name?: string;
  is_group: boolean;
  avatar_url?: string;
  last_message?: string;
  last_message_at: string;
  members?: User[];
  unread_count?: number;
};

type StatusItem = {
  id: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  bg_color?: string;
  created_at: string;
  viewed?: boolean;
};

type StatusGroup = {
  user: { id: string; full_name: string; avatar_url?: string; avatar_emoji?: string };
  statuses: StatusItem[];
  allViewed: boolean;
};

function Avatar({ user, size = "md" }: { user: Partial<User>; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-lg", md: "w-11 h-11 text-2xl", lg: "w-16 h-16 text-4xl" };
  if (user.avatar_url) {
    return (
      <img src={user.avatar_url} alt={user.full_name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0`} />
    );
  }
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
      {user.avatar_emoji || user.full_name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function MessageStatus({ status }: { status: string }) {
  if (status === "read") return <span className="text-blue-400 text-xs">✓✓</span>;
  if (status === "delivered") return <span className="text-slate-400 text-xs">✓✓</span>;
  return <span className="text-slate-500 text-xs">✓</span>;
}

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Download failed:", err);
    window.open(url, "_blank");
  }
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);

  const [activeTab, setActiveTab] = useState<"chats" | "status" | "groups">("chats");
  const [statusData, setStatusData] = useState<{ myStatuses: StatusItem[]; others: StatusGroup[] }>({ myStatuses: [], others: [] });
  const [showCreateStatus, setShowCreateStatus] = useState(false);
  const [viewingStatus, setViewingStatus] = useState<StatusGroup | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string>("");
  const [sendAsViewOnce, setSendAsViewOnce] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [viewerMsg, setViewerMsg] = useState<Message | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const [toasts, setToasts] = useState<{ id: string; name: string; avatar: Partial<User>; text: string; convId: string }[]>([]);
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const conversationsRef = useRef<Conversation[]>([]);
  const activeConvRef = useRef<Conversation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const user = session?.user as any;

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission("unsupported");
    }
  }, []);

  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchConversations();
      fetchAllUsers();
      fetchStatuses();
      setOnlineStatus(true);
    }
    return () => { setOnlineStatus(false); };
  }, [status]);

// ✅ Refresh statuses every time the status tab is opened
useEffect(() => {
  if (activeTab === "status" && status === "authenticated") {
    fetchStatuses();
  }
}, [activeTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeConv) return;

    fetchMessages(activeConv.id);

    const channel = supabase
      .channel(`messages-${activeConv.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConv.id}`,
      }, async (payload) => {
        const msg = payload.new as Message;
        const { data: sender } = await supabase
          .from("users").select("*").eq("id", msg.sender_id).single();
        setMessages((prev) => [...prev, { ...msg, sender }]);
        if (msg.sender_id !== user?.id) {
          await supabase.from("message_reads").upsert({
            message_id: msg.id,
            user_id: user?.id,
          });
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv?.id]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const channel = supabase
      .channel("conversations-realtime")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
      }, () => { fetchConversations(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const channel = supabase
      .channel("global-new-messages")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, async (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user?.id) return;

        const belongs = conversationsRef.current.some((c) => c.id === msg.conversation_id);
        if (!belongs) return;

        const isOpenAndFocused = activeConvRef.current?.id === msg.conversation_id && !document.hidden;
        if (isOpenAndFocused) return;

        const { data: sender } = await supabase
          .from("users").select("full_name, avatar_url, avatar_emoji").eq("id", msg.sender_id).single();

        const preview = msg.content || (msg.media_type === "image" ? "📷 Photo" : "📎 Attachment");
        const toastId = `${msg.id}-${Date.now()}`;

        setToasts((prev) => [...prev, {
          id: toastId,
          name: sender?.full_name || "New message",
          avatar: sender || {},
          text: preview,
          convId: msg.conversation_id,
        }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 5000);

        if (notifPermission === "granted" && document.hidden) {
          new Notification(sender?.full_name || "New message", {
            body: preview,
            icon: sender?.avatar_url || undefined,
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [status, notifPermission]);

  function openConvFromToast(convId: string) {
    const conv = conversationsRef.current.find((c) => c.id === convId);
    if (conv) {
      setActiveConv(conv);
      setShowSidebar(false);
    }
    setToasts((prev) => prev.filter((t) => t.convId !== convId));
  }

  async function setOnlineStatus(isOnline: boolean) {
    if (!user?.id) return;
    await supabase.from("users").update({
      is_online: isOnline,
      last_seen: new Date().toISOString(),
    }).eq("id", user.id);
  }

  async function fetchConversations() {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllUsers() {
    try {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, email, avatar_url, avatar_emoji, is_online, last_seen, about")
        .neq("id", user?.id);
      setAllUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  async function fetchStatuses() {
  try {
    const res = await fetch("/api/statuses");
    const data = await res.json();
    console.log("📊 Status data:", data); // ← add this
    setStatusData({ myStatuses: data.myStatuses || [], others: data.others || [] });
  } catch (error) {
    console.error("Error fetching statuses:", error);
  }
}

  async function markStatusViewed(statusId: string, ownerId: string) {
    if (ownerId === user?.id) return;
    try {
      await fetch(`/api/statuses/${statusId}/view`, { method: "POST" });
      setStatusData((prev) => ({
        ...prev,
        others: prev.others.map((g) => {
          if (g.user.id !== ownerId) return g;
          const statuses = g.statuses.map((s) => (s.id === statusId ? { ...s, viewed: true } : s));
          const allViewed = statuses.every((s) => s.viewed);
          return { ...g, statuses, allViewed };
        }),
      }));
    } catch (error) {
      console.error("Error marking status viewed:", error);
    }
  }

  function handleGroupCreated(conversation: any) {
    setShowNewGroup(false);
    fetchConversations();
    setActiveConv(conversation);
    setActiveTab("chats");
    setShowSidebar(false);
  }

  async function fetchMessages(convId: string) {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);

      if (!res.ok) {
        console.error(`Failed to fetch messages: ${res.status} ${res.statusText}`);
        setMessages([]);
        return;
      }

      const data = await res.json();
      setMessages(data.messages || []);

      const unreadFromOthers = (data.messages || []).filter(
        (m: Message) => m.sender_id !== user?.id
      );

      if (unreadFromOthers.length > 0 && user?.id) {
        const reads = unreadFromOthers.map((m: Message) => ({
          message_id: m.id,
          user_id: user.id,
        }));
        await supabase.from("message_reads").upsert(reads);
        fetchConversations();
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() && !replyTo) return;
    if (!activeConv) return;
    setSending(true);

    const content = newMessage.trim();
    setNewMessage("");
    setReplyTo(null);

    try {
      await fetch(`/api/conversations/${activeConv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          reply_to: replyTo?.id || null,
        }),
      });
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function startNewChat(otherUser: User) {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: otherUser.id }),
      });
      const data = await res.json();
      if (data.conversation) {
        await fetchConversations();
        setActiveConv(data.conversation);
        setShowNewChat(false);
        setShowSidebar(false);
      }
    } catch (error) {
      console.error("Error starting new chat:", error);
    }
  }

  function handleImageSend(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    setSendAsViewOnce(false);
    e.target.value = "";
  }

  function cancelPendingMedia() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl("");
    setSendAsViewOnce(false);
  }

  async function confirmSendMedia() {
    if (!pendingFile || !activeConv) return;
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);

      const uploadRes = await fetch("/api/upload/media", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.url) {
        console.error("Upload failed:", uploadData.error);
        return;
      }

      await fetch(`/api/conversations/${activeConv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "",
          media_url: uploadData.url,
          media_type: pendingFile.type.startsWith("image/") ? "image" : "file",
          is_view_once: sendAsViewOnce,
        }),
      });

      cancelPendingMedia();
    } catch (err) {
      console.error("Failed to send media:", err);
    } finally {
      setUploadingMedia(false);
    }
  }

  async function openViewer(msg: Message) {
    if (!msg.media_url) return;
    const isMe = msg.sender_id === user?.id;

    if (msg.is_view_once) {
      if (isMe) return;
      if (msg.viewed_at) return;

      setViewerLoading(true);
      try {
        const res = await fetch(`/api/messages/${msg.id}/view`, { method: "POST" });
        if (!res.ok) { setViewerLoading(false); return; }
        const data = await res.json();
        const updated = { ...msg, viewed_at: data.viewed_at };
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
        setViewerMsg(updated);
      } catch (error) {
        console.error("Error opening view-once:", error);
      } finally {
        setViewerLoading(false);
      }
      return;
    }

    setViewerMsg(msg);
  }

  const getConvName = (conv: Conversation) => {
    if (conv.is_group) return conv.name;
    if ((conv as any).is_bot_conversation) return conv.name || "AI Assistant";
    const other = conv.members?.find((m) => m.id !== user?.id);
    return other?.full_name || "Unknown";
  };

  const getConvAvatar = (conv: Conversation) => {
    if (conv.is_group) return null;
    return conv.members?.find((m) => m.id !== user?.id);
  };

  const filteredConversations = conversations.filter((c) =>
    getConvName(c)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabConversations = filteredConversations.filter((c) =>
    activeTab === "groups" ? c.is_group : !c.is_group
  );

  const filteredUsers = allUsers.filter((u) =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeOtherUser = activeConv ? getConvAvatar(activeConv) : null;
  const bgColor = user?.bg_color || "#0A0E1A";

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0E1A" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "#0A0E1A" }}>

      <AnimatePresence>
        {(showSidebar || typeof window !== "undefined" && window.innerWidth >= 768) && (
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            className="w-full md:w-[380px] flex-shrink-0 flex flex-col border-r border-white/8 z-20 md:relative absolute inset-y-0 left-0"
            style={{ background: "#111827" }}
          >
            <div className="flex items-center gap-3 relative px-3 pt-3 pb-1">
                <button onClick={() => setShowMenu(!showMenu)} className="relative">
                  <Avatar user={{ ...user, avatar_emoji: user?.avatar_emoji }} size="md" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-gray-800" />
                </button>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="font-bold text-white text-sm">{user?.full_name || user?.name || "AquaChat"}</span>
                  <span className="text-xs text-slate-500">AquaChat</span>
                </div>
                <AnimatePresence>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-12 left-0 w-48 rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-40"
                        style={{ background: "#1a2332" }}
                      >
                        <button onClick={() => { setShowProfile(true); setShowMenu(false); }}
                          className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition flex items-center gap-2">
                          👤 Profile
                        </button>
                        <button onClick={() => { setShowSettings(true); setShowMenu(false); }}
                          className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition flex items-center gap-2 border-t border-white/5">
                          ⚙️ Settings
                        </button>
                        <button onClick={() => signOut({ callbackUrl: "/login" })}
                          className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition flex items-center gap-2 border-t border-white/5">
                          🚪 Log out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              <div className="flex items-center gap-1 ml-auto">
                {notifPermission !== "granted" && notifPermission !== "unsupported" && (
                  <button onClick={requestNotifPermission}
                    className="p-2 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white"
                    title="Enable notifications">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                )}
                {activeTab !== "status" && (
                  <button
                    onClick={() => (activeTab === "groups" ? setShowNewGroup(true) : setShowNewChat(true))}
                    className="p-2 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white"
                    title={activeTab === "groups" ? "New group" : "New chat"}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex px-3 pt-1 pb-2 gap-1">
              {(["chats", "status", "groups"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition"
                  style={{
                    background: activeTab === tab ? "rgba(37,211,102,0.15)" : "transparent",
                    color: activeTab === tab ? "#25D366" : "#94a3b8",
                  }}>
                  {tab === "chats" ? "💬 Chats" : tab === "status" ? "⭐ Status" : "👥 Groups"}
                </button>
              ))}
            </div>

            <div className="px-3 py-2 border-b border-white/5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search or start new chat"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition placeholder-slate-500 text-white"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeTab === "status" ? (
                <div className="px-2 py-2">
                  <div
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 rounded-xl transition text-left cursor-pointer"
                    onClick={() => {
                      if (statusData.myStatuses.length > 0) {
                        setViewingStatus({
                          user: { id: user.id, full_name: user.full_name || user.name, avatar_url: user.avatar_url, avatar_emoji: user.avatar_emoji },
                          statuses: statusData.myStatuses,
                          allViewed: true,
                        });
                      } else {
                        setShowCreateStatus(true);
                      }
                    }}
                  >
                    <div className="relative">
                      <Avatar user={user} size="md" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowCreateStatus(true); }}
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white border-2 border-gray-900"
                        style={{ background: "#25D366" }}>+</button>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">My Status</p>
                      <p className="text-xs text-slate-400">
                        {statusData.myStatuses.length > 0 ? "Tap to view your status" : "Tap to add status update"}
                      </p>
                    </div>
                  </div>

                  {statusData.others.length > 0 && (
                    <>
                      <p className="text-xs text-slate-500 font-semibold px-3 pt-4 pb-2 uppercase tracking-wide">Recent updates</p>
                      {statusData.others.map((g) => (
                        <button key={g.user.id} onClick={() => setViewingStatus(g)}
                          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 rounded-xl transition text-left">
                          <div className="w-12 h-12 rounded-full p-0.5"
                            style={{ background: g.allViewed ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg, #25D366, #128C7E)" }}>
                            <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center">
                              <Avatar user={g.user} size="md" />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{g.user.full_name}</p>
                            <p className="text-xs text-slate-400">{formatTime(g.statuses[g.statuses.length - 1].created_at)}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {statusData.myStatuses.length === 0 && statusData.others.length === 0 && (
                    <div className="text-center py-12 px-4">
                      <div className="text-4xl mb-3">⭐</div>
                      <p className="text-slate-400 text-sm font-medium">No status updates</p>
                    </div>
                  )}
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : tabConversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-4xl mb-3">{activeTab === "groups" ? "👥" : "💬"}</div>
                  <p className="text-slate-400 text-sm font-medium">
                    {activeTab === "groups" ? "No groups yet" : "No conversations yet"}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {activeTab === "groups" ? "Create a group to chat with multiple people" : "Click the edit icon to start a new chat"}
                  </p>
                  {activeTab === "groups" && (
                    <button onClick={() => setShowNewGroup(true)}
                      className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
                      style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                      Create a group
                    </button>
                  )}
                </div>
              ) : (
                tabConversations.map((conv) => {
                  const convUser = getConvAvatar(conv);
                  const isActive = activeConv?.id === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => { setActiveConv(conv); setShowSidebar(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left border-b border-white/3"
                      style={{ background: isActive ? "rgba(37,211,102,0.08)" : undefined }}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar user={convUser || { full_name: conv.name, avatar_emoji: "👥" }} size="md" />
                        {convUser?.is_online && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-gray-900" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-semibold text-white truncate">{getConvName(conv)}</p>
                          <p className="text-xs text-slate-500 flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-400 truncate">{conv.last_message || "No messages yet"}</p>
                          {conv.unread_count ? (
                            <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                              {conv.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0" style={{ background: bgColor }}>

        {activeConv ? (
          <>
            <div className="px-4 py-3 flex items-center gap-3 border-b border-white/8 flex-shrink-0"
              style={{ background: "rgba(17,24,39,0.95)" }}>
              <button onClick={() => setShowSidebar(true)}
                className="md:hidden p-1 text-slate-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>

              <div className="relative flex-shrink-0">
                <Avatar user={activeOtherUser || { full_name: activeConv.name, avatar_emoji: "👥" }} size="md" />
                {activeOtherUser?.is_online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-gray-900" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white text-sm">{getConvName(activeConv)}</p>
                  {(activeConv as any).is_bot_conversation && (
                    <button
                      onClick={async () => {
                        const newName = prompt("Give your AI assistant a name:", getConvName(activeConv));
                        if (newName?.trim()) {
                          await fetch(`/api/conversations/${activeConv.id}/rename`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: newName.trim() }),
                          });
                          fetchConversations();
                          setActiveConv({ ...activeConv, name: newName.trim() });
                        }
                      }}
                      className="text-xs text-slate-500 hover:text-green-400 transition"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {activeConv.is_group
                    ? `${activeConv.members?.length || ""} members`
                    : activeOtherUser?.is_online ? (
                      <span className="text-green-400">online</span>
                    ) : activeOtherUser?.last_seen ? (
                      `last seen ${formatTime(activeOtherUser.last_seen)}`
                    ) : "offline"}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {activeConv.is_group && (
                  <button onClick={() => setShowAddMembers(true)}
                    className="p-2 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white" title="Add members">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
                <button className="p-2 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
                <button className="p-2 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-5xl mb-3">👋</div>
                    <p className="text-slate-400 text-sm">Say hello to {getConvName(activeConv)}!</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_id === user?.id;
                  const showAvatar = !isMe && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);

                  const isViewOnce = !!msg.is_view_once;
                  const isConsumed = isViewOnce && !!msg.viewed_at;

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      {!isMe && (
                        <div className="w-8 flex-shrink-0">
                          {showAvatar && <Avatar user={msg.sender || {}} size="sm" />}
                        </div>
                      )}

                      <div className={`group max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {!isMe && activeConv.is_group && showAvatar && (
                          <p className="text-xs text-green-400 font-medium px-1 mb-0.5">{msg.sender?.full_name}</p>
                        )}
                        {msg.reply_to && (
                          <div className={`text-xs px-3 py-1.5 rounded-xl mb-1 border-l-2 border-green-400 ${
                            isMe ? "bg-white/10" : "bg-black/20"
                          } text-slate-400 max-w-full truncate`}>
                            Replying to a message
                          </div>
                        )}

                        <div
                          onDoubleClick={() => setReplyTo(msg)}
                          className={`px-3 py-2 rounded-2xl text-sm cursor-pointer ${
                            isMe ? "rounded-br-sm text-white" : "rounded-bl-sm text-white"
                          }`}
                          style={{
                            background: isMe
                              ? "linear-gradient(135deg, #25D366, #128C7E)"
                              : "rgba(255,255,255,0.1)",
                            border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {msg.media_url && msg.media_type === "image" && (
                            isViewOnce ? (
                              isConsumed ? (
                                <div className="flex items-center gap-2 px-1 py-1 opacity-60 select-none">
                                  <span>🔥</span>
                                  <span className="text-xs italic">Opened</span>
                                </div>
                              ) : isMe ? (
                                <div className="flex items-center gap-2 px-1 py-1 select-none">
                                  <span>🔥</span>
                                  <span className="text-xs italic">Photo · view once</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openViewer(msg)}
                                  disabled={viewerLoading}
                                  className="flex items-center gap-2 px-1 py-1"
                                >
                                  <span>🔥</span>
                                  <span className="text-xs font-medium">Tap to view photo</span>
                                </button>
                              )
                            ) : (
                              <img
                                src={msg.media_url}
                                alt="media"
                                onClick={() => openViewer(msg)}
                                className="max-w-xs rounded-xl mb-1 object-cover cursor-pointer hover:opacity-90 transition"
                              />
                            )
                          )}
                          {msg.content && <p className="leading-relaxed">{msg.content}</p>}
                        </div>

                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <p className="text-xs text-slate-500">{formatTime(msg.created_at)}</p>
                          {isMe && <MessageStatus status={msg.status} />}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <AnimatePresence>
              {replyTo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mx-4 px-4 py-2 rounded-t-xl border border-white/10 flex items-center justify-between"
                  style={{ background: "rgba(37,211,102,0.1)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1 h-8 rounded-full bg-green-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-green-400 font-medium">
                        {replyTo.sender_id === user?.id ? "You" : replyTo.sender?.full_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{replyTo.content}</p>
                    </div>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-white ml-2 flex-shrink-0">✕</button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
              style={{ background: "rgba(17,24,39,0.95)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={() => fileRef.current?.click()}
                className="p-2.5 rounded-full hover:bg-white/10 transition text-slate-400 hover:text-white flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleImageSend} />

              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none transition text-white placeholder-slate-500"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
              />

              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="p-2.5 rounded-full transition disabled:opacity-40 flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-sm"
            >
              <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl mx-auto mb-6"
                style={{ background: "rgba(37,211,102,0.1)", border: "2px solid rgba(37,211,102,0.2)" }}>
                💬
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">AquaChat</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Send and receive messages with friends and family. Click a conversation to start chatting.
              </p>
              <button
                onClick={() => setShowNewChat(true)}
                className="px-6 py-3 rounded-2xl font-semibold text-white transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
              >
                Start a new chat
              </button>
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showNewChat && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
              onClick={() => setShowNewChat(false)}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
              style={{ background: "#111827" }}
            >
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                <h3 className="font-bold text-white">New Chat</h3>
                <button onClick={() => setShowNewChat(false)} className="text-slate-400 hover:text-white transition">✕</button>
              </div>

              <div className="px-4 py-3 border-b border-white/5">
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl text-sm outline-none text-white placeholder-slate-500"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>

              <div className="overflow-y-auto max-h-72">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">No users found</div>
                ) : (
                  filteredUsers.map((u) => (
                    <button key={u.id} onClick={() => startNewChat(u)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left">
                      <div className="relative">
                        <Avatar user={u} size="md" />
                        {u.is_online && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-gray-900" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{u.full_name}</p>
                        <p className="text-xs text-slate-400">{u.about || u.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewGroup && (
          <NewGroupModal
            users={allUsers}
            onClose={() => setShowNewGroup(false)}
            onCreated={handleGroupCreated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddMembers && activeConv && (
          <NewGroupModal
            users={allUsers}
            mode="add"
            conversationId={activeConv.id}
            excludeIds={(activeConv.members || []).map((m) => m.id)}
            onClose={() => setShowAddMembers(false)}
            onCreated={() => { setShowAddMembers(false); fetchConversations(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateStatus && (
          <CreateStatusModal
            onClose={() => setShowCreateStatus(false)}
            onCreated={() => { setShowCreateStatus(false); fetchStatuses(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingStatus && (
          <StatusViewer
            user={viewingStatus.user}
            statuses={viewingStatus.statuses}
            onClose={() => setViewingStatus(null)}
            onViewed={(id) => markStatusViewed(id, viewingStatus.user.id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingFile && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50"
              onClick={() => !uploadingMedia && cancelPendingMedia()}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
              style={{ background: "#111827" }}
            >
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                <h3 className="font-bold text-white">Send media</h3>
                <button onClick={() => !uploadingMedia && cancelPendingMedia()} className="text-slate-400 hover:text-white transition">✕</button>
              </div>

              <div className="p-5">
                {pendingFile.type.startsWith("image/") ? (
                  <img src={pendingPreviewUrl} alt="preview" className="w-full max-h-80 object-contain rounded-2xl mb-4 bg-black" />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center rounded-2xl mb-4 bg-white/5 text-slate-400 text-sm">
                    📎 {pendingFile.name}
                  </div>
                )}

                <button
                  onClick={() => setSendAsViewOnce((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition mb-5"
                  style={{
                    borderColor: sendAsViewOnce ? "#25D366" : "rgba(255,255,255,0.1)",
                    background: sendAsViewOnce ? "rgba(37,211,102,0.1)" : "rgba(255,255,255,0.03)",
                  }}
                >
                  <span className="flex items-center gap-2 text-sm text-white">
                    🔥 Send as view once
                  </span>
                  <div
                    className="w-10 h-6 rounded-full relative transition-colors"
                    style={{ background: sendAsViewOnce ? "#25D366" : "rgba(255,255,255,0.15)" }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                      style={{ transform: sendAsViewOnce ? "translateX(18px)" : "translateX(2px)" }}
                    />
                  </div>
                </button>

                <div className="flex gap-3">
                  <button onClick={cancelPendingMedia} disabled={uploadingMedia}
                    className="flex-1 py-3 rounded-xl font-medium text-slate-400 border border-white/10 hover:border-white/20 transition disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    Cancel
                  </button>
                  <button onClick={confirmSendMedia} disabled={uploadingMedia}
                    className="flex-1 py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                    {uploadingMedia ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewerMsg && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 z-[60]"
              onClick={() => setViewerMsg(null)}
            />
            <motion.div
              key="content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[61] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <button onClick={() => setViewerMsg(null)}
                  className="p-2 rounded-full hover:bg-white/10 transition text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {!viewerMsg.is_view_once && (
                  <button
                    onClick={() => downloadFile(viewerMsg.media_url!, `aquachat-media-${viewerMsg.id}.jpg`)}
                    className="p-2 rounded-full hover:bg-white/10 transition text-white flex items-center gap-2 px-4"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    <span className="text-sm font-medium">Download</span>
                  </button>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center px-4 pb-6" onClick={(e) => e.stopPropagation()}>
                <img src={viewerMsg.media_url} alt="media" className="max-w-full max-h-full object-contain rounded-lg" />
              </div>

              {viewerMsg.is_view_once && (
                <div className="text-center pb-6 text-slate-400 text-xs">
                  🔥 This photo disappears after you close it
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 w-full max-w-xs px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              onClick={() => openConvFromToast(t.convId)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 shadow-2xl text-left"
              style={{ background: "#1a2332" }}
            >
              <Avatar user={t.avatar} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                <p className="text-xs text-slate-400 truncate">{t.text}</p>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
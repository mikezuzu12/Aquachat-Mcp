"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function NotificationBell({ onOpenConv }: { onOpenConv?: (convId: string) => void }) {
  const { data: session, status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const ref = useRef<HTMLDivElement>(null);
  const user = session?.user as any;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function fetchUnread() {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/messages/unread");
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
      setUnreadByConv(data.unreadByConv || {});
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }

  useEffect(() => {
    if (status === "authenticated") fetchUnread();
  }, [status]);

  // Poll every 10 seconds
  useEffect(() => {
    if (status !== "authenticated") return;
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [status]);

  // Real-time: refresh on new messages
  useEffect(() => {
    if (status !== "authenticated" || !user?.id) return;

    const channel = supabase
      .channel("unread-counter")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== user.id) {
          fetchUnread();
        }
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "message_reads",
      }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [status, user?.id]);

  if (status !== "authenticated") return null;

  const convEntries = Object.entries(unreadByConv);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchUnread(); }}
        className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ background: "#111827" }}
          >
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Unread Messages</h3>
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto">
              {convEntries.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-sm text-slate-400">All caught up!</p>
                </div>
              ) : (
                convEntries.map(([convId, count]) => (
                  <button
                    key={convId}
                    onClick={() => {
                      onOpenConv?.(convId);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition border-b border-white/5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                        style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                        💬
                      </div>
                      <p className="text-sm text-white font-medium">
                        {count} unread message{count > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-xs text-green-400 font-bold">{count}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
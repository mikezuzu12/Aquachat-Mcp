"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Caller {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  avatar_emoji?: string | null;
}

interface IncomingCallModalProps {
  caller: Caller;
  isVideo: boolean;
  onAccept: () => void;
  onReject: () => void;
}

function Avatar({ user, size = "lg" }: { user: Caller; size?: "md" | "lg" }) {
  const sizes = { md: "w-14 h-14 text-2xl", lg: "w-24 h-24 text-5xl" };
  
  if (user?.avatar_url) {
    return (
      <img 
        src={user.avatar_url} 
        alt={user.full_name} 
        className={`${sizes[size]} rounded-full object-cover`} 
      />
    );
  }
  
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center text-white`}
      style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}
    >
      {user?.avatar_emoji || user?.full_name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

export default function IncomingCallModal({ 
  caller, 
  isVideo, 
  onAccept, 
  onReject 
}: IncomingCallModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-xl"
      onClick={onReject}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 p-8 text-center"
        style={{ background: "#111827" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Avatar with ringing animation */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-ping opacity-30" 
              style={{ background: "rgba(37,211,102,0.5)" }} 
            />
            <div className="absolute -inset-4 rounded-full animate-ping opacity-20 delay-150" 
              style={{ background: "rgba(37,211,102,0.3)" }} 
            />
            <Avatar user={caller} size="lg" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">{caller.full_name}</h2>
            <p className="text-slate-400 text-sm mt-1">
              Incoming {isVideo ? "video" : "voice"} call...
            </p>
          </div>

          <div className="flex items-center gap-6 mt-4">
            {/* Reject button */}
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl bg-red-500 hover:bg-red-600 transition shadow-lg">
                📵
              </div>
              <span className="text-xs text-slate-400">Decline</span>
            </button>

            {/* Accept button */}
            <button
              onClick={onAccept}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl hover:opacity-90 transition shadow-lg"
                style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}
              >
                {isVideo ? "🎥" : "📞"}
              </div>
              <span className="text-xs text-slate-400">Accept</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
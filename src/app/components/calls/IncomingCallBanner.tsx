import { motion } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────

interface Caller {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  avatar_emoji?: string | null;
}

interface IncomingCall {
  callId: string;
  caller: Caller;
  isVideo: boolean;
}

interface IncomingCallBannerProps {
  call: IncomingCall | null;
  onAccept: () => void;
  onReject: () => void;
}

// ── Components ────────────────────────────────────────────────────────────

function Avatar({ user }: { user: Caller }) {
  if (user?.avatar_url) {
    return (
      <img 
        src={user.avatar_url} 
        alt={user.full_name} 
        className="w-14 h-14 rounded-full object-cover" 
      />
    );
  }
  
  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl text-white"
      style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}
    >
      {user?.avatar_emoji || user?.full_name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

/**
 * IncomingCallBanner — a compact top-of-screen banner for an incoming call.
 * Mount this once alongside useIncomingCalls (e.g. in App.jsx) so it can
 * appear over any screen, not just an open chat.
 *
 * Props:
 *   call: { callId, caller: { id, full_name, avatar_url?, avatar_emoji? }, isVideo }
 *   onAccept: () => void
 *   onReject: () => void
 */
export default function IncomingCallBanner({ 
  call, 
  onAccept, 
  onReject 
}: IncomingCallBannerProps) {
  if (!call) return null;
  
  const { caller, isVideo } = call;

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="fixed top-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-[90] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
      style={{ background: "#111827" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex-shrink-0">
          <div 
            className="absolute inset-0 rounded-full animate-ping opacity-20" 
            style={{ background: "rgba(37,211,102,0.5)" }} 
          />
          <Avatar user={caller} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {caller?.full_name || "Unknown"}
          </p>
          <p className="text-xs text-slate-400">
            Incoming {isVideo ? "video" : "voice"} call...
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onReject}
            title="Decline"
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-red-500 hover:bg-red-600 transition"
          >
            📵
          </button>
          <button
            onClick={onAccept}
            title="Accept"
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}
          >
            {isVideo ? "🎥" : "📞"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useWebRTC } from "@/hooks/useWebRTC"; // ← Changed from @/services/ to @/hooks/

interface User {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  avatar_emoji?: string | null;
}

interface CallProps {
  callId: string;
  isVideo: boolean;
  isCaller: boolean;
  remoteUser: User;
}

interface CallScreenProps {
  call: CallProps;
  userId: string;
  onEnd: () => void;
}

function Avatar({ user, size = "lg" }: { user?: User | null; size?: "md" | "lg" }) {
  const sizes = { md: "w-20 h-20 text-4xl", lg: "w-32 h-32 text-6xl" };
  
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallScreen({ call, userId, onEnd }: CallScreenProps) {
  const { callId, isVideo, isCaller, remoteUser } = call;

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [callState, setCallState] = useState<"ringing" | "active" | "ended">("ringing");

  const {
    localStream,
    remoteStream,
    isConnected,
    isMuted,
    isCameraOff,
    error,
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useWebRTC({
    callId,
    userId,
    remoteUserId: remoteUser.id,
    isCaller,
    isVideo,
    onCallEnded: () => { 
      setCallState("ended"); 
      setTimeout(onEnd, 1500); 
    },
  });

  // Set local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Caller kicks off the offer
  useEffect(() => {
    if (isCaller) {
      startCall();
    }
  }, []);

  // Start duration timer when connected
  useEffect(() => {
    if (!isConnected) return;
    setCallState("active");
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const handleEnd = async () => {
    await endCall();
    setCallState("ended");
    setTimeout(onEnd, 1500);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />

      {/* Remote video (full screen) */}
      {isVideo && remoteStream && (
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-80" 
        />
      )}

      <div className="relative z-10 flex flex-col items-center justify-between w-full h-full py-16 px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="relative"
          >
            {callState === "ringing" && (
              <>
                <div 
                  className="absolute inset-0 rounded-full animate-ping opacity-30" 
                  style={{ background: "rgba(37,211,102,0.5)" }} 
                />
                <div 
                  className="absolute -inset-4 rounded-full animate-ping opacity-20 delay-150" 
                  style={{ background: "rgba(37,211,102,0.3)" }} 
                />
              </>
            )}
            {/* Show avatar if not video OR if video but not connected yet */}
            {(!isVideo || !remoteStream) && <Avatar user={remoteUser} size="lg" />}
          </motion.div>

          <div>
            <h2 className="text-2xl font-bold text-white">{remoteUser.full_name}</h2>
            <p className="text-slate-300 text-sm mt-1">
              {callState === "ringing" && (isCaller ? "Calling..." : "Incoming call...")}
              {callState === "active" && formatDuration(duration)}
              {callState === "ended" && "Call ended"}
            </p>
            {error && <p className="text-red-400 text-xs mt-1 max-w-xs">{error}</p>}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">
              {isVideo ? "🎥 Video call" : "📞 Voice call"}
            </span>
            {isConnected && (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* Local video (picture-in-picture) */}
        {isVideo && localStream && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-20 right-4 w-32 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
          >
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover" 
            />
            {isCameraOff && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <span className="text-3xl">📷</span>
              </div>
            )}
          </motion.div>
        )}

        <div className="flex flex-col items-center gap-6 w-full">
          {callState !== "ended" && (
            <div className="flex items-center gap-6">
              <button 
                onClick={toggleMute} 
                className="flex flex-col items-center gap-2"
              >
                <div 
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${
                    isMuted ? "bg-white text-black" : "bg-white/20 text-white"
                  }`}
                >
                  {isMuted ? "🔇" : "🎙️"}
                </div>
                <span className="text-xs text-slate-400">
                  {isMuted ? "Unmute" : "Mute"}
                </span>
              </button>

              <button 
                onClick={handleEnd} 
                className="flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl bg-red-500 hover:bg-red-600 transition shadow-lg">
                  📵
                </div>
                <span className="text-xs text-slate-400">End</span>
              </button>

              {isVideo && (
                <button 
                  onClick={toggleCamera} 
                  className="flex flex-col items-center gap-2"
                >
                  <div 
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${
                      isCameraOff ? "bg-white text-black" : "bg-white/20 text-white"
                    }`}
                  >
                    {isCameraOff ? "📷" : "🎥"}
                  </div>
                  <span className="text-xs text-slate-400">
                    {isCameraOff ? "Cam on" : "Cam off"}
                  </span>
                </button>
              )}

              {!isVideo && (
                <button className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl bg-white/20 text-white">
                    🔊
                  </div>
                  <span className="text-xs text-slate-400">Speaker</span>
                </button>
              )}
            </div>
          )}

          {callState === "ended" && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-center"
            >
              <div className="text-5xl mb-3">📵</div>
              <p className="text-white font-semibold">Call ended</p>
              <p className="text-slate-400 text-sm">{formatDuration(duration)}</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
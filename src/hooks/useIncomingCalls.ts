import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { updateCallStatus } from "../services/callService"; // ← Fixed import path

export function useIncomingCalls(userId: string) { // ← Added type for userId
  const [incomingCall, setIncomingCall] = useState<any>(null); // ← Added type
  const [activeCall, setActiveCall] = useState<any>(null); // ← Added type

  const activeCallRef = useRef(activeCall);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  // ── Global listener for incoming calls ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`incoming-calls-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `receiver_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new;
          if (call.status !== "ringing") return;

          // Already on a call → auto-decline as missed instead of interrupting.
          if (activeCallRef.current) {
            try {
              await updateCallStatus(call.id, "missed");
            } catch (err) {
              console.error("Failed to auto-mark call as missed:", err);
            }
            return;
          }

          const { data: caller } = await supabase
            .from("users")
            .select("id, full_name, avatar_url, avatar_emoji")
            .eq("id", call.caller_id)
            .single();

          setIncomingCall({
            callId: call.id,
            caller: caller || { id: call.caller_id, full_name: "Unknown" },
            isVideo: call.type === "video",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Caller side: kick off a new outgoing call and make it the active call. */
  const startCall = useCallback((callId: string, isVideo: boolean, remoteUser: any) => {
    setActiveCall({ callId, isVideo, isCaller: true, remoteUser });
  }, []);

  /** Receiver side: accept the current incoming call. */
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      await updateCallStatus(incomingCall.callId, "active");
    } catch (err) {
      console.error("Failed to accept call:", err);
    }
    setActiveCall({
      callId: incomingCall.callId,
      isVideo: incomingCall.isVideo,
      isCaller: false,
      remoteUser: incomingCall.caller,
    });
    setIncomingCall(null);
  }, [incomingCall]);

  /** Receiver side: reject the current incoming call. */
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      await updateCallStatus(incomingCall.callId, "rejected");
    } catch (err) {
      console.error("Failed to reject call:", err);
    }
    setIncomingCall(null);
  }, [incomingCall]);

  /** Either side: clear the active call once it's over. */
  const endActiveCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  return {
    incomingCall,
    activeCall,
    startCall,
    acceptCall,
    rejectCall,
    endActiveCall,
  };
}
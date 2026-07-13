import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

interface SignalData {
  callId: string;
  fromUserId: string;
  toUserId: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'end';
  payload: any;
}

// ── Call Management ──────────────────────────────────────────────────────

/**
 * Initiate a new call
 */
export async function initiateCall({ 
  conversationId, 
  callerId, 
  receiverId, 
  type 
}: {
  conversationId: string;
  callerId: string;
  receiverId: string;
  type: 'voice' | 'video';
}) {
  try {
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationId,
        caller_id: callerId,
        receiver_id: receiverId,
        type,
      }),
    });
    
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to initiate call");
    }
    return data.call;
  } catch (error) {
    console.error("Error initiating call:", error);
    throw error;
  }
}

/**
 * Update a call's status: 'active' | 'ended' | 'missed' | 'rejected'.
 */
export async function updateCallStatus(callId: string, status: string) {
  try {
    if (!callId) {
      throw new Error("Call ID is required");
    }

    const res = await fetch("/api/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call_id: callId, status }),
    });
    
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to update call");
    }
    return data.call;
  } catch (error) {
    console.error("Error updating call status:", error);
    throw error;
  }
}

/**
 * Fetch call history for a conversation (most recent first).
 */
export async function getCallHistory(conversationId: string) {
  try {
    if (!conversationId) {
      throw new Error("Conversation ID is required");
    }

    const res = await fetch(`/api/calls?conversation_id=${conversationId}`);
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to fetch call history");
    }
    return data.calls || [];
  } catch (error) {
    console.error("Error fetching call history:", error);
    return [];
  }
}

// ── Signaling (call_signals table) ──────────────────────────────────────────

/**
 * Send a WebRTC signal (offer / answer / ice-candidate / end) to the other party.
 */
export async function sendCallSignal({ 
  callId, 
  fromUserId, 
  toUserId, 
  type, 
  payload 
}: SignalData) {
  try {
    if (!callId || !fromUserId || !toUserId) {
      throw new Error("Missing required fields for call signal");
    }

    const { error } = await supabase.from("call_signals").insert({
      call_id: callId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      type,
      payload,
    });
    if (error) throw error;
  } catch (error) {
    console.error("Error sending call signal:", error);
    throw error;
  }
}

/**
 * Subscribe to signals for a given call.
 * Returns an unsubscribe function.
 */
export function subscribeToCallSignals(
  callId: string, 
  currentUserId: string, 
  onSignal: (signal: any) => void
) {
  if (!callId || !currentUserId) {
    console.error("Missing callId or currentUserId for subscription");
    return () => {};
  }

  const channel = supabase
    .channel(`call-signals-${callId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "call_signals",
        filter: `call_id=eq.${callId}`,
      },
      (payload) => {
        const signal = payload.new;
        if (signal.from_user_id === currentUserId) return;
        onSignal(signal);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
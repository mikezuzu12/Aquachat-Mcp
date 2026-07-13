import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// POST - Start a new call
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { conversation_id, caller_id, receiver_id, type } = await req.json();

    // Verify the caller is the authenticated user
    if (caller_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create the call
    const { data: call, error } = await supabaseAdmin
      .from("calls")
      .insert({
        conversation_id,
        caller_id,
        receiver_id,
        type,
        status: "ringing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating call:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, call });
  } catch (error) {
    console.error("Error in POST /api/calls:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update call status
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { call_id, status } = await req.json();

    console.log("PATCH /api/calls - call_id:", call_id);
    console.log("PATCH /api/calls - status:", status);

    if (!call_id) {
      return NextResponse.json({ error: "call_id is required" }, { status: 400 });
    }

    // Verify the user is part of the call
    const { data: call, error: callError } = await supabaseAdmin
      .from("calls")
      .select("caller_id, receiver_id, started_at")
      .eq("id", call_id)
      .single();

    console.log("PATCH /api/calls - found call:", call);

    if (callError || !call) {
      console.error("Call not found:", callError);
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (call.caller_id !== user.id && call.receiver_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the call status
    const updateData: any = { status };
    
    // If status is active or ended, set ended_at
    if (status === "active" || status === "ended" || status === "missed" || status === "rejected") {
      updateData.ended_at = new Date().toISOString();
      
      // Calculate duration if started_at exists
      if (call.started_at) {
        const start = new Date(call.started_at).getTime();
        const end = new Date().getTime();
        updateData.duration_seconds = Math.floor((end - start) / 1000);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("calls")
      .update(updateData)
      .eq("id", call_id);

    if (updateError) {
      console.error("Error updating call:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, call: { id: call_id, ...updateData } });
  } catch (error) {
    console.error("Error in PATCH /api/calls:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - Fetch call history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversation_id");

    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id is required" }, { status: 400 });
    }

    // Get call history
    const { data: calls, error: callsError } = await supabaseAdmin
      .from("calls")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("started_at", { ascending: false })
      .limit(50);

    if (callsError) {
      console.error("Error fetching calls:", callsError);
      return NextResponse.json({ error: callsError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, calls });
  } catch (error) {
    console.error("Error in GET /api/calls:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
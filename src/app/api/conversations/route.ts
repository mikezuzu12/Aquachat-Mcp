import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { data: memberships } = await supabaseAdmin
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (!memberships?.length) return NextResponse.json({ conversations: [] });

  const convIds = memberships.map((m) => m.conversation_id);

  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .in("id", convIds)
    .order("last_message_at", { ascending: false });

  const enriched = await Promise.all((conversations || []).map(async (conv) => {
    const { data: members } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id, users(id, full_name, email, avatar_url, avatar_emoji, is_online, last_seen, about)")
      .eq("conversation_id", conv.id);

    // ✅ Get all messages in this conversation NOT sent by me
    const { data: otherMessages } = await supabaseAdmin
      .from("messages")
      .select("id")
      .eq("conversation_id", conv.id)
      .neq("sender_id", user.id);

    let unread_count = 0;
    if (otherMessages?.length) {
      const messageIds = otherMessages.map((m) => m.id);

      // Get which of those I've already read
      const { data: reads } = await supabaseAdmin
        .from("message_reads")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", messageIds);

      const readIds = new Set((reads || []).map((r) => r.message_id));
      unread_count = messageIds.filter((id) => !readIds.has(id)).length;
    }

    return {
      ...conv,
      members: members?.map((m: any) => m.users) || [],
      unread_count,
    };
  }));

  return NextResponse.json({ conversations: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { user_id: otherUserId } = await req.json();

  if (!otherUserId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  if (otherUserId === user.id) {
    return NextResponse.json({ error: "Cannot start a conversation with yourself" }, { status: 400 });
  }

  try {
    // Check if a 1:1 conversation already exists between these two users
    const { data: myMemberships } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    const myConvIds = (myMemberships || []).map((m) => m.conversation_id);

    if (myConvIds.length) {
      const { data: sharedMemberships } = await supabaseAdmin
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", otherUserId)
        .in("conversation_id", myConvIds);

      if (sharedMemberships?.length) {
        // Reuse the first shared conversation found
        const existingConvId = sharedMemberships[0].conversation_id;

        const { data: existingConv, error: fetchErr } = await supabaseAdmin
          .from("conversations")
          .select("*")
          .eq("id", existingConvId)
          .single();

        if (!fetchErr && existingConv) {
          const { data: members } = await supabaseAdmin
            .from("conversation_members")
            .select("user_id, users(id, full_name, email, avatar_url, avatar_emoji, is_online, last_seen, about)")
            .eq("conversation_id", existingConvId);

          return NextResponse.json({
            conversation: {
              ...existingConv,
              members: members?.map((m: any) => m.users) || [],
              unread_count: 0,
            },
          });
        }
      }
    }

    // No existing conversation — create a new one
    const { data: newConv, error: createErr } = await supabaseAdmin
      .from("conversations")
      .insert({})
      .select()
      .single();

    if (createErr || !newConv) {
      console.error("Error creating conversation:", createErr);
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    const { error: memberErr } = await supabaseAdmin
      .from("conversation_members")
      .insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: otherUserId },
      ]);

    if (memberErr) {
      console.error("Error adding conversation members:", memberErr);
      return NextResponse.json({ error: "Failed to add members" }, { status: 500 });
    }

    const { data: members } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id, users(id, full_name, email, avatar_url, avatar_emoji, is_online, last_seen, about)")
      .eq("conversation_id", newConv.id);

    return NextResponse.json({
      conversation: {
        ...newConv,
        members: members?.map((m: any) => m.users) || [],
        unread_count: 0,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/conversations:", error);
    return NextResponse.json({ error: "Failed to start conversation" }, { status: 500 });
  }
}
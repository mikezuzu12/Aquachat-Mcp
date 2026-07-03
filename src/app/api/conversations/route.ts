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
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  // Get all conversations this user is in
  const { data: memberships } = await supabaseAdmin
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (!memberships?.length) return NextResponse.json({ unreadCount: 0, unreadByConv: {} });

  const convIds = memberships.map((m) => m.conversation_id);

  // Get all messages in those conversations NOT sent by this user
  const { data: allMessages } = await supabaseAdmin
    .from("messages")
    .select("id, conversation_id")
    .in("conversation_id", convIds)
    .neq("sender_id", user.id);

  if (!allMessages?.length) return NextResponse.json({ unreadCount: 0, unreadByConv: {} });

  const messageIds = allMessages.map((m) => m.id);

  // Get which ones have been read
  const { data: readReceipts } = await supabaseAdmin
    .from("message_reads")
    .select("message_id")
    .eq("user_id", user.id)
    .in("message_id", messageIds);

  const readIds = new Set((readReceipts || []).map((r) => r.message_id));

  // Count unread per conversation
  const unreadByConv: Record<string, number> = {};
  let unreadCount = 0;

  for (const msg of allMessages) {
    if (!readIds.has(msg.id)) {
      unreadByConv[msg.conversation_id] = (unreadByConv[msg.conversation_id] || 0) + 1;
      unreadCount++;
    }
  }

  return NextResponse.json({ unreadCount, unreadByConv });
}
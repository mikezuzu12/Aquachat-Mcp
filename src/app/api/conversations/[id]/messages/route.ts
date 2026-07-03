import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { generateBotReply } from "@/lib/botReply";

// ✅ ADD THIS GET HANDLER
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { id } = await params;

    // Verify user is a member of this conversation
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      console.error("Membership check error:", memberError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Get messages
    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("GET messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Your existing POST handler stays here
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  const { id } = await params;
  const { content, reply_to, media_url, media_type, is_view_once } = await req.json();

  const { data: message } = await supabaseAdmin
    .from("messages")
    .insert([{
      conversation_id: id,
      sender_id: user.id,
      content,
      reply_to: reply_to || null,
      media_url: media_url || null,
      media_type: media_type || null,
      message_type: media_type || "text",
      status: "sent",
      is_view_once: is_view_once || false,
    }])
    .select().single();

  await supabaseAdmin.from("conversations").update({
    last_message: content || "📎 Media",
    last_message_at: new Date().toISOString(),
  }).eq("id", id);

  // ✅ If this is the bot conversation, generate and insert a reply
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("is_bot_conversation")
    .eq("id", id)
    .single();

  if (conv?.is_bot_conversation && content?.trim()) {
    const { data: bot } = await supabaseAdmin
      .from("users").select("id").eq("is_bot", true).limit(1).maybeSingle();

    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("sender_id, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(20);

    const formattedHistory = (history || [])
      .filter((m) => m.content?.trim())
      .map((m) => ({
        role: (m.sender_id === bot?.id ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      }));

    try {
      const botText = await generateBotReply(formattedHistory);

      await supabaseAdmin.from("messages").insert([{
        conversation_id: id,
        sender_id: bot!.id,
        content: botText,
        message_type: "text",
        status: "sent",
      }]);

      await supabaseAdmin.from("conversations").update({
        last_message: botText,
        last_message_at: new Date().toISOString(),
      }).eq("id", id);
    } catch (err) {
      console.error("Bot reply failed:", err);
    }
  }

  return NextResponse.json({ message });
}
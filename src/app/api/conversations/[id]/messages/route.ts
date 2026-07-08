import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { generateBotReply } from "@/lib/botReply";

// GET handler - fetch messages
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

    // Get messages with sender info
    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get sender info for each message
    const userIds = [...new Set(messages?.map(m => m.sender_id) || [])];
    let usersMap: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, full_name, avatar_url, avatar_emoji, is_online")
        .in("id", userIds);
      
      if (users) {
        usersMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {});
      }
    }

    const messagesWithSenders = messages?.map(m => ({
      ...m,
      sender: usersMap[m.sender_id] || null
    })) || [];

    return NextResponse.json({ messages: messagesWithSenders });
  } catch (error) {
    console.error("GET messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST handler - send message
export async function POST(
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
    const { content, reply_to, media_url, media_type, is_view_once } = await req.json();

    // Check if this is a bot conversation
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("is_bot_conversation")
      .eq("id", id)
      .single();

    // Insert user message
    const { data: message, error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: user.id,
        content,
        reply_to: reply_to || null,
        media_url: media_url || null,
        media_type: media_type || null,
        message_type: media_type || "text",
        status: "sent",
        is_view_once: is_view_once || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Message insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update conversation last message
    await supabaseAdmin
      .from("conversations")
      .update({
        last_message: content || "📎 Media",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", id);

    // If this is a bot conversation and has content, generate bot reply
    if (conv?.is_bot_conversation && content?.trim()) {
      const { data: bot } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("is_bot", true)
        .limit(1)
        .maybeSingle();

      if (bot) {
        // Get conversation history
        // Get conversation history — limit to last 10 messages only
const { data: history } = await supabaseAdmin
  .from("messages")
  .select("sender_id, content")
  .eq("conversation_id", id)
  .order("created_at", { ascending: false }) // ← newest first
  .limit(10);

// Reverse to get chronological order, format correctly
const formattedHistory = (history || [])
  .reverse() // ← back to oldest first
  .filter((m) => m.content?.trim())
  .map((m) => ({
    role: (m.sender_id === bot.id ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));

// ✅ Make sure last message is always from user
const lastEntry = formattedHistory[formattedHistory.length - 1];
if (!lastEntry || lastEntry.role !== "user") {
  formattedHistory.push({ role: "user", content });
}

const botText = await generateBotReply(formattedHistory, user.id);

       // Inside the POST handler, when generating bot reply
try {
  const botText = await generateBotReply(formattedHistory, user.id);
  console.log("🤖 Bot response:", botText);

  // Insert bot response
  const { data: botMessage, error: botError } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: bot.id,
      content: botText,
      message_type: "text",
      status: "sent",
    })
    .select()
    .single();

  if (botError) {
    console.error("Bot message insert error:", botError);
  } else {
    // Update conversation with bot's last message
    await supabaseAdmin
      .from("conversations")
      .update({
        last_message: botText,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", id);
  }
} catch (err) {
  console.error("Bot reply generation failed:", err);
}
      }
    }

    // Get sender info for the response
    const { data: sender } = await supabaseAdmin
      .from("users")
      .select("id, full_name, avatar_url, avatar_emoji")
      .eq("id", user.id)
      .single();

    return NextResponse.json({ 
      message: {
        ...message,
        sender: sender || null
      }
    });
  } catch (error) {
    console.error("POST message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
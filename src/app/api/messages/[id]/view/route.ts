import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { generateBotReply } from "@/lib/botReply";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const { id } = await params;
  const { content } = await req.json();

  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  }

  try {
    // Get user's language preference
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("language")
      .eq("id", user.id)
      .single();

    const userLanguage = userData?.language || "en";

    // Get conversation history
    const { data: messages } = await supabaseAdmin
      .from("messages")
      .select("content, sender_id")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(10);

    const history = messages?.map((msg: any): { role: "user" | "assistant"; content: string } => ({
      role: msg.sender_id === user.id ? "user" : "assistant",
      content: String(msg.content),
    })) || [];

    // Add the new user message
    history.push({ role: "user", content: String(content) });

    // Generate bot reply with user's language
    const botText = await generateBotReply(
      history,
      user.id,
      userLanguage
    );

    // Save bot message
    const { error: saveError } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: null,
        content: botText,
      });

    if (saveError) {
      console.error("Error saving bot message:", saveError);
      return NextResponse.json({ error: "Failed to save bot message" }, { status: 500 });
    }

    return NextResponse.json({ 
      reply: botText,
      language: userLanguage 
    });

  } catch (error) {
    console.error("Error in message route:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
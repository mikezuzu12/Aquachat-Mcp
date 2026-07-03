import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  const { data: existing } = await supabaseAdmin
    .from("users").select("id").eq("email", email).maybeSingle();

  if (existing) return NextResponse.json({ error: "Email already registered." }, { status: 400 });

  const password_hash = await bcrypt.hash(password, 12);

  const { error } = await supabaseAdmin.from("users").insert([{
    full_name: name, email, password_hash,
  }]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ✅ Auto-create a conversation with the AI Assistant bot
  try {
    const { data: newUser } = await supabaseAdmin
      .from("users").select("id").eq("email", email).single();

    const { data: bot } = await supabaseAdmin
      .from("users").select("id").eq("is_bot", true).limit(1).maybeSingle();

    if (newUser && bot) {
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .insert([{
          is_group: false,
          is_bot_conversation: true,
          last_message: "Hi! I'm your AI Assistant. Ask me anything 👋",
          last_message_at: new Date().toISOString(),
        }])
        .select().single();

      await supabaseAdmin.from("conversation_members").insert([
        { conversation_id: conv.id, user_id: newUser.id },
        { conversation_id: conv.id, user_id: bot.id },
      ]);

      await supabaseAdmin.from("messages").insert([{
        conversation_id: conv.id,
        sender_id: bot.id,
        content: "Hi! I'm your AI Assistant. Ask me anything 👋",
        message_type: "text",
        status: "sent",
      }]);
    }
  } catch (botErr) {
    // Don't fail registration if bot setup fails
    console.error("Bot conversation setup failed:", botErr);
  }

  return NextResponse.json({ success: true });
}
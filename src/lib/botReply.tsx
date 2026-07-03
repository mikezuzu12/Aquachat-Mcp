import Groq from "groq-sdk";
import { supabaseAdmin } from "./supabaseAdmin";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export async function generateBotReply(
  conversationHistory: { role: "user" | "assistant"; content: string }[]
) {
  try {
    console.log("🤖 Generating bot reply with Groq...");
    console.log("🔑 Groq API key exists:", !!process.env.GROQ_API_KEY);

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are a friendly AI assistant inside AquaChat, a messaging app.
Keep replies conversational, helpful, and concise — like a real chat message.
Be warm and engaging but not too long.`,
        },
        ...conversationHistory,
      ],
    });

    return (
      response.choices[0]?.message?.content ||
      "Sorry, I couldn't think of a reply."
    );
  } catch (error: any) {
    console.error("Bot generation error:", error?.message);
    return "I'm having trouble thinking right now. Try again in a moment!";
  }
}
import Groq from "groq-sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchWebWithContext } from "@/lib/webSearch";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

// Fallback chain: try the best tool-calling model first, drop down if it's
// unavailable/decommissioned on Groq's end. Check console.groq.com/docs/models
// for the current list if you hit "model not found" errors.
const MODEL_CANDIDATES = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

// ---- Tool definitions (what the model is allowed to call) ----
const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_online_users",
      description: "Get the list of users currently online in AquaChat",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_contacts",
      description:
        "Get the current user's contacts (people they share a conversation with)",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Search the web for current information, facts, news, or anything outside AquaChat's own data (not for AquaChat features or user data).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
];

// ---- Tool implementations ----
async function runTool(name: string, args: any, userId?: string): Promise<string> {
  try {
    switch (name) {
      case "get_online_users": {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("full_name")
          .eq("is_online", true)
          .limit(10);
        if (error) return "Couldn't check online users right now.";
        return data?.length
          ? `Online users: ${data.map((u) => u.full_name).join(", ")}`
          : "No users are currently online.";
      }

      case "get_my_contacts": {
        if (!userId) return "No user context available.";

        const { data: memberships, error: memErr } = await supabaseAdmin
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", userId);
        if (memErr) return "Couldn't fetch contacts right now.";
        if (!memberships?.length) return "You don't have any contacts yet.";

        const convIds = memberships.map((m) => m.conversation_id);
        const { data: contacts, error: contactErr } = await supabaseAdmin
          .from("conversation_members")
          .select(`user:users(id, full_name, is_online)`)
          .in("conversation_id", convIds)
          .neq("user_id", userId);
        if (contactErr) return "Couldn't fetch contacts right now.";

        const unique = new Map<string, any>();
        contacts?.forEach((c: any) => {
          if (c.user && !unique.has(c.user.id)) unique.set(c.user.id, c.user);
        });
        const list = Array.from(unique.values());
        return list.length
          ? `You have ${list.length} contacts: ${list
              .map((u) => u.full_name)
              .join(", ")}`
          : "You don't have any contacts yet.";
      }

      case "search_web": {
        const query = args?.query?.trim();
        if (!query) return "No search query provided.";
        return await searchWebWithContext(query, "");
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    console.error(`Tool "${name}" failed:`, err);
    return `The ${name} tool failed to run.`;
  }
}

const SYSTEM_PROMPT = `You are AquaBot, a helpful AI assistant inside AquaChat — a real-time messaging app.

IMPORTANT RULES:
- ALWAYS directly answer the user's actual question
- NEVER repeat the same response twice
- For football/sports questions, answer them directly from your knowledge
- For "who are my contacts" — use the get_my_contacts tool
- For "who's online" — use the get_online_users tool  
- For current events/news — use the search_web tool
- For your name: say "I'm AquaBot, your AI assistant in AquaChat"
- Keep replies short (2-4 sentences) and conversational

NEVER say "Hello! Is there something I can help you with" — just answer the question directly.`;

async function createCompletion(messages: any[]) {
  let lastErr: any;
  for (const model of MODEL_CANDIDATES) {
    try {
      return await groq.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.9,      // ← increase from 0.7 to 0.9
        max_tokens: 500,
        frequency_penalty: 0.8, // ← add this — stops repeating phrases
        presence_penalty: 0.6,  // ← add this — encourages new topics
      });
    } catch (err) {
      console.error(`Groq call failed on model ${model}:`, err);
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function generateBotReply(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  userId?: string
) {
  if (!process.env.GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY is not set");
    return "I'm not configured properly. Please add your Groq API key. 🙏";
  }

  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
  ];

  try {
    let response = await createCompletion(messages);
    let choice = response.choices[0].message;

    let rounds = 0;
    while (choice.tool_calls?.length && rounds < 3) {
      messages.push(choice);

      for (const call of choice.tool_calls) {
        let args: any = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          // malformed args from the model — proceed with empty args
        }
        const result = await runTool(call.function.name, args, userId);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      response = await createCompletion(messages);
      choice = response.choices[0].message;
      rounds++;
    }

    return choice.content?.trim() || "Sorry, I couldn't think of a reply.";
  } catch (error) {
    console.error("❌ Bot error:", error);

    const lastMsg =
      conversationHistory[conversationHistory.length - 1]?.content?.toLowerCase() || "";
    if (lastMsg.includes("hi") || lastMsg.includes("hello")) {
      return "Hello! 👋 How can I help you with AquaChat today?";
    }
    return "I'm having trouble thinking right now. Please try again in a moment! 🙏";
  }
}
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Define all tools with detailed descriptions
const tools: Tool[] = [
  {
    name: "get_system_info",
    description: "Get information about the AquaChat system including architecture, features, and capabilities",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_user_info",
    description: "Get detailed information about a user by their ID, email, or name",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The user's UUID" },
        email: { type: "string", description: "The user's email address" },
        name: { type: "string", description: "The user's full name (partial search)" },
      },
    },
  },
  {
    name: "get_my_contacts",
    description: "Get all contacts that the current user has conversations with",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The current user's ID" },
      },
      required: ["userId"],
    },
  },
  {
    name: "search_messages",
    description: "Search for messages containing specific text across all conversations",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for" },
        conversationId: { type: "string", description: "Optional: search within specific conversation" },
        userId: { type: "string", description: "Optional: search messages from a specific user" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_conversation_history",
    description: "Get full conversation history between two users",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "The conversation ID" },
        userId: { type: "string", description: "Optional: get history for a specific user" },
        contactId: { type: "string", description: "Optional: get history with a specific contact" },
        limit: { type: "number", description: "Number of messages to return (default: 50)" },
      },
    },
  },
  {
    name: "get_user_conversations",
    description: "Get all conversations for a specific user with contact details",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The user's ID" },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_online_users",
    description: "Get all currently online users with their details",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_user_status",
    description: "Get status updates from a specific user or all contacts",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Optional: get status from specific user" },
        getContacts: { type: "boolean", description: "Get statuses from all contacts" },
      },
    },
  },
  {
    name: "get_conversation_participants",
    description: "Get all participants in a conversation",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "The conversation ID" },
      },
      required: ["conversationId"],
    },
  },
  {
    name: "get_recent_activity",
    description: "Get recent activity across the system",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID to get activity for" },
        limit: { type: "number", description: "Number of activities (default: 20)" },
      },
      required: ["userId"],
    },
  },
];

// System information about AquaChat
const SYSTEM_INFO = {
  name: "AquaChat",
  version: "1.0.0",
  description: "A WhatsApp-like messaging application built with Next.js, Supabase, and NextAuth",
  features: [
    "Real-time messaging with Supabase Realtime",
    "Direct and group chats",
    "End-to-end encrypted messages",
    "View-once media (like WhatsApp)",
    "Status updates (stories)",
    "Profile customization with avatars and emojis",
    "Online/offline presence",
    "Message read receipts",
    "Typing indicators",
    "Media sharing (images, videos, files)",
    "Reply to specific messages",
    "Toast and browser notifications",
    "AI Assistant with MCP integration",
  ],
  techStack: {
    frontend: "Next.js 16, React 19, Tailwind CSS, Framer Motion",
    backend: "Next.js API Routes, Supabase PostgreSQL",
    auth: "NextAuth.js (Email/Password)",
    realtime: "Supabase Realtime",
    ai: "Claude API (Anthropic) with MCP",
    storage: "Supabase Storage",
  },
  databaseTables: [
    "users - User profiles and authentication",
    "conversations - Chat conversations (direct and groups)",
    "conversation_members - Users in conversations",
    "messages - All chat messages with media support",
    "message_reads - Read receipts for messages",
    "statuses - User status updates (stories)",
    "status_views - Who viewed each status",
  ],
};

// Tool handler with system understanding
async function handleToolCall(toolName: string, args: any) {
  switch (toolName) {
    case "get_system_info": {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(SYSTEM_INFO, null, 2),
          },
        ],
      };
    }

    case "get_user_info": {
      const { userId, email, name } = args;
      let query = supabaseAdmin.from("users").select("*");

      if (userId) query = query.eq("id", userId);
      if (email) query = query.eq("email", email);
      if (name) query = query.ilike("full_name", `%${name}%`);

      const { data, error } = await query.limit(name ? 10 : 1);

      if (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data || { error: "User not found" }, null, 2),
          },
        ],
      };
    }

    case "get_my_contacts": {
      const { userId } = args;

      // Get all conversations the user is in
      const { data: memberships } = await supabaseAdmin
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId);

      if (!memberships?.length) {
        return {
          content: [{ type: "text", text: JSON.stringify({ contacts: [], message: "No contacts found" }) }],
        };
      }

      const convIds = memberships.map((m) => m.conversation_id);

      // Get all members of those conversations except the user
      const { data: contacts } = await supabaseAdmin
        .from("conversation_members")
        .select(`
          conversation_id,
          user:users(
            id, 
            full_name, 
            email, 
            avatar_url, 
            avatar_emoji,
            is_online,
            last_seen,
            about
          )
        `)
        .in("conversation_id", convIds)
        .neq("user_id", userId);

      // Deduplicate contacts
      const contactMap = new Map();
      contacts?.forEach((c: any) => {
        if (c.user && !contactMap.has(c.user.id)) {
          contactMap.set(c.user.id, c.user);
        }
      });

      const uniqueContacts = Array.from(contactMap.values());

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              contacts: uniqueContacts,
              count: uniqueContacts.length,
            }, null, 2),
          },
        ],
      };
    }

    case "search_messages": {
      const { query, conversationId, userId } = args;

      let dbQuery = supabaseAdmin
        .from("messages")
        .select(`
          *,
          sender:users(id, full_name, email, avatar_url)
        `)
        .ilike("content", `%${query}%`);

      if (conversationId) {
        dbQuery = dbQuery.eq("conversation_id", conversationId);
      }
      if (userId) {
        dbQuery = dbQuery.eq("sender_id", userId);
      }

      const { data, error } = await dbQuery.limit(50);

      if (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              messages: data || [],
              count: data?.length || 0,
            }, null, 2),
          },
        ],
      };
    }

    case "get_conversation_history": {
      const { conversationId, userId, contactId, limit = 50 } = args;

      let query = supabaseAdmin
        .from("messages")
        .select(`
          *,
          sender:users(id, full_name, email, avatar_url)
        `);

      if (conversationId) {
        query = query.eq("conversation_id", conversationId);
      } else if (userId && contactId) {
        // Find conversation between two users
        const { data: convData } = await supabaseAdmin
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", userId);

        const convIds = convData?.map((c: any) => c.conversation_id) || [];

        if (convIds.length > 0) {
          const { data: contactConv } = await supabaseAdmin
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", contactId)
            .in("conversation_id", convIds);

          const matchedConv = contactConv?.[0]?.conversation_id;
          if (matchedConv) {
            query = query.eq("conversation_id", matchedConv);
          } else {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "No conversation found" }) }],
            };
          }
        }
      } else {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Need conversationId or userId + contactId" }) }],
        };
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              messages: data || [],
              count: data?.length || 0,
            }, null, 2),
          },
        ],
      };
    }

    case "get_user_conversations": {
      const { userId } = args;

      const { data: memberships } = await supabaseAdmin
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId);

      if (!memberships?.length) {
        return {
          content: [{ type: "text", text: JSON.stringify({ conversations: [] }) }],
        };
      }

      const convIds = memberships.map((m) => m.conversation_id);

      const { data, error } = await supabaseAdmin
        .from("conversations")
        .select(`
          *,
          members:conversation_members(
            user:users(
              id, 
              full_name, 
              email, 
              avatar_url, 
              avatar_emoji,
              is_online,
              last_seen
            )
          )
        `)
        .in("id", convIds)
        .order("last_message_at", { ascending: false });

      if (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        };
      }

      // Format conversations with contact info
      const formatted = data?.map((conv: any) => {
        const members = conv.members?.map((m: any) => m.user) || [];
        const otherMembers = members.filter((m: any) => m.id !== userId);
        return {
          ...conv,
          participants: otherMembers,
          participant_count: members.length,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              conversations: formatted || [],
              count: formatted?.length || 0,
            }, null, 2),
          },
        ],
      };
    }

    case "get_online_users": {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email, avatar_url, avatar_emoji, about, last_seen")
        .eq("is_online", true);

      if (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              online_users: data || [],
              count: data?.length || 0,
            }, null, 2),
          },
        ],
      };
    }

    case "get_user_status": {
      const { userId, getContacts } = args;

      if (userId) {
        // Get status from specific user
        const { data, error } = await supabaseAdmin
          .from("statuses")
          .select("*")
          .eq("user_id", userId)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (error) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(data || [], null, 2) }],
        };
      }

      if (getContacts) {
        // Get all statuses from contacts (simplified)
        const { data, error } = await supabaseAdmin
          .from("statuses")
          .select(`
            *,
            user:users(id, full_name, avatar_url, avatar_emoji)
          `)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false });

        if (error) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(data || [], null, 2) }],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Need userId or getContacts=true" }) }],
      };
    }

    case "get_conversation_participants": {
      const { conversationId } = args;

      const { data, error } = await supabaseAdmin
        .from("conversation_members")
        .select(`
          user:users(
            id, 
            full_name, 
            email, 
            avatar_url, 
            avatar_emoji,
            is_online,
            about
          )
        `)
        .eq("conversation_id", conversationId);

      if (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        };
      }

      const participants = data?.map((m: any) => m.user) || [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              participants,
              count: participants.length,
            }, null, 2),
          },
        ],
      };
    }

    case "get_recent_activity": {
      const { userId, limit = 20 } = args;

      // Get recent messages from all conversations the user is in
      const { data: memberships } = await supabaseAdmin
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId);

      if (!memberships?.length) {
        return {
          content: [{ type: "text", text: JSON.stringify({ activities: [] }) }],
        };
      }

      const convIds = memberships.map((m) => m.conversation_id);

      const { data, error } = await supabaseAdmin
        .from("messages")
        .select(`
          *,
          sender:users(id, full_name, email, avatar_url)
        `)
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              recent_messages: data || [],
              count: data?.length || 0,
            }, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Start MCP Server
export async function startMcpServer() {
  const server = new Server(
    {
      name: "aquachat-mcp-server",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return await handleToolCall(name, args);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("✅ AquaChat MCP Server started successfully");
  console.error(`📦 ${tools.length} tools available`);
}

// Auto-start if run directly
if (require.main === module) {
  startMcpServer().catch(console.error);
}
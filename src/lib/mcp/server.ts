import "@/lib/env";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { z } from "zod";

// Define tools
const tools: Tool[] = [
  {
    name: "get_user_info",
    description: "Get information about a user by their ID or email",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The user's ID" },
        email: { type: "string", description: "The user's email" },
      },
    },
  },
  {
    name: "search_messages",
    description: "Search for messages containing specific text",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for" },
        conversationId: { type: "string", description: "Optional conversation ID" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_conversation_history",
    description: "Get conversation history",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        limit: { type: "number" },
      },
      required: ["conversationId"],
    },
  },
  {
    name: "get_user_conversations",
    description: "Get user conversations",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_online_users",
    description: "Get online users",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Tool handler
async function handleToolCall(toolName: string, args: any) {
  switch (toolName) {
    case "get_user_info": {
      const { userId, email } = args;

      let query = supabaseAdmin.from("users").select("*");

      if (userId) query = query.eq("id", userId);
      if (email) query = query.eq("email", email);

      const { data } = await query.maybeSingle();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data || { error: "User not found" }, null, 2),
          },
        ],
      };
    }

    case "search_messages": {
      const { query, conversationId } = args;

      let dbQuery = supabaseAdmin
        .from("messages")
        .select("*, sender:users(full_name, email, avatar_url)")
        .ilike("content", `%${query}%`);

      if (conversationId) {
        dbQuery = dbQuery.eq("conversation_id", conversationId);
      }

      const { data } = await dbQuery.limit(20);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data || [], null, 2),
          },
        ],
      };
    }

    case "get_conversation_history": {
      const { conversationId, limit = 50 } = args;

      const { data } = await supabaseAdmin
        .from("messages")
        .select("*, sender:users(full_name, email, avatar_url)")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data || [], null, 2),
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
          content: [{ type: "text", text: "[]" }],
        };
      }

      const convIds = memberships.map((m) => m.conversation_id);

      const { data } = await supabaseAdmin
        .from("conversations")
        .select("*, members:conversation_members(user:users(*))")
        .in("id", convIds);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data || [], null, 2),
          },
        ],
      };
    }

    case "get_online_users": {
      const { data } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email, avatar_url, avatar_emoji, about")
        .eq("is_online", true);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data || [], null, 2),
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
      version: "1.0.0",
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

  console.error("MCP Server started successfully");
}
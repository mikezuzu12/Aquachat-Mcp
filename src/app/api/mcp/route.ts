import { NextRequest, NextResponse } from "next/server";
import { startMcpServer } from "@/lib/mcp/server";

let serverInstance: any = null;

export async function GET(req: NextRequest) {
  try {
    if (!serverInstance) {
      serverInstance = await startMcpServer();
    }
    
    return NextResponse.json({
      status: "running",
      version: "2.0.0",
      tools: [
        "get_system_info",
        "get_user_info", 
        "get_my_contacts",
        "search_messages",
        "get_conversation_history",
        "get_user_conversations",
        "get_online_users",
        "get_user_status",
        "get_conversation_participants",
        "get_recent_activity"
      ],
      message: "AquaChat MCP Server is running. The AI bot now understands the full system!"
    });
  } catch (error) {
    console.error("MCP Server error:", error);
    return NextResponse.json(
      { error: "MCP Server failed to start" },
      { status: 500 }
    );
  }
}
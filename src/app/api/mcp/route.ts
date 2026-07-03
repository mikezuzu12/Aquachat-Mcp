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
      tools: ["get_user_info", "search_messages", "get_conversation_history", "get_user_conversations", "get_online_users"]
    });
  } catch (error) {
    console.error("MCP Server error:", error);
    return NextResponse.json(
      { error: "MCP Server failed to start" },
      { status: 500 }
    );
  }
}
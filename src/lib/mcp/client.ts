import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ListToolsResultSchema,
  CallToolResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

export class McpClient {
  private client: Client;
  private transport: StdioClientTransport;

  constructor() {
    this.transport = new StdioClientTransport({
      command: "node",
      args: ["dist/lib/mcp/server.js"],
    });

    this.client = new Client(
      {
        name: "aquachat-mcp-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  async connect() {
    await this.client.connect(this.transport);
  }

  async listTools() {
    const result = await this.client.request(
      { method: "tools/list" },
      ListToolsResultSchema
    );
    return result;
  }

  async callTool(toolName: string, args: any) {
    const result = await this.client.request(
      {
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      },
      CallToolResultSchema
    );
    return result;
  }

  async listResources() {
    const result = await this.client.request(
      { method: "resources/list" },
      ListResourcesResultSchema
    );
    return result;
  }

  async readResource(uri: string) {
    const result = await this.client.request(
      {
        method: "resources/read",
        params: { uri },
      },
      ReadResourceResultSchema
    );
    return result;
  }

  async disconnect() {
    await this.client.close();
  }
}
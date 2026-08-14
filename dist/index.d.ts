#!/usr/bin/env node
import { McpServer, type McpHttpHandler } from "@modelcontextprotocol/server";
import { z } from "zod";
interface ToolHandler {
    description: string;
    inputSchema: z.ZodType<unknown>;
    handler: (args: unknown) => Promise<unknown>;
}
interface ResourceHandler {
    name: string;
    description: string;
    mimeType: string;
    handler: (uri: string) => Promise<string>;
}
interface ServerState {
    projectPath: string | null;
    editorConnected: boolean;
    editorPort: number;
}
declare const state: ServerState;
declare const tools: Map<string, ToolHandler>;
declare const resources: Map<string, ResourceHandler>;
export { tools, resources, state };
export type { ToolHandler, ResourceHandler, ServerState };
/**
 * Build one protocol server instance. MCP v2 calls this factory once per HTTP
 * request (or connection for stdio), while the Godot editor bridge remains a
 * deliberately process-scoped connection shared by all instances.
 */
export declare function createGodotMcpServer(registry?: Map<string, ToolHandler>): McpServer;
/** Create the MCP v2 HTTP handler with stateless legacy compatibility. */
export declare function createGodotHttpHandler(): McpHttpHandler;
//# sourceMappingURL=index.d.ts.map
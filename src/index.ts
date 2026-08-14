#!/usr/bin/env node

import { createServer, type Server as HttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { McpServer, createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { registerSceneTools } from "./tools/scene-tools.js";
import { registerScriptTools } from "./tools/script-tools.js";
import { registerEditorTools } from "./tools/editor-tools.js";
import { registerShaderTools } from "./tools/shader-tools.js";
import { registerResourceTools } from "./tools/resource-tools.js";
import { registerDocsTools } from "./tools/docs-tools.js";
import { registerUIThemeTools } from "./tools/ui-theme-tools.js";
import { registerUIComponentTools } from "./tools/ui-component-tools.js";
import { registerUILayoutTools } from "./tools/ui-layout-tools.js";
import { registerAnimationTools } from "./tools/animation-tools.js";
import { registerInputTools } from "./tools/input-tools.js";
import { registerAudioTools } from "./tools/audio-tools.js";
import { registerNavigationTools } from "./tools/navigation-tools.js";
import {
  isMutatingToolName,
  requiresEditorBridgeConnection,
  usesEditorBridgeTool,
} from "./utils/tool-metadata.js";

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

interface CliOptions {
  transport: "stdio" | "http";
  httpPort: number;
  projectPath: string;
  editorPort: number;
}

const state: ServerState = {
  projectPath: process.cwd(),
  editorConnected: false,
  editorPort: 6550,
};

const tools: Map<string, ToolHandler> = new Map();
const resources: Map<string, ResourceHandler> = new Map();

registerSceneTools(tools, state);
registerScriptTools(tools, state);
registerEditorTools(tools, state);
registerShaderTools(tools, state);
registerResourceTools(tools, state);
registerAnimationTools(tools, state);
registerInputTools(tools, state);
registerAudioTools(tools, state);
registerNavigationTools(tools, state);
registerUIThemeTools(tools, state);
registerUIComponentTools(tools, state);
registerUILayoutTools(tools, state);
registerDocsTools(tools, state);

export { tools, resources, state };
export type { ToolHandler, ResourceHandler, ServerState };

/**
 * Build one protocol server instance. MCP v2 calls this factory once per HTTP
 * request (or connection for stdio), while the Godot editor bridge remains a
 * deliberately process-scoped connection shared by all instances.
 */
export function createGodotMcpServer(
  registry: Map<string, ToolHandler> = tools
): McpServer {
  const server = new McpServer({ name: "godot-mcp", version: "0.2.0" });

  for (const [name, tool] of registry) {
    server.registerTool(
      name,
      {
        description: formatToolDescription(name, tool.description),
        inputSchema: tool.inputSchema,
      },
      async (args) => {
        try {
          const result = await tool.handler(args);
          const response = {
            content: [
              {
                type: "text" as const,
                text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
              },
            ],
          };

          if (isPlainObject(result)) {
            return { ...response, structuredContent: result };
          }

          return response;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}

/** Create the MCP v2 HTTP handler with stateless legacy compatibility. */
export function createGodotHttpHandler(): McpHttpHandler {
  return createMcpHandler(() => createGodotMcpServer(), {
    legacy: "stateless",
    responseMode: "auto",
    onerror: (error) => console.error("MCP HTTP error:", error),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatToolDescription(name: string, description: string): string {
  const notes = [
    `Purpose: ${description}`,
    `Operation: ${!isMutatingToolName(name) ? "Read-only" : "May modify files or editor state"}`,
  ];

  if (requiresEditorBridgeConnection(name)) {
    notes.push("Prerequisite: Requires an active Godot AI Bridge connection (`godot_connect`).");
  }

  if (!usesEditorBridgeTool(name)) {
    notes.push("Path scope: File operations are restricted to the configured project root.");
  }

  notes.push("Behavior: Inputs are schema-validated before execution.");
  return notes.join("\n");
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    transport: "stdio",
    httpPort: 3000,
    projectPath: process.cwd(),
    editorPort: 6550,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project" && args[i + 1]) {
      options.projectPath = path.resolve(args[++i]);
    } else if (args[i] === "--port" && args[i + 1]) {
      options.editorPort = parsePort(args[++i], "--port");
    } else if (args[i] === "--transport" && args[i + 1]) {
      const transport = args[++i];
      if (transport !== "stdio" && transport !== "http") {
        throw new Error("--transport must be either 'stdio' or 'http'");
      }
      options.transport = transport;
    } else if (args[i] === "--http-port" && args[i + 1]) {
      options.httpPort = parsePort(args[++i], "--http-port");
    }
  }

  return options;
}

function parsePort(value: string, option: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${option} must be an integer between 1 and 65535`);
  }
  return port;
}

async function validateProject(projectPath: string): Promise<void> {
  await fs.access(projectPath).catch(() => {
    throw new Error(`Project path does not exist: ${projectPath}`);
  });

  try {
    await fs.access(path.join(projectPath, "project.godot"));
  } catch {
    console.error(`Warning: No project.godot found in ${projectPath}`);
    console.error("This directory may not be a Godot project. Tools may not work as expected.");
  }
}

async function startHttpServer(port: number): Promise<{ server: HttpServer; handler: McpHttpHandler }> {
  const handler = createGodotHttpHandler();
  const nodeHandler = toNodeHandler(handler);
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();

  const server = createServer(async (request, response) => {
    if (request.url !== "/mcp") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    if (!validateHost(request, response) || !validateOrigin(request, response)) {
      return;
    }

    await nodeHandler(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  return { server, handler };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  state.projectPath = options.projectPath;
  state.editorPort = options.editorPort;
  await validateProject(options.projectPath);

  console.error("Godot MCP server running");
  console.error(`Project path: ${state.projectPath}`);
  console.error(`Editor port: ${state.editorPort}`);

  if (options.transport === "http") {
    const { server, handler } = await startHttpServer(options.httpPort);
    console.error(`MCP transport: stateless HTTP at http://127.0.0.1:${options.httpPort}/mcp`);

    const close = async () => {
      await handler.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    };
    process.once("SIGINT", () => void close());
    process.once("SIGTERM", () => void close());
    return;
  }

  serveStdio(() => createGodotMcpServer());
  console.error("MCP transport: stdio (2025 and 2026-07-28 protocol eras)");
}

const isMainModule = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isMainModule) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

import { TscnParser } from "./parsers/tscn-parser.js";
import { registerSceneTools } from "./tools/scene-tools.js";
import { registerScriptTools } from "./tools/script-tools.js";
import { registerEditorTools } from "./tools/editor-tools.js";
import { registerShaderTools } from "./tools/shader-tools.js";
import { registerResourceTools } from "./tools/resource-tools.js";
import { registerDocsTools } from "./tools/docs-tools.js";
import { registerUIThemeTools } from "./tools/ui-theme-tools.js";
import { registerUIComponentTools } from "./tools/ui-component-tools.js";
import { registerUILayoutTools } from "./tools/ui-layout-tools.js";

// Tool registry
interface ToolHandler {
  description: string;
  inputSchema: z.ZodType<unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

const tools: Map<string, ToolHandler> = new Map();

// Resource registry
interface ResourceHandler {
  name: string;
  description: string;
  mimeType: string;
  handler: (uri: string) => Promise<string>;
}

const resources: Map<string, ResourceHandler> = new Map();

// Server state
interface ServerState {
  projectPath: string | null;
  editorConnected: boolean;
  editorPort: number;
}

const state: ServerState = {
  projectPath: process.cwd(),
  editorConnected: false,
  editorPort: 6550,
};

// Export for tools to use
export { tools, resources, state };
export type { ToolHandler, ResourceHandler, ServerState };

// Create MCP server
const server = new Server(
  {
    name: "godot-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Register tools from modules
registerSceneTools(tools, state);
registerScriptTools(tools, state);
registerEditorTools(tools, state);
registerShaderTools(tools, state);
registerResourceTools(tools, state);
registerDocsTools(tools, state);
registerUIThemeTools(tools, state);
registerUIComponentTools(tools, state);
registerUILayoutTools(tools, state);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolList = Array.from(tools.entries()).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema:
      tool.inputSchema instanceof z.ZodObject
        ? zodToJsonSchema(tool.inputSchema)
        : { type: "object", properties: {} },
  }));

  return { tools: toolList };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = tools.get(name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const validatedArgs = tool.inputSchema.parse(args);
    const result = await tool.handler(validatedArgs);

    return {
      content: [
        {
          type: "text",
          text:
            typeof result === "string" ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Handle resource listing
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resourceList = Array.from(resources.entries()).map(([uri, resource]) => ({
    uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType,
  }));

  return { resources: resourceList };
});

// Handle resource reading
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  const resource = resources.get(uri);
  if (!resource) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  const content = await resource.handler(uri);
  return {
    contents: [
      {
        uri,
        mimeType: resource.mimeType,
        text: content,
      },
    ],
  };
});

// Convert Zod schema to JSON Schema (simplified)
function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
    properties[key] = zodTypeToJsonSchema(zodType);

    if (!zodType.isOptional()) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
  // Handle optional types
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }

  // Handle string
  if (zodType instanceof z.ZodString) {
    return { type: "string", description: zodType.description };
  }

  // Handle number
  if (zodType instanceof z.ZodNumber) {
    return { type: "number", description: zodType.description };
  }

  // Handle boolean
  if (zodType instanceof z.ZodBoolean) {
    return { type: "boolean", description: zodType.description };
  }

  // Handle array
  if (zodType instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodTypeToJsonSchema(zodType.element),
      description: zodType.description,
    };
  }

  // Handle object
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType);
  }

  // Handle enum
  if (zodType instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: zodType.options,
      description: zodType.description,
    };
  }

  // Handle record (dictionary/map)
  if (zodType instanceof z.ZodRecord) {
    return {
      type: "object",
      additionalProperties: true,
      description: zodType.description,
    };
  }

  // Default
  return { type: "string" };
}

// Main entry point
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project" && args[i + 1]) {
      state.projectPath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--port" && args[i + 1]) {
      state.editorPort = parseInt(args[i + 1], 10);
      i++;
    }
  }

  // Verify project path exists
  if (state.projectPath) {
    try {
      await fs.access(state.projectPath);
    } catch {
      console.error(`Project path does not exist: ${state.projectPath}`);
      process.exit(1);
    }

    // Check if this looks like a Godot project
    try {
      await fs.access(path.join(state.projectPath, "project.godot"));
    } catch {
      console.error(`Warning: No project.godot found in ${state.projectPath}`);
      console.error(`This directory may not be a Godot project. Tools may not work as expected.`);
    }
  }

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Godot MCP server running`);
  console.error(`Project path: ${state.projectPath}`);
  console.error(`Editor port: ${state.editorPort}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

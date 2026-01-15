#!/usr/bin/env node
import { z } from "zod";
interface ToolHandler {
    description: string;
    inputSchema: z.ZodType<unknown>;
    handler: (args: unknown) => Promise<unknown>;
}
declare const tools: Map<string, ToolHandler>;
interface ResourceHandler {
    name: string;
    description: string;
    mimeType: string;
    handler: (uri: string) => Promise<string>;
}
declare const resources: Map<string, ResourceHandler>;
interface ServerState {
    projectPath: string | null;
    editorConnected: boolean;
    editorPort: number;
}
declare const state: ServerState;
export { tools, resources, state };
export type { ToolHandler, ResourceHandler, ServerState };
//# sourceMappingURL=index.d.ts.map
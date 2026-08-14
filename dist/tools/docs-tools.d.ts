/**
 * Documentation and project tools for Godot MCP
 */
import type { ToolHandler, ServerState } from "../index.js";
export declare function registerDocsTools(tools: Map<string, ToolHandler>, state: ServerState): void;
/** Load the canonical bridge shipped beside dist/ in source and npm installs. */
export declare function loadAiBridgePluginFiles(): Promise<Record<string, string>>;
//# sourceMappingURL=docs-tools.d.ts.map
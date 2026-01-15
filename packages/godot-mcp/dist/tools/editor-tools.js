/**
 * Live editor connection tools for Godot MCP
 * These tools require the godot-ai-bridge plugin running in Godot
 */
import { z } from "zod";
import WebSocket from "ws";
// WebSocket connection state
let wsConnection = null;
let messageId = 0;
const pendingRequests = new Map();
export function registerEditorTools(tools, state) {
    // Connect to Godot editor
    tools.set("godot_connect", {
        description: "Connect to a running Godot editor instance with the godot-ai-bridge plugin enabled. This enables live scene manipulation and real-time feedback.",
        inputSchema: z.object({
            port: z
                .number()
                .optional()
                .describe("Port the Godot AI Bridge is running on (default: 6550)"),
            host: z
                .string()
                .optional()
                .describe("Host address (default: localhost)"),
        }),
        handler: async (args) => {
            const { port = state.editorPort, host = "127.0.0.1" } = args;
            if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
                return {
                    success: true,
                    message: "Already connected to Godot editor",
                    connected: true,
                };
            }
            try {
                const result = await connectToGodot(host, port, state);
                return result;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return {
                    success: false,
                    error: message,
                    hint: "Make sure Godot is running with the godot-ai-bridge plugin enabled",
                };
            }
        },
    });
    // Disconnect from Godot editor
    tools.set("godot_disconnect", {
        description: "Disconnect from the Godot editor.",
        inputSchema: z.object({}),
        handler: async () => {
            if (wsConnection) {
                wsConnection.close();
                wsConnection = null;
                state.editorConnected = false;
            }
            return {
                success: true,
                message: "Disconnected from Godot editor",
            };
        },
    });
    // Get connection status
    tools.set("godot_connection_status", {
        description: "Check the current connection status to the Godot editor.",
        inputSchema: z.object({}),
        handler: async () => {
            const connected = wsConnection !== null && wsConnection.readyState === WebSocket.OPEN;
            return {
                connected,
                port: state.editorPort,
                projectPath: state.projectPath,
            };
        },
    });
    // Get scene tree from running editor
    tools.set("godot_editor_get_scene_tree", {
        description: "Get the current scene tree from the running Godot editor. Shows all nodes, their types, and hierarchy.",
        inputSchema: z.object({}),
        handler: async () => {
            ensureConnected();
            const result = await sendRequest("scene_tree.get", {});
            return result;
        },
    });
    // Select a node in the editor
    tools.set("godot_editor_select_node", {
        description: "Select a node in the Godot editor's scene tree.",
        inputSchema: z.object({
            nodePath: z
                .string()
                .describe("Path to the node to select (e.g., 'Player' or 'Player/Sprite2D')"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { nodePath } = args;
            const result = await sendRequest("scene_tree.select", { path: nodePath });
            return result;
        },
    });
    // Add a node in the running editor
    tools.set("godot_editor_add_node", {
        description: "Add a new node to the current scene in the running Godot editor.",
        inputSchema: z.object({
            parentPath: z
                .string()
                .describe("Path to the parent node (use '.' for scene root)"),
            name: z.string().describe("Name for the new node"),
            type: z.string().describe("Godot node type (e.g., 'Sprite2D', 'Node2D')"),
            properties: z
                .record(z.unknown())
                .optional()
                .describe("Initial properties to set"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { parentPath, name, type, properties } = args;
            const result = await sendRequest("scene_tree.add_node", {
                parent: parentPath,
                name,
                type,
                properties,
            });
            return result;
        },
    });
    // Remove a node from the running editor
    tools.set("godot_editor_remove_node", {
        description: "Remove a node from the current scene in the running Godot editor.",
        inputSchema: z.object({
            nodePath: z.string().describe("Path to the node to remove"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { nodePath } = args;
            const result = await sendRequest("scene_tree.remove_node", {
                path: nodePath,
            });
            return result;
        },
    });
    // Modify a node in the running editor
    tools.set("godot_editor_modify_node", {
        description: "Modify properties of a node in the current scene in the running Godot editor.",
        inputSchema: z.object({
            nodePath: z.string().describe("Path to the node to modify"),
            properties: z
                .record(z.unknown())
                .describe("Properties to set on the node"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { nodePath, properties } = args;
            const result = await sendRequest("scene_tree.modify_node", {
                path: nodePath,
                properties,
            });
            return result;
        },
    });
    // Open a scene in the editor
    tools.set("godot_editor_open_scene", {
        description: "Open a scene file in the Godot editor.",
        inputSchema: z.object({
            scenePath: z
                .string()
                .describe("Path to the scene file (e.g., 'res://scenes/main.tscn')"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { scenePath } = args;
            const result = await sendRequest("editor.open_scene", { path: scenePath });
            return result;
        },
    });
    // Save the current scene
    tools.set("godot_editor_save_scene", {
        description: "Save the current scene in the Godot editor.",
        inputSchema: z.object({}),
        handler: async () => {
            ensureConnected();
            const result = await sendRequest("editor.save_scene", {});
            return result;
        },
    });
    // Run the current scene
    tools.set("godot_editor_run_scene", {
        description: "Run the current scene or a specific scene in the Godot editor.",
        inputSchema: z.object({
            scenePath: z
                .string()
                .optional()
                .describe("Optional path to a specific scene to run"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { scenePath } = args;
            const result = await sendRequest("editor.run_scene", {
                path: scenePath,
            });
            return result;
        },
    });
    // Stop the running scene
    tools.set("godot_editor_stop_scene", {
        description: "Stop the currently running scene in the Godot editor.",
        inputSchema: z.object({}),
        handler: async () => {
            ensureConnected();
            const result = await sendRequest("editor.stop_scene", {});
            return result;
        },
    });
    // Get editor errors
    tools.set("godot_editor_get_errors", {
        description: "Get the current list of errors from the Godot editor.",
        inputSchema: z.object({}),
        handler: async () => {
            ensureConnected();
            const result = await sendRequest("info.errors", {});
            return result;
        },
    });
    // Get editor output
    tools.set("godot_editor_get_output", {
        description: "Get the output console content from the Godot editor.",
        inputSchema: z.object({
            lines: z
                .number()
                .optional()
                .describe("Number of recent lines to retrieve (default: 50)"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { lines = 50 } = args;
            const result = await sendRequest("info.output", { lines });
            return result;
        },
    });
    // Get log file content (captures all print output)
    tools.set("godot_editor_get_log_file", {
        description: "Read Godot's log file which captures ALL print output, errors, and warnings from both editor and running game. Use this to debug runtime issues.",
        inputSchema: z.object({
            lines: z
                .number()
                .optional()
                .describe("Number of recent lines to retrieve (default: 100)"),
            filter: z
                .enum(["all", "error", "warning"])
                .optional()
                .describe("Filter log entries: 'all', 'error', or 'warning' (default: all)"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { lines = 100, filter = "all" } = args;
            const result = await sendRequest("info.log_file", { lines, filter });
            return result;
        },
    });
    // Execute GDScript in the editor
    tools.set("godot_editor_execute_gdscript", {
        description: "Execute arbitrary GDScript code in the running Godot editor. Use with caution.",
        inputSchema: z.object({
            code: z.string().describe("GDScript code to execute"),
        }),
        handler: async (args) => {
            ensureConnected();
            const { code } = args;
            const result = await sendRequest("execute.gdscript", { code });
            return result;
        },
    });
    // Get project info from editor
    tools.set("godot_editor_get_project_info", {
        description: "Get information about the currently open project in the Godot editor.",
        inputSchema: z.object({}),
        handler: async () => {
            ensureConnected();
            const result = await sendRequest("info.project", {});
            return result;
        },
    });
    // Refresh the filesystem in editor
    tools.set("godot_editor_refresh_filesystem", {
        description: "Trigger a filesystem refresh in the Godot editor. Useful after external file changes.",
        inputSchema: z.object({}),
        handler: async () => {
            ensureConnected();
            const result = await sendRequest("fs.refresh", {});
            return result;
        },
    });
}
// Helper functions
function ensureConnected() {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to Godot editor. Use godot_connect first.");
    }
}
async function connectToGodot(host, port, state) {
    return new Promise((resolve, reject) => {
        const url = `ws://${host}:${port}`;
        try {
            wsConnection = new WebSocket(url);
            const timeout = setTimeout(() => {
                if (wsConnection) {
                    wsConnection.close();
                    wsConnection = null;
                }
                reject(new Error(`Connection timeout to ${url}`));
            }, 5000);
            wsConnection.on("open", async () => {
                clearTimeout(timeout);
                state.editorConnected = true;
                // Send initialization message
                try {
                    const info = await sendRequest("initialize", {
                        client: "godot-mcp",
                        version: "0.1.0",
                        capabilities: ["scene_tree", "execute", "subscribe"],
                    });
                    resolve({
                        success: true,
                        message: `Connected to Godot editor at ${url}`,
                        info,
                    });
                }
                catch (error) {
                    resolve({
                        success: true,
                        message: `Connected to Godot editor at ${url} (init info unavailable)`,
                    });
                }
            });
            wsConnection.on("message", (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.id !== undefined && pendingRequests.has(message.id)) {
                        const { resolve, reject } = pendingRequests.get(message.id);
                        pendingRequests.delete(message.id);
                        if (message.error) {
                            reject(new Error(message.error.message || "Unknown error"));
                        }
                        else {
                            resolve(message.result);
                        }
                    }
                }
                catch (error) {
                    console.error("Failed to parse message:", error);
                }
            });
            wsConnection.on("close", () => {
                state.editorConnected = false;
                wsConnection = null;
                // Reject all pending requests
                for (const [id, { reject }] of pendingRequests) {
                    reject(new Error("Connection closed"));
                    pendingRequests.delete(id);
                }
            });
            wsConnection.on("error", (error) => {
                clearTimeout(timeout);
                state.editorConnected = false;
                reject(error);
            });
        }
        catch (error) {
            reject(error);
        }
    });
}
async function sendRequest(method, params) {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to Godot editor");
    }
    const id = ++messageId;
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`Request timeout: ${method}`));
        }, 30000);
        pendingRequests.set(id, {
            resolve: (value) => {
                clearTimeout(timeout);
                resolve(value);
            },
            reject: (error) => {
                clearTimeout(timeout);
                reject(error);
            },
        });
        const message = JSON.stringify({
            jsonrpc: "2.0",
            id,
            method,
            params,
        });
        wsConnection.send(message);
    });
}
//# sourceMappingURL=editor-tools.js.map
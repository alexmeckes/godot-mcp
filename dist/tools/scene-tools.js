/**
 * Scene manipulation tools for Godot MCP
 */
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { TscnParser } from "../parsers/tscn-parser.js";
export function registerSceneTools(tools, state) {
    // Read and parse a scene file
    tools.set("godot_read_scene", {
        description: "Read and parse a Godot scene file (.tscn). Returns the scene structure as JSON including nodes, resources, and connections.",
        inputSchema: z.object({
            path: z
                .string()
                .describe("Path to the scene file, either absolute or relative to project (e.g., 'res://scenes/player.tscn' or 'scenes/player.tscn')"),
        }),
        handler: async (args) => {
            const { path: scenePath } = args;
            const fullPath = resolvePath(scenePath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const scene = TscnParser.parse(content);
            return {
                path: scenePath,
                scene,
                tree: TscnParser.getSceneTree(scene),
            };
        },
    });
    // Write a scene file
    tools.set("godot_write_scene", {
        description: "Create or update a Godot scene file (.tscn) from structured JSON data. Use this to create new scenes or overwrite existing ones.",
        inputSchema: z.object({
            path: z
                .string()
                .describe("Path where the scene file should be written"),
            scene: z
                .object({
                header: z
                    .object({
                    type: z.enum(["gd_scene", "gd_resource"]).default("gd_scene"),
                    format: z.number().default(3),
                    uid: z.string().optional(),
                })
                    .optional(),
                externalResources: z
                    .array(z.object({
                    type: z.string(),
                    path: z.string(),
                    id: z.string(),
                    uid: z.string().optional(),
                }))
                    .optional(),
                subResources: z
                    .array(z.object({
                    type: z.string(),
                    id: z.string(),
                    properties: z.record(z.unknown()).optional(),
                }))
                    .optional(),
                nodes: z.array(z.object({
                    name: z.string(),
                    type: z.string().optional(),
                    parent: z.string().optional(),
                    instance: z.string().optional(),
                    groups: z.array(z.string()).optional(),
                    properties: z.record(z.unknown()).optional(),
                })),
                connections: z
                    .array(z.object({
                    signal: z.string(),
                    from: z.string(),
                    to: z.string(),
                    method: z.string(),
                    flags: z.number().optional(),
                }))
                    .optional(),
            })
                .describe("The scene structure to write"),
        }),
        handler: async (args) => {
            const { path: scenePath, scene } = args;
            const fullPath = resolvePath(scenePath, state.projectPath);
            // Build complete scene with defaults
            const completeScene = {
                header: {
                    type: scene.header?.type || "gd_scene",
                    format: scene.header?.format || 3,
                    uid: scene.header?.uid,
                    loadSteps: (scene.externalResources?.length || 0) +
                        (scene.subResources?.length || 0) +
                        1,
                },
                externalResources: scene.externalResources || [],
                subResources: (scene.subResources || []).map((sr) => ({
                    ...sr,
                    properties: sr.properties || {},
                })),
                nodes: (scene.nodes || []).map((n) => ({
                    ...n,
                    properties: n.properties || {},
                })),
                connections: scene.connections || [],
            };
            const content = TscnParser.serialize(completeScene);
            // Ensure directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            return {
                success: true,
                path: scenePath,
                nodesCount: completeScene.nodes.length,
            };
        },
    });
    // Add a node to an existing scene
    tools.set("godot_add_node", {
        description: "Add a new node to an existing Godot scene file. The node will be added to the scene tree at the specified parent path.",
        inputSchema: z.object({
            scenePath: z.string().describe("Path to the scene file to modify"),
            node: z.object({
                name: z.string().describe("Name of the new node"),
                type: z.string().describe("Godot node type (e.g., 'Node2D', 'Sprite2D', 'CharacterBody2D')"),
                parent: z
                    .string()
                    .optional()
                    .describe("Parent node path (use '.' for root's children, omit for root node)"),
                groups: z.array(z.string()).optional().describe("Groups to add the node to"),
                properties: z
                    .record(z.unknown())
                    .optional()
                    .describe("Node properties to set"),
            }),
        }),
        handler: async (args) => {
            const { scenePath, node } = args;
            const fullPath = resolvePath(scenePath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const scene = TscnParser.parse(content);
            TscnParser.addNode(scene, node);
            const newContent = TscnParser.serialize(scene);
            await fs.writeFile(fullPath, newContent, "utf-8");
            return {
                success: true,
                addedNode: node.name,
                totalNodes: scene.nodes.length,
            };
        },
    });
    // Remove a node from a scene
    tools.set("godot_remove_node", {
        description: "Remove a node and all its children from a Godot scene file.",
        inputSchema: z.object({
            scenePath: z.string().describe("Path to the scene file to modify"),
            nodePath: z
                .string()
                .describe("Path to the node to remove (e.g., 'Player' for root child, 'Player/Sprite' for nested)"),
        }),
        handler: async (args) => {
            const { scenePath, nodePath } = args;
            const fullPath = resolvePath(scenePath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const scene = TscnParser.parse(content);
            const beforeCount = scene.nodes.length;
            TscnParser.removeNode(scene, nodePath);
            const newContent = TscnParser.serialize(scene);
            await fs.writeFile(fullPath, newContent, "utf-8");
            return {
                success: true,
                removedPath: nodePath,
                nodesRemoved: beforeCount - scene.nodes.length,
            };
        },
    });
    // Modify a node's properties
    tools.set("godot_modify_node", {
        description: "Modify properties of an existing node in a Godot scene file.",
        inputSchema: z.object({
            scenePath: z.string().describe("Path to the scene file to modify"),
            nodePath: z.string().describe("Path to the node to modify"),
            updates: z.object({
                name: z.string().optional().describe("New name for the node"),
                groups: z.array(z.string()).optional().describe("New groups for the node"),
                properties: z
                    .record(z.unknown())
                    .optional()
                    .describe("Properties to set or update"),
            }),
        }),
        handler: async (args) => {
            const { scenePath, nodePath, updates } = args;
            const fullPath = resolvePath(scenePath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const scene = TscnParser.parse(content);
            const success = TscnParser.modifyNode(scene, nodePath, updates);
            if (!success) {
                throw new Error(`Node not found: ${nodePath}`);
            }
            const newContent = TscnParser.serialize(scene);
            await fs.writeFile(fullPath, newContent, "utf-8");
            return {
                success: true,
                modifiedPath: nodePath,
                updates,
            };
        },
    });
    // List all scene nodes
    tools.set("godot_list_scene_nodes", {
        description: "List all nodes in a Godot scene file with their types and hierarchy.",
        inputSchema: z.object({
            scenePath: z.string().describe("Path to the scene file"),
        }),
        handler: async (args) => {
            const { scenePath } = args;
            const fullPath = resolvePath(scenePath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const scene = TscnParser.parse(content);
            const nodes = scene.nodes.map((node) => ({
                name: node.name,
                type: node.type,
                parent: node.parent,
                path: node.parent
                    ? node.parent === "."
                        ? node.name
                        : `${node.parent}/${node.name}`
                    : node.name,
                groups: node.groups,
                propertyCount: Object.keys(node.properties).length,
            }));
            return {
                scenePath,
                nodeCount: nodes.length,
                nodes,
                tree: TscnParser.getSceneTree(scene),
            };
        },
    });
    // Validate a scene file
    tools.set("godot_validate_scene", {
        description: "Validate a Godot scene file for common issues like missing resources, invalid node types, or broken references.",
        inputSchema: z.object({
            scenePath: z.string().describe("Path to the scene file to validate"),
        }),
        handler: async (args) => {
            const { scenePath } = args;
            const fullPath = resolvePath(scenePath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const scene = TscnParser.parse(content);
            const issues = [];
            // Check for root node
            const hasRoot = scene.nodes.some((n) => !n.parent);
            if (!hasRoot) {
                issues.push({
                    severity: "error",
                    message: "Scene has no root node",
                });
            }
            // Check external resource paths exist
            for (const extRes of scene.externalResources) {
                const resPath = resolvePath(extRes.path, state.projectPath);
                try {
                    await fs.access(resPath);
                }
                catch {
                    issues.push({
                        severity: "warning",
                        message: `External resource not found: ${extRes.path}`,
                        location: `ext_resource id="${extRes.id}"`,
                    });
                }
            }
            // Check for orphaned nodes (parent doesn't exist)
            const nodeNames = new Set();
            for (const node of scene.nodes) {
                if (!node.parent) {
                    nodeNames.add(node.name);
                }
                else if (node.parent === ".") {
                    nodeNames.add(node.name);
                }
                else {
                    nodeNames.add(`${node.parent}/${node.name}`);
                }
            }
            for (const node of scene.nodes) {
                if (node.parent && node.parent !== ".") {
                    // Check if parent exists
                    const parentParts = node.parent.split("/");
                    let currentPath = "";
                    for (const part of parentParts) {
                        currentPath = currentPath ? `${currentPath}/${part}` : part;
                        if (!nodeNames.has(currentPath)) {
                            issues.push({
                                severity: "error",
                                message: `Node '${node.name}' references non-existent parent: ${node.parent}`,
                                location: `node name="${node.name}"`,
                            });
                            break;
                        }
                    }
                }
            }
            // Check signal connections
            for (const conn of scene.connections) {
                const fromExists = scene.nodes.some((n) => {
                    const nodePath = n.parent
                        ? n.parent === "."
                            ? n.name
                            : `${n.parent}/${n.name}`
                        : ".";
                    return nodePath === conn.from || (conn.from === "." && !n.parent);
                });
                const toExists = scene.nodes.some((n) => {
                    const nodePath = n.parent
                        ? n.parent === "."
                            ? n.name
                            : `${n.parent}/${n.name}`
                        : ".";
                    return nodePath === conn.to || (conn.to === "." && !n.parent);
                });
                if (!fromExists) {
                    issues.push({
                        severity: "warning",
                        message: `Signal connection references non-existent 'from' node: ${conn.from}`,
                        location: `connection signal="${conn.signal}"`,
                    });
                }
                if (!toExists) {
                    issues.push({
                        severity: "warning",
                        message: `Signal connection references non-existent 'to' node: ${conn.to}`,
                        location: `connection signal="${conn.signal}"`,
                    });
                }
            }
            return {
                valid: issues.filter((i) => i.severity === "error").length === 0,
                scenePath,
                issues,
                summary: {
                    nodes: scene.nodes.length,
                    externalResources: scene.externalResources.length,
                    subResources: scene.subResources.length,
                    connections: scene.connections.length,
                    errors: issues.filter((i) => i.severity === "error").length,
                    warnings: issues.filter((i) => i.severity === "warning").length,
                },
            };
        },
    });
    // List project scenes
    tools.set("godot_list_scenes", {
        description: "List all scene files (.tscn) in the Godot project.",
        inputSchema: z.object({
            directory: z
                .string()
                .optional()
                .describe("Subdirectory to search in (e.g., 'scenes')"),
        }),
        handler: async (args) => {
            const { directory } = args;
            const searchPath = directory
                ? path.join(state.projectPath || ".", directory)
                : state.projectPath || ".";
            const scenes = await findFiles(searchPath, ".tscn");
            return {
                projectPath: state.projectPath,
                directory: directory || ".",
                scenes: scenes.map((s) => ({
                    path: path.relative(state.projectPath || ".", s),
                    resPath: `res://${path.relative(state.projectPath || ".", s)}`,
                })),
                count: scenes.length,
            };
        },
    });
}
// Helper functions
function resolvePath(inputPath, projectPath) {
    // Handle res:// paths
    if (inputPath.startsWith("res://")) {
        inputPath = inputPath.slice(6);
    }
    // If absolute, use as-is
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }
    // Relative to project
    return path.join(projectPath || ".", inputPath);
}
async function findFiles(dir, extension) {
    const results = [];
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith(".")) {
                results.push(...(await findFiles(fullPath, extension)));
            }
            else if (entry.isFile() && entry.name.endsWith(extension)) {
                results.push(fullPath);
            }
        }
    }
    catch {
        // Directory doesn't exist or not readable
    }
    return results;
}
//# sourceMappingURL=scene-tools.js.map
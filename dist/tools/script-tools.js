/**
 * GDScript manipulation tools for Godot MCP
 */
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
export function registerScriptTools(tools, state) {
    // Read a GDScript file
    tools.set("godot_read_script", {
        description: "Read a GDScript file (.gd) and return its content along with parsed metadata (class name, signals, exports, functions, etc.).",
        inputSchema: z.object({
            path: z.string().describe("Path to the GDScript file"),
        }),
        handler: async (args) => {
            const { path: scriptPath } = args;
            const fullPath = resolvePath(scriptPath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const metadata = parseGDScript(content);
            return {
                path: scriptPath,
                content,
                metadata,
                lineCount: content.split("\n").length,
            };
        },
    });
    // Write a GDScript file
    tools.set("godot_write_script", {
        description: "Create or update a GDScript file (.gd). Writes the provided content directly to the file.",
        inputSchema: z.object({
            path: z.string().describe("Path where the script should be written"),
            content: z.string().describe("The GDScript content to write"),
        }),
        handler: async (args) => {
            const { path: scriptPath, content } = args;
            const fullPath = resolvePath(scriptPath, state.projectPath);
            // Ensure directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            const metadata = parseGDScript(content);
            return {
                success: true,
                path: scriptPath,
                metadata,
                lineCount: content.split("\n").length,
            };
        },
    });
    // Analyze a GDScript file
    tools.set("godot_analyze_script", {
        description: "Analyze a GDScript file in detail, extracting all classes, functions, signals, exports, and their relationships.",
        inputSchema: z.object({
            path: z.string().describe("Path to the GDScript file to analyze"),
        }),
        handler: async (args) => {
            const { path: scriptPath } = args;
            const fullPath = resolvePath(scriptPath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const metadata = parseGDScript(content);
            const analysis = analyzeScript(content, metadata);
            return {
                path: scriptPath,
                metadata,
                analysis,
            };
        },
    });
    // Generate a GDScript from description
    tools.set("godot_generate_script", {
        description: "Generate a GDScript file based on a description. Creates properly structured Godot 4.x code with type hints, signals, and best practices.",
        inputSchema: z.object({
            description: z
                .string()
                .describe("Description of what the script should do (e.g., 'A player controller with WASD movement and jumping')"),
            extends: z
                .string()
                .default("Node")
                .describe("Base class to extend (e.g., CharacterBody2D, Node2D, Control)"),
            className: z
                .string()
                .optional()
                .describe("Optional class_name for the script"),
            features: z
                .array(z.string())
                .optional()
                .describe("Specific features to include (e.g., ['signals', 'exports', 'ready', 'process'])"),
        }),
        handler: async (args) => {
            const { description, extends: baseClass, className, features } = args;
            // Generate script based on common patterns
            const script = generateScript(description, baseClass, className, features);
            return {
                generatedScript: script,
                metadata: parseGDScript(script),
                hint: "Use godot_write_script to save this script to a file",
            };
        },
    });
    // List all scripts in project
    tools.set("godot_list_scripts", {
        description: "List all GDScript files (.gd) in the Godot project.",
        inputSchema: z.object({
            directory: z
                .string()
                .optional()
                .describe("Subdirectory to search in (e.g., 'scripts')"),
        }),
        handler: async (args) => {
            const { directory } = args;
            const searchPath = directory
                ? path.join(state.projectPath || ".", directory)
                : state.projectPath || ".";
            const scripts = await findFiles(searchPath, ".gd");
            // Get basic metadata for each script
            const scriptInfos = await Promise.all(scripts.map(async (scriptPath) => {
                try {
                    const content = await fs.readFile(scriptPath, "utf-8");
                    const metadata = parseGDScript(content);
                    return {
                        path: path.relative(state.projectPath || ".", scriptPath),
                        resPath: `res://${path.relative(state.projectPath || ".", scriptPath)}`,
                        className: metadata.className,
                        extends: metadata.extends,
                        functionCount: metadata.functions.length,
                        signalCount: metadata.signals.length,
                    };
                }
                catch {
                    return {
                        path: path.relative(state.projectPath || ".", scriptPath),
                        resPath: `res://${path.relative(state.projectPath || ".", scriptPath)}`,
                        error: "Could not parse",
                    };
                }
            }));
            return {
                projectPath: state.projectPath,
                directory: directory || ".",
                scripts: scriptInfos,
                count: scripts.length,
            };
        },
    });
    // Validate GDScript syntax
    tools.set("godot_validate_script", {
        description: "Validate a GDScript file for common syntax issues and best practices.",
        inputSchema: z.object({
            path: z.string().optional().describe("Path to the script file"),
            content: z.string().optional().describe("Script content to validate directly"),
        }),
        handler: async (args) => {
            const { path: scriptPath, content: directContent } = args;
            let content;
            if (directContent) {
                content = directContent;
            }
            else if (scriptPath) {
                const fullPath = resolvePath(scriptPath, state.projectPath);
                content = await fs.readFile(fullPath, "utf-8");
            }
            else {
                throw new Error("Either path or content must be provided");
            }
            const issues = validateScript(content);
            return {
                valid: issues.filter((i) => i.severity === "error").length === 0,
                path: scriptPath,
                issues,
                summary: {
                    errors: issues.filter((i) => i.severity === "error").length,
                    warnings: issues.filter((i) => i.severity === "warning").length,
                    suggestions: issues.filter((i) => i.severity === "suggestion").length,
                },
            };
        },
    });
}
// GDScript parser
function parseGDScript(content) {
    const lines = content.split("\n");
    const metadata = {
        signals: [],
        exports: [],
        onready: [],
        functions: [],
        constants: [],
        enums: [],
    };
    let inEnum = false;
    let currentEnum = null;
    for (const line of lines) {
        const trimmed = line.trim();
        // Class name
        const classMatch = trimmed.match(/^class_name\s+(\w+)/);
        if (classMatch) {
            metadata.className = classMatch[1];
            continue;
        }
        // Extends
        const extendsMatch = trimmed.match(/^extends\s+(\w+)/);
        if (extendsMatch) {
            metadata.extends = extendsMatch[1];
            continue;
        }
        // Signals
        const signalMatch = trimmed.match(/^signal\s+(\w+)/);
        if (signalMatch) {
            metadata.signals.push(signalMatch[1]);
            continue;
        }
        // Exports
        const exportMatch = trimmed.match(/^@export(?:_\w+)?\s+var\s+(\w+)\s*:\s*(\w+)(?:\s*=\s*(.+))?/);
        if (exportMatch) {
            metadata.exports.push({
                name: exportMatch[1],
                type: exportMatch[2],
                default: exportMatch[3],
            });
            continue;
        }
        // Onready
        const onreadyMatch = trimmed.match(/^@onready\s+var\s+(\w+)\s*(?::\s*(\w+))?\s*=\s*\$(.+)/);
        if (onreadyMatch) {
            metadata.onready.push({
                name: onreadyMatch[1],
                type: onreadyMatch[2] || "Node",
                path: onreadyMatch[3],
            });
            continue;
        }
        // Functions
        const funcMatch = trimmed.match(/^func\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+))?/);
        if (funcMatch) {
            const isOverride = funcMatch[1].startsWith("_");
            metadata.functions.push({
                name: funcMatch[1],
                args: funcMatch[2]
                    .split(",")
                    .map((a) => a.trim())
                    .filter(Boolean),
                returnType: funcMatch[3],
                isOverride,
            });
            continue;
        }
        // Constants
        const constMatch = trimmed.match(/^const\s+(\w+)\s*(?::\s*\w+)?\s*=\s*(.+)/);
        if (constMatch) {
            metadata.constants.push({
                name: constMatch[1],
                value: constMatch[2],
            });
            continue;
        }
        // Enums
        const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{/);
        if (enumMatch) {
            inEnum = true;
            currentEnum = { name: enumMatch[1], values: [] };
            continue;
        }
        if (inEnum && currentEnum) {
            if (trimmed.includes("}")) {
                metadata.enums.push(currentEnum);
                inEnum = false;
                currentEnum = null;
            }
            else {
                const values = trimmed.split(",").map((v) => v.trim().split("=")[0].trim());
                currentEnum.values.push(...values.filter(Boolean));
            }
        }
    }
    return metadata;
}
// Script analysis
function analyzeScript(content, metadata) {
    const lines = content.split("\n");
    const analysis = {
        lineCount: lines.length,
        hasDocstrings: content.includes('"""') || content.includes("##"),
        hasTypeHints: /:\s*\w+/.test(content),
        usesSignals: metadata.signals.length > 0,
        usesExports: metadata.exports.length > 0,
        complexity: calculateComplexity(content),
        dependencies: findDependencies(content),
    };
    // Check for common patterns
    analysis.patterns = {
        usesReady: metadata.functions.some((f) => f.name === "_ready"),
        usesProcess: metadata.functions.some((f) => f.name === "_process"),
        usesPhysicsProcess: metadata.functions.some((f) => f.name === "_physics_process"),
        usesInput: metadata.functions.some((f) => f.name === "_input" || f.name === "_unhandled_input"),
        usesSingleton: /get_node\s*\(\s*["']\/root\//.test(content),
    };
    return analysis;
}
function calculateComplexity(content) {
    const ifCount = (content.match(/\bif\b/g) || []).length;
    const forCount = (content.match(/\bfor\b/g) || []).length;
    const whileCount = (content.match(/\bwhile\b/g) || []).length;
    const matchCount = (content.match(/\bmatch\b/g) || []).length;
    const score = ifCount + forCount * 2 + whileCount * 2 + matchCount;
    if (score < 5)
        return "low";
    if (score < 15)
        return "medium";
    return "high";
}
function findDependencies(content) {
    const deps = new Set();
    // preload/load calls
    const loadMatches = content.matchAll(/(?:preload|load)\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of loadMatches) {
        deps.add(match[1]);
    }
    // get_node calls with paths
    const nodeMatches = content.matchAll(/get_node\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of nodeMatches) {
        if (match[1].startsWith("/root/")) {
            deps.add(match[1]);
        }
    }
    return Array.from(deps);
}
// Script validation
function validateScript(content) {
    const issues = [];
    const lines = content.split("\n");
    let indentStack = [0];
    let inMultilineString = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // Skip empty lines and comments
        if (line.trim() === "" || line.trim().startsWith("#"))
            continue;
        // Track multiline strings
        const tripleQuotes = (line.match(/"""/g) || []).length;
        if (tripleQuotes % 2 === 1) {
            inMultilineString = !inMultilineString;
        }
        if (inMultilineString)
            continue;
        // Check for tabs (Godot uses tabs for indentation)
        if (line.match(/^ +/) && !line.match(/^\t/)) {
            issues.push({
                severity: "warning",
                message: "Use tabs for indentation in GDScript",
                line: lineNum,
            });
        }
        // Check for missing type hints on function parameters
        const funcMatch = line.match(/^(?:\t*)func\s+\w+\s*\(([^)]+)\)/);
        if (funcMatch) {
            const params = funcMatch[1].split(",");
            for (const param of params) {
                if (param.trim() && !param.includes(":")) {
                    issues.push({
                        severity: "suggestion",
                        message: `Consider adding type hint to parameter: ${param.trim().split("=")[0].trim()}`,
                        line: lineNum,
                    });
                }
            }
        }
        // Check for deprecated patterns
        if (line.includes(".connect(")) {
            const oldStyleConnect = /\.connect\s*\(\s*["']\w+["']\s*,\s*\w+/;
            if (oldStyleConnect.test(line)) {
                issues.push({
                    severity: "warning",
                    message: "Use Godot 4.x signal syntax: signal.connect(callable)",
                    line: lineNum,
                });
            }
        }
        // Check for yield (deprecated in Godot 4)
        if (/\byield\s*\(/.test(line)) {
            issues.push({
                severity: "error",
                message: "'yield' is deprecated in Godot 4.x, use 'await' instead",
                line: lineNum,
            });
        }
        // Check for old export syntax
        if (/^export\s*\(/.test(line.trim())) {
            issues.push({
                severity: "error",
                message: "Use @export annotation instead of export() in Godot 4.x",
                line: lineNum,
            });
        }
        // Check for old onready syntax
        if (/^onready\s+var/.test(line.trim())) {
            issues.push({
                severity: "error",
                message: "Use @onready annotation instead of onready keyword in Godot 4.x",
                line: lineNum,
            });
        }
    }
    return issues;
}
// Script generation
function generateScript(description, baseClass, className, features) {
    const lines = [];
    const featureSet = new Set(features || []);
    // Class name
    if (className) {
        lines.push(`class_name ${className}`);
    }
    // Extends
    lines.push(`extends ${baseClass}`);
    // Doc comment
    lines.push(`## ${description}`);
    lines.push("");
    // Determine what to generate based on description and base class
    const isCharacterBody = baseClass.includes("CharacterBody");
    const isControl = baseClass === "Control" || baseClass.endsWith("Container");
    const hasMovement = description.toLowerCase().includes("movement") ||
        description.toLowerCase().includes("player") ||
        description.toLowerCase().includes("wasd");
    const hasHealth = description.toLowerCase().includes("health") ||
        description.toLowerCase().includes("damage");
    const hasJump = description.toLowerCase().includes("jump");
    // Signals
    if (featureSet.has("signals") || hasHealth) {
        if (hasHealth) {
            lines.push("signal health_changed(new_health: int)");
            lines.push("signal died");
        }
        lines.push("");
    }
    // Exports
    if (featureSet.has("exports") || hasMovement || hasHealth) {
        if (hasMovement) {
            lines.push("@export var speed: float = 200.0");
            if (hasJump && isCharacterBody) {
                lines.push("@export var jump_force: float = 400.0");
            }
        }
        if (hasHealth) {
            lines.push("@export var max_health: int = 100");
        }
        lines.push("");
    }
    // Variables
    if (hasHealth) {
        lines.push("var _health: int = max_health");
        lines.push("");
    }
    if (isCharacterBody && hasMovement) {
        lines.push("var _gravity: float = ProjectSettings.get_setting(\"physics/2d/default_gravity\")");
        lines.push("");
    }
    // Ready function
    if (featureSet.has("ready")) {
        lines.push("func _ready() -> void:");
        if (hasHealth) {
            lines.push("\t_health = max_health");
        }
        else {
            lines.push("\tpass");
        }
        lines.push("");
    }
    // Process or physics process
    if (featureSet.has("process") || (hasMovement && !isCharacterBody)) {
        lines.push("func _process(delta: float) -> void:");
        if (hasMovement && !isCharacterBody) {
            lines.push("\tvar direction := Input.get_vector(\"ui_left\", \"ui_right\", \"ui_up\", \"ui_down\")");
            lines.push("\tposition += direction * speed * delta");
        }
        else {
            lines.push("\tpass");
        }
        lines.push("");
    }
    if (isCharacterBody && hasMovement) {
        lines.push("func _physics_process(delta: float) -> void:");
        if (baseClass.includes("2D")) {
            lines.push("\t# Add gravity");
            lines.push("\tif not is_on_floor():");
            lines.push("\t\tvelocity.y += _gravity * delta");
            lines.push("");
            if (hasJump) {
                lines.push("\t# Handle jump");
                lines.push('\tif Input.is_action_just_pressed("ui_accept") and is_on_floor():');
                lines.push("\t\tvelocity.y = -jump_force");
                lines.push("");
            }
            lines.push("\t# Get horizontal movement");
            lines.push('\tvar direction := Input.get_axis("ui_left", "ui_right")');
            lines.push("\tif direction:");
            lines.push("\t\tvelocity.x = direction * speed");
            lines.push("\telse:");
            lines.push("\t\tvelocity.x = move_toward(velocity.x, 0, speed)");
        }
        else {
            // 3D movement
            lines.push('\tvar input_dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")');
            lines.push("\tvar direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()");
            lines.push("\tif direction:");
            lines.push("\t\tvelocity.x = direction.x * speed");
            lines.push("\t\tvelocity.z = direction.z * speed");
            lines.push("\telse:");
            lines.push("\t\tvelocity.x = move_toward(velocity.x, 0, speed)");
            lines.push("\t\tvelocity.z = move_toward(velocity.z, 0, speed)");
        }
        lines.push("");
        lines.push("\tmove_and_slide()");
        lines.push("");
    }
    // Health functions
    if (hasHealth) {
        lines.push("func take_damage(amount: int) -> void:");
        lines.push("\t_health = maxi(_health - amount, 0)");
        lines.push("\thealth_changed.emit(_health)");
        lines.push("\tif _health <= 0:");
        lines.push("\t\tdied.emit()");
        lines.push("");
        lines.push("func heal(amount: int) -> void:");
        lines.push("\t_health = mini(_health + amount, max_health)");
        lines.push("\thealth_changed.emit(_health)");
        lines.push("");
        lines.push("func get_health() -> int:");
        lines.push("\treturn _health");
        lines.push("");
    }
    return lines.join("\n");
}
// Helper functions
function resolvePath(inputPath, projectPath) {
    if (inputPath.startsWith("res://")) {
        inputPath = inputPath.slice(6);
    }
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }
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
//# sourceMappingURL=script-tools.js.map
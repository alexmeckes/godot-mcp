/**
 * Resource (.tres) and procedural generation tools for Godot MCP
 */
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
export function registerResourceTools(tools, state) {
    // Read a resource file
    tools.set("godot_read_resource", {
        description: "Read a Godot resource file (.tres) and return its content as structured data.",
        inputSchema: z.object({
            path: z.string().describe("Path to the resource file"),
        }),
        handler: async (args) => {
            const { path: resPath } = args;
            const fullPath = resolvePath(resPath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const parsed = parseTres(content);
            return {
                path: resPath,
                content,
                parsed,
            };
        },
    });
    // Write a resource file
    tools.set("godot_write_resource", {
        description: "Create or update a Godot resource file (.tres) from structured data.",
        inputSchema: z.object({
            path: z.string().describe("Path where the resource should be written"),
            resourceType: z.string().describe("Resource type (e.g., 'Resource', 'GDScript')"),
            scriptPath: z
                .string()
                .optional()
                .describe("Path to custom resource script (for typed resources)"),
            scriptClass: z
                .string()
                .optional()
                .describe("Class name of the custom resource"),
            properties: z
                .record(z.unknown())
                .describe("Resource properties to set"),
        }),
        handler: async (args) => {
            const { path: resPath, resourceType, scriptPath, scriptClass, properties } = args;
            const fullPath = resolvePath(resPath, state.projectPath);
            const content = serializeTres(resourceType, scriptPath, scriptClass, properties);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            return {
                success: true,
                path: resPath,
                resourceType,
            };
        },
    });
    // List resources by type
    tools.set("godot_list_resources", {
        description: "List all resource files (.tres) in the Godot project.",
        inputSchema: z.object({
            directory: z.string().optional().describe("Subdirectory to search in"),
            resourceType: z
                .string()
                .optional()
                .describe("Filter by resource type"),
        }),
        handler: async (args) => {
            const { directory, resourceType } = args;
            const searchPath = directory
                ? path.join(state.projectPath || ".", directory)
                : state.projectPath || ".";
            const resources = await findFiles(searchPath, ".tres");
            const resourceInfos = await Promise.all(resources.map(async (resPath) => {
                try {
                    const content = await fs.readFile(resPath, "utf-8");
                    const typeMatch = content.match(/\[gd_resource\s+type="([^"]+)"/);
                    const type = typeMatch ? typeMatch[1] : "Unknown";
                    if (resourceType && type !== resourceType) {
                        return null;
                    }
                    return {
                        path: path.relative(state.projectPath || ".", resPath),
                        resPath: `res://${path.relative(state.projectPath || ".", resPath)}`,
                        type,
                    };
                }
                catch {
                    return null;
                }
            }));
            const filtered = resourceInfos.filter((r) => r !== null);
            return {
                projectPath: state.projectPath,
                directory: directory || ".",
                resources: filtered,
                count: filtered.length,
            };
        },
    });
    // Generate procedural dungeon layout
    tools.set("godot_generate_dungeon", {
        description: "Generate a procedural dungeon layout as a scene file with rooms and corridors.",
        inputSchema: z.object({
            outputPath: z.string().describe("Path to save the generated scene"),
            roomCount: z
                .number()
                .min(2)
                .max(50)
                .default(10)
                .describe("Number of rooms to generate"),
            roomMinSize: z
                .number()
                .default(5)
                .describe("Minimum room size in tiles"),
            roomMaxSize: z
                .number()
                .default(15)
                .describe("Maximum room size in tiles"),
            gridWidth: z.number().default(100).describe("Grid width in tiles"),
            gridHeight: z.number().default(100).describe("Grid height in tiles"),
            tileSize: z.number().default(16).describe("Size of each tile in pixels"),
            seed: z.number().optional().describe("Random seed for reproducibility"),
        }),
        handler: async (args) => {
            const { outputPath, roomCount, roomMinSize, roomMaxSize, gridWidth, gridHeight, tileSize, seed, } = args;
            const rng = createRNG(seed || Date.now());
            const rooms = generateRooms(roomCount, roomMinSize, roomMaxSize, gridWidth, gridHeight, rng);
            const corridors = connectRooms(rooms, rng);
            const scene = generateDungeonScene(rooms, corridors, tileSize);
            const fullPath = resolvePath(outputPath, state.projectPath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, scene, "utf-8");
            return {
                success: true,
                path: outputPath,
                roomCount: rooms.length,
                corridorCount: corridors.length,
                gridSize: { width: gridWidth, height: gridHeight },
                rooms: rooms.map((r) => ({
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                })),
            };
        },
    });
    // Generate procedural tilemap pattern
    tools.set("godot_generate_tilemap_pattern", {
        description: "Generate a procedural tilemap pattern (platforms, terrain, etc.) as tile data.",
        inputSchema: z.object({
            patternType: z
                .enum(["platforms", "terrain", "maze", "cave"])
                .describe("Type of pattern to generate"),
            width: z.number().min(5).max(200).describe("Width in tiles"),
            height: z.number().min(5).max(200).describe("Height in tiles"),
            density: z
                .number()
                .min(0)
                .max(1)
                .default(0.5)
                .describe("Fill density (0-1)"),
            seed: z.number().optional().describe("Random seed"),
        }),
        handler: async (args) => {
            const { patternType, width, height, density, seed } = args;
            const rng = createRNG(seed || Date.now());
            let tiles;
            switch (patternType) {
                case "platforms":
                    tiles = generatePlatforms(width, height, density, rng);
                    break;
                case "terrain":
                    tiles = generateTerrain(width, height, density, rng);
                    break;
                case "maze":
                    tiles = generateMaze(width, height, rng);
                    break;
                case "cave":
                    tiles = generateCave(width, height, density, rng);
                    break;
                default:
                    tiles = generatePlatforms(width, height, density, rng);
            }
            return {
                patternType,
                width,
                height,
                tiles,
                hint: "Use these tiles with a TileMapLayer. 1 = solid, 0 = empty",
            };
        },
    });
    // Generate enemy wave configuration
    tools.set("godot_generate_wave_config", {
        description: "Generate enemy wave configurations for a wave-based game mode.",
        inputSchema: z.object({
            waveCount: z.number().min(1).max(100).describe("Number of waves"),
            startingDifficulty: z
                .number()
                .min(1)
                .max(10)
                .default(1)
                .describe("Starting difficulty level"),
            difficultyScale: z
                .number()
                .min(1)
                .max(2)
                .default(1.2)
                .describe("Difficulty multiplier per wave"),
            enemyTypes: z
                .array(z.object({
                name: z.string(),
                baseCost: z.number(),
                minWave: z.number().default(1),
            }))
                .describe("Enemy types with spawn costs"),
        }),
        handler: async (args) => {
            const { waveCount, startingDifficulty, difficultyScale, enemyTypes } = args;
            const waves = generateWaves(waveCount, startingDifficulty, difficultyScale, enemyTypes);
            return {
                waveCount,
                waves,
                hint: "Save as .tres resource or use directly in your wave spawner",
            };
        },
    });
}
// TRES parser
function parseTres(content) {
    const result = {};
    const lines = content.split("\n");
    let currentSection = "";
    for (const line of lines) {
        const trimmed = line.trim();
        // Header
        const headerMatch = trimmed.match(/\[gd_resource\s+(.+)\]/);
        if (headerMatch) {
            const attrs = parseAttributes(headerMatch[1]);
            result._header = attrs;
            continue;
        }
        // Resource section
        if (trimmed === "[resource]") {
            currentSection = "resource";
            continue;
        }
        // Property
        if (currentSection === "resource" && trimmed.includes("=")) {
            const eqIndex = trimmed.indexOf("=");
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();
            result[key] = parseValue(value);
        }
    }
    return result;
}
function parseAttributes(attrString) {
    const attrs = {};
    const regex = /(\w+)="([^"]*)"/g;
    let match;
    while ((match = regex.exec(attrString)) !== null) {
        attrs[match[1]] = match[2];
    }
    return attrs;
}
function parseValue(str) {
    str = str.trim();
    if (str === "null")
        return null;
    if (str === "true")
        return true;
    if (str === "false")
        return false;
    if (str.startsWith('"') && str.endsWith('"'))
        return str.slice(1, -1);
    if (/^-?\d+$/.test(str))
        return parseInt(str, 10);
    if (/^-?\d+\.\d+$/.test(str))
        return parseFloat(str);
    return str;
}
// TRES serializer
function serializeTres(resourceType, scriptPath, scriptClass, properties) {
    const lines = [];
    // Header
    let header = `[gd_resource type="${resourceType}"`;
    if (scriptClass) {
        header += ` script_class="${scriptClass}"`;
    }
    const loadSteps = scriptPath ? 2 : 1;
    header += ` load_steps=${loadSteps} format=3]`;
    lines.push(header);
    lines.push("");
    // External resource (script)
    if (scriptPath) {
        lines.push(`[ext_resource type="Script" path="${scriptPath}" id="1_script"]`);
        lines.push("");
    }
    // Resource section
    lines.push("[resource]");
    if (scriptPath) {
        lines.push('script = ExtResource("1_script")');
    }
    if (properties) {
        for (const [key, value] of Object.entries(properties)) {
            lines.push(`${key} = ${serializeValue(value)}`);
        }
    }
    return lines.join("\n") + "\n";
}
function serializeValue(value) {
    if (value === null)
        return "null";
    if (typeof value === "boolean")
        return value ? "true" : "false";
    if (typeof value === "number")
        return String(value);
    if (typeof value === "string")
        return `"${value}"`;
    if (Array.isArray(value)) {
        return `[${value.map(serializeValue).join(", ")}]`;
    }
    if (typeof value === "object") {
        const obj = value;
        if (obj._type === "Vector2")
            return `Vector2(${obj.x}, ${obj.y})`;
        if (obj._type === "Vector3")
            return `Vector3(${obj.x}, ${obj.y}, ${obj.z})`;
        if (obj._type === "Color")
            return `Color(${obj.r}, ${obj.g}, ${obj.b}, ${obj.a})`;
    }
    return String(value);
}
// Simple RNG
function createRNG(seed) {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}
function generateRooms(count, minSize, maxSize, gridWidth, gridHeight, rng) {
    const rooms = [];
    const maxAttempts = count * 20;
    let attempts = 0;
    while (rooms.length < count && attempts < maxAttempts) {
        attempts++;
        const width = Math.floor(rng() * (maxSize - minSize + 1)) + minSize;
        const height = Math.floor(rng() * (maxSize - minSize + 1)) + minSize;
        const x = Math.floor(rng() * (gridWidth - width - 2)) + 1;
        const y = Math.floor(rng() * (gridHeight - height - 2)) + 1;
        const newRoom = {
            x,
            y,
            width,
            height,
            centerX: Math.floor(x + width / 2),
            centerY: Math.floor(y + height / 2),
        };
        // Check for overlap
        let overlaps = false;
        for (const room of rooms) {
            if (newRoom.x < room.x + room.width + 2 &&
                newRoom.x + newRoom.width + 2 > room.x &&
                newRoom.y < room.y + room.height + 2 &&
                newRoom.y + newRoom.height + 2 > room.y) {
                overlaps = true;
                break;
            }
        }
        if (!overlaps) {
            rooms.push(newRoom);
        }
    }
    return rooms;
}
function connectRooms(rooms, rng) {
    const corridors = [];
    const connected = new Set();
    connected.add(0);
    while (connected.size < rooms.length) {
        let minDist = Infinity;
        let bestFrom = -1;
        let bestTo = -1;
        for (const fromIdx of connected) {
            for (let toIdx = 0; toIdx < rooms.length; toIdx++) {
                if (connected.has(toIdx))
                    continue;
                const from = rooms[fromIdx];
                const to = rooms[toIdx];
                const dist = Math.abs(from.centerX - to.centerX) + Math.abs(from.centerY - to.centerY);
                if (dist < minDist) {
                    minDist = dist;
                    bestFrom = fromIdx;
                    bestTo = toIdx;
                }
            }
        }
        if (bestTo !== -1) {
            const from = rooms[bestFrom];
            const to = rooms[bestTo];
            // L-shaped corridor
            if (rng() > 0.5) {
                corridors.push({
                    x1: from.centerX,
                    y1: from.centerY,
                    x2: to.centerX,
                    y2: from.centerY,
                });
                corridors.push({
                    x1: to.centerX,
                    y1: from.centerY,
                    x2: to.centerX,
                    y2: to.centerY,
                });
            }
            else {
                corridors.push({
                    x1: from.centerX,
                    y1: from.centerY,
                    x2: from.centerX,
                    y2: to.centerY,
                });
                corridors.push({
                    x1: from.centerX,
                    y1: to.centerY,
                    x2: to.centerX,
                    y2: to.centerY,
                });
            }
            connected.add(bestTo);
        }
    }
    return corridors;
}
function generateDungeonScene(rooms, corridors, tileSize) {
    const lines = [];
    lines.push(`[gd_scene load_steps=1 format=3]`);
    lines.push("");
    lines.push(`[node name="Dungeon" type="Node2D"]`);
    lines.push("");
    // Add room markers
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        lines.push(`[node name="Room${i}" type="Marker2D" parent="."]`);
        lines.push(`position = Vector2(${room.centerX * tileSize}, ${room.centerY * tileSize})`);
        lines.push("");
    }
    // Add spawn point at first room
    if (rooms.length > 0) {
        lines.push(`[node name="SpawnPoint" type="Marker2D" parent="."]`);
        lines.push(`position = Vector2(${rooms[0].centerX * tileSize}, ${rooms[0].centerY * tileSize})`);
        lines.push("");
    }
    // Add exit point at last room
    if (rooms.length > 1) {
        const lastRoom = rooms[rooms.length - 1];
        lines.push(`[node name="ExitPoint" type="Marker2D" parent="."]`);
        lines.push(`position = Vector2(${lastRoom.centerX * tileSize}, ${lastRoom.centerY * tileSize})`);
        lines.push("");
    }
    return lines.join("\n");
}
// Pattern generators
function generatePlatforms(width, height, density, rng) {
    const tiles = Array(height)
        .fill(null)
        .map(() => Array(width).fill(0));
    // Ground
    for (let x = 0; x < width; x++) {
        tiles[height - 1][x] = 1;
    }
    // Platforms
    const platformCount = Math.floor(width * height * density * 0.01);
    for (let i = 0; i < platformCount; i++) {
        const px = Math.floor(rng() * (width - 5));
        const py = Math.floor(rng() * (height - 3)) + 1;
        const pwidth = Math.floor(rng() * 5) + 3;
        for (let x = px; x < px + pwidth && x < width; x++) {
            tiles[py][x] = 1;
        }
    }
    return tiles;
}
function generateTerrain(width, height, density, rng) {
    const tiles = Array(height)
        .fill(null)
        .map(() => Array(width).fill(0));
    // Generate heightmap using simple noise
    const groundLevel = Math.floor(height * (1 - density));
    for (let x = 0; x < width; x++) {
        const noise = Math.sin(x * 0.2) * 3 + Math.sin(x * 0.05) * 5;
        const terrainHeight = Math.floor(groundLevel + noise);
        for (let y = terrainHeight; y < height; y++) {
            if (y >= 0 && y < height) {
                tiles[y][x] = 1;
            }
        }
    }
    return tiles;
}
function generateMaze(width, height, rng) {
    // Ensure odd dimensions for proper maze
    const w = width % 2 === 0 ? width + 1 : width;
    const h = height % 2 === 0 ? height + 1 : height;
    const tiles = Array(h)
        .fill(null)
        .map(() => Array(w).fill(1));
    const stack = [];
    const startX = 1;
    const startY = 1;
    tiles[startY][startX] = 0;
    stack.push([startX, startY]);
    const directions = [
        [0, -2],
        [2, 0],
        [0, 2],
        [-2, 0],
    ];
    while (stack.length > 0) {
        const [cx, cy] = stack[stack.length - 1];
        const unvisited = [];
        for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && tiles[ny][nx] === 1) {
                unvisited.push([nx, ny, cx + dx / 2, cy + dy / 2]);
            }
        }
        if (unvisited.length > 0) {
            const idx = Math.floor(rng() * unvisited.length);
            const [nx, ny, wx, wy] = unvisited[idx];
            tiles[ny][nx] = 0;
            tiles[wy][wx] = 0;
            stack.push([nx, ny]);
        }
        else {
            stack.pop();
        }
    }
    return tiles;
}
function generateCave(width, height, density, rng) {
    // Cellular automata cave generation
    let tiles = Array(height)
        .fill(null)
        .map(() => Array(width)
        .fill(0)
        .map(() => (rng() < density ? 1 : 0)));
    // Borders are always solid
    for (let x = 0; x < width; x++) {
        tiles[0][x] = 1;
        tiles[height - 1][x] = 1;
    }
    for (let y = 0; y < height; y++) {
        tiles[y][0] = 1;
        tiles[y][width - 1] = 1;
    }
    // Apply cellular automata rules
    for (let iteration = 0; iteration < 5; iteration++) {
        const newTiles = Array(height)
            .fill(null)
            .map(() => Array(width).fill(0));
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let neighbors = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (tiles[y + dy][x + dx] === 1)
                            neighbors++;
                    }
                }
                newTiles[y][x] = neighbors >= 5 ? 1 : 0;
            }
        }
        // Keep borders solid
        for (let x = 0; x < width; x++) {
            newTiles[0][x] = 1;
            newTiles[height - 1][x] = 1;
        }
        for (let y = 0; y < height; y++) {
            newTiles[y][0] = 1;
            newTiles[y][width - 1] = 1;
        }
        tiles = newTiles;
    }
    return tiles;
}
// Wave generator
function generateWaves(waveCount, startingDifficulty, difficultyScale, enemyTypes) {
    const waves = [];
    for (let w = 1; w <= waveCount; w++) {
        const budget = Math.floor(startingDifficulty * 10 * Math.pow(difficultyScale, w - 1));
        const enemies = {};
        // Get available enemies for this wave
        const available = enemyTypes.filter((e) => e.minWave <= w);
        if (available.length === 0)
            continue;
        let remaining = budget;
        while (remaining > 0) {
            // Pick random enemy that fits budget
            const affordable = available.filter((e) => e.baseCost <= remaining);
            if (affordable.length === 0)
                break;
            const enemy = affordable[Math.floor(Math.random() * affordable.length)];
            enemies[enemy.name] = (enemies[enemy.name] || 0) + 1;
            remaining -= enemy.baseCost;
        }
        waves.push({ wave: w, budget, enemies });
    }
    return waves;
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
//# sourceMappingURL=resource-tools.js.map
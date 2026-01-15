/**
 * Shader manipulation tools for Godot MCP
 */
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
export function registerShaderTools(tools, state) {
    // Read a shader file
    tools.set("godot_read_shader", {
        description: "Read a Godot shader file (.gdshader) and return its content along with parsed metadata (type, uniforms, functions).",
        inputSchema: z.object({
            path: z.string().describe("Path to the shader file"),
        }),
        handler: async (args) => {
            const { path: shaderPath } = args;
            const fullPath = resolvePath(shaderPath, state.projectPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const metadata = parseShader(content);
            return {
                path: shaderPath,
                content,
                metadata,
                lineCount: content.split("\n").length,
            };
        },
    });
    // Write a shader file
    tools.set("godot_write_shader", {
        description: "Create or update a Godot shader file (.gdshader). Writes the provided shader code to the file.",
        inputSchema: z.object({
            path: z.string().describe("Path where the shader should be written"),
            content: z.string().describe("The shader code to write"),
        }),
        handler: async (args) => {
            const { path: shaderPath, content } = args;
            const fullPath = resolvePath(shaderPath, state.projectPath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            const metadata = parseShader(content);
            return {
                success: true,
                path: shaderPath,
                metadata,
            };
        },
    });
    // Generate a shader from description
    tools.set("godot_generate_shader", {
        description: "Generate a Godot shader based on a description and shader type. Creates properly structured .gdshader code.",
        inputSchema: z.object({
            description: z
                .string()
                .describe("Description of what the shader should do"),
            shaderType: z
                .enum(["canvas_item", "spatial", "particles", "sky", "fog"])
                .describe("Type of shader to generate"),
            effect: z
                .enum([
                "custom",
                "flash",
                "outline",
                "dissolve",
                "pixelate",
                "wave",
                "gradient_map",
                "chromatic_aberration",
                "vignette",
                "crt",
                "hologram",
                "fresnel",
            ])
                .optional()
                .describe("Predefined effect type to generate"),
        }),
        handler: async (args) => {
            const { description, shaderType, effect } = args;
            const shader = generateShader(description, shaderType, effect);
            return {
                generatedShader: shader,
                metadata: parseShader(shader),
                hint: "Use godot_write_shader to save this shader to a file",
            };
        },
    });
    // List all shaders in project
    tools.set("godot_list_shaders", {
        description: "List all shader files (.gdshader) in the Godot project.",
        inputSchema: z.object({
            directory: z
                .string()
                .optional()
                .describe("Subdirectory to search in (e.g., 'shaders')"),
        }),
        handler: async (args) => {
            const { directory } = args;
            const searchPath = directory
                ? path.join(state.projectPath || ".", directory)
                : state.projectPath || ".";
            const shaders = await findFiles(searchPath, ".gdshader");
            const shaderInfos = await Promise.all(shaders.map(async (shaderPath) => {
                try {
                    const content = await fs.readFile(shaderPath, "utf-8");
                    const metadata = parseShader(content);
                    return {
                        path: path.relative(state.projectPath || ".", shaderPath),
                        resPath: `res://${path.relative(state.projectPath || ".", shaderPath)}`,
                        type: metadata.type,
                        uniformCount: metadata.uniforms.length,
                    };
                }
                catch {
                    return {
                        path: path.relative(state.projectPath || ".", shaderPath),
                        error: "Could not parse",
                    };
                }
            }));
            return {
                projectPath: state.projectPath,
                directory: directory || ".",
                shaders: shaderInfos,
                count: shaders.length,
            };
        },
    });
}
// Shader parser
function parseShader(content) {
    const lines = content.split("\n");
    const metadata = {
        type: "canvas_item",
        renderModes: [],
        uniforms: [],
        varyings: [],
        functions: [],
    };
    for (const line of lines) {
        const trimmed = line.trim();
        // Shader type
        const typeMatch = trimmed.match(/^shader_type\s+(\w+)/);
        if (typeMatch) {
            metadata.type = typeMatch[1];
            continue;
        }
        // Render modes
        const renderMatch = trimmed.match(/^render_mode\s+(.+);/);
        if (renderMatch) {
            metadata.renderModes = renderMatch[1].split(",").map((m) => m.trim());
            continue;
        }
        // Uniforms
        const uniformMatch = trimmed.match(/^(?:uniform|instance\s+uniform)\s+(\w+)\s+(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?;/);
        if (uniformMatch) {
            metadata.uniforms.push({
                name: uniformMatch[2],
                type: uniformMatch[1],
                hint: uniformMatch[3]?.trim(),
                default: uniformMatch[4]?.trim(),
            });
            continue;
        }
        // Varyings
        const varyingMatch = trimmed.match(/^varying\s+(\w+)\s+(\w+);/);
        if (varyingMatch) {
            metadata.varyings.push({
                name: varyingMatch[2],
                type: varyingMatch[1],
            });
            continue;
        }
        // Functions
        const funcMatch = trimmed.match(/^void\s+(\w+)\s*\(/);
        if (funcMatch) {
            metadata.functions.push(funcMatch[1]);
        }
    }
    return metadata;
}
// Shader generator
function generateShader(description, shaderType, effect) {
    // If a predefined effect is requested, use that template
    if (effect && effect !== "custom") {
        return getEffectTemplate(effect, shaderType);
    }
    // Generate based on shader type and description
    const lines = [];
    lines.push(`shader_type ${shaderType};`);
    lines.push("");
    lines.push(`// ${description}`);
    lines.push("");
    // Add common uniforms based on description keywords
    const descLower = description.toLowerCase();
    if (shaderType === "canvas_item") {
        if (descLower.includes("color") || descLower.includes("tint")) {
            lines.push("uniform vec4 tint_color : source_color = vec4(1.0);");
        }
        if (descLower.includes("intensity") || descLower.includes("strength")) {
            lines.push("uniform float intensity : hint_range(0.0, 1.0) = 0.5;");
        }
        if (descLower.includes("texture") || descLower.includes("noise")) {
            lines.push("uniform sampler2D effect_texture : hint_default_white;");
        }
        if (descLower.includes("speed") || descLower.includes("animate")) {
            lines.push("uniform float speed : hint_range(0.0, 10.0) = 1.0;");
        }
        lines.push("");
        lines.push("void fragment() {");
        lines.push("\tvec4 tex_color = texture(TEXTURE, UV);");
        lines.push("\t// TODO: Implement effect");
        lines.push("\tCOLOR = tex_color;");
        lines.push("}");
    }
    else if (shaderType === "spatial") {
        lines.push("uniform vec4 albedo_color : source_color = vec4(1.0);");
        lines.push("uniform float metallic : hint_range(0.0, 1.0) = 0.0;");
        lines.push("uniform float roughness : hint_range(0.0, 1.0) = 0.5;");
        lines.push("");
        lines.push("void fragment() {");
        lines.push("\tALBEDO = albedo_color.rgb;");
        lines.push("\tMETALLIC = metallic;");
        lines.push("\tROUGHNESS = roughness;");
        lines.push("}");
    }
    else if (shaderType === "particles") {
        lines.push("uniform float initial_speed : hint_range(0.0, 100.0) = 10.0;");
        lines.push("");
        lines.push("void start() {");
        lines.push("\tVELOCITY = vec3(0.0, initial_speed, 0.0);");
        lines.push("}");
        lines.push("");
        lines.push("void process() {");
        lines.push("\tVELOCITY.y -= 9.8 * DELTA;");
        lines.push("\tCOLOR.a = 1.0 - LIFETIME;");
        lines.push("}");
    }
    return lines.join("\n");
}
function getEffectTemplate(effect, shaderType) {
    const templates = {
        flash: `shader_type canvas_item;

// Flash/Hit effect - makes sprite flash a solid color
uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
    vec4 tex_color = texture(TEXTURE, UV);
    COLOR = mix(tex_color, flash_color, flash_amount);
    COLOR.a = tex_color.a;
}`,
        outline: `shader_type canvas_item;

// Outline effect - adds colored outline around sprite
uniform vec4 outline_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float outline_width : hint_range(0.0, 10.0) = 1.0;

void fragment() {
    vec2 size = TEXTURE_PIXEL_SIZE * outline_width;

    float outline = texture(TEXTURE, UV + vec2(-size.x, 0)).a;
    outline += texture(TEXTURE, UV + vec2(size.x, 0)).a;
    outline += texture(TEXTURE, UV + vec2(0, -size.y)).a;
    outline += texture(TEXTURE, UV + vec2(0, size.y)).a;
    outline += texture(TEXTURE, UV + vec2(-size.x, -size.y)).a;
    outline += texture(TEXTURE, UV + vec2(size.x, -size.y)).a;
    outline += texture(TEXTURE, UV + vec2(-size.x, size.y)).a;
    outline += texture(TEXTURE, UV + vec2(size.x, size.y)).a;
    outline = min(outline, 1.0);

    vec4 tex_color = texture(TEXTURE, UV);
    COLOR = mix(outline_color * outline, tex_color, tex_color.a);
}`,
        dissolve: `shader_type canvas_item;

// Dissolve effect - gradually dissolves sprite using noise
uniform sampler2D dissolve_texture : hint_default_white;
uniform float dissolve_amount : hint_range(0.0, 1.0) = 0.0;
uniform float edge_width : hint_range(0.0, 0.2) = 0.05;
uniform vec4 edge_color : source_color = vec4(1.0, 0.5, 0.0, 1.0);

void fragment() {
    vec4 tex_color = texture(TEXTURE, UV);
    float noise = texture(dissolve_texture, UV).r;

    float edge = smoothstep(dissolve_amount, dissolve_amount + edge_width, noise);
    float alpha = step(dissolve_amount, noise);

    COLOR = mix(edge_color, tex_color, edge);
    COLOR.a = tex_color.a * alpha;
}`,
        pixelate: `shader_type canvas_item;

// Pixelate effect - reduces resolution for retro look
uniform float pixel_size : hint_range(1.0, 100.0) = 4.0;

void fragment() {
    vec2 grid_uv = round(UV * pixel_size) / pixel_size;
    COLOR = texture(TEXTURE, grid_uv);
}`,
        wave: `shader_type canvas_item;

// Wave distortion effect
uniform float wave_amplitude : hint_range(0.0, 0.1) = 0.02;
uniform float wave_frequency : hint_range(0.0, 50.0) = 10.0;
uniform float wave_speed : hint_range(0.0, 10.0) = 2.0;

void fragment() {
    vec2 uv = UV;
    uv.x += sin(uv.y * wave_frequency + TIME * wave_speed) * wave_amplitude;
    uv.y += cos(uv.x * wave_frequency + TIME * wave_speed) * wave_amplitude * 0.5;
    COLOR = texture(TEXTURE, uv);
}`,
        gradient_map: `shader_type canvas_item;

// Gradient map - remaps colors using a gradient texture
uniform sampler2D gradient : hint_default_white;
uniform float mix_amount : hint_range(0.0, 1.0) = 1.0;

void fragment() {
    vec4 tex_color = texture(TEXTURE, UV);
    float luminance = dot(tex_color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 mapped = texture(gradient, vec2(luminance, 0.0)).rgb;
    COLOR = vec4(mix(tex_color.rgb, mapped, mix_amount), tex_color.a);
}`,
        chromatic_aberration: `shader_type canvas_item;

// Chromatic aberration - RGB color channel separation
uniform float offset : hint_range(0.0, 0.02) = 0.005;

void fragment() {
    vec2 dir = UV - vec2(0.5);
    float r = texture(TEXTURE, UV + dir * offset).r;
    float g = texture(TEXTURE, UV).g;
    float b = texture(TEXTURE, UV - dir * offset).b;
    float a = texture(TEXTURE, UV).a;
    COLOR = vec4(r, g, b, a);
}`,
        vignette: `shader_type canvas_item;

// Vignette - darkens edges of screen
uniform float vignette_intensity : hint_range(0.0, 1.0) = 0.4;
uniform float vignette_opacity : hint_range(0.0, 1.0) = 0.5;

void fragment() {
    vec4 color = texture(TEXTURE, UV);

    float vignette = UV.x * UV.y * (1.0 - UV.x) * (1.0 - UV.y);
    vignette = clamp(pow(16.0 * vignette, vignette_intensity), 0.0, 1.0);

    color.rgb = mix(color.rgb, color.rgb * vignette, vignette_opacity);
    COLOR = color;
}`,
        crt: `shader_type canvas_item;

// CRT monitor effect with scanlines and curvature
uniform float scanline_count : hint_range(0.0, 1000.0) = 400.0;
uniform float scanline_intensity : hint_range(0.0, 1.0) = 0.1;
uniform float curvature : hint_range(0.0, 0.1) = 0.02;

void fragment() {
    vec2 uv = UV - 0.5;
    float dist = dot(uv, uv);
    uv *= 1.0 + dist * curvature;
    uv += 0.5;

    vec4 color = texture(TEXTURE, uv);

    float scanline = sin(uv.y * scanline_count * PI) * 0.5 + 0.5;
    color.rgb -= scanline_intensity * scanline;

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        color = vec4(0.0);
    }

    COLOR = color;
}`,
        hologram: `shader_type spatial;
render_mode cull_disabled, depth_draw_opaque;

// Hologram effect for 3D objects
uniform vec4 hologram_color : source_color = vec4(0.0, 1.0, 1.0, 1.0);
uniform float scan_speed : hint_range(0.0, 10.0) = 2.0;
uniform float scan_line_count : hint_range(10.0, 200.0) = 50.0;
uniform float flicker_speed : hint_range(0.0, 20.0) = 5.0;

void fragment() {
    float scan = sin((UV.y + TIME * scan_speed) * scan_line_count) * 0.5 + 0.5;
    float flicker = sin(TIME * flicker_speed) * 0.1 + 0.9;
    float fresnel = pow(1.0 - dot(NORMAL, VIEW), 2.0);

    ALBEDO = hologram_color.rgb;
    EMISSION = hologram_color.rgb * (scan * 0.5 + 0.5) * flicker;
    ALPHA = (fresnel + 0.3) * scan * flicker * hologram_color.a;
}`,
        fresnel: `shader_type spatial;

// Fresnel/rim lighting effect
uniform vec4 rim_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float rim_power : hint_range(0.0, 10.0) = 3.0;
uniform vec4 albedo_color : source_color = vec4(0.2, 0.2, 0.2, 1.0);

void fragment() {
    float fresnel = pow(1.0 - dot(NORMAL, VIEW), rim_power);
    ALBEDO = albedo_color.rgb;
    EMISSION = rim_color.rgb * fresnel * rim_color.a;
}`,
    };
    return templates[effect] || templates["flash"];
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
//# sourceMappingURL=shader-tools.js.map
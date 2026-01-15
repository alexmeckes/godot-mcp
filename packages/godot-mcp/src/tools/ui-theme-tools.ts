import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import type { ToolHandler, ServerState } from "../index.js";

// Color schema
const ColorSchema = z.object({
  r: z.number().min(0).max(1).describe("Red component (0-1)"),
  g: z.number().min(0).max(1).describe("Green component (0-1)"),
  b: z.number().min(0).max(1).describe("Blue component (0-1)"),
  a: z.number().min(0).max(1).optional().default(1).describe("Alpha component (0-1)"),
});

// StyleBox schema for panels, buttons, etc.
const StyleBoxSchema = z.object({
  bg_color: ColorSchema.optional().describe("Background color"),
  border_color: ColorSchema.optional().describe("Border color"),
  border_width: z.number().optional().describe("Border width in pixels"),
  corner_radius: z.number().optional().describe("Corner radius in pixels"),
  content_margin_left: z.number().optional().describe("Left content margin"),
  content_margin_right: z.number().optional().describe("Right content margin"),
  content_margin_top: z.number().optional().describe("Top content margin"),
  content_margin_bottom: z.number().optional().describe("Bottom content margin"),
  shadow_color: ColorSchema.optional().describe("Shadow color"),
  shadow_size: z.number().optional().describe("Shadow size in pixels"),
  shadow_offset: z.object({
    x: z.number(),
    y: z.number(),
  }).optional().describe("Shadow offset"),
});

export function registerUIThemeTools(
  tools: Map<string, ToolHandler>,
  state: ServerState
): void {
  // Create a complete UI theme
  tools.set("godot_ui_create_theme", {
    description:
      "Create a Godot Theme resource (.tres) with colors, fonts, and styleboxes for consistent UI styling. Generates a complete theme file that can be applied to Control nodes.",
    inputSchema: z.object({
      path: z.string().describe("Output path for the theme file (e.g., 'res://themes/game_theme.tres')"),
      name: z.string().optional().describe("Theme name for reference"),
      colors: z.object({
        primary: ColorSchema.optional().describe("Primary accent color"),
        secondary: ColorSchema.optional().describe("Secondary accent color"),
        background: ColorSchema.optional().describe("Background color"),
        surface: ColorSchema.optional().describe("Surface/panel color"),
        text: ColorSchema.optional().describe("Primary text color"),
        text_secondary: ColorSchema.optional().describe("Secondary/muted text color"),
        success: ColorSchema.optional().describe("Success/positive color"),
        warning: ColorSchema.optional().describe("Warning color"),
        error: ColorSchema.optional().describe("Error/danger color"),
      }).optional().describe("Color palette for the theme"),
      font_size: z.number().optional().describe("Base font size in pixels"),
      styleboxes: z.object({
        panel: StyleBoxSchema.optional().describe("Default panel style"),
        button_normal: StyleBoxSchema.optional().describe("Button normal state"),
        button_hover: StyleBoxSchema.optional().describe("Button hover state"),
        button_pressed: StyleBoxSchema.optional().describe("Button pressed state"),
        button_disabled: StyleBoxSchema.optional().describe("Button disabled state"),
      }).optional().describe("StyleBox definitions for UI elements"),
      preset: z.enum(["dark", "light", "game", "minimal"]).optional()
        .describe("Use a preset theme as base (dark, light, game, minimal)"),
    }),
    handler: async (args) => {
      const {
        path: themePath,
        name,
        colors,
        font_size,
        styleboxes,
        preset,
      } = args as {
        path: string;
        name?: string;
        colors?: Record<string, { r: number; g: number; b: number; a?: number }>;
        font_size?: number;
        styleboxes?: Record<string, unknown>;
        preset?: string;
      };

      // Get preset defaults
      const presetColors = getPresetColors(preset || "dark");
      const presetStyleboxes = getPresetStyleboxes(preset || "dark");

      // Merge user colors with preset
      const finalColors = { ...presetColors, ...colors };
      const finalStyleboxes = { ...presetStyleboxes, ...styleboxes };

      // Generate .tres content
      const themeContent = generateThemeFile(
        name || "UITheme",
        finalColors,
        font_size || 16,
        finalStyleboxes
      );

      // Resolve path
      let outputPath = themePath;
      if (themePath.startsWith("res://") && state.projectPath) {
        outputPath = path.join(state.projectPath, themePath.replace("res://", ""));
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Write theme file
      await fs.writeFile(outputPath, themeContent, "utf-8");

      return {
        success: true,
        path: themePath,
        message: `Created theme at ${themePath}`,
        colors: Object.keys(finalColors),
        styleboxes: Object.keys(finalStyleboxes),
      };
    },
  });

  // Generate a StyleBox resource
  tools.set("godot_ui_create_stylebox", {
    description:
      "Create a StyleBoxFlat resource for styling UI elements like panels, buttons, and containers.",
    inputSchema: z.object({
      path: z.string().describe("Output path for the stylebox file"),
      bg_color: ColorSchema.describe("Background color"),
      border_color: ColorSchema.optional().describe("Border color"),
      border_width: z.number().optional().describe("Border width (applies to all sides)"),
      corner_radius: z.number().optional().describe("Corner radius (applies to all corners)"),
      content_margins: z.number().optional().describe("Content margin (applies to all sides)"),
      shadow_color: ColorSchema.optional().describe("Shadow color"),
      shadow_size: z.number().optional().describe("Shadow size"),
    }),
    handler: async (args) => {
      const {
        path: boxPath,
        bg_color,
        border_color,
        border_width,
        corner_radius,
        content_margins,
        shadow_color,
        shadow_size,
      } = args as {
        path: string;
        bg_color: { r: number; g: number; b: number; a?: number };
        border_color?: { r: number; g: number; b: number; a?: number };
        border_width?: number;
        corner_radius?: number;
        content_margins?: number;
        shadow_color?: { r: number; g: number; b: number; a?: number };
        shadow_size?: number;
      };

      const content = generateStyleBoxFlat(
        bg_color,
        border_color,
        border_width,
        corner_radius,
        content_margins,
        shadow_color,
        shadow_size
      );

      let outputPath = boxPath;
      if (boxPath.startsWith("res://") && state.projectPath) {
        outputPath = path.join(state.projectPath, boxPath.replace("res://", ""));
      }

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, content, "utf-8");

      return {
        success: true,
        path: boxPath,
        message: `Created StyleBoxFlat at ${boxPath}`,
      };
    },
  });

  // List available theme presets
  tools.set("godot_ui_list_presets", {
    description: "List available theme presets with their color schemes",
    inputSchema: z.object({}),
    handler: async () => {
      return {
        presets: [
          {
            name: "dark",
            description: "Dark theme with blue accents, good for games",
            colors: getPresetColors("dark"),
          },
          {
            name: "light",
            description: "Light theme with clean aesthetics",
            colors: getPresetColors("light"),
          },
          {
            name: "game",
            description: "Game-focused theme with bold colors",
            colors: getPresetColors("game"),
          },
          {
            name: "minimal",
            description: "Minimal theme with subtle styling",
            colors: getPresetColors("minimal"),
          },
        ],
      };
    },
  });
}

// Preset color schemes
function getPresetColors(preset: string): Record<string, { r: number; g: number; b: number; a: number }> {
  const presets: Record<string, Record<string, { r: number; g: number; b: number; a: number }>> = {
    dark: {
      primary: { r: 0.3, g: 0.5, b: 0.8, a: 1 },
      secondary: { r: 0.5, g: 0.3, b: 0.7, a: 1 },
      background: { r: 0.1, g: 0.1, b: 0.12, a: 1 },
      surface: { r: 0.15, g: 0.15, b: 0.18, a: 1 },
      text: { r: 0.9, g: 0.9, b: 0.9, a: 1 },
      text_secondary: { r: 0.6, g: 0.6, b: 0.65, a: 1 },
      success: { r: 0.3, g: 0.7, b: 0.4, a: 1 },
      warning: { r: 0.9, g: 0.7, b: 0.2, a: 1 },
      error: { r: 0.8, g: 0.3, b: 0.3, a: 1 },
    },
    light: {
      primary: { r: 0.2, g: 0.4, b: 0.7, a: 1 },
      secondary: { r: 0.4, g: 0.2, b: 0.6, a: 1 },
      background: { r: 0.95, g: 0.95, b: 0.97, a: 1 },
      surface: { r: 1, g: 1, b: 1, a: 1 },
      text: { r: 0.1, g: 0.1, b: 0.15, a: 1 },
      text_secondary: { r: 0.4, g: 0.4, b: 0.45, a: 1 },
      success: { r: 0.2, g: 0.6, b: 0.3, a: 1 },
      warning: { r: 0.8, g: 0.6, b: 0.1, a: 1 },
      error: { r: 0.7, g: 0.2, b: 0.2, a: 1 },
    },
    game: {
      primary: { r: 0.9, g: 0.6, b: 0.1, a: 1 },      // Gold
      secondary: { r: 0.6, g: 0.2, b: 0.2, a: 1 },    // Dark red
      background: { r: 0.08, g: 0.06, b: 0.04, a: 1 }, // Very dark brown
      surface: { r: 0.15, g: 0.12, b: 0.08, a: 1 },   // Dark brown
      text: { r: 0.95, g: 0.9, b: 0.8, a: 1 },        // Cream
      text_secondary: { r: 0.7, g: 0.65, b: 0.55, a: 1 },
      success: { r: 0.4, g: 0.8, b: 0.4, a: 1 },
      warning: { r: 0.9, g: 0.7, b: 0.2, a: 1 },
      error: { r: 0.9, g: 0.3, b: 0.2, a: 1 },
    },
    minimal: {
      primary: { r: 0.3, g: 0.3, b: 0.35, a: 1 },
      secondary: { r: 0.4, g: 0.4, b: 0.45, a: 1 },
      background: { r: 0.12, g: 0.12, b: 0.14, a: 1 },
      surface: { r: 0.18, g: 0.18, b: 0.2, a: 1 },
      text: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
      text_secondary: { r: 0.55, g: 0.55, b: 0.55, a: 1 },
      success: { r: 0.5, g: 0.7, b: 0.5, a: 1 },
      warning: { r: 0.7, g: 0.6, b: 0.3, a: 1 },
      error: { r: 0.7, g: 0.4, b: 0.4, a: 1 },
    },
  };

  return presets[preset] || presets.dark;
}

// Preset styleboxes
function getPresetStyleboxes(preset: string): Record<string, unknown> {
  const colors = getPresetColors(preset);

  return {
    panel: {
      bg_color: colors.surface,
      border_color: colors.primary,
      border_width: 1,
      corner_radius: 4,
      content_margin_left: 8,
      content_margin_right: 8,
      content_margin_top: 8,
      content_margin_bottom: 8,
    },
    button_normal: {
      bg_color: colors.surface,
      border_color: colors.primary,
      border_width: 1,
      corner_radius: 4,
      content_margin_left: 12,
      content_margin_right: 12,
      content_margin_top: 8,
      content_margin_bottom: 8,
    },
    button_hover: {
      bg_color: colors.primary,
      border_color: colors.primary,
      border_width: 1,
      corner_radius: 4,
      content_margin_left: 12,
      content_margin_right: 12,
      content_margin_top: 8,
      content_margin_bottom: 8,
    },
    button_pressed: {
      bg_color: { ...colors.primary, r: colors.primary.r * 0.8, g: colors.primary.g * 0.8, b: colors.primary.b * 0.8 },
      border_color: colors.primary,
      border_width: 1,
      corner_radius: 4,
      content_margin_left: 12,
      content_margin_right: 12,
      content_margin_top: 8,
      content_margin_bottom: 8,
    },
  };
}

// Generate .tres theme file content
function generateThemeFile(
  name: string,
  colors: Record<string, { r: number; g: number; b: number; a?: number }>,
  fontSize: number,
  styleboxes: Record<string, unknown>
): string {
  let content = `[gd_resource type="Theme" format=3]\n\n`;

  // Add sub-resources for styleboxes
  let subResourceId = 1;
  const styleboxIds: Record<string, number> = {};

  for (const [key, box] of Object.entries(styleboxes)) {
    if (box && typeof box === "object") {
      const boxData = box as Record<string, unknown>;
      content += `[sub_resource type="StyleBoxFlat" id="StyleBoxFlat_${subResourceId}"]\n`;

      if (boxData.bg_color) {
        const c = boxData.bg_color as { r: number; g: number; b: number; a?: number };
        content += `bg_color = Color(${c.r}, ${c.g}, ${c.b}, ${c.a || 1})\n`;
      }

      if (boxData.border_color) {
        const c = boxData.border_color as { r: number; g: number; b: number; a?: number };
        content += `border_color = Color(${c.r}, ${c.g}, ${c.b}, ${c.a || 1})\n`;
      }

      if (boxData.border_width) {
        const w = boxData.border_width as number;
        content += `border_width_left = ${w}\n`;
        content += `border_width_top = ${w}\n`;
        content += `border_width_right = ${w}\n`;
        content += `border_width_bottom = ${w}\n`;
      }

      if (boxData.corner_radius) {
        const r = boxData.corner_radius as number;
        content += `corner_radius_top_left = ${r}\n`;
        content += `corner_radius_top_right = ${r}\n`;
        content += `corner_radius_bottom_right = ${r}\n`;
        content += `corner_radius_bottom_left = ${r}\n`;
      }

      if (boxData.content_margin_left) content += `content_margin_left = ${boxData.content_margin_left}\n`;
      if (boxData.content_margin_right) content += `content_margin_right = ${boxData.content_margin_right}\n`;
      if (boxData.content_margin_top) content += `content_margin_top = ${boxData.content_margin_top}\n`;
      if (boxData.content_margin_bottom) content += `content_margin_bottom = ${boxData.content_margin_bottom}\n`;

      content += `\n`;
      styleboxIds[key] = subResourceId;
      subResourceId++;
    }
  }

  // Main theme resource
  content += `[resource]\n`;

  // Button styles
  if (styleboxIds.button_normal) {
    content += `Button/styles/normal = SubResource("StyleBoxFlat_${styleboxIds.button_normal}")\n`;
  }
  if (styleboxIds.button_hover) {
    content += `Button/styles/hover = SubResource("StyleBoxFlat_${styleboxIds.button_hover}")\n`;
  }
  if (styleboxIds.button_pressed) {
    content += `Button/styles/pressed = SubResource("StyleBoxFlat_${styleboxIds.button_pressed}")\n`;
  }

  // Panel styles
  if (styleboxIds.panel) {
    content += `Panel/styles/panel = SubResource("StyleBoxFlat_${styleboxIds.panel}")\n`;
    content += `PanelContainer/styles/panel = SubResource("StyleBoxFlat_${styleboxIds.panel}")\n`;
  }

  // Colors
  if (colors.text) {
    content += `Button/colors/font_color = Color(${colors.text.r}, ${colors.text.g}, ${colors.text.b}, ${colors.text.a || 1})\n`;
    content += `Label/colors/font_color = Color(${colors.text.r}, ${colors.text.g}, ${colors.text.b}, ${colors.text.a || 1})\n`;
  }

  // Font sizes
  content += `Button/font_sizes/font_size = ${fontSize}\n`;
  content += `Label/font_sizes/font_size = ${fontSize}\n`;

  return content;
}

// Generate StyleBoxFlat .tres file
function generateStyleBoxFlat(
  bgColor: { r: number; g: number; b: number; a?: number },
  borderColor?: { r: number; g: number; b: number; a?: number },
  borderWidth?: number,
  cornerRadius?: number,
  contentMargins?: number,
  shadowColor?: { r: number; g: number; b: number; a?: number },
  shadowSize?: number
): string {
  let content = `[gd_resource type="StyleBoxFlat" format=3]\n\n[resource]\n`;

  content += `bg_color = Color(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${bgColor.a || 1})\n`;

  if (borderColor) {
    content += `border_color = Color(${borderColor.r}, ${borderColor.g}, ${borderColor.b}, ${borderColor.a || 1})\n`;
  }

  if (borderWidth) {
    content += `border_width_left = ${borderWidth}\n`;
    content += `border_width_top = ${borderWidth}\n`;
    content += `border_width_right = ${borderWidth}\n`;
    content += `border_width_bottom = ${borderWidth}\n`;
  }

  if (cornerRadius) {
    content += `corner_radius_top_left = ${cornerRadius}\n`;
    content += `corner_radius_top_right = ${cornerRadius}\n`;
    content += `corner_radius_bottom_right = ${cornerRadius}\n`;
    content += `corner_radius_bottom_left = ${cornerRadius}\n`;
  }

  if (contentMargins) {
    content += `content_margin_left = ${contentMargins}\n`;
    content += `content_margin_top = ${contentMargins}\n`;
    content += `content_margin_right = ${contentMargins}\n`;
    content += `content_margin_bottom = ${contentMargins}\n`;
  }

  if (shadowColor) {
    content += `shadow_color = Color(${shadowColor.r}, ${shadowColor.g}, ${shadowColor.b}, ${shadowColor.a || 1})\n`;
  }

  if (shadowSize) {
    content += `shadow_size = ${shadowSize}\n`;
  }

  return content;
}

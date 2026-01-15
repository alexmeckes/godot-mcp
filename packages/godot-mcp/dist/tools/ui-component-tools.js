import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
// Button definition schema
const ButtonSchema = z.object({
    text: z.string().describe("Button label text"),
    name: z.string().optional().describe("Node name (defaults to sanitized text)"),
    signal: z.string().optional().describe("Signal name to emit on press"),
});
export function registerUIComponentTools(tools, state) {
    // Create a menu scene
    tools.set("godot_ui_create_menu", {
        description: "Create a menu scene with a title, buttons, and optional background. Perfect for main menus, pause menus, and settings screens.",
        inputSchema: z.object({
            path: z.string().describe("Output path for the scene file (e.g., 'res://scenes/ui/main_menu.tscn')"),
            title: z.string().describe("Menu title text"),
            buttons: z.array(ButtonSchema).describe("List of menu buttons"),
            theme_path: z.string().optional().describe("Path to theme resource to apply"),
            background_color: z.object({
                r: z.number(), g: z.number(), b: z.number(), a: z.number().optional(),
            }).optional().describe("Background color"),
            centered: z.boolean().optional().default(true).describe("Center the menu on screen"),
            button_min_width: z.number().optional().default(200).describe("Minimum button width"),
            spacing: z.number().optional().default(10).describe("Spacing between elements"),
        }),
        handler: async (args) => {
            const { path: scenePath, title, buttons, theme_path, background_color, centered, button_min_width, spacing, } = args;
            // Calculate script path (res:// relative)
            const gdScriptPath = scenePath.replace(".tscn", ".gd");
            const content = generateMenuScene(title, buttons, theme_path, background_color, centered ?? true, button_min_width ?? 200, spacing ?? 10, gdScriptPath);
            let outputPath = scenePath;
            if (scenePath.startsWith("res://") && state.projectPath) {
                outputPath = path.join(state.projectPath, scenePath.replace("res://", ""));
            }
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, content, "utf-8");
            // Generate accompanying script
            const scriptPath = outputPath.replace(".tscn", ".gd");
            const scriptContent = generateMenuScript(buttons, centered ?? true);
            await fs.writeFile(scriptPath, scriptContent, "utf-8");
            return {
                success: true,
                scene_path: scenePath,
                script_path: scenePath.replace(".tscn", ".gd"),
                message: `Created menu scene at ${scenePath}`,
                buttons: buttons.map(b => b.text),
            };
        },
    });
    // Create a HUD scene
    tools.set("godot_ui_create_hud", {
        description: "Create a game HUD scene with common elements like score, health, timer, and minimap placeholder.",
        inputSchema: z.object({
            path: z.string().describe("Output path for the scene file"),
            elements: z.array(z.enum([
                "score", "health", "timer", "lives", "level", "minimap", "player_name"
            ])).describe("HUD elements to include"),
            layout: z.enum(["top_bar", "corners", "custom"]).optional().default("top_bar")
                .describe("Layout style for HUD elements"),
            theme_path: z.string().optional().describe("Path to theme resource"),
        }),
        handler: async (args) => {
            const { path: scenePath, elements, layout, theme_path } = args;
            // Calculate script path (res:// relative)
            const gdScriptPath = scenePath.replace(".tscn", ".gd");
            const content = generateHUDScene(elements, layout || "top_bar", theme_path, gdScriptPath);
            let outputPath = scenePath;
            if (scenePath.startsWith("res://") && state.projectPath) {
                outputPath = path.join(state.projectPath, scenePath.replace("res://", ""));
            }
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, content, "utf-8");
            // Generate script
            const scriptPath = outputPath.replace(".tscn", ".gd");
            const scriptContent = generateHUDScript(elements, layout || "top_bar");
            await fs.writeFile(scriptPath, scriptContent, "utf-8");
            return {
                success: true,
                scene_path: scenePath,
                script_path: scenePath.replace(".tscn", ".gd"),
                message: `Created HUD scene at ${scenePath}`,
                elements,
                layout: layout || "top_bar",
            };
        },
    });
    // Create a dialog/popup
    tools.set("godot_ui_create_dialog", {
        description: "Create a dialog/popup scene for confirmations, alerts, or custom content.",
        inputSchema: z.object({
            path: z.string().describe("Output path for the scene file"),
            title: z.string().describe("Dialog title"),
            message: z.string().optional().describe("Dialog message text"),
            buttons: z.array(ButtonSchema).optional().describe("Dialog buttons"),
            dialog_type: z.enum(["alert", "confirm", "custom"]).optional().default("alert")
                .describe("Type of dialog"),
            theme_path: z.string().optional().describe("Path to theme resource"),
            width: z.number().optional().default(400).describe("Dialog width"),
        }),
        handler: async (args) => {
            const { path: scenePath, title, message, buttons, dialog_type, theme_path, width } = args;
            // Default buttons based on dialog type
            let dialogButtons = buttons;
            if (!dialogButtons) {
                if (dialog_type === "confirm") {
                    dialogButtons = [
                        { text: "Cancel", signal: "cancelled" },
                        { text: "OK", signal: "confirmed" },
                    ];
                }
                else {
                    dialogButtons = [{ text: "OK", signal: "confirmed" }];
                }
            }
            // Calculate script path (res:// relative)
            const gdScriptPath = scenePath.replace(".tscn", ".gd");
            const content = generateDialogScene(title, message, dialogButtons, theme_path, width ?? 400, gdScriptPath);
            let outputPath = scenePath;
            if (scenePath.startsWith("res://") && state.projectPath) {
                outputPath = path.join(state.projectPath, scenePath.replace("res://", ""));
            }
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, content, "utf-8");
            // Generate script
            const scriptPath = outputPath.replace(".tscn", ".gd");
            const scriptContent = generateDialogScript(dialogButtons);
            await fs.writeFile(scriptPath, scriptContent, "utf-8");
            return {
                success: true,
                scene_path: scenePath,
                script_path: scenePath.replace(".tscn", ".gd"),
                message: `Created dialog scene at ${scenePath}`,
            };
        },
    });
    // Create a panel
    tools.set("godot_ui_create_panel", {
        description: "Create a styled panel container that can hold other UI elements.",
        inputSchema: z.object({
            path: z.string().describe("Output path for the scene file"),
            title: z.string().optional().describe("Optional panel title"),
            size: z.object({
                width: z.number(),
                height: z.number(),
            }).optional().describe("Panel size"),
            position: z.enum(["center", "top_left", "top_right", "bottom_left", "bottom_right"]).optional()
                .describe("Panel position anchor"),
            theme_path: z.string().optional().describe("Path to theme resource"),
            content_type: z.enum(["vbox", "hbox", "grid", "empty"]).optional().default("vbox")
                .describe("Type of content container"),
        }),
        handler: async (args) => {
            const { path: scenePath, title, size, position, theme_path, content_type } = args;
            const content = generatePanelScene(title, size, position || "center", theme_path, content_type || "vbox");
            let outputPath = scenePath;
            if (scenePath.startsWith("res://") && state.projectPath) {
                outputPath = path.join(state.projectPath, scenePath.replace("res://", ""));
            }
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, content, "utf-8");
            return {
                success: true,
                scene_path: scenePath,
                message: `Created panel scene at ${scenePath}`,
            };
        },
    });
}
// Generate menu scene content
function generateMenuScene(title, buttons, themePath, bgColor, centered = true, buttonMinWidth = 200, spacing = 10, scriptPath) {
    let extResources = "";
    let extResourceCount = 0;
    // Add theme resource if provided
    if (themePath) {
        extResourceCount++;
        extResources += `[ext_resource type="Theme" path="${themePath}" id="theme_${extResourceCount}"]\n`;
    }
    // Add script reference
    extResourceCount++;
    const scriptId = `script_${extResourceCount}`;
    const resolvedScriptPath = scriptPath || "menu.gd";
    extResources += `[ext_resource type="Script" path="${resolvedScriptPath}" id="${scriptId}"]\n`;
    let content = `[gd_scene load_steps=${extResourceCount + 1} format=3]\n\n`;
    content += extResources;
    content += `\n`;
    // Root Control node
    content += `[node name="Menu" type="Control"]\n`;
    content += `layout_mode = 3\n`;
    content += `anchors_preset = 15\n`; // Full rect
    content += `anchor_right = 1.0\n`;
    content += `anchor_bottom = 1.0\n`;
    content += `grow_horizontal = 2\n`;
    content += `grow_vertical = 2\n`;
    const themeId = themePath ? "theme_1" : null;
    if (themeId) {
        content += `theme = ExtResource("${themeId}")\n`;
    }
    content += `script = ExtResource("${scriptId}")\n\n`;
    // Background
    if (bgColor) {
        content += `[node name="Background" type="ColorRect" parent="."]\n`;
        content += `layout_mode = 1\n`;
        content += `anchors_preset = 15\n`;
        content += `anchor_right = 1.0\n`;
        content += `anchor_bottom = 1.0\n`;
        content += `color = Color(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${bgColor.a ?? 1})\n\n`;
    }
    // Center container
    if (centered) {
        content += `[node name="CenterContainer" type="CenterContainer" parent="."]\n`;
        content += `layout_mode = 1\n`;
        content += `anchors_preset = 15\n`;
        content += `anchor_right = 1.0\n`;
        content += `anchor_bottom = 1.0\n\n`;
        content += `[node name="VBoxContainer" type="VBoxContainer" parent="CenterContainer"]\n`;
    }
    else {
        content += `[node name="VBoxContainer" type="VBoxContainer" parent="."]\n`;
    }
    content += `layout_mode = 2\n`;
    content += `theme_override_constants/separation = ${spacing}\n\n`;
    const parentPath = centered ? "CenterContainer/VBoxContainer" : "VBoxContainer";
    // Title
    content += `[node name="Title" type="Label" parent="${parentPath}"]\n`;
    content += `layout_mode = 2\n`;
    content += `text = "${title}"\n`;
    content += `horizontal_alignment = 1\n\n`;
    // Spacer
    content += `[node name="Spacer" type="Control" parent="${parentPath}"]\n`;
    content += `layout_mode = 2\n`;
    content += `custom_minimum_size = Vector2(0, 20)\n\n`;
    // Buttons
    for (const button of buttons) {
        const nodeName = button.name || button.text.replace(/[^a-zA-Z0-9]/g, "");
        content += `[node name="${nodeName}Button" type="Button" parent="${parentPath}"]\n`;
        content += `layout_mode = 2\n`;
        content += `custom_minimum_size = Vector2(${buttonMinWidth}, 0)\n`;
        content += `text = "${button.text}"\n\n`;
    }
    return content;
}
// Generate menu script
function generateMenuScript(buttons, centered = true) {
    let script = `extends Control\n\n`;
    // Signals
    for (const button of buttons) {
        const signalName = button.signal || `${button.text.toLowerCase().replace(/[^a-z0-9]/g, "_")}_pressed`;
        script += `signal ${signalName}\n`;
    }
    script += `\n`;
    const basePath = centered ? "CenterContainer/VBoxContainer" : "VBoxContainer";
    // Ready function
    script += `func _ready() -> void:\n`;
    for (const button of buttons) {
        const nodeName = button.name || button.text.replace(/[^a-zA-Z0-9]/g, "");
        script += `\t$${basePath}/${nodeName}Button.pressed.connect(_on_${nodeName.toLowerCase()}_pressed)\n`;
    }
    script += `\n`;
    // Button handlers
    for (const button of buttons) {
        const nodeName = button.name || button.text.replace(/[^a-zA-Z0-9]/g, "");
        const signalName = button.signal || `${button.text.toLowerCase().replace(/[^a-z0-9]/g, "_")}_pressed`;
        script += `func _on_${nodeName.toLowerCase()}_pressed() -> void:\n`;
        script += `\t${signalName}.emit()\n\n`;
    }
    return script;
}
// Generate HUD scene
function generateHUDScene(elements, layout, themePath, scriptPath) {
    let extResourceCount = 0;
    let extResources = "";
    if (themePath) {
        extResourceCount++;
        extResources += `[ext_resource type="Theme" path="${themePath}" id="theme_${extResourceCount}"]\n`;
    }
    extResourceCount++;
    const scriptId = `script_${extResourceCount}`;
    const resolvedScriptPath = scriptPath || "hud.gd";
    extResources += `[ext_resource type="Script" path="${resolvedScriptPath}" id="${scriptId}"]\n`;
    let content = `[gd_scene load_steps=${extResourceCount + 1} format=3]\n\n`;
    content += extResources;
    content += `\n`;
    // Root
    content += `[node name="HUD" type="CanvasLayer"]\n`;
    content += `script = ExtResource("${scriptId}")\n\n`;
    // Container
    content += `[node name="Container" type="Control" parent="."]\n`;
    content += `layout_mode = 3\n`;
    content += `anchors_preset = 15\n`;
    content += `anchor_right = 1.0\n`;
    content += `anchor_bottom = 1.0\n`;
    if (themePath) {
        content += `theme = ExtResource("theme_1")\n`;
    }
    content += `\n`;
    // Generate layout-specific containers and elements
    if (layout === "top_bar") {
        content += `[node name="TopBar" type="HBoxContainer" parent="Container"]\n`;
        content += `layout_mode = 1\n`;
        content += `anchors_preset = 10\n`;
        content += `anchor_right = 1.0\n`;
        content += `offset_bottom = 40.0\n`;
        content += `theme_override_constants/separation = 20\n\n`;
        for (const element of elements) {
            content += generateHUDElement(element, "TopBar");
        }
    }
    else if (layout === "corners") {
        // Top-left corner container
        content += `[node name="TopLeft" type="VBoxContainer" parent="Container"]\n`;
        content += `layout_mode = 1\n`;
        content += `anchors_preset = 0\n`; // top-left
        content += `offset_right = 200.0\n`;
        content += `offset_bottom = 100.0\n`;
        content += `theme_override_constants/separation = 5\n\n`;
        // Top-right corner container
        content += `[node name="TopRight" type="VBoxContainer" parent="Container"]\n`;
        content += `layout_mode = 1\n`;
        content += `anchors_preset = 1\n`; // top-right
        content += `anchor_left = 1.0\n`;
        content += `anchor_right = 1.0\n`;
        content += `offset_left = -200.0\n`;
        content += `offset_bottom = 100.0\n`;
        content += `theme_override_constants/separation = 5\n\n`;
        // Bottom-left corner container
        content += `[node name="BottomLeft" type="VBoxContainer" parent="Container"]\n`;
        content += `layout_mode = 1\n`;
        content += `anchors_preset = 2\n`; // bottom-left
        content += `anchor_top = 1.0\n`;
        content += `anchor_bottom = 1.0\n`;
        content += `offset_top = -100.0\n`;
        content += `offset_right = 200.0\n`;
        content += `theme_override_constants/separation = 5\n\n`;
        // Bottom-right corner container (for minimap)
        content += `[node name="BottomRight" type="VBoxContainer" parent="Container"]\n`;
        content += `layout_mode = 1\n`;
        content += `anchors_preset = 3\n`; // bottom-right
        content += `anchor_left = 1.0\n`;
        content += `anchor_top = 1.0\n`;
        content += `anchor_right = 1.0\n`;
        content += `anchor_bottom = 1.0\n`;
        content += `offset_left = -200.0\n`;
        content += `offset_top = -200.0\n`;
        content += `theme_override_constants/separation = 5\n\n`;
        // Distribute elements to corners based on type
        for (const element of elements) {
            let corner = "TopLeft";
            if (element === "minimap") {
                corner = "BottomRight";
            }
            else if (element === "timer" || element === "score") {
                corner = "TopRight";
            }
            else if (element === "lives" || element === "level") {
                corner = "BottomLeft";
            }
            content += generateHUDElement(element, corner);
        }
    }
    else if (layout === "custom") {
        // Custom layout - just create a basic container, user will arrange
        content += `[node name="CustomLayout" type="Control" parent="Container"]\n`;
        content += `layout_mode = 1\n`;
        content += `anchors_preset = 15\n`;
        content += `anchor_right = 1.0\n`;
        content += `anchor_bottom = 1.0\n\n`;
        for (const element of elements) {
            content += generateHUDElement(element, "CustomLayout");
        }
    }
    return content;
}
// Generate individual HUD element
function generateHUDElement(element, parent) {
    let content = "";
    switch (element) {
        case "score":
            content += `[node name="ScoreLabel" type="Label" parent="Container/${parent}"]\n`;
            content += `layout_mode = 2\n`;
            content += `text = "Score: 0"\n\n`;
            break;
        case "health":
            content += `[node name="HealthLabel" type="Label" parent="Container/${parent}"]\n`;
            content += `layout_mode = 2\n`;
            content += `text = "Health: 100"\n\n`;
            break;
        case "timer":
            content += `[node name="TimerLabel" type="Label" parent="Container/${parent}"]\n`;
            content += `layout_mode = 2\n`;
            content += `text = "Time: 0:00"\n\n`;
            break;
        case "lives":
            content += `[node name="LivesLabel" type="Label" parent="Container/${parent}"]\n`;
            content += `layout_mode = 2\n`;
            content += `text = "Lives: 3"\n\n`;
            break;
        case "level":
            content += `[node name="LevelLabel" type="Label" parent="Container/${parent}"]\n`;
            content += `layout_mode = 2\n`;
            content += `text = "Level: 1"\n\n`;
            break;
        case "player_name":
            content += `[node name="PlayerNameLabel" type="Label" parent="Container/${parent}"]\n`;
            content += `layout_mode = 2\n`;
            content += `text = "Player"\n\n`;
            break;
        case "minimap":
            content += `[node name="MinimapContainer" type="PanelContainer" parent="Container/${parent}"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(150, 150)\n\n`;
            content += `[node name="Minimap" type="SubViewportContainer" parent="Container/${parent}/MinimapContainer"]\n`;
            content += `layout_mode = 2\n\n`;
            break;
    }
    return content;
}
// Convert element name to PascalCase node name (e.g., "player_name" -> "PlayerName")
function elementToNodeName(element) {
    return element
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}
// Generate HUD script
function generateHUDScript(elements, layout = "top_bar") {
    let script = `extends CanvasLayer\n\n`;
    // Determine container paths based on layout
    const getContainerPath = (element) => {
        if (layout === "top_bar") {
            return "TopBar";
        }
        else if (layout === "corners") {
            if (element === "minimap")
                return "BottomRight";
            if (element === "timer" || element === "score")
                return "TopRight";
            if (element === "lives" || element === "level")
                return "BottomLeft";
            return "TopLeft";
        }
        else {
            return "CustomLayout";
        }
    };
    // Node references
    for (const element of elements) {
        const nodeName = elementToNodeName(element);
        const containerPath = getContainerPath(element);
        if (element !== "minimap") {
            script += `@onready var ${element}_label: Label = $Container/${containerPath}/${nodeName}Label\n`;
        }
    }
    script += `\n`;
    // Update functions
    if (elements.includes("score")) {
        script += `func update_score(value: int) -> void:\n`;
        script += `\tscore_label.text = "Score: %d" % value\n\n`;
    }
    if (elements.includes("health")) {
        script += `func update_health(value: int) -> void:\n`;
        script += `\thealth_label.text = "Health: %d" % value\n\n`;
    }
    if (elements.includes("timer")) {
        script += `func update_timer(seconds: float) -> void:\n`;
        script += `\tvar mins := int(seconds) / 60\n`;
        script += `\tvar secs := int(seconds) % 60\n`;
        script += `\ttimer_label.text = "Time: %d:%02d" % [mins, secs]\n\n`;
    }
    if (elements.includes("lives")) {
        script += `func update_lives(value: int) -> void:\n`;
        script += `\tlives_label.text = "Lives: %d" % value\n\n`;
    }
    if (elements.includes("level")) {
        script += `func update_level(value: int) -> void:\n`;
        script += `\tlevel_label.text = "Level: %d" % value\n\n`;
    }
    return script;
}
// Generate dialog scene
function generateDialogScene(title, message, buttons, themePath, width = 400, scriptPath) {
    let extResourceCount = 0;
    let extResources = "";
    if (themePath) {
        extResourceCount++;
        extResources += `[ext_resource type="Theme" path="${themePath}" id="theme_${extResourceCount}"]\n`;
    }
    extResourceCount++;
    const scriptId = `script_${extResourceCount}`;
    const resolvedScriptPath = scriptPath || "dialog.gd";
    extResources += `[ext_resource type="Script" path="${resolvedScriptPath}" id="${scriptId}"]\n`;
    let content = `[gd_scene load_steps=${extResourceCount + 1} format=3]\n\n`;
    content += extResources;
    content += `\n`;
    // Root - centered popup
    content += `[node name="Dialog" type="Control"]\n`;
    content += `layout_mode = 3\n`;
    content += `anchors_preset = 15\n`;
    content += `anchor_right = 1.0\n`;
    content += `anchor_bottom = 1.0\n`;
    content += `script = ExtResource("${scriptId}")\n\n`;
    // Dimmed background
    content += `[node name="Dimmer" type="ColorRect" parent="."]\n`;
    content += `layout_mode = 1\n`;
    content += `anchors_preset = 15\n`;
    content += `anchor_right = 1.0\n`;
    content += `anchor_bottom = 1.0\n`;
    content += `color = Color(0, 0, 0, 0.5)\n\n`;
    // Center container
    content += `[node name="CenterContainer" type="CenterContainer" parent="."]\n`;
    content += `layout_mode = 1\n`;
    content += `anchors_preset = 15\n`;
    content += `anchor_right = 1.0\n`;
    content += `anchor_bottom = 1.0\n\n`;
    // Panel
    content += `[node name="Panel" type="PanelContainer" parent="CenterContainer"]\n`;
    content += `layout_mode = 2\n`;
    content += `custom_minimum_size = Vector2(${width}, 0)\n`;
    if (themePath) {
        content += `theme = ExtResource("theme_1")\n`;
    }
    content += `\n`;
    // Content VBox
    content += `[node name="VBox" type="VBoxContainer" parent="CenterContainer/Panel"]\n`;
    content += `layout_mode = 2\n`;
    content += `theme_override_constants/separation = 15\n\n`;
    // Title
    content += `[node name="Title" type="Label" parent="CenterContainer/Panel/VBox"]\n`;
    content += `layout_mode = 2\n`;
    content += `text = "${title}"\n`;
    content += `horizontal_alignment = 1\n\n`;
    // Message
    if (message) {
        content += `[node name="Message" type="Label" parent="CenterContainer/Panel/VBox"]\n`;
        content += `layout_mode = 2\n`;
        content += `text = "${message}"\n`;
        content += `horizontal_alignment = 1\n`;
        content += `autowrap_mode = 2\n\n`;
    }
    // Button container
    content += `[node name="Buttons" type="HBoxContainer" parent="CenterContainer/Panel/VBox"]\n`;
    content += `layout_mode = 2\n`;
    content += `alignment = 1\n`;
    content += `theme_override_constants/separation = 10\n\n`;
    // Buttons
    for (const button of buttons) {
        const nodeName = button.name || button.text.replace(/[^a-zA-Z0-9]/g, "");
        content += `[node name="${nodeName}Button" type="Button" parent="CenterContainer/Panel/VBox/Buttons"]\n`;
        content += `layout_mode = 2\n`;
        content += `custom_minimum_size = Vector2(100, 0)\n`;
        content += `text = "${button.text}"\n\n`;
    }
    return content;
}
// Generate dialog script
function generateDialogScript(buttons) {
    let script = `extends Control\n\n`;
    // Signals
    for (const button of buttons) {
        const signalName = button.signal || `${button.text.toLowerCase().replace(/[^a-z0-9]/g, "_")}_pressed`;
        script += `signal ${signalName}\n`;
    }
    script += `\n`;
    // Ready
    script += `func _ready() -> void:\n`;
    for (const button of buttons) {
        const nodeName = button.name || button.text.replace(/[^a-zA-Z0-9]/g, "");
        script += `\t$CenterContainer/Panel/VBox/Buttons/${nodeName}Button.pressed.connect(_on_${nodeName.toLowerCase()}_pressed)\n`;
    }
    script += `\n`;
    // Show/hide functions
    script += `func show_dialog() -> void:\n`;
    script += `\tvisible = true\n\n`;
    script += `func hide_dialog() -> void:\n`;
    script += `\tvisible = false\n\n`;
    // Handlers
    for (const button of buttons) {
        const nodeName = button.name || button.text.replace(/[^a-zA-Z0-9]/g, "");
        const signalName = button.signal || `${button.text.toLowerCase().replace(/[^a-z0-9]/g, "_")}_pressed`;
        script += `func _on_${nodeName.toLowerCase()}_pressed() -> void:\n`;
        script += `\t${signalName}.emit()\n`;
        script += `\thide_dialog()\n\n`;
    }
    return script;
}
// Generate panel scene
function generatePanelScene(title, size, position, themePath, contentType = "vbox") {
    const loadSteps = themePath ? 2 : 1;
    let content = `[gd_scene load_steps=${loadSteps} format=3]\n\n`;
    if (themePath) {
        content += `[ext_resource type="Theme" path="${themePath}" id="theme_1"]\n`;
    }
    content += `\n`;
    // Root panel
    content += `[node name="Panel" type="PanelContainer"]\n`;
    // Anchors based on position
    const anchors = {
        center: `anchors_preset = 8\nanchor_left = 0.5\nanchor_top = 0.5\nanchor_right = 0.5\nanchor_bottom = 0.5\ngrow_horizontal = 2\ngrow_vertical = 2`,
        top_left: `anchors_preset = 0`,
        top_right: `anchors_preset = 1\nanchor_left = 1.0\nanchor_right = 1.0\ngrow_horizontal = 0`,
        bottom_left: `anchors_preset = 2\nanchor_top = 1.0\nanchor_bottom = 1.0\ngrow_vertical = 0`,
        bottom_right: `anchors_preset = 3\nanchor_left = 1.0\nanchor_top = 1.0\nanchor_right = 1.0\nanchor_bottom = 1.0\ngrow_horizontal = 0\ngrow_vertical = 0`,
    };
    content += anchors[position] || anchors.center;
    content += `\n`;
    if (size) {
        content += `custom_minimum_size = Vector2(${size.width}, ${size.height})\n`;
    }
    if (themePath) {
        content += `theme = ExtResource("theme_1")\n`;
    }
    content += `\n`;
    // Content container
    const containerTypes = {
        vbox: "VBoxContainer",
        hbox: "HBoxContainer",
        grid: "GridContainer",
        empty: "Control",
    };
    content += `[node name="Content" type="${containerTypes[contentType] || "VBoxContainer"}" parent="."]\n`;
    content += `layout_mode = 2\n`;
    if (contentType === "grid") {
        content += `columns = 2\n`;
    }
    content += `\n`;
    // Title if provided
    if (title) {
        content += `[node name="Title" type="Label" parent="Content"]\n`;
        content += `layout_mode = 2\n`;
        content += `text = "${title}"\n`;
        content += `horizontal_alignment = 1\n\n`;
    }
    return content;
}
//# sourceMappingURL=ui-component-tools.js.map
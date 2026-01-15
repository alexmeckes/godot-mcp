import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
// Anchor presets matching Godot's built-in presets
const ANCHOR_PRESETS = {
    top_left: { preset: 0, anchor_left: 0, anchor_top: 0, anchor_right: 0, anchor_bottom: 0 },
    top_right: { preset: 1, anchor_left: 1, anchor_top: 0, anchor_right: 1, anchor_bottom: 0 },
    bottom_left: { preset: 2, anchor_left: 0, anchor_top: 1, anchor_right: 0, anchor_bottom: 1 },
    bottom_right: { preset: 3, anchor_left: 1, anchor_top: 1, anchor_right: 1, anchor_bottom: 1 },
    center_left: { preset: 4, anchor_left: 0, anchor_top: 0.5, anchor_right: 0, anchor_bottom: 0.5 },
    center_top: { preset: 5, anchor_left: 0.5, anchor_top: 0, anchor_right: 0.5, anchor_bottom: 0 },
    center_right: { preset: 6, anchor_left: 1, anchor_top: 0.5, anchor_right: 1, anchor_bottom: 0.5 },
    center_bottom: { preset: 7, anchor_left: 0.5, anchor_top: 1, anchor_right: 0.5, anchor_bottom: 1 },
    center: { preset: 8, anchor_left: 0.5, anchor_top: 0.5, anchor_right: 0.5, anchor_bottom: 0.5 },
    left_wide: { preset: 9, anchor_left: 0, anchor_top: 0, anchor_right: 0, anchor_bottom: 1 },
    top_wide: { preset: 10, anchor_left: 0, anchor_top: 0, anchor_right: 1, anchor_bottom: 0 },
    right_wide: { preset: 11, anchor_left: 1, anchor_top: 0, anchor_right: 1, anchor_bottom: 1 },
    bottom_wide: { preset: 12, anchor_left: 0, anchor_top: 1, anchor_right: 1, anchor_bottom: 1 },
    vcenter_wide: { preset: 13, anchor_left: 0, anchor_top: 0.5, anchor_right: 1, anchor_bottom: 0.5 },
    hcenter_wide: { preset: 14, anchor_left: 0.5, anchor_top: 0, anchor_right: 0.5, anchor_bottom: 1 },
    full_rect: { preset: 15, anchor_left: 0, anchor_top: 0, anchor_right: 1, anchor_bottom: 1 },
};
export function registerUILayoutTools(tools, state) {
    // List anchor presets
    tools.set("godot_ui_list_anchors", {
        description: "List all available anchor presets for positioning UI elements. Use these presets for responsive layouts.",
        inputSchema: z.object({}),
        handler: async () => {
            return {
                presets: Object.entries(ANCHOR_PRESETS).map(([name, values]) => ({
                    name,
                    preset_id: values.preset,
                    description: getAnchorDescription(name),
                    anchors: {
                        left: values.anchor_left,
                        top: values.anchor_top,
                        right: values.anchor_right,
                        bottom: values.anchor_bottom,
                    },
                })),
                usage: "Use these preset names with godot_ui_set_anchors or when creating components",
            };
        },
    });
    // List container types
    tools.set("godot_ui_list_containers", {
        description: "List all available container types for organizing UI elements with their use cases.",
        inputSchema: z.object({}),
        handler: async () => {
            return {
                containers: [
                    {
                        type: "HBoxContainer",
                        description: "Arranges children horizontally in a row",
                        use_cases: ["Button bars", "Icon rows", "Horizontal menus"],
                        key_properties: ["separation", "alignment"],
                    },
                    {
                        type: "VBoxContainer",
                        description: "Arranges children vertically in a column",
                        use_cases: ["Vertical menus", "Lists", "Form layouts"],
                        key_properties: ["separation", "alignment"],
                    },
                    {
                        type: "GridContainer",
                        description: "Arranges children in a grid",
                        use_cases: ["Inventories", "Icon grids", "Settings grids"],
                        key_properties: ["columns", "h_separation", "v_separation"],
                    },
                    {
                        type: "CenterContainer",
                        description: "Centers a single child",
                        use_cases: ["Centering dialogs", "Loading screens", "Splash screens"],
                        key_properties: ["use_top_left"],
                    },
                    {
                        type: "MarginContainer",
                        description: "Adds margins around children",
                        use_cases: ["Adding padding", "Content insets", "Safe area margins"],
                        key_properties: ["margin_left", "margin_top", "margin_right", "margin_bottom"],
                    },
                    {
                        type: "PanelContainer",
                        description: "Container with a panel background",
                        use_cases: ["Styled panels", "Cards", "Bordered sections"],
                        key_properties: ["theme", "panel StyleBox"],
                    },
                    {
                        type: "ScrollContainer",
                        description: "Scrollable container for content larger than viewport",
                        use_cases: ["Long lists", "Scrollable content", "Text areas"],
                        key_properties: ["horizontal_scroll_mode", "vertical_scroll_mode"],
                    },
                    {
                        type: "HSplitContainer",
                        description: "Horizontal split with draggable divider",
                        use_cases: ["Resizable panels", "Side-by-side views"],
                        key_properties: ["split_offset", "dragger_visibility"],
                    },
                    {
                        type: "VSplitContainer",
                        description: "Vertical split with draggable divider",
                        use_cases: ["Resizable panels", "Top-bottom views"],
                        key_properties: ["split_offset", "dragger_visibility"],
                    },
                    {
                        type: "TabContainer",
                        description: "Tabbed container for switching between views",
                        use_cases: ["Settings pages", "Multi-panel UIs", "Inventory tabs"],
                        key_properties: ["current_tab", "tabs_visible"],
                    },
                    {
                        type: "AspectRatioContainer",
                        description: "Maintains aspect ratio of child",
                        use_cases: ["Video players", "Image displays", "Fixed ratio content"],
                        key_properties: ["ratio", "stretch_mode"],
                    },
                    {
                        type: "FlowContainer",
                        description: "Wrapping container (horizontal or vertical)",
                        use_cases: ["Tag clouds", "Wrapping button bars", "Responsive grids"],
                        key_properties: ["vertical", "h_separation", "v_separation"],
                    },
                ],
            };
        },
    });
    // Create a responsive layout scene
    tools.set("godot_ui_create_layout", {
        description: "Create a responsive layout scene with specified structure. Good for creating screen layouts that adapt to different resolutions.",
        inputSchema: z.object({
            path: z.string().describe("Output path for the scene file"),
            layout_type: z.enum([
                "single_panel", // One centered panel
                "sidebar_content", // Sidebar + main content
                "header_content", // Header + main content
                "header_footer", // Header + content + footer
                "holy_grail", // Header + sidebar + content + sidebar + footer
                "grid_layout", // Grid of equal panels
            ]).describe("Type of layout to create"),
            theme_path: z.string().optional().describe("Path to theme resource"),
            options: z.object({
                sidebar_width: z.number().optional().describe("Sidebar width for sidebar layouts"),
                header_height: z.number().optional().describe("Header height"),
                footer_height: z.number().optional().describe("Footer height"),
                grid_columns: z.number().optional().describe("Number of columns for grid layout"),
                grid_rows: z.number().optional().describe("Number of rows for grid layout"),
                spacing: z.number().optional().describe("Spacing between elements"),
            }).optional(),
        }),
        handler: async (args) => {
            const { path: scenePath, layout_type, theme_path, options } = args;
            const content = generateLayoutScene(layout_type, theme_path, options || {});
            let outputPath = scenePath;
            if (scenePath.startsWith("res://") && state.projectPath) {
                outputPath = path.join(state.projectPath, scenePath.replace("res://", ""));
            }
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, content, "utf-8");
            return {
                success: true,
                path: scenePath,
                message: `Created ${layout_type} layout at ${scenePath}`,
                layout_type,
            };
        },
    });
    // Generate anchor configuration
    tools.set("godot_ui_get_anchor_config", {
        description: "Get the Godot scene file properties for a specific anchor configuration. Useful for understanding how to configure anchors manually.",
        inputSchema: z.object({
            preset: z.enum([
                "top_left", "top_right", "bottom_left", "bottom_right",
                "center_left", "center_top", "center_right", "center_bottom", "center",
                "left_wide", "top_wide", "right_wide", "bottom_wide",
                "vcenter_wide", "hcenter_wide", "full_rect"
            ]).describe("Anchor preset name"),
            margins: z.object({
                left: z.number().optional(),
                top: z.number().optional(),
                right: z.number().optional(),
                bottom: z.number().optional(),
            }).optional().describe("Offset margins in pixels"),
        }),
        handler: async (args) => {
            const { preset, margins } = args;
            const config = ANCHOR_PRESETS[preset];
            if (!config) {
                throw new Error(`Unknown anchor preset: ${preset}`);
            }
            let tscnProperties = `anchors_preset = ${config.preset}\n`;
            if (config.anchor_left !== 0)
                tscnProperties += `anchor_left = ${config.anchor_left}\n`;
            if (config.anchor_top !== 0)
                tscnProperties += `anchor_top = ${config.anchor_top}\n`;
            if (config.anchor_right !== 0)
                tscnProperties += `anchor_right = ${config.anchor_right}\n`;
            if (config.anchor_bottom !== 0)
                tscnProperties += `anchor_bottom = ${config.anchor_bottom}\n`;
            if (margins) {
                if (margins.left)
                    tscnProperties += `offset_left = ${margins.left}\n`;
                if (margins.top)
                    tscnProperties += `offset_top = ${margins.top}\n`;
                if (margins.right)
                    tscnProperties += `offset_right = ${margins.right}\n`;
                if (margins.bottom)
                    tscnProperties += `offset_bottom = ${margins.bottom}\n`;
            }
            return {
                preset,
                description: getAnchorDescription(preset),
                tscn_properties: tscnProperties,
                gdscript_code: generateAnchorGDScript(preset, margins),
            };
        },
    });
    // Create a responsive container
    tools.set("godot_ui_create_container", {
        description: "Create a container scene with specified configuration.",
        inputSchema: z.object({
            path: z.string().describe("Output path for the scene file"),
            container_type: z.enum([
                "HBoxContainer", "VBoxContainer", "GridContainer",
                "CenterContainer", "MarginContainer", "PanelContainer",
                "ScrollContainer", "TabContainer", "FlowContainer"
            ]).describe("Type of container to create"),
            anchor_preset: z.enum([
                "top_left", "top_right", "bottom_left", "bottom_right",
                "center_left", "center_top", "center_right", "center_bottom", "center",
                "left_wide", "top_wide", "right_wide", "bottom_wide",
                "vcenter_wide", "hcenter_wide", "full_rect"
            ]).optional().describe("Anchor preset for the container"),
            properties: z.object({
                separation: z.number().optional().describe("Separation between children"),
                columns: z.number().optional().describe("Number of columns (for GridContainer)"),
                margins: z.number().optional().describe("Margin size (for MarginContainer)"),
            }).optional(),
            theme_path: z.string().optional().describe("Path to theme resource"),
        }),
        handler: async (args) => {
            const { path: scenePath, container_type, anchor_preset, properties, theme_path } = args;
            const content = generateContainerScene(container_type, anchor_preset || "full_rect", properties || {}, theme_path);
            let outputPath = scenePath;
            if (scenePath.startsWith("res://") && state.projectPath) {
                outputPath = path.join(state.projectPath, scenePath.replace("res://", ""));
            }
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, content, "utf-8");
            return {
                success: true,
                path: scenePath,
                message: `Created ${container_type} at ${scenePath}`,
                container_type,
                anchor_preset: anchor_preset || "full_rect",
            };
        },
    });
}
// Get human-readable description for anchor preset
function getAnchorDescription(name) {
    const descriptions = {
        top_left: "Fixed to top-left corner",
        top_right: "Fixed to top-right corner",
        bottom_left: "Fixed to bottom-left corner",
        bottom_right: "Fixed to bottom-right corner",
        center_left: "Centered vertically on left edge",
        center_top: "Centered horizontally on top edge",
        center_right: "Centered vertically on right edge",
        center_bottom: "Centered horizontally on bottom edge",
        center: "Centered both horizontally and vertically",
        left_wide: "Full height on left side",
        top_wide: "Full width on top",
        right_wide: "Full height on right side",
        bottom_wide: "Full width on bottom",
        vcenter_wide: "Full width, centered vertically",
        hcenter_wide: "Full height, centered horizontally",
        full_rect: "Fill entire parent area",
    };
    return descriptions[name] || "Unknown preset";
}
// Generate GDScript code for setting anchors
function generateAnchorGDScript(preset, margins) {
    const config = ANCHOR_PRESETS[preset];
    if (!config)
        return "";
    let code = `# Set anchor preset programmatically\n`;
    code += `control.anchor_left = ${config.anchor_left}\n`;
    code += `control.anchor_top = ${config.anchor_top}\n`;
    code += `control.anchor_right = ${config.anchor_right}\n`;
    code += `control.anchor_bottom = ${config.anchor_bottom}\n`;
    if (margins) {
        if (margins.left)
            code += `control.offset_left = ${margins.left}\n`;
        if (margins.top)
            code += `control.offset_top = ${margins.top}\n`;
        if (margins.right)
            code += `control.offset_right = ${margins.right}\n`;
        if (margins.bottom)
            code += `control.offset_bottom = ${margins.bottom}\n`;
    }
    return code;
}
// Generate layout scene content
function generateLayoutScene(layoutType, themePath, options) {
    let content = `[gd_scene load_steps=1 format=3]\n\n`;
    if (themePath) {
        content = `[gd_scene load_steps=2 format=3]\n\n`;
        content += `[ext_resource type="Theme" path="${themePath}" id="theme_1"]\n\n`;
    }
    // Root control
    content += `[node name="Layout" type="Control"]\n`;
    content += `layout_mode = 3\n`;
    content += `anchors_preset = 15\n`;
    content += `anchor_right = 1.0\n`;
    content += `anchor_bottom = 1.0\n`;
    if (themePath) {
        content += `theme = ExtResource("theme_1")\n`;
    }
    content += `\n`;
    const spacing = options?.spacing || 0;
    switch (layoutType) {
        case "single_panel":
            content += `[node name="CenterContainer" type="CenterContainer" parent="."]\n`;
            content += `layout_mode = 1\n`;
            content += `anchors_preset = 15\n`;
            content += `anchor_right = 1.0\n`;
            content += `anchor_bottom = 1.0\n\n`;
            content += `[node name="Panel" type="PanelContainer" parent="CenterContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(400, 300)\n\n`;
            content += `[node name="Content" type="VBoxContainer" parent="CenterContainer/Panel"]\n`;
            content += `layout_mode = 2\n\n`;
            break;
        case "sidebar_content":
            const sidebarWidth = options?.sidebar_width || 250;
            content += `[node name="HBoxContainer" type="HBoxContainer" parent="."]\n`;
            content += `layout_mode = 1\n`;
            content += `anchors_preset = 15\n`;
            content += `anchor_right = 1.0\n`;
            content += `anchor_bottom = 1.0\n`;
            content += `theme_override_constants/separation = ${spacing}\n\n`;
            content += `[node name="Sidebar" type="PanelContainer" parent="HBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(${sidebarWidth}, 0)\n\n`;
            content += `[node name="SidebarContent" type="VBoxContainer" parent="HBoxContainer/Sidebar"]\n`;
            content += `layout_mode = 2\n\n`;
            content += `[node name="MainContent" type="PanelContainer" parent="HBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `size_flags_horizontal = 3\n\n`;
            content += `[node name="Content" type="VBoxContainer" parent="HBoxContainer/MainContent"]\n`;
            content += `layout_mode = 2\n\n`;
            break;
        case "header_content":
            const headerHeight = options?.header_height || 60;
            content += `[node name="VBoxContainer" type="VBoxContainer" parent="."]\n`;
            content += `layout_mode = 1\n`;
            content += `anchors_preset = 15\n`;
            content += `anchor_right = 1.0\n`;
            content += `anchor_bottom = 1.0\n`;
            content += `theme_override_constants/separation = ${spacing}\n\n`;
            content += `[node name="Header" type="PanelContainer" parent="VBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(0, ${headerHeight})\n\n`;
            content += `[node name="HeaderContent" type="HBoxContainer" parent="VBoxContainer/Header"]\n`;
            content += `layout_mode = 2\n\n`;
            content += `[node name="MainContent" type="PanelContainer" parent="VBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `size_flags_vertical = 3\n\n`;
            content += `[node name="Content" type="VBoxContainer" parent="VBoxContainer/MainContent"]\n`;
            content += `layout_mode = 2\n\n`;
            break;
        case "header_footer":
            const hfHeaderHeight = options?.header_height || 60;
            const footerHeight = options?.footer_height || 40;
            content += `[node name="VBoxContainer" type="VBoxContainer" parent="."]\n`;
            content += `layout_mode = 1\n`;
            content += `anchors_preset = 15\n`;
            content += `anchor_right = 1.0\n`;
            content += `anchor_bottom = 1.0\n`;
            content += `theme_override_constants/separation = ${spacing}\n\n`;
            content += `[node name="Header" type="PanelContainer" parent="VBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(0, ${hfHeaderHeight})\n\n`;
            content += `[node name="MainContent" type="PanelContainer" parent="VBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `size_flags_vertical = 3\n\n`;
            content += `[node name="Footer" type="PanelContainer" parent="VBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(0, ${footerHeight})\n\n`;
            break;
        case "grid_layout":
            const columns = options?.grid_columns || 2;
            const rows = options?.grid_rows || 2;
            content += `[node name="GridContainer" type="GridContainer" parent="."]\n`;
            content += `layout_mode = 1\n`;
            content += `anchors_preset = 15\n`;
            content += `anchor_right = 1.0\n`;
            content += `anchor_bottom = 1.0\n`;
            content += `columns = ${columns}\n`;
            content += `theme_override_constants/h_separation = ${spacing}\n`;
            content += `theme_override_constants/v_separation = ${spacing}\n\n`;
            for (let i = 0; i < columns * rows; i++) {
                content += `[node name="Panel${i + 1}" type="PanelContainer" parent="GridContainer"]\n`;
                content += `layout_mode = 2\n`;
                content += `size_flags_horizontal = 3\n`;
                content += `size_flags_vertical = 3\n\n`;
            }
            break;
        case "holy_grail":
            // Header + left sidebar + content + right sidebar + footer
            const hgHeaderHeight = options?.header_height || 60;
            const hgFooterHeight = options?.footer_height || 40;
            const hgSidebarWidth = options?.sidebar_width || 200;
            // Main VBox for header/middle/footer
            content += `[node name="VBoxContainer" type="VBoxContainer" parent="."]\n`;
            content += `layout_mode = 1\n`;
            content += `anchors_preset = 15\n`;
            content += `anchor_right = 1.0\n`;
            content += `anchor_bottom = 1.0\n`;
            content += `theme_override_constants/separation = ${spacing}\n\n`;
            // Header
            content += `[node name="Header" type="PanelContainer" parent="VBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(0, ${hgHeaderHeight})\n\n`;
            content += `[node name="HeaderContent" type="HBoxContainer" parent="VBoxContainer/Header"]\n`;
            content += `layout_mode = 2\n\n`;
            // Middle section with HBox for sidebars + content
            content += `[node name="Middle" type="HBoxContainer" parent="VBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `size_flags_vertical = 3\n`;
            content += `theme_override_constants/separation = ${spacing}\n\n`;
            // Left sidebar
            content += `[node name="LeftSidebar" type="PanelContainer" parent="VBoxContainer/Middle"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(${hgSidebarWidth}, 0)\n\n`;
            content += `[node name="LeftContent" type="VBoxContainer" parent="VBoxContainer/Middle/LeftSidebar"]\n`;
            content += `layout_mode = 2\n\n`;
            // Main content
            content += `[node name="MainContent" type="PanelContainer" parent="VBoxContainer/Middle"]\n`;
            content += `layout_mode = 2\n`;
            content += `size_flags_horizontal = 3\n\n`;
            content += `[node name="Content" type="VBoxContainer" parent="VBoxContainer/Middle/MainContent"]\n`;
            content += `layout_mode = 2\n\n`;
            // Right sidebar
            content += `[node name="RightSidebar" type="PanelContainer" parent="VBoxContainer/Middle"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(${hgSidebarWidth}, 0)\n\n`;
            content += `[node name="RightContent" type="VBoxContainer" parent="VBoxContainer/Middle/RightSidebar"]\n`;
            content += `layout_mode = 2\n\n`;
            // Footer
            content += `[node name="Footer" type="PanelContainer" parent="VBoxContainer"]\n`;
            content += `layout_mode = 2\n`;
            content += `custom_minimum_size = Vector2(0, ${hgFooterHeight})\n\n`;
            content += `[node name="FooterContent" type="HBoxContainer" parent="VBoxContainer/Footer"]\n`;
            content += `layout_mode = 2\n\n`;
            break;
    }
    return content;
}
// Generate container scene content
function generateContainerScene(containerType, anchorPreset, properties, themePath) {
    let content = `[gd_scene load_steps=1 format=3]\n\n`;
    if (themePath) {
        content = `[gd_scene load_steps=2 format=3]\n\n`;
        content += `[ext_resource type="Theme" path="${themePath}" id="theme_1"]\n\n`;
    }
    const anchor = ANCHOR_PRESETS[anchorPreset] || ANCHOR_PRESETS.full_rect;
    content += `[node name="${containerType.replace("Container", "")}" type="${containerType}"]\n`;
    content += `layout_mode = 3\n`;
    content += `anchors_preset = ${anchor.preset}\n`;
    if (anchor.anchor_left !== 0)
        content += `anchor_left = ${anchor.anchor_left}\n`;
    if (anchor.anchor_top !== 0)
        content += `anchor_top = ${anchor.anchor_top}\n`;
    if (anchor.anchor_right !== 0)
        content += `anchor_right = ${anchor.anchor_right}\n`;
    if (anchor.anchor_bottom !== 0)
        content += `anchor_bottom = ${anchor.anchor_bottom}\n`;
    if (themePath) {
        content += `theme = ExtResource("theme_1")\n`;
    }
    // Container-specific properties
    if (properties.separation && (containerType === "HBoxContainer" || containerType === "VBoxContainer")) {
        content += `theme_override_constants/separation = ${properties.separation}\n`;
    }
    if (properties.columns && containerType === "GridContainer") {
        content += `columns = ${properties.columns}\n`;
    }
    if (properties.margins && containerType === "MarginContainer") {
        content += `theme_override_constants/margin_left = ${properties.margins}\n`;
        content += `theme_override_constants/margin_top = ${properties.margins}\n`;
        content += `theme_override_constants/margin_right = ${properties.margins}\n`;
        content += `theme_override_constants/margin_bottom = ${properties.margins}\n`;
    }
    content += `\n`;
    return content;
}
//# sourceMappingURL=ui-layout-tools.js.map
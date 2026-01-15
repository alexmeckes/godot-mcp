# Godot MCP Server

MCP (Model Context Protocol) server for AI-assisted Godot 4.x game development. Provides **60 tools** across 8 categories for scene manipulation, script generation, shader creation, UI building, procedural generation, and live editor control.

## Features

### File-Based Tools (Always Available)
- **Scene Tools**: Read, write, and manipulate `.tscn` scene files
- **Script Tools**: Generate and analyze GDScript files
- **Shader Tools**: Create shaders with 11 preset effects (dissolve, outline, hologram, etc.)
- **Resource Tools**: Manage `.tres` resource files
- **UI Tools**: Create themes, menus, HUDs, dialogs, and responsive layouts
- **Procedural Generation**: Dungeons, tilemaps, and enemy wave configurations

### Live Editor Tools (Requires Godot AI Bridge Plugin)
- Real-time scene tree inspection
- Live node manipulation with undo/redo support
- Run/stop scenes directly from your AI assistant
- Capture runtime errors and console output
- Select nodes in the editor

### Documentation
- Built-in Godot 4.x class documentation
- Searchable API reference for 200+ classes

## Quick Start

**Not sure which tool to use?** Call `godot_help` first:

```
godot_help                           # Overview of all 60 tools
godot_help category="scenes"         # Scene manipulation tools
godot_help category="ui"             # UI creation tools
godot_help task="create a menu"      # Get suggestions for a task
godot_help category="workflows"      # Common multi-step workflows
```

## Installation

### Option 1: From npm (when published)
```bash
npm install -g @genai-gametools/godot-mcp
```

### Option 2: From Source
```bash
git clone https://github.com/alexmeckes/godot-mcp.git
cd godot-mcp
npm install
npm run build
```

## Configuration

### Claude Code / Claude Desktop

Add to your MCP configuration (`~/.claude/mcp_servers.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "godot-mcp": {
      "command": "node",
      "args": [
        "/path/to/godot-mcp/dist/index.js",
        "--project",
        "/path/to/your/godot/project"
      ]
    }
  }
}
```

### Command Line Options

```bash
godot-mcp [options]

Options:
  --project <path>  Path to Godot project directory (default: current directory)
  --port <number>   Editor WebSocket port (default: 6550)
```

---

## All 60 Tools

### Scene Tools (8 tools)

| Tool | Description |
|------|-------------|
| `godot_read_scene` | Parse and read a .tscn scene file |
| `godot_write_scene` | Create or overwrite a .tscn scene file |
| `godot_add_node` | Add a new node to an existing scene |
| `godot_remove_node` | Remove a node and its children from a scene |
| `godot_modify_node` | Modify properties of an existing node |
| `godot_list_scene_nodes` | List all nodes in a scene with hierarchy |
| `godot_validate_scene` | Validate scene for missing resources and issues |
| `godot_list_scenes` | List all .tscn files in project |

### Script Tools (6 tools)

| Tool | Description |
|------|-------------|
| `godot_read_script` | Read a GDScript file with parsed metadata |
| `godot_write_script` | Create or update a GDScript file |
| `godot_analyze_script` | Extract classes, functions, signals, exports |
| `godot_generate_script` | Generate GDScript from natural language description |
| `godot_list_scripts` | List all .gd files in project |
| `godot_validate_script` | Check GDScript syntax and best practices |

### Shader Tools (4 tools)

| Tool | Description |
|------|-------------|
| `godot_read_shader` | Read a .gdshader file with parsed uniforms |
| `godot_write_shader` | Create or update a shader file |
| `godot_generate_shader` | Generate shader from preset or description |
| `godot_list_shaders` | List all .gdshader files in project |

**Built-in Shader Presets**: flash, outline, dissolve, pixelate, wave, gradient_map, chromatic_aberration, vignette, crt, hologram, fresnel

### UI Tools (12 tools)

| Tool | Description |
|------|-------------|
| `godot_ui_create_theme` | Generate a complete UI theme (.tres) from presets |
| `godot_ui_create_stylebox` | Create individual StyleBox resources |
| `godot_ui_list_presets` | List available theme presets and styles |
| `godot_ui_create_menu` | Generate main menu, pause menu, or settings menu scenes |
| `godot_ui_create_hud` | Generate HUD with health bars, score, minimap |
| `godot_ui_create_dialog` | Generate dialog boxes, popups, confirmations |
| `godot_ui_create_panel` | Generate info panels, inventories, stat panels |
| `godot_ui_list_anchors` | List available anchor presets |
| `godot_ui_list_containers` | List container types and their use cases |
| `godot_ui_create_layout` | Create responsive layouts with proper anchoring |
| `godot_ui_get_anchor_config` | Get anchor values for a specific preset |
| `godot_ui_create_container` | Create container hierarchies for complex layouts |

**Theme Presets**: fantasy, sci-fi, minimal, retro, horror, mobile

### Resource Tools (3 tools)

| Tool | Description |
|------|-------------|
| `godot_read_resource` | Read a .tres resource file as structured data |
| `godot_write_resource` | Create or update a resource file |
| `godot_list_resources` | List all .tres files in project |

### Procedural Generation Tools (3 tools)

| Tool | Description |
|------|-------------|
| `godot_generate_dungeon` | Generate dungeon layout with rooms and corridors |
| `godot_generate_tilemap_pattern` | Generate platforms, terrain, maze, or cave patterns |
| `godot_generate_wave_config` | Generate enemy wave configurations for wave-based games |

### Documentation Tools (4 tools)

| Tool | Description |
|------|-------------|
| `godot_help` | **Start here** - Get guidance on which tool to use |
| `godot_get_class_docs` | Get full documentation for any Godot class |
| `godot_search_docs` | Search documentation by keyword |
| `godot_list_documented_classes` | List all 200+ documented classes by category |

### Editor Tools (17 tools - Requires Plugin)

| Tool | Description |
|------|-------------|
| `godot_connect` | Connect to running Godot editor |
| `godot_disconnect` | Disconnect from editor |
| `godot_connection_status` | Check connection status |
| `godot_editor_get_scene_tree` | Get live scene tree from editor |
| `godot_editor_select_node` | Select a node in the editor |
| `godot_editor_add_node` | Add a node to the live scene |
| `godot_editor_modify_node` | Modify node properties in real-time |
| `godot_editor_remove_node` | Remove a node from the live scene |
| `godot_editor_open_scene` | Open a scene file in the editor |
| `godot_editor_save_scene` | Save the current scene |
| `godot_editor_run_scene` | Run the current or specified scene |
| `godot_editor_stop_scene` | Stop the running scene |
| `godot_editor_get_errors` | Get current errors from the editor |
| `godot_editor_get_output` | Get console output from running game |
| `godot_editor_get_log_file` | Read Godot's log file for debugging |
| `godot_editor_execute_gdscript` | Execute arbitrary GDScript in the editor |
| `godot_editor_get_project_info` | Get project name, path, Godot version |
| `godot_editor_refresh_filesystem` | Trigger filesystem rescan |

### Project Tools (1 tool)

| Tool | Description |
|------|-------------|
| `godot_init_project` | Initialize a new Godot project with recommended structure |

---

## Godot AI Bridge Plugin

For live editor features, you need to install the **Godot AI Bridge** plugin in your Godot project.

### What It Does

The AI Bridge plugin runs a WebSocket server inside the Godot editor that allows the MCP server to:
- Read and modify the live scene tree
- Run and stop game scenes
- Capture print output and errors from the running game
- Trigger editor actions (save, open scenes, etc.)

### Installation

1. **Copy the plugin folder** to your Godot project:
   ```bash
   cp -r addons/godot_ai_bridge /path/to/your/project/addons/
   ```

2. **Enable the plugin** in Godot:
   - Open your project in Godot 4.x
   - Go to **Project > Project Settings > Plugins**
   - Find "Godot AI Bridge" and set it to **Active**

3. **Verify it's running**:
   - You should see `[AI Bridge] Server started on port 6550` in the Output panel

### Plugin Structure

```
addons/godot_ai_bridge/
├── plugin.cfg           # Plugin metadata
├── godot_ai_bridge.gd   # Main EditorPlugin
├── ws_server.gd         # WebSocket server implementation
└── message_handler.gd   # JSON-RPC message handling
```

### How It Works

The plugin uses Godot's `EditorPlugin` and `EditorDebuggerPlugin` APIs to:

1. **WebSocket Server** (`ws_server.gd`): Listens on port 6550 for connections
2. **Message Handler** (`message_handler.gd`): Processes JSON-RPC requests
3. **Debugger Plugin**: Captures runtime output, errors, and warnings from the running game

### JSON-RPC Methods

The plugin responds to these JSON-RPC methods:

| Method | Description |
|--------|-------------|
| `initialize` | Get server info and capabilities |
| `scene_tree.get` | Get the current scene tree |
| `scene_tree.add_node` | Add a node to the scene |
| `scene_tree.remove_node` | Remove a node from the scene |
| `scene_tree.modify_node` | Modify node properties |
| `editor.open_scene` | Open a scene file |
| `editor.save_scene` | Save the current scene |
| `editor.run_scene` | Run current or specified scene |
| `editor.stop_scene` | Stop the running scene |
| `editor.select_node` | Select a node in the scene tree |
| `info.project` | Get project information |
| `info.errors` | Get runtime errors |
| `info.output` | Get console output |
| `info.log_file` | Read Godot's log file |
| `fs.refresh` | Refresh the filesystem |

---

## Example Usage

Once configured, you can ask your AI assistant:

### Scene Creation
- "Create a new 2D platformer scene with a player and some platforms"
- "Add a Camera2D that follows the player"
- "Set up a tilemap for my level"

### Script Generation
- "Generate a player controller script with WASD movement and jumping"
- "Create an enemy AI script that patrols and chases the player"
- "Write a state machine for managing game states"

### UI Development
- "Create a main menu with play, settings, and quit buttons using the fantasy theme"
- "Build a HUD with a health bar, score counter, and minimap"
- "Generate a settings menu with audio and display options"

### Shaders
- "Add a dissolve shader to the player sprite"
- "Create a CRT screen effect for the game"
- "Generate an outline shader for selected objects"

### Procedural Content
- "Generate a 10x10 dungeon with 5 rooms"
- "Create a cave tilemap pattern that's 20x15"
- "Generate 10 waves of enemies with goblins and orcs"

### Live Editing
- "Connect to Godot and show me the current scene tree"
- "Run the main scene and show me any errors"
- "Select the Player node in the editor"

### Documentation
- "Show me the CharacterBody2D documentation"
- "Search the docs for 'collision'"
- "What methods does Area2D have?"

---

## Common Workflows

### 1. Create a Complete Character
```
1. godot_write_scene - Create character scene
2. godot_generate_script - Generate controller script
3. godot_generate_shader - Add visual effects
4. godot_add_node - Add collision shapes, sprites
```

### 2. Build Game UI
```
1. godot_ui_create_theme - Create consistent theme
2. godot_ui_create_menu - Build main menu
3. godot_ui_create_hud - Add in-game HUD
4. godot_ui_create_dialog - Add dialog system
```

### 3. Debug with Live Editor
```
1. godot_connect - Connect to Godot
2. godot_editor_run_scene - Run the game
3. godot_editor_get_output - Check console output
4. godot_editor_get_errors - Review any errors
```

### 4. Generate Procedural Content
```
1. godot_generate_dungeon - Create dungeon layout
2. godot_generate_tilemap_pattern - Add tile patterns
3. godot_generate_wave_config - Configure enemies
```

---

## Requirements

- **Node.js 18+**
- **Godot 4.x** (4.2+ recommended for live editor features)

## License

MIT

## Contributing

Issues and pull requests welcome at [github.com/alexmeckes/godot-mcp](https://github.com/alexmeckes/godot-mcp)

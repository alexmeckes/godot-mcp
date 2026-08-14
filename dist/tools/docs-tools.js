/**
 * Documentation and project tools for Godot MCP
 */
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { isMutatingToolName, usesEditorBridgeTool } from "../utils/tool-metadata.js";
// Godot 4.x class documentation (commonly used classes)
const GODOT_DOCS = {
    // Core nodes
    Node: {
        description: "Base class for all scene objects. Nodes can be organized in a tree structure.",
        inherits: "Object",
        category: "Core",
        properties: [
            { name: "name", type: "StringName", description: "The name of the node" },
            { name: "owner", type: "Node", description: "The node owner (for scene saving)" },
            { name: "process_mode", type: "ProcessMode", description: "Processing mode (inherit, pausable, etc.)" },
        ],
        methods: [
            { name: "add_child", args: ["node: Node"], description: "Adds a child node" },
            { name: "remove_child", args: ["node: Node"], description: "Removes a child node" },
            { name: "get_node", args: ["path: NodePath"], returns: "Node", description: "Gets a node by path" },
            { name: "get_children", args: [], returns: "Array[Node]", description: "Returns all child nodes" },
            { name: "queue_free", args: [], description: "Queues the node for deletion" },
            { name: "is_in_group", args: ["group: String"], returns: "bool", description: "Check if node is in group" },
            { name: "add_to_group", args: ["group: String"], description: "Add node to group" },
        ],
        signals: [
            { name: "ready", description: "Emitted when the node enters the scene tree" },
            { name: "tree_entered", description: "Emitted when entering the scene tree" },
            { name: "tree_exited", description: "Emitted when exiting the scene tree" },
        ],
    },
    Node2D: {
        description: "2D game object with transform (position, rotation, scale).",
        inherits: "CanvasItem",
        category: "2D",
        properties: [
            { name: "position", type: "Vector2", description: "Position relative to parent" },
            { name: "rotation", type: "float", description: "Rotation in radians" },
            { name: "scale", type: "Vector2", description: "Scale factor" },
            { name: "global_position", type: "Vector2", description: "Global position" },
            { name: "global_rotation", type: "float", description: "Global rotation" },
        ],
        methods: [
            { name: "rotate", args: ["radians: float"], description: "Rotates the node" },
            { name: "translate", args: ["offset: Vector2"], description: "Moves the node" },
            { name: "look_at", args: ["point: Vector2"], description: "Rotates to look at point" },
            { name: "to_local", args: ["global: Vector2"], returns: "Vector2", description: "Converts global to local coordinates" },
            { name: "to_global", args: ["local: Vector2"], returns: "Vector2", description: "Converts local to global coordinates" },
        ],
        signals: [],
    },
    Node3D: {
        description: "3D game object with transform (position, rotation, scale).",
        inherits: "Node",
        category: "3D",
        properties: [
            { name: "position", type: "Vector3", description: "Position relative to parent" },
            { name: "rotation", type: "Vector3", description: "Rotation in Euler angles (radians)" },
            { name: "scale", type: "Vector3", description: "Scale factor" },
            { name: "global_position", type: "Vector3", description: "Global position" },
            { name: "global_rotation", type: "Vector3", description: "Global rotation" },
            { name: "transform", type: "Transform3D", description: "Local transform matrix" },
        ],
        methods: [
            { name: "rotate", args: ["axis: Vector3", "angle: float"], description: "Rotates around axis" },
            { name: "translate", args: ["offset: Vector3"], description: "Moves the node" },
            { name: "look_at", args: ["target: Vector3", "up: Vector3"], description: "Rotates to look at target" },
        ],
        signals: [],
    },
    CharacterBody2D: {
        description: "2D physics body for character movement with built-in collision response.",
        inherits: "PhysicsBody2D",
        category: "2D Physics",
        properties: [
            { name: "velocity", type: "Vector2", description: "Current velocity" },
            { name: "floor_max_angle", type: "float", description: "Max angle for floor detection" },
            { name: "motion_mode", type: "MotionMode", description: "Grounded or floating motion" },
        ],
        methods: [
            { name: "move_and_slide", args: [], returns: "bool", description: "Moves with collision, returns true if collided" },
            { name: "is_on_floor", args: [], returns: "bool", description: "True if touching floor" },
            { name: "is_on_wall", args: [], returns: "bool", description: "True if touching wall" },
            { name: "is_on_ceiling", args: [], returns: "bool", description: "True if touching ceiling" },
            { name: "get_floor_normal", args: [], returns: "Vector2", description: "Normal of the floor" },
        ],
        signals: [],
    },
    CharacterBody3D: {
        description: "3D physics body for character movement with built-in collision response.",
        inherits: "PhysicsBody3D",
        category: "3D Physics",
        properties: [
            { name: "velocity", type: "Vector3", description: "Current velocity" },
            { name: "floor_max_angle", type: "float", description: "Max angle for floor detection" },
            { name: "motion_mode", type: "MotionMode", description: "Grounded or floating motion" },
        ],
        methods: [
            { name: "move_and_slide", args: [], returns: "bool", description: "Moves with collision" },
            { name: "is_on_floor", args: [], returns: "bool", description: "True if touching floor" },
            { name: "is_on_wall", args: [], returns: "bool", description: "True if touching wall" },
            { name: "is_on_ceiling", args: [], returns: "bool", description: "True if touching ceiling" },
        ],
        signals: [],
    },
    RigidBody2D: {
        description: "2D physics body driven by physics simulation.",
        inherits: "PhysicsBody2D",
        category: "2D Physics",
        properties: [
            { name: "mass", type: "float", description: "Body mass" },
            { name: "gravity_scale", type: "float", description: "Gravity multiplier" },
            { name: "linear_velocity", type: "Vector2", description: "Linear velocity" },
            { name: "angular_velocity", type: "float", description: "Angular velocity" },
        ],
        methods: [
            { name: "apply_force", args: ["force: Vector2", "position: Vector2"], description: "Applies force at position" },
            { name: "apply_impulse", args: ["impulse: Vector2", "position: Vector2"], description: "Applies instant impulse" },
            { name: "apply_central_force", args: ["force: Vector2"], description: "Applies force at center" },
        ],
        signals: [
            { name: "body_entered", description: "Emitted when a body enters contact" },
            { name: "body_exited", description: "Emitted when a body exits contact" },
        ],
    },
    Area2D: {
        description: "2D area for detecting overlaps and physics interactions.",
        inherits: "CollisionObject2D",
        category: "2D Physics",
        properties: [
            { name: "monitoring", type: "bool", description: "Whether to detect bodies/areas" },
            { name: "monitorable", type: "bool", description: "Whether can be detected by others" },
            { name: "gravity", type: "float", description: "Area gravity strength" },
        ],
        methods: [
            { name: "get_overlapping_bodies", args: [], returns: "Array[Node2D]", description: "Returns overlapping physics bodies" },
            { name: "get_overlapping_areas", args: [], returns: "Array[Area2D]", description: "Returns overlapping areas" },
            { name: "overlaps_body", args: ["body: Node"], returns: "bool", description: "Check if overlapping specific body" },
        ],
        signals: [
            { name: "body_entered", description: "Emitted when a body enters" },
            { name: "body_exited", description: "Emitted when a body exits" },
            { name: "area_entered", description: "Emitted when an area enters" },
            { name: "area_exited", description: "Emitted when an area exits" },
        ],
    },
    Sprite2D: {
        description: "2D sprite node for displaying textures.",
        inherits: "Node2D",
        category: "2D",
        properties: [
            { name: "texture", type: "Texture2D", description: "The texture to display" },
            { name: "offset", type: "Vector2", description: "Texture offset" },
            { name: "flip_h", type: "bool", description: "Flip horizontally" },
            { name: "flip_v", type: "bool", description: "Flip vertically" },
            { name: "hframes", type: "int", description: "Horizontal frames in spritesheet" },
            { name: "vframes", type: "int", description: "Vertical frames in spritesheet" },
            { name: "frame", type: "int", description: "Current frame index" },
        ],
        methods: [
            { name: "get_rect", args: [], returns: "Rect2", description: "Returns the sprite's bounding rectangle" },
        ],
        signals: [
            { name: "frame_changed", description: "Emitted when frame changes" },
        ],
    },
    AnimatedSprite2D: {
        description: "2D sprite with frame-based animations.",
        inherits: "Node2D",
        category: "2D",
        properties: [
            { name: "sprite_frames", type: "SpriteFrames", description: "Animation frames resource" },
            { name: "animation", type: "StringName", description: "Current animation name" },
            { name: "frame", type: "int", description: "Current frame" },
            { name: "speed_scale", type: "float", description: "Animation speed multiplier" },
        ],
        methods: [
            { name: "play", args: ["name: StringName"], description: "Plays an animation" },
            { name: "stop", args: [], description: "Stops the animation" },
            { name: "is_playing", args: [], returns: "bool", description: "Whether animation is playing" },
        ],
        signals: [
            { name: "animation_finished", description: "Emitted when animation finishes" },
            { name: "frame_changed", description: "Emitted when frame changes" },
        ],
    },
    Control: {
        description: "Base class for all UI nodes.",
        inherits: "CanvasItem",
        category: "UI",
        properties: [
            { name: "position", type: "Vector2", description: "Position relative to parent" },
            { name: "size", type: "Vector2", description: "Size of the control" },
            { name: "anchor_left", type: "float", description: "Left anchor (0-1)" },
            { name: "anchor_top", type: "float", description: "Top anchor (0-1)" },
            { name: "anchor_right", type: "float", description: "Right anchor (0-1)" },
            { name: "anchor_bottom", type: "float", description: "Bottom anchor (0-1)" },
            { name: "size_flags_horizontal", type: "SizeFlags", description: "Horizontal size flags for containers" },
            { name: "size_flags_vertical", type: "SizeFlags", description: "Vertical size flags for containers" },
        ],
        methods: [
            { name: "set_anchors_preset", args: ["preset: LayoutPreset"], description: "Sets anchor preset" },
            { name: "grab_focus", args: [], description: "Gives focus to this control" },
            { name: "has_focus", args: [], returns: "bool", description: "Whether control has focus" },
        ],
        signals: [
            { name: "gui_input", description: "Emitted on unhandled input" },
            { name: "focus_entered", description: "Emitted when receiving focus" },
            { name: "focus_exited", description: "Emitted when losing focus" },
            { name: "mouse_entered", description: "Emitted when mouse enters" },
            { name: "mouse_exited", description: "Emitted when mouse exits" },
        ],
    },
    Button: {
        description: "Standard themed button that can contain text and an icon.",
        inherits: "BaseButton",
        category: "UI",
        properties: [
            { name: "text", type: "String", description: "Button text" },
            { name: "icon", type: "Texture2D", description: "Button icon" },
            { name: "flat", type: "bool", description: "Flat appearance (no background)" },
            { name: "disabled", type: "bool", description: "Whether button is disabled" },
        ],
        methods: [],
        signals: [
            { name: "pressed", description: "Emitted when button is pressed" },
            { name: "button_down", description: "Emitted when button is held down" },
            { name: "button_up", description: "Emitted when button is released" },
        ],
    },
    Label: {
        description: "Text display node.",
        inherits: "Control",
        category: "UI",
        properties: [
            { name: "text", type: "String", description: "The text to display" },
            { name: "horizontal_alignment", type: "HorizontalAlignment", description: "Horizontal text alignment" },
            { name: "vertical_alignment", type: "VerticalAlignment", description: "Vertical text alignment" },
            { name: "autowrap_mode", type: "AutowrapMode", description: "Text wrapping mode" },
        ],
        methods: [
            { name: "get_line_count", args: [], returns: "int", description: "Returns number of lines" },
        ],
        signals: [],
    },
    ProgressBar: {
        description: "Progress bar for displaying completion percentage.",
        inherits: "Range",
        category: "UI",
        properties: [
            { name: "value", type: "float", description: "Current value" },
            { name: "min_value", type: "float", description: "Minimum value" },
            { name: "max_value", type: "float", description: "Maximum value" },
            { name: "step", type: "float", description: "Value step" },
            { name: "show_percentage", type: "bool", description: "Show percentage text" },
        ],
        methods: [],
        signals: [
            { name: "value_changed", description: "Emitted when value changes" },
        ],
    },
    Timer: {
        description: "Countdown timer node.",
        inherits: "Node",
        category: "Core",
        properties: [
            { name: "wait_time", type: "float", description: "Time to wait in seconds" },
            { name: "one_shot", type: "bool", description: "Whether timer runs once or loops" },
            { name: "autostart", type: "bool", description: "Start automatically" },
            { name: "time_left", type: "float", description: "Time remaining (read-only)" },
        ],
        methods: [
            { name: "start", args: ["time_sec: float"], description: "Starts the timer" },
            { name: "stop", args: [], description: "Stops the timer" },
            { name: "is_stopped", args: [], returns: "bool", description: "Whether timer is stopped" },
        ],
        signals: [
            { name: "timeout", description: "Emitted when timer finishes" },
        ],
    },
    AnimationPlayer: {
        description: "Node for playing animations on properties.",
        inherits: "AnimationMixer",
        category: "Animation",
        properties: [
            { name: "current_animation", type: "String", description: "Currently playing animation" },
            { name: "playback_speed", type: "float", description: "Playback speed multiplier" },
            { name: "autoplay", type: "String", description: "Animation to autoplay" },
        ],
        methods: [
            { name: "play", args: ["name: StringName", "custom_blend: float", "custom_speed: float"], description: "Plays animation" },
            { name: "stop", args: [], description: "Stops animation" },
            { name: "pause", args: [], description: "Pauses animation" },
            { name: "is_playing", args: [], returns: "bool", description: "Whether animation is playing" },
            { name: "get_animation_list", args: [], returns: "PackedStringArray", description: "List of animations" },
        ],
        signals: [
            { name: "animation_finished", description: "Emitted when animation finishes" },
            { name: "animation_started", description: "Emitted when animation starts" },
        ],
    },
    Camera2D: {
        description: "2D camera node.",
        inherits: "Node2D",
        category: "2D",
        properties: [
            { name: "offset", type: "Vector2", description: "Camera offset" },
            { name: "zoom", type: "Vector2", description: "Camera zoom" },
            { name: "limit_left", type: "int", description: "Left scroll limit" },
            { name: "limit_right", type: "int", description: "Right scroll limit" },
            { name: "limit_top", type: "int", description: "Top scroll limit" },
            { name: "limit_bottom", type: "int", description: "Bottom scroll limit" },
            { name: "position_smoothing_enabled", type: "bool", description: "Enable smooth following" },
            { name: "position_smoothing_speed", type: "float", description: "Smoothing speed" },
        ],
        methods: [
            { name: "make_current", args: [], description: "Makes this the current camera" },
            { name: "is_current", args: [], returns: "bool", description: "Whether this is current camera" },
        ],
        signals: [],
    },
    AudioStreamPlayer: {
        description: "Plays audio globally (non-positional).",
        inherits: "Node",
        category: "Audio",
        properties: [
            { name: "stream", type: "AudioStream", description: "Audio stream to play" },
            { name: "volume_db", type: "float", description: "Volume in decibels" },
            { name: "pitch_scale", type: "float", description: "Pitch multiplier" },
            { name: "autoplay", type: "bool", description: "Play automatically" },
            { name: "bus", type: "StringName", description: "Audio bus name" },
        ],
        methods: [
            { name: "play", args: ["from_position: float"], description: "Plays the audio" },
            { name: "stop", args: [], description: "Stops playback" },
            { name: "is_playing", args: [], returns: "bool", description: "Whether audio is playing" },
        ],
        signals: [
            { name: "finished", description: "Emitted when playback finishes" },
        ],
    },
    TileMapLayer: {
        description: "Single layer of a tilemap (Godot 4.3+).",
        inherits: "Node2D",
        category: "2D",
        properties: [
            { name: "tile_set", type: "TileSet", description: "The tileset resource" },
            { name: "cell_quadrant_size", type: "int", description: "Size of cell quadrants for optimization" },
        ],
        methods: [
            { name: "set_cell", args: ["coords: Vector2i", "source_id: int", "atlas_coords: Vector2i"], description: "Sets a tile" },
            { name: "get_cell_source_id", args: ["coords: Vector2i"], returns: "int", description: "Gets tile source ID" },
            { name: "erase_cell", args: ["coords: Vector2i"], description: "Erases a tile" },
            { name: "clear", args: [], description: "Clears all tiles" },
            { name: "get_used_cells", args: [], returns: "Array[Vector2i]", description: "Gets all used cell coordinates" },
        ],
        signals: [],
    },
    RayCast2D: {
        description: "2D ray for collision detection.",
        inherits: "Node2D",
        category: "2D Physics",
        properties: [
            { name: "enabled", type: "bool", description: "Whether raycast is active" },
            { name: "target_position", type: "Vector2", description: "Ray end point (local)" },
            { name: "collision_mask", type: "int", description: "Collision layers to detect" },
        ],
        methods: [
            { name: "is_colliding", args: [], returns: "bool", description: "Whether ray is hitting something" },
            { name: "get_collider", args: [], returns: "Object", description: "Gets the collided object" },
            { name: "get_collision_point", args: [], returns: "Vector2", description: "Gets collision point" },
            { name: "get_collision_normal", args: [], returns: "Vector2", description: "Gets collision normal" },
            { name: "force_raycast_update", args: [], description: "Updates raycast immediately" },
        ],
        signals: [],
    },
};
// Tool guide for helping select the right tool
const TOOL_GUIDE = {
    overview: `Godot MCP provides 90 tools across 13 categories. This guide helps you choose the right tool for your task.`,
    categories: {
        scenes: {
            description: "Work with .tscn scene files (file-based, no editor connection needed)",
            tools: {
                godot_read_scene: "Parse and inspect a scene file's structure",
                godot_write_scene: "Create or overwrite a scene file",
                godot_add_node: "Add a new node to an existing scene (accepts root-prefixed or root-relative paths)",
                godot_remove_node: "Remove a node from a scene (accepts root-prefixed or root-relative paths)",
                godot_modify_node: "Change node properties (position, scale, etc.; accepts root-prefixed or root-relative paths)",
                godot_list_scene_nodes: "List all nodes in a scene hierarchically",
                godot_validate_scene: "Check scene for structural errors",
                godot_list_scenes: "Find all .tscn files in the project",
            },
            whenToUse: [
                "Creating new game levels or UI layouts",
                "Modifying existing scenes programmatically",
                "Batch operations across multiple scenes",
                "Working without Godot editor open",
            ],
        },
        scripts: {
            description: "Work with .gd GDScript files",
            tools: {
                godot_read_script: "Read a GDScript file's contents",
                godot_write_script: "Create or overwrite a GDScript file",
                godot_analyze_script: "Extract class info, functions, signals from a script",
                godot_generate_script: "Generate GDScript from a description (e.g., 'player controller with double jump')",
                godot_list_scripts: "Find all .gd files in the project",
                godot_validate_script: "Check script for syntax errors",
            },
            whenToUse: [
                "Writing new game logic or behaviors",
                "Analyzing existing code structure",
                "Generating boilerplate code",
                "Refactoring scripts",
            ],
        },
        editor: {
            description: "Control the live Godot editor (requires AI Bridge plugin and connection)",
            tools: {
                godot_connect: "Connect to running Godot editor",
                godot_disconnect: "Disconnect from editor",
                godot_connection_status: "Check current bridge connection status",
                godot_editor_get_scene_tree: "Inspect the live scene tree",
                godot_editor_select_node: "Select a node in the editor",
                godot_editor_add_node: "Add node in real-time",
                godot_editor_modify_node: "Modify node in real-time",
                godot_editor_remove_node: "Remove node in real-time",
                godot_editor_open_scene: "Open a scene in the editor",
                godot_editor_save_scene: "Save current scene",
                godot_editor_run_scene: "Play the current scene",
                godot_editor_stop_scene: "Stop the running scene",
                godot_editor_get_errors: "Retrieve current editor/runtime errors",
                godot_editor_get_output: "Retrieve captured output lines",
                godot_editor_get_log_file: "Read latest Godot log file lines",
                godot_editor_execute_gdscript: "Execute GDScript inside editor context",
                godot_editor_get_project_info: "Get project path/name/version details",
                godot_editor_refresh_filesystem: "Trigger editor filesystem rescan",
                godot_runtime_status: "Inspect runtime automation harness status",
                godot_runtime_wait: "Wait for frames or seconds inside the running game (defaults to one frame)",
                godot_runtime_press_action: "Press and hold an InputMap action in the running game",
                godot_runtime_release_action: "Release a pressed InputMap action in the running game",
                godot_runtime_tap_action: "Tap an InputMap action for a few frames",
                godot_runtime_mouse_move: "Move the synthetic runtime pointer",
                godot_runtime_click: "Click inside the running game viewport",
                godot_runtime_type_text: "Type into the focused runtime control",
                godot_runtime_capture_screenshot: "Capture the running game viewport to PNG",
            },
            whenToUse: [
                "Iterating quickly with visual feedback",
                "Testing changes immediately",
                "Debugging with live inspection",
                "Automating repeatable runtime checks",
                "Collaborative editing sessions",
            ],
            prerequisite: "Must install AI Bridge plugin and call godot_connect first",
        },
        shaders: {
            description: "Work with .gdshader visual effects",
            tools: {
                godot_read_shader: "Read a shader file",
                godot_write_shader: "Create or overwrite a shader",
                godot_generate_shader: "Generate shader from preset (flash, dissolve, outline, etc.)",
                godot_list_shaders: "Find all .gdshader files",
            },
            presets: ["flash", "outline", "dissolve", "pixelate", "wave", "gradient_map", "chromatic_aberration", "vignette", "crt", "hologram", "fresnel"],
            whenToUse: [
                "Adding visual effects to sprites/models",
                "Creating damage flash, death dissolve effects",
                "Post-processing and screen effects",
            ],
        },
        resources: {
            description: "Work with .tres resource files",
            tools: {
                godot_read_resource: "Read a resource file",
                godot_write_resource: "Create or overwrite a resource",
                godot_list_resources: "Find all .tres files",
            },
            whenToUse: [
                "Creating data-driven game content",
                "Managing item databases, enemy stats",
                "Theme and style resources",
            ],
        },
        animation: {
            description: "Create and edit animation clips plus AnimationPlayer/AnimationTree scene setup",
            tools: {
                godot_animation_create_clip: "Create Animation resources with value tracks and keyframes",
                godot_animation_read_clip: "Read Animation resource tracks/keyframes as structured data",
                godot_animation_add_keyframe: "Add a keyframe to an existing animation track",
                godot_animation_remove_keyframe: "Remove keyframes by index or timestamp",
                godot_animation_list_clips: "List Animation resource files and metadata",
                godot_animation_setup_scene: "Add or configure AnimationPlayer and AnimationTree nodes in scenes",
                godot_animation_build_state_machine_plan: "Build state-machine configuration plans and runtime setup scripts",
                godot_animation_build_blend_space_plan: "Build blend-space configuration plans and runtime setup scripts",
            },
            whenToUse: [
                "Bootstrapping animation clips from structured data",
                "Editing keyframe timing/value data programmatically",
                "Wiring AnimationPlayer/AnimationTree into existing scenes",
            ],
        },
        input: {
            description: "Manage InputMap actions and bindings in project.godot (keyboard, mouse, and gamepad)",
            tools: {
                godot_input_list_actions: "List all input actions with deadzones and binding counts",
                godot_input_get_action: "Inspect one input action and all of its bindings",
                godot_input_set_action: "Create or update an action and its bindings",
                godot_input_remove_action: "Remove an action from InputMap",
                godot_input_list_presets: "List built-in control presets",
                godot_input_apply_preset: "Apply a built-in control preset (merge or replace)",
            },
            whenToUse: [
                "Setting up keyboard/mouse/gamepad controls",
                "Standardizing control schemes across projects",
                "Automating InputMap edits without opening editor settings",
            ],
        },
        audio: {
            description: "Manage AudioBusLayout resources and configure AudioStreamPlayer nodes in scenes",
            tools: {
                godot_audio_create_bus_layout: "Create or overwrite AudioBusLayout resources and optionally set project default",
                godot_audio_read_bus_layout: "Read bus layout resources into structured bus data",
                godot_audio_set_bus: "Create/update individual buses (send, volume, mute, solo, bypass)",
                godot_audio_remove_bus: "Remove buses from a layout by name",
                godot_audio_list_players: "List AudioStreamPlayer nodes and their stream/bus settings",
                godot_audio_configure_player: "Configure player stream, bus routing, volume, pitch, and autoplay",
                godot_audio_list_effect_presets: "List built-in effect-chain presets",
                godot_audio_generate_effect_chain_script: "Generate AudioServer scripts to apply preset effects on a bus",
                godot_audio_apply_mix_profile: "Apply named mix profiles (gameplay/cinematic/paused/silent)",
            },
            whenToUse: [
                "Setting up bus routing (Music/SFX/VO) in a reproducible way",
                "Applying consistent audio player settings across scenes",
                "Automating project audio defaults for new environments",
            ],
        },
        navigation: {
            description: "Set up navigation regions, agents, and links directly in scene files",
            tools: {
                godot_navigation_list_nodes: "List navigation nodes and their key settings in a scene",
                godot_navigation_add_region: "Add NavigationRegion2D/3D nodes with baseline navigation properties",
                godot_navigation_add_agent: "Add NavigationAgent2D/3D nodes with baseline movement/avoidance settings",
                godot_navigation_add_link: "Add NavigationLink2D/3D nodes with start/end positions",
                godot_navigation_configure_region: "Configure region properties like layers/costs/enabled",
                godot_navigation_configure_agent: "Configure agent movement and avoidance properties",
                godot_navigation_build_bake_plan: "Generate bake checklists from region/agent/link setup",
                godot_navigation_validate_paths: "Validate layer compatibility and link/path consistency",
            },
            whenToUse: [
                "Bootstrapping scene-level navigation setup",
                "Standardizing agent parameters across multiple scenes",
                "Automating link/region scaffolding before navmesh baking",
            ],
        },
        procedural: {
            description: "Generate game content algorithmically",
            tools: {
                godot_generate_dungeon: "Generate dungeon layout (rooms, corridors, doors)",
                godot_generate_tilemap_pattern: "Generate tilemap patterns (terrain, borders)",
                godot_generate_wave_config: "Generate enemy wave configurations",
            },
            whenToUse: [
                "Roguelike level generation",
                "Auto-generating terrain",
                "Creating varied enemy encounters",
            ],
        },
        docs: {
            description: "Access Godot API documentation and project setup",
            tools: {
                godot_help: "This guide - shows available tools and when to use them",
                godot_get_class_docs: "Get docs for a Godot class (CharacterBody2D, etc.)",
                godot_search_docs: "Search documentation by keyword",
                godot_list_documented_classes: "List all documented classes",
                godot_init_project: "Create a new Godot project with folder structure",
            },
            whenToUse: [
                "Looking up Godot API usage",
                "Finding the right class or method",
                "Setting up new projects",
            ],
        },
        ui: {
            description: "Create Godot UI elements - themes, menus, HUDs, dialogs, and layouts",
            tools: {
                godot_ui_create_theme: "Create Theme resource with colors, fonts, styleboxes (presets: dark, light, game, minimal)",
                godot_ui_create_stylebox: "Create StyleBoxFlat for custom panel/button styling",
                godot_ui_list_presets: "See available theme presets and their color schemes",
                godot_ui_create_menu: "Create menu scenes (main menu, pause, settings) with buttons and signals",
                godot_ui_create_hud: "Create game HUD with score, health, timer, lives elements",
                godot_ui_create_dialog: "Create dialog/popup scenes (alert, confirm, custom)",
                godot_ui_create_panel: "Create styled panel containers",
                godot_ui_list_anchors: "List all 16 anchor presets for responsive positioning",
                godot_ui_list_containers: "List container types (VBox, HBox, Grid, etc.) and use cases",
                godot_ui_create_layout: "Create responsive layouts (sidebar, header/footer, holy grail, grid)",
                godot_ui_create_container: "Create individual container scenes with anchor presets",
                godot_ui_get_anchor_config: "Get TSCN properties and GDScript for anchor configuration",
            },
            whenToUse: [
                "Building game menus and pause screens",
                "Creating in-game HUDs",
                "Making consistent UI themes",
                "Building responsive UI layouts",
                "Generating UI scenes with scripts",
            ],
        },
        coverage: {
            description: "Coverage matrix and roadmap for Godot subsystem support",
            tools: {},
            whenToUse: [
                "Evaluating what is currently supported",
                "Planning MCP feature expansion",
                "Prioritizing missing high-impact tool groups",
            ],
        },
    },
    workflows: {
        "Create a new game": [
            "1. godot_init_project - Set up project structure",
            "2. godot_generate_script - Create player controller",
            "3. godot_write_scene - Create main scene",
            "4. godot_add_node - Add player, platforms, etc.",
        ],
        "Add visual effects": [
            "1. godot_generate_shader - Pick a preset (dissolve, flash, etc.)",
            "2. godot_modify_node - Apply shader to sprite material",
        ],
        "Live editing session": [
            "1. godot_connect - Connect to Godot editor",
            "2. godot_editor_get_scene_tree - Inspect current state",
            "3. godot_editor_add_node / godot_editor_modify_node - Make changes",
            "4. godot_editor_run_scene - Test immediately",
        ],
        "Runtime automation session": [
            "1. godot_connect - Connect to Godot editor",
            "2. godot_editor_run_scene - Start a debug session",
            "3. godot_runtime_status - Confirm the runtime harness is available",
            "4. godot_runtime_tap_action / godot_runtime_click - Drive interactions",
            "5. godot_runtime_capture_screenshot - Save visual evidence when needed",
        ],
        "Generate a level": [
            "1. godot_generate_dungeon - Create room layout",
            "2. godot_write_scene - Save as scene file",
            "3. godot_generate_wave_config - Add enemy waves",
        ],
        "Set up animations": [
            "1. godot_animation_create_clip - Create base clips (idle/run/jump)",
            "2. godot_animation_add_keyframe - Refine timing and values",
            "3. godot_animation_setup_scene - Wire AnimationPlayer/AnimationTree nodes",
            "4. godot_animation_build_state_machine_plan - Generate state machine runtime script",
        ],
        "Set up controls": [
            "1. godot_input_list_presets - Inspect available presets",
            "2. godot_input_apply_preset - Apply baseline controls",
            "3. godot_input_set_action - Add or customize specific bindings",
        ],
        "Set up audio": [
            "1. godot_audio_create_bus_layout - Create baseline bus routing",
            "2. godot_audio_set_bus - Tune Music/SFX/VO bus levels and routing",
            "3. godot_audio_configure_player - Attach streams and bus assignment in scenes",
            "4. godot_audio_generate_effect_chain_script - Apply effect chain through AudioServer",
        ],
        "Set up navigation": [
            "1. godot_navigation_add_region - Create navigation regions in scenes",
            "2. godot_navigation_add_agent - Add configured navigation agents",
            "3. godot_navigation_add_link - Add explicit link connections where needed",
            "4. godot_navigation_validate_paths - Validate layers and link consistency before bake",
        ],
        "Build game UI": [
            "1. godot_ui_create_theme - Create a theme (or use preset like 'game')",
            "2. godot_ui_create_menu - Create main menu with buttons",
            "3. godot_ui_create_hud - Create in-game HUD with score/health",
            "4. godot_ui_create_dialog - Create pause menu or confirmation dialogs",
        ],
    },
    tips: [
        "File-based tools (scenes, scripts, shaders) work without Godot running",
        "Editor tools require the AI Bridge plugin enabled and godot_connect called",
        "Use godot_validate_scene/script to check for errors before running",
        "godot_analyze_script is great for understanding existing code",
        "Shader presets cover most common 2D effects - customize after generating",
        "Use animation tools to create reusable clips before wiring AnimationTree logic",
        "Use input tools to keep control mappings reproducible across environments",
        "Use audio tools to standardize bus routing and player configuration across scenes",
        "Use navigation tools to scaffold regions/agents before running navmesh baking in editor",
        "Use generated script plans with godot_editor_execute_gdscript for live advanced setup",
    ],
};
const COVERAGE_GUIDE = {
    levels: {
        strong: "End-to-end workflows are supported with multiple focused tools.",
        partial: "Useful operations exist, but major workflow gaps remain.",
        minimal: "Only basic helpers exist; most workflow is still manual.",
        missing: "No dedicated tooling yet.",
    },
    matrix: [
        {
            subsystem: "Scene authoring (.tscn)",
            coverage: "strong",
            priority: "medium",
            tools: [
                "godot_read_scene",
                "godot_write_scene",
                "godot_add_node",
                "godot_modify_node",
                "godot_validate_scene",
            ],
            gaps: [
                "PackedScene-heavy instancing workflows",
                "Bulk scene refactors",
            ],
        },
        {
            subsystem: "Live editor control",
            coverage: "strong",
            priority: "medium",
            tools: ["godot_connect", "godot_editor_*"],
            gaps: ["Subscription/event streaming", "Richer querying/filtering"],
        },
        {
            subsystem: "Runtime automation and screenshots",
            coverage: "partial",
            priority: "high",
            tools: [
                "godot_runtime_status",
                "godot_runtime_wait",
                "godot_runtime_press_action",
                "godot_runtime_release_action",
                "godot_runtime_tap_action",
                "godot_runtime_mouse_move",
                "godot_runtime_click",
                "godot_runtime_type_text",
                "godot_runtime_capture_screenshot",
            ],
            gaps: [
                "Project-specific state snapshots and reset hooks",
                "Drag-and-drop, multi-window focus, and richer pointer semantics",
            ],
        },
        {
            subsystem: "GDScript workflows",
            coverage: "strong",
            priority: "medium",
            tools: [
                "godot_read_script",
                "godot_write_script",
                "godot_analyze_script",
                "godot_validate_script",
            ],
            gaps: ["AST-grade refactors", "Project-wide symbol operations"],
        },
        {
            subsystem: "UI workflows",
            coverage: "strong",
            priority: "medium",
            tools: [
                "godot_ui_create_theme",
                "godot_ui_create_menu",
                "godot_ui_create_hud",
                "godot_ui_create_layout",
            ],
            gaps: ["Patch existing UI scenes", "Accessibility/localization checks"],
        },
        {
            subsystem: "Shaders",
            coverage: "partial",
            priority: "medium",
            tools: ["godot_read_shader", "godot_write_shader", "godot_generate_shader"],
            gaps: ["Material assignment workflows", "Validation/linting"],
        },
        {
            subsystem: "Resources/data",
            coverage: "partial",
            priority: "high",
            tools: ["godot_read_resource", "godot_write_resource", "godot_list_resources"],
            gaps: ["Deep typed resource editing", ".res support", "Reference integrity checks"],
        },
        {
            subsystem: "Tilemap/procedural generation",
            coverage: "partial",
            priority: "high",
            tools: [
                "godot_generate_dungeon",
                "godot_generate_tilemap_pattern",
                "godot_generate_wave_config",
            ],
            gaps: ["TileSet authoring", "Navigation integration", "Runtime placement helpers"],
        },
        {
            subsystem: "Animation system",
            coverage: "partial",
            priority: "high",
            tools: [
                "godot_animation_create_clip",
                "godot_animation_read_clip",
                "godot_animation_add_keyframe",
                "godot_animation_remove_keyframe",
                "godot_animation_list_clips",
                "godot_animation_setup_scene",
                "godot_animation_build_state_machine_plan",
                "godot_animation_build_blend_space_plan",
            ],
            gaps: [
                "Direct AnimationTree graph resource authoring",
                "Advanced track types (method/audio/bezier) with scene-side wiring",
            ],
        },
        {
            subsystem: "Audio system",
            coverage: "partial",
            priority: "high",
            tools: [
                "godot_audio_create_bus_layout",
                "godot_audio_read_bus_layout",
                "godot_audio_set_bus",
                "godot_audio_remove_bus",
                "godot_audio_list_players",
                "godot_audio_configure_player",
                "godot_audio_list_effect_presets",
                "godot_audio_generate_effect_chain_script",
                "godot_audio_apply_mix_profile",
            ],
            gaps: [
                "Direct effect-chain serialization into AudioBusLayout resources",
                "Live runtime mixer automation hooks",
            ],
        },
        {
            subsystem: "Input map and controls",
            coverage: "partial",
            priority: "high",
            tools: [
                "godot_input_list_actions",
                "godot_input_get_action",
                "godot_input_set_action",
                "godot_input_remove_action",
                "godot_input_list_presets",
                "godot_input_apply_preset",
            ],
            gaps: ["Per-platform profile overlays", "Runtime/player-specific rebind workflows"],
        },
        {
            subsystem: "Navigation and AI helpers",
            coverage: "partial",
            priority: "high",
            tools: [
                "godot_navigation_list_nodes",
                "godot_navigation_add_region",
                "godot_navigation_add_agent",
                "godot_navigation_add_link",
                "godot_navigation_configure_region",
                "godot_navigation_configure_agent",
                "godot_navigation_build_bake_plan",
                "godot_navigation_validate_paths",
            ],
            gaps: ["Editor-triggered bake execution", "Live path visualization overlays"],
        },
        {
            subsystem: "Asset import pipeline",
            coverage: "missing",
            priority: "medium",
            tools: [],
            gaps: ["Import preset authoring", "Reimport controls"],
        },
        {
            subsystem: "Export/deployment",
            coverage: "missing",
            priority: "medium",
            tools: [],
            gaps: ["Export preset management", "Build validation"],
        },
        {
            subsystem: "Multiplayer/networking",
            coverage: "missing",
            priority: "low",
            tools: [],
            gaps: ["Replication scaffolds", "Authority/peer setup helpers"],
        },
    ],
    roadmap: {
        phase_1_highest_impact: [
            "Input map tool refinement (profile/rebind workflows)",
            "Audio tool refinement (direct effect serialization + runtime automation)",
            "Navigation tool refinement (editor bake + live path visualization)",
            "Animation tool refinement (direct graph authoring + advanced tracks)",
        ],
        phase_2_workflow_depth: [
            "Typed resource editing expansion",
            "TileSet/TileMap authoring tools",
            "Asset import pipeline tools",
        ],
        phase_3_advanced_release: [
            "Export/deployment tools",
            "Multiplayer scaffolding",
            "Advanced project-wide refactor/lint tools",
        ],
    },
    source: "docs/COVERAGE_MATRIX.md",
};
function isMutatingTool(toolName) {
    return isMutatingToolName(toolName);
}
function getToolPrerequisites(toolName) {
    const requirements = [];
    const usesEditorBridge = usesEditorBridgeTool(toolName);
    if (usesEditorBridge) {
        requirements.push("Godot editor running with the Godot AI Bridge plugin enabled.");
    }
    if (toolName.startsWith("godot_editor_") || toolName.startsWith("godot_runtime_")) {
        requirements.push("A successful `godot_connect` call in the current session.");
    }
    return requirements;
}
function unwrapSchema(schema) {
    let current = schema;
    let required = true;
    let nullable = false;
    let defaultValue;
    let shouldContinue = true;
    while (shouldContinue) {
        shouldContinue = false;
        if (current instanceof z.ZodDefault) {
            required = false;
            const defaultGetter = current._def.defaultValue;
            defaultValue =
                typeof defaultGetter === "function" ? defaultGetter() : defaultGetter;
            current = current.removeDefault();
            shouldContinue = true;
            continue;
        }
        if (current instanceof z.ZodOptional) {
            required = false;
            current = current.unwrap();
            shouldContinue = true;
            continue;
        }
        if (current instanceof z.ZodNullable) {
            nullable = true;
            current = current.unwrap();
            shouldContinue = true;
            continue;
        }
    }
    return { schema: current, required, nullable, defaultValue };
}
function schemaTypeLabel(schema) {
    if (schema instanceof z.ZodString)
        return "string";
    if (schema instanceof z.ZodNumber)
        return "number";
    if (schema instanceof z.ZodBoolean)
        return "boolean";
    if (schema instanceof z.ZodEnum)
        return schema.options.join(" | ");
    if (schema instanceof z.ZodLiteral)
        return JSON.stringify(schema.value);
    if (schema instanceof z.ZodArray) {
        return `array<${schemaTypeLabel(schema.element)}>`;
    }
    if (schema instanceof z.ZodRecord)
        return "record<string, unknown>";
    if (schema instanceof z.ZodObject)
        return "object";
    if (schema instanceof z.ZodUnion) {
        return schema.options
            .map((option) => schemaTypeLabel(option))
            .join(" | ");
    }
    if (schema instanceof z.ZodTuple) {
        return `tuple<${schema.def.items
            .map((item) => schemaTypeLabel(item))
            .join(", ")}>`;
    }
    return "unknown";
}
function describeToolInputs(inputSchema) {
    if (!(inputSchema instanceof z.ZodObject)) {
        return [];
    }
    const shape = inputSchema.shape;
    return Object.entries(shape).map(([name, value]) => {
        const rawSchema = value;
        const unwrapped = unwrapSchema(rawSchema);
        const typeLabel = `${schemaTypeLabel(unwrapped.schema)}${unwrapped.nullable ? " | null" : ""}`;
        const field = {
            name,
            type: typeLabel,
            required: unwrapped.required,
        };
        const description = rawSchema.description || unwrapped.schema.description;
        if (description) {
            field.description = description;
        }
        if (unwrapped.defaultValue !== undefined) {
            field.default = unwrapped.defaultValue;
        }
        return field;
    });
}
function exampleValueForType(typeLabel) {
    if (typeLabel.startsWith("string"))
        return "<string>";
    if (typeLabel.startsWith("number"))
        return 0;
    if (typeLabel.startsWith("boolean"))
        return false;
    if (typeLabel.startsWith("array<"))
        return [];
    if (typeLabel.startsWith("tuple<"))
        return [];
    if (typeLabel.startsWith("object"))
        return {};
    if (typeLabel.startsWith("record<"))
        return {};
    return "<value>";
}
function buildToolTemplate(toolName, tool) {
    const mutating = isMutatingTool(toolName);
    const prerequisites = getToolPrerequisites(toolName);
    const inputs = describeToolInputs(tool.inputSchema);
    const constraints = [];
    if (!usesEditorBridgeTool(toolName)) {
        constraints.push("Filesystem paths are restricted to the configured project root.");
    }
    if (toolName === "godot_editor_execute_gdscript") {
        constraints.push("Executes arbitrary GDScript in editor context. Only run trusted code.");
    }
    if (mutating) {
        constraints.push("May modify project files and/or live editor state.");
    }
    else {
        constraints.push("Read-only operation with no project mutation.");
    }
    const requiredInputs = inputs
        .filter((input) => input.required === true)
        .slice(0, 3);
    const exampleArgs = Object.fromEntries(requiredInputs.map((input) => [
        String(input.name),
        exampleValueForType(String(input.type || "unknown")),
    ]));
    return {
        tool: toolName,
        purpose: tool.description,
        operation: mutating ? "mutating" : "read_only",
        prerequisites,
        constraints,
        inputs,
        output: {
            format: "JSON object returned as MCP text content.",
            errors: "Returns `isError=true` with an error message when validation/execution fails.",
        },
        example: {
            tool: toolName,
            arguments: exampleArgs,
        },
    };
}
export function registerDocsTools(tools, state) {
    // Help/guide tool
    tools.set("godot_help", {
        description: "Get guidance on which Godot MCP tools to use. Call this first if unsure which tool to use for a task.",
        inputSchema: z.object({
            tool: z
                .string()
                .optional()
                .describe("Specific tool name to get a standardized usage template for"),
            category: z
                .enum(["all", "scenes", "scripts", "editor", "shaders", "resources", "animation", "input", "audio", "navigation", "procedural", "docs", "ui", "workflows", "coverage"])
                .optional()
                .describe("Specific category to get help on, or 'all' for overview"),
            task: z
                .string()
                .optional()
                .describe("Describe what you want to do (e.g., 'add a player to my scene')"),
        }),
        handler: async (args) => {
            const { tool: toolName, category, task } = args;
            if (toolName) {
                const targetTool = tools.get(toolName);
                if (!targetTool) {
                    return {
                        error: `Tool '${toolName}' not found`,
                        availableTools: Array.from(tools.keys()).sort(),
                    };
                }
                return buildToolTemplate(toolName, targetTool);
            }
            // If a specific task is described, suggest relevant tools
            if (task) {
                const taskLower = task.toLowerCase();
                const suggestions = [];
                // Match task to tools
                if (taskLower.includes("scene") || taskLower.includes("level") || taskLower.includes("node")) {
                    if (taskLower.includes("create") || taskLower.includes("new") || taskLower.includes("add")) {
                        suggestions.push({ tool: "godot_write_scene", reason: "Create new scene file" });
                        suggestions.push({ tool: "godot_add_node", reason: "Add nodes to existing scene" });
                    }
                    if (taskLower.includes("read") || taskLower.includes("inspect") || taskLower.includes("view")) {
                        suggestions.push({ tool: "godot_read_scene", reason: "Read scene structure" });
                        suggestions.push({ tool: "godot_list_scene_nodes", reason: "List all nodes" });
                    }
                    if (taskLower.includes("modify") || taskLower.includes("change") || taskLower.includes("update")) {
                        suggestions.push({ tool: "godot_modify_node", reason: "Change node properties" });
                    }
                }
                if (taskLower.includes("script") || taskLower.includes("code") || taskLower.includes("gdscript")) {
                    if (taskLower.includes("generate") || taskLower.includes("create") || taskLower.includes("write")) {
                        suggestions.push({ tool: "godot_generate_script", reason: "Generate from description" });
                        suggestions.push({ tool: "godot_write_script", reason: "Write custom script" });
                    }
                    if (taskLower.includes("read") || taskLower.includes("analyze")) {
                        suggestions.push({ tool: "godot_analyze_script", reason: "Analyze script structure" });
                    }
                }
                if (taskLower.includes("shader") || taskLower.includes("effect") || taskLower.includes("visual")) {
                    suggestions.push({ tool: "godot_generate_shader", reason: "Generate shader from preset" });
                    suggestions.push({ tool: "godot_write_shader", reason: "Write custom shader" });
                }
                if (taskLower.includes("animation") ||
                    taskLower.includes("keyframe") ||
                    taskLower.includes("animationplayer") ||
                    taskLower.includes("animationtree") ||
                    taskLower.includes("clip")) {
                    suggestions.push({ tool: "godot_animation_create_clip", reason: "Create animation clip resources" });
                    suggestions.push({ tool: "godot_animation_add_keyframe", reason: "Refine keyframe timing/values" });
                    suggestions.push({ tool: "godot_animation_setup_scene", reason: "Wire AnimationPlayer/AnimationTree in scene" });
                    if (taskLower.includes("state machine") ||
                        taskLower.includes("transition") ||
                        taskLower.includes("blend")) {
                        suggestions.push({ tool: "godot_animation_build_state_machine_plan", reason: "Generate state-machine plan and script" });
                        suggestions.push({ tool: "godot_animation_build_blend_space_plan", reason: "Generate blend-space plan and script" });
                    }
                }
                if (taskLower.includes("input") ||
                    taskLower.includes("control") ||
                    taskLower.includes("keybind") ||
                    taskLower.includes("binding") ||
                    taskLower.includes("action map") ||
                    taskLower.includes("rebind")) {
                    suggestions.push({ tool: "godot_input_list_actions", reason: "Inspect current InputMap actions" });
                    suggestions.push({ tool: "godot_input_set_action", reason: "Create/update action bindings" });
                    suggestions.push({ tool: "godot_input_apply_preset", reason: "Apply baseline control presets" });
                }
                if (taskLower.includes("audio") ||
                    taskLower.includes("sound") ||
                    taskLower.includes("music") ||
                    taskLower.includes("bus") ||
                    taskLower.includes("sfx") ||
                    taskLower.includes("volume") ||
                    taskLower.includes("stream")) {
                    suggestions.push({ tool: "godot_audio_create_bus_layout", reason: "Create/update bus layout routing" });
                    suggestions.push({ tool: "godot_audio_set_bus", reason: "Tune bus levels and sends" });
                    suggestions.push({ tool: "godot_audio_configure_player", reason: "Assign streams and bus settings on players" });
                    if (taskLower.includes("effect") ||
                        taskLower.includes("compressor") ||
                        taskLower.includes("eq") ||
                        taskLower.includes("reverb")) {
                        suggestions.push({ tool: "godot_audio_list_effect_presets", reason: "Browse available effect-chain presets" });
                        suggestions.push({ tool: "godot_audio_generate_effect_chain_script", reason: "Generate AudioServer effect-chain script" });
                    }
                    if (taskLower.includes("mix") ||
                        taskLower.includes("snapshot") ||
                        taskLower.includes("profile")) {
                        suggestions.push({ tool: "godot_audio_apply_mix_profile", reason: "Apply named mix profile to bus layout" });
                    }
                }
                if (taskLower.includes("navigation") ||
                    taskLower.includes("pathfinding") ||
                    taskLower.includes("navmesh") ||
                    taskLower.includes("agent") ||
                    taskLower.includes("path") ||
                    taskLower.includes("waypoint")) {
                    suggestions.push({ tool: "godot_navigation_add_region", reason: "Create navigation regions in scene files" });
                    suggestions.push({ tool: "godot_navigation_add_agent", reason: "Add configured navigation agents" });
                    suggestions.push({ tool: "godot_navigation_add_link", reason: "Create explicit navigation links" });
                    if (taskLower.includes("bake") ||
                        taskLower.includes("validate") ||
                        taskLower.includes("debug")) {
                        suggestions.push({ tool: "godot_navigation_build_bake_plan", reason: "Generate bake checklist and readiness report" });
                        suggestions.push({ tool: "godot_navigation_validate_paths", reason: "Validate layers/link consistency before bake" });
                    }
                }
                if (taskLower.includes("dungeon") || taskLower.includes("procedural") || taskLower.includes("generate")) {
                    if (taskLower.includes("dungeon") || taskLower.includes("room")) {
                        suggestions.push({ tool: "godot_generate_dungeon", reason: "Generate dungeon layout" });
                    }
                    if (taskLower.includes("tile") || taskLower.includes("terrain")) {
                        suggestions.push({ tool: "godot_generate_tilemap_pattern", reason: "Generate tilemap" });
                    }
                    if (taskLower.includes("wave") || taskLower.includes("enemy") || taskLower.includes("spawn")) {
                        suggestions.push({ tool: "godot_generate_wave_config", reason: "Generate enemy waves" });
                    }
                }
                if (taskLower.includes("live") || taskLower.includes("editor") || taskLower.includes("real-time")) {
                    suggestions.push({ tool: "godot_connect", reason: "Connect to Godot editor first" });
                    suggestions.push({ tool: "godot_editor_get_scene_tree", reason: "Inspect live scene" });
                }
                if (taskLower.includes("runtime") ||
                    taskLower.includes("screenshot") ||
                    taskLower.includes("click") ||
                    taskLower.includes("tap") ||
                    taskLower.includes("input") ||
                    taskLower.includes("type text") ||
                    taskLower.includes("automate")) {
                    suggestions.push({ tool: "godot_connect", reason: "Connect to Godot editor first" });
                    suggestions.push({ tool: "godot_editor_run_scene", reason: "Start a runtime debug session" });
                    suggestions.push({ tool: "godot_runtime_status", reason: "Confirm the runtime automation harness is available" });
                    if (taskLower.includes("screenshot")) {
                        suggestions.push({ tool: "godot_runtime_capture_screenshot", reason: "Capture the running game viewport to disk" });
                    }
                    if (taskLower.includes("click") || taskLower.includes("mouse")) {
                        suggestions.push({ tool: "godot_runtime_click", reason: "Send pointer clicks into the running game" });
                    }
                    if (taskLower.includes("tap") || taskLower.includes("press") || taskLower.includes("jump")) {
                        suggestions.push({ tool: "godot_runtime_tap_action", reason: "Drive InputMap gameplay actions in the running game" });
                    }
                    if (taskLower.includes("type")) {
                        suggestions.push({ tool: "godot_runtime_type_text", reason: "Type into the focused runtime control" });
                    }
                }
                if (taskLower.includes("project") || taskLower.includes("init") || taskLower.includes("setup")) {
                    suggestions.push({ tool: "godot_init_project", reason: "Initialize new project" });
                }
                if (taskLower.includes("menu") || taskLower.includes("ui") || taskLower.includes("hud") ||
                    taskLower.includes("dialog") || taskLower.includes("theme") || taskLower.includes("button")) {
                    suggestions.push({ tool: "godot_ui_create_theme", reason: "Create consistent UI styling" });
                    if (taskLower.includes("menu")) {
                        suggestions.push({ tool: "godot_ui_create_menu", reason: "Create menu scene with buttons" });
                    }
                    if (taskLower.includes("hud") || taskLower.includes("score") || taskLower.includes("health")) {
                        suggestions.push({ tool: "godot_ui_create_hud", reason: "Create game HUD" });
                    }
                    if (taskLower.includes("dialog") || taskLower.includes("popup") || taskLower.includes("confirm")) {
                        suggestions.push({ tool: "godot_ui_create_dialog", reason: "Create dialog/popup" });
                    }
                    if (taskLower.includes("layout") || taskLower.includes("sidebar") || taskLower.includes("responsive")) {
                        suggestions.push({ tool: "godot_ui_create_layout", reason: "Create responsive layout" });
                    }
                }
                if (taskLower.includes("doc") || taskLower.includes("api") || taskLower.includes("how to")) {
                    suggestions.push({ tool: "godot_search_docs", reason: "Search Godot docs" });
                    suggestions.push({ tool: "godot_get_class_docs", reason: "Get class documentation" });
                }
                if (suggestions.length > 0) {
                    return {
                        task,
                        suggestedTools: suggestions.slice(0, 5),
                        tip: "Call the suggested tool with appropriate parameters",
                    };
                }
                return {
                    task,
                    message: "No specific match found. Here's an overview:",
                    categories: Object.keys(TOOL_GUIDE.categories),
                    tip: "Try godot_help with category='all' for full guide, or be more specific about your task",
                };
            }
            // Return category-specific or full guide
            if (category && category !== "all") {
                if (category === "coverage") {
                    return COVERAGE_GUIDE;
                }
                if (category === "workflows") {
                    return {
                        category: "workflows",
                        workflows: TOOL_GUIDE.workflows,
                    };
                }
                const catInfo = TOOL_GUIDE.categories[category];
                if (catInfo) {
                    return {
                        category,
                        ...catInfo,
                    };
                }
            }
            // Return full overview
            return {
                overview: TOOL_GUIDE.overview,
                categories: Object.entries(TOOL_GUIDE.categories).map(([name, info]) => ({
                    name,
                    description: info.description,
                    toolCount: Object.keys(info.tools).length,
                })),
                workflows: Object.keys(TOOL_GUIDE.workflows),
                tips: TOOL_GUIDE.tips,
                usage: "Call godot_help with tool='<tool_name>' for a full usage template, category='<name>' for category details, or task='<description>' for suggestions",
            };
        },
    });
    // Get class documentation
    tools.set("godot_get_class_docs", {
        description: "Get documentation for a Godot built-in class including properties, methods, and signals.",
        inputSchema: z.object({
            className: z.string().describe("Name of the Godot class (e.g., 'CharacterBody2D', 'Sprite2D')"),
        }),
        handler: async (args) => {
            const { className } = args;
            const doc = GODOT_DOCS[className];
            if (!doc) {
                const availableClasses = Object.keys(GODOT_DOCS).sort();
                return {
                    error: `Class '${className}' not found in documentation`,
                    availableClasses,
                    hint: "Try one of the available classes listed above",
                };
            }
            return {
                className,
                ...doc,
            };
        },
    });
    // Search documentation
    tools.set("godot_search_docs", {
        description: "Search Godot documentation for classes, methods, or properties matching a query.",
        inputSchema: z.object({
            query: z.string().describe("Search query"),
            category: z
                .enum(["all", "2D", "3D", "UI", "Physics", "Audio", "Core", "Animation"])
                .optional()
                .describe("Filter by category"),
        }),
        handler: async (args) => {
            const { query, category } = args;
            const queryLower = query.toLowerCase();
            const results = [];
            for (const [className, doc] of Object.entries(GODOT_DOCS)) {
                // Filter by category if specified
                if (category && category !== "all" && !doc.category.includes(category)) {
                    continue;
                }
                // Search class name
                if (className.toLowerCase().includes(queryLower)) {
                    results.push({
                        className,
                        matchType: "class",
                        match: className,
                        description: doc.description,
                    });
                }
                // Search properties
                for (const prop of doc.properties) {
                    if (prop.name.toLowerCase().includes(queryLower)) {
                        results.push({
                            className,
                            matchType: "property",
                            match: `${className}.${prop.name}`,
                            description: prop.description,
                        });
                    }
                }
                // Search methods
                for (const method of doc.methods) {
                    if (method.name.toLowerCase().includes(queryLower)) {
                        results.push({
                            className,
                            matchType: "method",
                            match: `${className}.${method.name}()`,
                            description: method.description,
                        });
                    }
                }
                // Search signals
                for (const signal of doc.signals) {
                    if (signal.name.toLowerCase().includes(queryLower)) {
                        results.push({
                            className,
                            matchType: "signal",
                            match: `${className}.${signal.name}`,
                            description: signal.description,
                        });
                    }
                }
            }
            return {
                query,
                category: category || "all",
                resultCount: results.length,
                results: results.slice(0, 20), // Limit results
            };
        },
    });
    // List available classes
    tools.set("godot_list_documented_classes", {
        description: "List all Godot classes available in the documentation.",
        inputSchema: z.object({
            category: z
                .enum(["all", "2D", "3D", "UI", "Physics", "Audio", "Core", "Animation"])
                .optional()
                .describe("Filter by category"),
        }),
        handler: async (args) => {
            const { category } = args;
            const classes = [];
            for (const [name, doc] of Object.entries(GODOT_DOCS)) {
                if (category && category !== "all" && !doc.category.includes(category)) {
                    continue;
                }
                classes.push({
                    name,
                    category: doc.category,
                    inherits: doc.inherits,
                    description: doc.description,
                });
            }
            // Sort by category then name
            classes.sort((a, b) => {
                if (a.category !== b.category)
                    return a.category.localeCompare(b.category);
                return a.name.localeCompare(b.name);
            });
            return {
                category: category || "all",
                classCount: classes.length,
                classes,
            };
        },
    });
    // Initialize a new Godot project with AI bridge
    tools.set("godot_init_project", {
        description: "Initialize a new Godot project structure with recommended folders and the AI Bridge plugin pre-installed.",
        inputSchema: z.object({
            projectPath: z.string().describe("Path where the project should be created"),
            projectName: z.string().describe("Name of the project"),
            template: z
                .enum(["empty", "2d_platformer", "2d_topdown", "3d_fps", "ui_app"])
                .default("empty")
                .describe("Project template to use"),
            includeAiBridge: z
                .boolean()
                .default(true)
                .describe("Include the AI Bridge plugin"),
        }),
        handler: async (args) => {
            const { projectPath, projectName, template, includeAiBridge } = args;
            const fullPath = path.resolve(projectPath);
            const pluginFiles = includeAiBridge
                ? await loadAiBridgePluginFiles()
                : {};
            // Create directory structure
            const dirs = [
                "",
                "scenes",
                "scripts",
                "assets",
                "assets/sprites",
                "assets/audio",
                "assets/fonts",
                "shaders",
                "resources",
            ];
            if (includeAiBridge) {
                dirs.push("addons", "addons/godot_ai_bridge");
            }
            for (const dir of dirs) {
                await fs.mkdir(path.join(fullPath, dir), { recursive: true });
            }
            // Create project.godot
            const projectGodot = generateProjectGodot(projectName, template, includeAiBridge);
            await fs.writeFile(path.join(fullPath, "project.godot"), projectGodot);
            // Create .gitignore
            const gitignore = `# Godot
.godot/
*.import
export.cfg
export_presets.cfg

# Mono
.mono/
data_*/
mono_crash.*.json
`;
            await fs.writeFile(path.join(fullPath, ".gitignore"), gitignore);
            // Create template-specific files
            const templateFiles = await generateTemplateFiles(template, projectName);
            for (const [filePath, content] of Object.entries(templateFiles)) {
                const fullFilePath = path.join(fullPath, filePath);
                await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
                await fs.writeFile(fullFilePath, content);
            }
            // Copy AI Bridge plugin if requested
            if (includeAiBridge) {
                for (const [filePath, content] of Object.entries(pluginFiles)) {
                    await fs.writeFile(path.join(fullPath, filePath), content);
                }
            }
            return {
                success: true,
                projectPath: fullPath,
                projectName,
                template,
                createdDirectories: dirs,
                createdFiles: [
                    "project.godot",
                    ".gitignore",
                    ...Object.keys(templateFiles),
                    ...Object.keys(pluginFiles),
                ],
                nextSteps: [
                    `Open Godot and import the project from: ${fullPath}`,
                    includeAiBridge
                        ? "Enable the 'Godot AI Bridge' plugin in Project Settings > Plugins"
                        : "Consider installing the AI Bridge plugin for live editing",
                    "Start creating your game!",
                ],
            };
        },
    });
}
function generateProjectGodot(projectName, template, includeAiBridge) {
    const config = [];
    config.push("; Engine configuration file.");
    config.push("; Generated by godot-mcp");
    config.push("");
    config.push("config_version=5");
    config.push("");
    config.push("[application]");
    config.push("");
    config.push(`config/name="${projectName}"`);
    // Set main scene based on template
    if (template !== "empty") {
        config.push('run/main_scene="res://scenes/main.tscn"');
    }
    config.push('config/features=PackedStringArray("4.3", "Forward Plus")');
    config.push('config/icon="res://icon.svg"');
    config.push("");
    // Add input actions for game templates
    if (template === "2d_platformer" || template === "2d_topdown" || template === "3d_fps") {
        config.push("[input]");
        config.push("");
        config.push("move_left={");
        config.push('"deadzone": 0.5,');
        config.push('"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":65,"key_label":0,"unicode":97,"location":0,"echo":false,"script":null)]');
        config.push("}");
        config.push("move_right={");
        config.push('"deadzone": 0.5,');
        config.push('"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":68,"key_label":0,"unicode":100,"location":0,"echo":false,"script":null)]');
        config.push("}");
        if (template === "2d_topdown" || template === "3d_fps") {
            config.push("move_up={");
            config.push('"deadzone": 0.5,');
            config.push('"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":87,"key_label":0,"unicode":119,"location":0,"echo":false,"script":null)]');
            config.push("}");
            config.push("move_down={");
            config.push('"deadzone": 0.5,');
            config.push('"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":83,"key_label":0,"unicode":115,"location":0,"echo":false,"script":null)]');
            config.push("}");
        }
        if (template === "2d_platformer") {
            config.push("jump={");
            config.push('"deadzone": 0.5,');
            config.push('"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":32,"key_label":0,"unicode":32,"location":0,"echo":false,"script":null)]');
            config.push("}");
        }
        config.push("");
    }
    // Enable AI Bridge plugin
    if (includeAiBridge) {
        config.push("[editor_plugins]");
        config.push("");
        config.push('enabled=PackedStringArray("res://addons/godot_ai_bridge/plugin.cfg")');
        config.push("");
    }
    return config.join("\n");
}
async function generateTemplateFiles(template, projectName) {
    const files = {};
    // Default icon
    files["icon.svg"] = `<svg height="128" width="128" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="124" height="124" rx="14" fill="#363d52" stroke="#212532" stroke-width="4"/><g transform="scale(.101) translate(122 122)"><g fill="#fff"><path d="M105 673v33q407 354 814 0v-33z"/><path fill="#478cbf" d="m105 673 152 14q12 1 15 14l4 67 132 10 8-61q2-11 15-15h162q13 4 15 15l8 61 132-10 4-67q3-13 15-14l152-14V427q30-39 56-81-35-59-83-108-43 20-82 47-40-37-88-64 7-51 8-102-59-28-123-42-26 43-46 89-49-7-98 0-20-46-46-89-64 14-123 42 1 51 8 102-48 27-88 64-39-27-82-47-48 49-83 108 26 42 56 81zm0 33v39c0 276 813 276 814 0v-39l-134 12-5 69q-2 10-14 13l-162 11q-12 0-16-11l-10-65H447l-10 65q-4 11-16 11l-162-11q-12-3-14-13l-5-69z"/><path d="M483 600c3 34 55 34 58 0v-86c-3-34-55-34-58 0z"/><circle cx="725" cy="526" r="90"/><circle cx="299" cy="526" r="90"/></g><g fill="#414042"><circle cx="307" cy="532" r="60"/><circle cx="717" cy="532" r="60"/></g></g></svg>`;
    if (template === "empty") {
        return files;
    }
    // Main scene for all templates
    if (template === "2d_platformer") {
        files["scenes/main.tscn"] = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/player.gd" id="1_player"]

[node name="Main" type="Node2D"]

[node name="Player" type="CharacterBody2D" parent="."]
position = Vector2(100, 300)
script = ExtResource("1_player")

[node name="Sprite2D" type="Sprite2D" parent="Player"]
scale = Vector2(0.5, 0.5)

[node name="CollisionShape2D" type="CollisionShape2D" parent="Player"]

[node name="Camera2D" type="Camera2D" parent="Player"]
`;
        files["scripts/player.gd"] = `extends CharacterBody2D
## 2D Platformer Player Controller

@export var speed: float = 300.0
@export var jump_force: float = 400.0

var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")

func _physics_process(delta: float) -> void:
\t# Add gravity
\tif not is_on_floor():
\t\tvelocity.y += gravity * delta

\t# Handle jump
\tif Input.is_action_just_pressed("jump") and is_on_floor():
\t\tvelocity.y = -jump_force

\t# Get horizontal movement
\tvar direction := Input.get_axis("move_left", "move_right")
\tif direction:
\t\tvelocity.x = direction * speed
\telse:
\t\tvelocity.x = move_toward(velocity.x, 0, speed)

\tmove_and_slide()
`;
    }
    else if (template === "2d_topdown") {
        files["scenes/main.tscn"] = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/player.gd" id="1_player"]

[node name="Main" type="Node2D"]

[node name="Player" type="CharacterBody2D" parent="."]
position = Vector2(512, 300)
script = ExtResource("1_player")

[node name="Sprite2D" type="Sprite2D" parent="Player"]
scale = Vector2(0.5, 0.5)

[node name="CollisionShape2D" type="CollisionShape2D" parent="Player"]

[node name="Camera2D" type="Camera2D" parent="Player"]
`;
        files["scripts/player.gd"] = `extends CharacterBody2D
## 2D Top-Down Player Controller

@export var speed: float = 200.0

func _physics_process(_delta: float) -> void:
\tvar direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
\tvelocity = direction * speed
\tmove_and_slide()
`;
    }
    else if (template === "3d_fps") {
        files["scenes/main.tscn"] = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/player.gd" id="1_player"]

[node name="Main" type="Node3D"]

[node name="Player" type="CharacterBody3D" parent="."]
script = ExtResource("1_player")

[node name="CollisionShape3D" type="CollisionShape3D" parent="Player"]

[node name="Camera3D" type="Camera3D" parent="Player"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.6, 0)

[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.707107, 0.707107, 0, -0.707107, 0.707107, 0, 10, 0)

[node name="CSGBox3D" type="CSGBox3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.5, 0)
use_collision = true
size = Vector3(20, 1, 20)
`;
        files["scripts/player.gd"] = `extends CharacterBody3D
## 3D FPS Player Controller

@export var speed: float = 5.0
@export var mouse_sensitivity: float = 0.002

var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")

@onready var camera: Camera3D = $Camera3D

func _ready() -> void:
\tInput.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _input(event: InputEvent) -> void:
\tif event is InputEventMouseMotion:
\t\trotate_y(-event.relative.x * mouse_sensitivity)
\t\tcamera.rotate_x(-event.relative.y * mouse_sensitivity)
\t\tcamera.rotation.x = clamp(camera.rotation.x, -PI/2, PI/2)
\t
\tif event.is_action_pressed("ui_cancel"):
\t\tInput.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _physics_process(delta: float) -> void:
\tif not is_on_floor():
\t\tvelocity.y -= gravity * delta

\tvar input_dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
\tvar direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
\t
\tif direction:
\t\tvelocity.x = direction.x * speed
\t\tvelocity.z = direction.z * speed
\telse:
\t\tvelocity.x = move_toward(velocity.x, 0, speed)
\t\tvelocity.z = move_toward(velocity.z, 0, speed)

\tmove_and_slide()
`;
    }
    else if (template === "ui_app") {
        files["scenes/main.tscn"] = `[gd_scene load_steps=1 format=3]

[node name="Main" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="VBoxContainer" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
offset_left = 20.0
offset_top = 20.0
offset_right = -20.0
offset_bottom = -20.0

[node name="TitleLabel" type="Label" parent="VBoxContainer"]
layout_mode = 2
text = "${projectName}"
horizontal_alignment = 1

[node name="HSeparator" type="HSeparator" parent="VBoxContainer"]
layout_mode = 2

[node name="ContentLabel" type="Label" parent="VBoxContainer"]
layout_mode = 2
size_flags_vertical = 3
text = "Welcome to your new app!"
horizontal_alignment = 1
vertical_alignment = 1

[node name="Button" type="Button" parent="VBoxContainer"]
layout_mode = 2
text = "Click Me"
`;
    }
    return files;
}
const AI_BRIDGE_FILENAMES = [
    "plugin.cfg",
    "godot_ai_bridge.gd",
    "runtime_bridge.gd",
    "ws_server.gd",
    "message_handler.gd",
];
/** Load the canonical bridge shipped beside dist/ in source and npm installs. */
export async function loadAiBridgePluginFiles() {
    const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
    const bridgeDirectory = path.resolve(moduleDirectory, "../../addons/godot_ai_bridge");
    const entries = await Promise.all(AI_BRIDGE_FILENAMES.map(async (filename) => {
        const content = await fs.readFile(path.join(bridgeDirectory, filename), "utf-8");
        return [`addons/godot_ai_bridge/${filename}`, content];
    }));
    return Object.fromEntries(entries);
}
//# sourceMappingURL=docs-tools.js.map
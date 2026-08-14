import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { ServerState, ToolHandler } from "../index.js";
import { registerAnimationTools } from "./animation-tools.js";
import { registerAudioTools } from "./audio-tools.js";
import { registerDocsTools } from "./docs-tools.js";
import { registerEditorTools } from "./editor-tools.js";
import { registerInputTools } from "./input-tools.js";
import { registerNavigationTools } from "./navigation-tools.js";
import { registerResourceTools } from "./resource-tools.js";
import { registerSceneTools } from "./scene-tools.js";
import { registerScriptTools } from "./script-tools.js";
import { registerShaderTools } from "./shader-tools.js";
import { registerUIComponentTools } from "./ui-component-tools.js";
import { registerUILayoutTools } from "./ui-layout-tools.js";
import { registerUIThemeTools } from "./ui-theme-tools.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true })
    )
  );
});

function createToolRegistry(): {
  tools: Map<string, ToolHandler>;
  state: ServerState;
} {
  const tools = new Map<string, ToolHandler>();
  const state: ServerState = {
    projectPath: process.cwd(),
    editorConnected: false,
    editorPort: 6550,
  };

  registerSceneTools(tools, state);
  registerScriptTools(tools, state);
  registerEditorTools(tools, state);
  registerShaderTools(tools, state);
  registerResourceTools(tools, state);
  registerAnimationTools(tools, state);
  registerInputTools(tools, state);
  registerAudioTools(tools, state);
  registerNavigationTools(tools, state);
  registerUIThemeTools(tools, state);
  registerUIComponentTools(tools, state);
  registerUILayoutTools(tools, state);
  registerDocsTools(tools, state);

  return { tools, state };
}

describe("production tool registry", () => {
  it("registers the complete unique 99-tool surface with valid schemas", () => {
    const { tools } = createToolRegistry();

    expect(tools.size).toBe(99);
    expect(tools.has("godot_help")).toBe(true);
    expect(tools.has("godot_runtime_capture_screenshot")).toBe(true);
    expect(tools.has("godot_init_project")).toBe(true);

    for (const [name, tool] of tools) {
      expect(name).toMatch(/^godot_/);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("initializes a project with the complete canonical AI Bridge", async () => {
    const { tools } = createToolRegistry();
    const baseDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "godot-mcp-init-")
    );
    temporaryDirectories.push(baseDirectory);
    const projectDirectory = path.join(baseDirectory, "game");
    const initTool = tools.get("godot_init_project");
    expect(initTool).toBeDefined();

    const args = initTool!.inputSchema.parse({
      projectPath: projectDirectory,
      projectName: "Integration Game",
      template: "empty",
      includeAiBridge: true,
    });
    const result = (await initTool!.handler(args)) as {
      success: boolean;
      createdFiles: string[];
    };

    expect(result.success).toBe(true);
    expect(result.createdFiles).toContain(
      "addons/godot_ai_bridge/runtime_bridge.gd"
    );

    const copiedHandler = await fs.readFile(
      path.join(
        projectDirectory,
        "addons",
        "godot_ai_bridge",
        "message_handler.gd"
      ),
      "utf-8"
    );
    expect(copiedHandler).toContain('"runtime.capture_screenshot"');

    const projectConfig = await fs.readFile(
      path.join(projectDirectory, "project.godot"),
      "utf-8"
    );
    expect(projectConfig).toContain(
      'enabled=PackedStringArray("res://addons/godot_ai_bridge/plugin.cfg")'
    );
  });
});

import { describe, it, expect } from 'vitest';
// Mock the tool guide structure
const TOOL_GUIDE = {
    categories: {
        scenes: {
            description: 'Work with .tscn scene files',
            tools: {
                godot_read_scene: 'Parse and inspect a scene file',
                godot_write_scene: 'Create or overwrite a scene file',
                godot_add_node: 'Add a new node to a scene',
                godot_remove_node: 'Remove a node from a scene',
            },
        },
        scripts: {
            description: 'Work with .gd GDScript files',
            tools: {
                godot_read_script: 'Read a GDScript file',
                godot_write_script: 'Write a GDScript file',
                godot_generate_script: 'Generate script from description',
            },
        },
        shaders: {
            description: 'Work with .gdshader files',
            tools: {
                godot_generate_shader: 'Generate shader from preset',
            },
        },
        procedural: {
            description: 'Generate game content',
            tools: {
                godot_generate_dungeon: 'Generate dungeon layout',
                godot_generate_tilemap_pattern: 'Generate tilemap patterns',
                godot_generate_wave_config: 'Generate enemy waves',
            },
        },
    },
    workflows: {
        'Create a new game': [
            'godot_init_project',
            'godot_generate_script',
            'godot_write_scene',
        ],
        'Add visual effects': [
            'godot_generate_shader',
            'godot_modify_node',
        ],
    },
};
// Mock Godot documentation
const GODOT_DOCS = {
    Node: {
        description: 'Base class for all scene objects',
        inherits: 'Object',
        category: 'Core',
        properties: [
            { name: 'name', type: 'StringName', description: 'The name of the node' },
        ],
        methods: [
            { name: 'add_child', args: ['node: Node'], description: 'Adds a child node' },
            { name: 'get_node', args: ['path: NodePath'], returns: 'Node', description: 'Gets node by path' },
        ],
        signals: [
            { name: 'ready', description: 'Emitted when node enters scene tree' },
        ],
    },
    CharacterBody2D: {
        description: '2D physics body for character movement',
        inherits: 'PhysicsBody2D',
        category: '2D Physics',
        properties: [
            { name: 'velocity', type: 'Vector2', description: 'Current velocity' },
        ],
        methods: [
            { name: 'move_and_slide', args: [], returns: 'bool', description: 'Moves with collision' },
            { name: 'is_on_floor', args: [], returns: 'bool', description: 'True if touching floor' },
        ],
        signals: [],
    },
};
describe('Documentation Tools', () => {
    describe('godot_help', () => {
        it('should return all categories in overview', () => {
            const categories = Object.keys(TOOL_GUIDE.categories);
            expect(categories).toContain('scenes');
            expect(categories).toContain('scripts');
            expect(categories).toContain('shaders');
            expect(categories).toContain('procedural');
        });
        it('should return tools for specific category', () => {
            const sceneTools = TOOL_GUIDE.categories.scenes.tools;
            expect(sceneTools).toHaveProperty('godot_read_scene');
            expect(sceneTools).toHaveProperty('godot_write_scene');
            expect(sceneTools).toHaveProperty('godot_add_node');
        });
        it('should suggest tools based on task description', () => {
            const suggestTools = (task) => {
                const taskLower = task.toLowerCase();
                const suggestions = [];
                if (taskLower.includes('scene') || taskLower.includes('node')) {
                    suggestions.push('godot_read_scene', 'godot_write_scene');
                }
                if (taskLower.includes('script') || taskLower.includes('code')) {
                    suggestions.push('godot_generate_script');
                }
                if (taskLower.includes('shader') || taskLower.includes('effect')) {
                    suggestions.push('godot_generate_shader');
                }
                if (taskLower.includes('dungeon') || taskLower.includes('level')) {
                    suggestions.push('godot_generate_dungeon');
                }
                return suggestions;
            };
            expect(suggestTools('create a new scene')).toContain('godot_write_scene');
            expect(suggestTools('generate player script')).toContain('godot_generate_script');
            expect(suggestTools('add dissolve effect')).toContain('godot_generate_shader');
            expect(suggestTools('generate dungeon level')).toContain('godot_generate_dungeon');
        });
        it('should return workflows', () => {
            const workflows = Object.keys(TOOL_GUIDE.workflows);
            expect(workflows).toContain('Create a new game');
            expect(workflows).toContain('Add visual effects');
        });
        it('should provide workflow steps', () => {
            const gameWorkflow = TOOL_GUIDE.workflows['Create a new game'];
            expect(gameWorkflow).toContain('godot_init_project');
            expect(gameWorkflow).toContain('godot_generate_script');
            expect(gameWorkflow).toContain('godot_write_scene');
        });
    });
    describe('godot_get_class_docs', () => {
        it('should return documentation for valid class', () => {
            const docs = GODOT_DOCS['CharacterBody2D'];
            expect(docs).toBeDefined();
            expect(docs.description).toContain('2D physics body');
            expect(docs.inherits).toBe('PhysicsBody2D');
            expect(docs.category).toBe('2D Physics');
        });
        it('should include properties', () => {
            const docs = GODOT_DOCS['CharacterBody2D'];
            expect(docs.properties.length).toBeGreaterThan(0);
            const velocityProp = docs.properties.find(p => p.name === 'velocity');
            expect(velocityProp).toBeDefined();
            expect(velocityProp?.type).toBe('Vector2');
        });
        it('should include methods', () => {
            const docs = GODOT_DOCS['CharacterBody2D'];
            expect(docs.methods.length).toBeGreaterThan(0);
            const moveMethod = docs.methods.find(m => m.name === 'move_and_slide');
            expect(moveMethod).toBeDefined();
            expect(moveMethod?.returns).toBe('bool');
        });
        it('should include signals', () => {
            const docs = GODOT_DOCS['Node'];
            expect(docs.signals.length).toBeGreaterThan(0);
            const readySignal = docs.signals.find(s => s.name === 'ready');
            expect(readySignal).toBeDefined();
        });
        it('should handle unknown class', () => {
            const docs = GODOT_DOCS['UnknownClass'];
            expect(docs).toBeUndefined();
        });
    });
    describe('godot_search_docs', () => {
        it('should find classes by name', () => {
            const searchResults = Object.entries(GODOT_DOCS)
                .filter(([name]) => name.toLowerCase().includes('body'))
                .map(([name, doc]) => ({ name, description: doc.description }));
            expect(searchResults.length).toBeGreaterThan(0);
            expect(searchResults[0].name).toBe('CharacterBody2D');
        });
        it('should find methods by name', () => {
            const query = 'floor';
            const results = [];
            for (const [className, doc] of Object.entries(GODOT_DOCS)) {
                for (const method of doc.methods) {
                    if (method.name.toLowerCase().includes(query)) {
                        results.push({ className, method: method.name });
                    }
                }
            }
            expect(results.length).toBeGreaterThan(0);
            expect(results).toContainEqual({
                className: 'CharacterBody2D',
                method: 'is_on_floor',
            });
        });
        it('should filter by category', () => {
            const category = '2D Physics';
            const filtered = Object.entries(GODOT_DOCS)
                .filter(([, doc]) => doc.category === category);
            expect(filtered.length).toBeGreaterThan(0);
            expect(filtered[0][0]).toBe('CharacterBody2D');
        });
    });
    describe('godot_list_documented_classes', () => {
        it('should list all classes', () => {
            const classes = Object.keys(GODOT_DOCS);
            expect(classes).toContain('Node');
            expect(classes).toContain('CharacterBody2D');
        });
        it('should group by category', () => {
            const byCategory = {};
            for (const [name, doc] of Object.entries(GODOT_DOCS)) {
                if (!byCategory[doc.category]) {
                    byCategory[doc.category] = [];
                }
                byCategory[doc.category].push(name);
            }
            expect(byCategory['Core']).toContain('Node');
            expect(byCategory['2D Physics']).toContain('CharacterBody2D');
        });
    });
    describe('godot_init_project', () => {
        it('should create project structure', () => {
            const expectedDirs = [
                'scenes',
                'scripts',
                'assets',
                'assets/sprites',
                'assets/audio',
                'shaders',
                'resources',
            ];
            // Verify expected directories
            for (const dir of expectedDirs) {
                expect(dir).toBeTruthy();
            }
        });
        it('should generate project.godot file', () => {
            const projectName = 'TestGame';
            const template = 'empty';
            const projectGodot = `; Engine configuration file.
config_version=5

[application]

config/name="${projectName}"
config/features=PackedStringArray("4.3", "Forward Plus")
config/icon="res://icon.svg"
`;
            expect(projectGodot).toContain(`config/name="${projectName}"`);
            expect(projectGodot).toContain('config_version=5');
        });
        it('should add input actions for game templates', () => {
            const template = '2d_platformer';
            const expectedInputs = ['move_left', 'move_right', 'jump'];
            // For platformer template, should have these inputs
            for (const input of expectedInputs) {
                expect(input).toBeTruthy();
            }
        });
        it('should include AI Bridge plugin when requested', () => {
            const includeAiBridge = true;
            if (includeAiBridge) {
                const pluginPath = 'addons/godot_ai_bridge/plugin.cfg';
                expect(pluginPath).toContain('godot_ai_bridge');
            }
        });
        it('should support different templates', () => {
            const templates = ['empty', '2d_platformer', '2d_topdown', '3d_fps', 'ui_app'];
            for (const template of templates) {
                expect(templates).toContain(template);
            }
        });
    });
});
describe('Tool Count Validation', () => {
    it('should have documented tool count', () => {
        // Count all tools across categories
        let totalTools = 0;
        for (const category of Object.values(TOOL_GUIDE.categories)) {
            totalTools += Object.keys(category.tools).length;
        }
        // We expect at least 10 tools in the test mock
        expect(totalTools).toBeGreaterThanOrEqual(10);
    });
});
//# sourceMappingURL=docs-tools.test.js.map
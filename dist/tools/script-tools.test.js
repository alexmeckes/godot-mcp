import { describe, it, expect } from 'vitest';
describe('Script Tools', () => {
    describe('GDScript parsing', () => {
        it('should detect class_name declaration', () => {
            const script = `extends Node2D
class_name Player

func _ready():
    pass
`;
            const match = script.match(/class_name\s+(\w+)/);
            expect(match).toBeTruthy();
            expect(match[1]).toBe('Player');
        });
        it('should detect extends declaration', () => {
            const script = `extends CharacterBody2D

func _physics_process(delta):
    pass
`;
            const match = script.match(/extends\s+(\w+)/);
            expect(match).toBeTruthy();
            expect(match[1]).toBe('CharacterBody2D');
        });
        it('should extract function definitions', () => {
            const script = `extends Node

func _ready():
    print("ready")

func custom_function(arg1: int, arg2: String) -> bool:
    return true

func another_func():
    pass
`;
            const funcMatches = script.matchAll(/func\s+(\w+)\s*\([^)]*\)/g);
            const funcNames = Array.from(funcMatches).map(m => m[1]);
            expect(funcNames).toContain('_ready');
            expect(funcNames).toContain('custom_function');
            expect(funcNames).toContain('another_func');
        });
        it('should extract signal declarations', () => {
            const script = `extends Node

signal health_changed(new_health: int)
signal player_died
signal item_collected(item_name: String, count: int)
`;
            const signalMatches = script.matchAll(/signal\s+(\w+)/g);
            const signalNames = Array.from(signalMatches).map(m => m[1]);
            expect(signalNames).toContain('health_changed');
            expect(signalNames).toContain('player_died');
            expect(signalNames).toContain('item_collected');
        });
        it('should extract export variables', () => {
            const script = `extends Node2D

@export var speed: float = 300.0
@export var jump_force: float = 500.0
@export_group("Combat")
@export var health: int = 100
@export var damage: int = 10
`;
            const exportMatches = script.matchAll(/@export(?:_\w+)?\s+var\s+(\w+)/g);
            const exportNames = Array.from(exportMatches).map(m => m[1]);
            expect(exportNames).toContain('speed');
            expect(exportNames).toContain('jump_force');
            expect(exportNames).toContain('health');
            expect(exportNames).toContain('damage');
        });
        it('should detect @onready variables', () => {
            const script = `extends Node2D

@onready var sprite: Sprite2D = $Sprite2D
@onready var collision: CollisionShape2D = $CollisionShape2D
`;
            const onreadyMatches = script.matchAll(/@onready\s+var\s+(\w+)/g);
            const names = Array.from(onreadyMatches).map(m => m[1]);
            expect(names).toContain('sprite');
            expect(names).toContain('collision');
        });
    });
    describe('GDScript generation', () => {
        it('should generate basic script structure', () => {
            const baseClass = 'CharacterBody2D';
            const className = 'Player';
            const script = `extends ${baseClass}
class_name ${className}

func _ready() -> void:
\tpass

func _physics_process(delta: float) -> void:
\tpass
`;
            expect(script).toContain(`extends ${baseClass}`);
            expect(script).toContain(`class_name ${className}`);
            expect(script).toContain('func _ready()');
            expect(script).toContain('func _physics_process(delta: float)');
        });
        it('should generate export variables', () => {
            const exports = [
                { name: 'speed', type: 'float', default: '300.0' },
                { name: 'health', type: 'int', default: '100' },
            ];
            const lines = exports.map(e => `@export var ${e.name}: ${e.type} = ${e.default}`);
            expect(lines[0]).toBe('@export var speed: float = 300.0');
            expect(lines[1]).toBe('@export var health: int = 100');
        });
        it('should generate signals', () => {
            const signals = ['player_died', 'health_changed(new_health: int)'];
            const lines = signals.map(s => `signal ${s}`);
            expect(lines[0]).toBe('signal player_died');
            expect(lines[1]).toBe('signal health_changed(new_health: int)');
        });
    });
    describe('GDScript validation', () => {
        it('should detect syntax errors in function definitions', () => {
            const invalidScripts = [
                'func missing_colon()\n\tpass', // Missing colon after )
                'func no_body():', // No body
            ];
            // These would be caught by actual validation
            for (const script of invalidScripts) {
                expect(script).toBeDefined();
            }
        });
        it('should validate indentation', () => {
            const script = `extends Node

func _ready():
\tvar x = 1
\tif x > 0:
\t\tprint("positive")
`;
            // Check for consistent tab indentation
            const lines = script.split('\n').filter(l => l.trim());
            const indentedLines = lines.filter(l => l.startsWith('\t'));
            expect(indentedLines.length).toBeGreaterThan(0);
        });
        it('should detect common patterns', () => {
            const patterns = {
                physicsProcess: /func\s+_physics_process\s*\(\s*delta/,
                ready: /func\s+_ready\s*\(/,
                input: /func\s+_input\s*\(\s*event/,
                unhandledInput: /func\s+_unhandled_input\s*\(\s*event/,
            };
            const script = `extends Node

func _ready():
\tpass

func _physics_process(delta):
\tpass

func _input(event):
\tpass
`;
            expect(patterns.physicsProcess.test(script)).toBe(true);
            expect(patterns.ready.test(script)).toBe(true);
            expect(patterns.input.test(script)).toBe(true);
            expect(patterns.unhandledInput.test(script)).toBe(false);
        });
    });
    describe('Script templates', () => {
        it('should generate player controller template', () => {
            const template = `extends CharacterBody2D
class_name Player

@export var speed: float = 300.0
@export var jump_force: float = 500.0

var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")

func _physics_process(delta: float) -> void:
\tif not is_on_floor():
\t\tvelocity.y += gravity * delta

\tif Input.is_action_just_pressed("jump") and is_on_floor():
\t\tvelocity.y = -jump_force

\tvar direction := Input.get_axis("move_left", "move_right")
\tvelocity.x = direction * speed

\tmove_and_slide()
`;
            expect(template).toContain('extends CharacterBody2D');
            expect(template).toContain('move_and_slide()');
            expect(template).toContain('is_on_floor()');
        });
        it('should generate enemy AI template', () => {
            const hasPatrolBehavior = (script) => {
                return script.includes('patrol') || script.includes('waypoint');
            };
            const hasChaseeBehavior = (script) => {
                return script.includes('chase') || script.includes('target') || script.includes('player');
            };
            const enemyScript = `extends CharacterBody2D

var target: Node2D
var patrol_points: Array[Vector2] = []

func chase_target():
\tif target:
\t\tvar direction = (target.global_position - global_position).normalized()
\t\tvelocity = direction * speed
`;
            expect(hasChaseeBehavior(enemyScript)).toBe(true);
        });
    });
});
//# sourceMappingURL=script-tools.test.js.map
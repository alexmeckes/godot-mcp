import { describe, it, expect } from 'vitest';
import { TscnParser, ParsedScene, SceneNode } from './tscn-parser.js';

describe('TscnParser', () => {
  describe('parse', () => {
    it('should parse a simple scene header', () => {
      const content = `[gd_scene load_steps=2 format=3 uid="uid://test123"]

[node name="Main" type="Node2D"]
`;
      const result = TscnParser.parse(content);

      expect(result.header.type).toBe('gd_scene');
      expect(result.header.loadSteps).toBe(2);
      expect(result.header.format).toBe(3);
      expect(result.header.uid).toBe('uid://test123');
    });

    it('should parse external resources', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/player.gd" id="1_script"]
[ext_resource type="Texture2D" path="res://sprites/icon.png" uid="uid://abc123" id="2_texture"]

[node name="Main" type="Node2D"]
`;
      const result = TscnParser.parse(content);

      expect(result.externalResources).toHaveLength(2);
      expect(result.externalResources[0]).toEqual({
        type: 'Script',
        path: 'res://scripts/player.gd',
        id: '1_script',
        uid: undefined,
      });
      expect(result.externalResources[1]).toEqual({
        type: 'Texture2D',
        path: 'res://sprites/icon.png',
        id: '2_texture',
        uid: 'uid://abc123',
      });
    });

    it('should parse sub-resources with properties', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_1"]
size = Vector2(32, 48)

[node name="Main" type="Node2D"]
`;
      const result = TscnParser.parse(content);

      expect(result.subResources).toHaveLength(1);
      expect(result.subResources[0].type).toBe('RectangleShape2D');
      expect(result.subResources[0].id).toBe('RectangleShape2D_1');
      expect(result.subResources[0].properties.size).toEqual({
        _type: 'Vector2',
        x: 32,
        y: 48,
      });
    });

    it('should parse nodes with various properties', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="CharacterBody2D"]
position = Vector2(100, 200)
rotation = 1.5708
scale = Vector2(2, 2)
visible = true

[node name="Sprite" type="Sprite2D" parent="."]
texture = ExtResource("1_texture")
`;
      const result = TscnParser.parse(content);

      expect(result.nodes).toHaveLength(2);

      const player = result.nodes[0];
      expect(player.name).toBe('Player');
      expect(player.type).toBe('CharacterBody2D');
      expect(player.properties.position).toEqual({ _type: 'Vector2', x: 100, y: 200 });
      expect(player.properties.rotation).toBe(1.5708);
      expect(player.properties.visible).toBe(true);

      const sprite = result.nodes[1];
      expect(sprite.name).toBe('Sprite');
      expect(sprite.parent).toBe('.');
      expect(sprite.properties.texture).toEqual({ _type: 'ExtResource', id: '1_texture' });
    });

    it('should parse signal connections', () => {
      const content = `[gd_scene format=3]

[node name="Main" type="Node2D"]

[node name="Button" type="Button" parent="."]

[connection signal="pressed" from="Button" to="." method="_on_button_pressed"]
[connection signal="mouse_entered" from="Button" to="." method="_on_mouse_entered" flags=3]
`;
      const result = TscnParser.parse(content);

      expect(result.connections).toHaveLength(2);
      expect(result.connections[0]).toEqual({
        signal: 'pressed',
        from: 'Button',
        to: '.',
        method: '_on_button_pressed',
        flags: undefined,
        binds: undefined,
      });
      expect(result.connections[1].flags).toBe(3);
    });

    it('should parse nodes with groups', () => {
      const content = `[gd_scene format=3]

[node name="Enemy" type="CharacterBody2D" groups=["enemies", "damageable"]]
`;
      const result = TscnParser.parse(content);

      expect(result.nodes[0].groups).toEqual(['enemies', 'damageable']);
    });

    it('should parse Color values', () => {
      const content = `[gd_scene format=3]

[node name="ColorRect" type="ColorRect"]
color = Color(0.2, 0.6, 1, 0.8)
`;
      const result = TscnParser.parse(content);

      expect(result.nodes[0].properties.color).toEqual({
        _type: 'Color',
        r: 0.2,
        g: 0.6,
        b: 1,
        a: 0.8,
      });
    });

    it('should parse Vector3 values', () => {
      const content = `[gd_scene format=3]

[node name="Mesh" type="MeshInstance3D"]
position = Vector3(1, 2, 3)
`;
      const result = TscnParser.parse(content);

      expect(result.nodes[0].properties.position).toEqual({
        _type: 'Vector3',
        x: 1,
        y: 2,
        z: 3,
      });
    });

    it('should parse arrays', () => {
      const content = `[gd_scene format=3]

[node name="Test" type="Node"]
values = [1, 2, 3, 4, 5]
strings = ["a", "b", "c"]
`;
      const result = TscnParser.parse(content);

      expect(result.nodes[0].properties.values).toEqual([1, 2, 3, 4, 5]);
      expect(result.nodes[0].properties.strings).toEqual(['a', 'b', 'c']);
    });

    it('should parse NodePath values', () => {
      const content = `[gd_scene format=3]

[node name="Test" type="Node"]
target = NodePath("../Player")
`;
      const result = TscnParser.parse(content);

      expect(result.nodes[0].properties.target).toEqual({
        _type: 'NodePath',
        path: '../Player',
      });
    });
  });

  describe('serialize', () => {
    it('should serialize a simple scene', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [
          { name: 'Main', type: 'Node2D', properties: {} },
        ],
        connections: [],
      };

      const result = TscnParser.serialize(scene);

      expect(result).toContain('[gd_scene format=3]');
      expect(result).toContain('[node name="Main" type="Node2D"]');
    });

    it('should serialize external resources', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3, loadSteps: 2 },
        externalResources: [
          { type: 'Script', path: 'res://player.gd', id: '1_script' },
        ],
        subResources: [],
        nodes: [{ name: 'Main', type: 'Node2D', properties: {} }],
        connections: [],
      };

      const result = TscnParser.serialize(scene);

      expect(result).toContain('[ext_resource type="Script" path="res://player.gd" id="1_script"]');
    });

    it('should serialize nodes with properties', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [
          {
            name: 'Player',
            type: 'CharacterBody2D',
            properties: {
              position: { _type: 'Vector2', x: 100, y: 200 },
              visible: true,
            },
          },
        ],
        connections: [],
      };

      const result = TscnParser.serialize(scene);

      expect(result).toContain('position = Vector2(100, 200)');
      expect(result).toContain('visible = true');
    });

    it('should serialize connections', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [{ name: 'Main', type: 'Node2D', properties: {} }],
        connections: [
          { signal: 'pressed', from: 'Button', to: '.', method: '_on_pressed' },
        ],
      };

      const result = TscnParser.serialize(scene);

      expect(result).toContain('[connection signal="pressed" from="Button" to="." method="_on_pressed"]');
    });

    it('should serialize Color values', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [
          {
            name: 'ColorRect',
            type: 'ColorRect',
            properties: {
              color: { _type: 'Color', r: 0.5, g: 0.5, b: 0.5, a: 1 },
            },
          },
        ],
        connections: [],
      };

      const result = TscnParser.serialize(scene);

      expect(result).toContain('color = Color(0.5, 0.5, 0.5, 1)');
    });
  });

  describe('round-trip', () => {
    it('should parse and re-serialize without data loss', () => {
      const original = `[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://player.gd" id="1_script"]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_1"]
size = Vector2(32, 48)

[node name="Player" type="CharacterBody2D"]
position = Vector2(100, 200)
script = ExtResource("1_script")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
shape = SubResource("RectangleShape2D_1")

[connection signal="body_entered" from="." to="." method="_on_body_entered"]
`;
      const parsed = TscnParser.parse(original);
      const serialized = TscnParser.serialize(parsed);
      const reparsed = TscnParser.parse(serialized);

      expect(reparsed.header.format).toBe(parsed.header.format);
      expect(reparsed.externalResources).toHaveLength(parsed.externalResources.length);
      expect(reparsed.subResources).toHaveLength(parsed.subResources.length);
      expect(reparsed.nodes).toHaveLength(parsed.nodes.length);
      expect(reparsed.connections).toHaveLength(parsed.connections.length);
    });
  });

  describe('addNode', () => {
    it('should add a node to the scene', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [{ name: 'Main', type: 'Node2D', properties: {} }],
        connections: [],
      };

      TscnParser.addNode(scene, {
        name: 'Player',
        type: 'CharacterBody2D',
        parent: '.',
      });

      expect(scene.nodes).toHaveLength(2);
      expect(scene.nodes[1].name).toBe('Player');
      expect(scene.nodes[1].parent).toBe('.');
    });

    it('should add a node with properties', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [{ name: 'Main', type: 'Node2D', properties: {} }],
        connections: [],
      };

      TscnParser.addNode(scene, {
        name: 'Sprite',
        type: 'Sprite2D',
        parent: '.',
        properties: {
          position: { _type: 'Vector2', x: 50, y: 50 },
        },
      });

      expect(scene.nodes[1].properties.position).toEqual({
        _type: 'Vector2',
        x: 50,
        y: 50,
      });
    });
  });

  describe('removeNode', () => {
    it('should remove a node and its children', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [
          { name: 'Main', type: 'Node2D', properties: {} },
          { name: 'Player', type: 'CharacterBody2D', parent: '.', properties: {} },
          { name: 'Sprite', type: 'Sprite2D', parent: 'Player', properties: {} },
          { name: 'Enemy', type: 'CharacterBody2D', parent: '.', properties: {} },
        ],
        connections: [],
      };

      TscnParser.removeNode(scene, 'Player');

      expect(scene.nodes).toHaveLength(2);
      expect(scene.nodes.map(n => n.name)).toEqual(['Main', 'Enemy']);
    });

    it('should remove connections involving removed nodes', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [
          { name: 'Main', type: 'Node2D', properties: {} },
          { name: 'Button', type: 'Button', parent: '.', properties: {} },
        ],
        connections: [
          { signal: 'pressed', from: 'Button', to: '.', method: '_on_pressed' },
        ],
      };

      TscnParser.removeNode(scene, 'Button');

      expect(scene.connections).toHaveLength(0);
    });
  });

  describe('modifyNode', () => {
    it('should modify node properties', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [
          {
            name: 'Player',
            type: 'CharacterBody2D',
            properties: {
              position: { _type: 'Vector2', x: 0, y: 0 },
            },
          },
        ],
        connections: [],
      };

      const result = TscnParser.modifyNode(scene, 'Player', {
        properties: {
          position: { _type: 'Vector2', x: 100, y: 200 },
          speed: 300,
        },
      });

      expect(result).toBe(true);
      expect(scene.nodes[0].properties.position).toEqual({
        _type: 'Vector2',
        x: 100,
        y: 200,
      });
      expect(scene.nodes[0].properties.speed).toBe(300);
    });

    it('should return false for non-existent node', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [{ name: 'Main', type: 'Node2D', properties: {} }],
        connections: [],
      };

      const result = TscnParser.modifyNode(scene, 'NonExistent', {
        properties: { test: true },
      });

      expect(result).toBe(false);
    });
  });

  describe('getSceneTree', () => {
    it('should return hierarchical structure', () => {
      const scene: ParsedScene = {
        header: { type: 'gd_scene', format: 3 },
        externalResources: [],
        subResources: [],
        nodes: [
          { name: 'Main', type: 'Node2D', properties: {} },
          { name: 'Player', type: 'CharacterBody2D', parent: '.', properties: {} },
          { name: 'Sprite', type: 'Sprite2D', parent: 'Player', properties: {} },
        ],
        connections: [],
      };

      const tree = TscnParser.getSceneTree(scene);

      expect(tree.Main).toBeDefined();
      expect((tree.Main as any).type).toBe('Node2D');
    });
  });

  describe('edge cases', () => {
    it('should handle empty scene', () => {
      const content = `[gd_scene format=3]
`;
      const result = TscnParser.parse(content);

      expect(result.nodes).toHaveLength(0);
      expect(result.externalResources).toHaveLength(0);
    });

    it('should handle negative numbers', () => {
      const content = `[gd_scene format=3]

[node name="Test" type="Node2D"]
position = Vector2(-100, -200)
offset = -50
`;
      const result = TscnParser.parse(content);

      expect(result.nodes[0].properties.position).toEqual({
        _type: 'Vector2',
        x: -100,
        y: -200,
      });
      expect(result.nodes[0].properties.offset).toBe(-50);
    });

    it('should handle escaped strings', () => {
      const content = `[gd_scene format=3]

[node name="Test" type="Label"]
text = "Hello \\"World\\""
`;
      const result = TscnParser.parse(content);

      expect(result.nodes[0].properties.text).toBe('Hello "World"');
    });

    it('should handle gd_resource type', () => {
      const content = `[gd_resource type="Resource" format=3]
`;
      const result = TscnParser.parse(content);

      expect(result.header.type).toBe('gd_resource');
    });
  });
});

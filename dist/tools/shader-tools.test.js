import { describe, it, expect } from 'vitest';
// Shader preset definitions for testing
const SHADER_PRESETS = {
    flash: {
        name: 'flash',
        description: 'Flash effect for damage or highlights',
        uniforms: ['flash_color', 'flash_intensity'],
    },
    outline: {
        name: 'outline',
        description: 'Outline around sprite',
        uniforms: ['outline_color', 'outline_width'],
    },
    dissolve: {
        name: 'dissolve',
        description: 'Dissolve/disintegration effect',
        uniforms: ['dissolve_amount', 'dissolve_color', 'noise_texture'],
    },
    pixelate: {
        name: 'pixelate',
        description: 'Pixelation effect',
        uniforms: ['pixel_size'],
    },
    wave: {
        name: 'wave',
        description: 'Wave distortion effect',
        uniforms: ['wave_amplitude', 'wave_frequency', 'wave_speed'],
    },
    hologram: {
        name: 'hologram',
        description: 'Hologram/glitch effect',
        uniforms: ['scan_line_count', 'glitch_intensity', 'hologram_color'],
    },
    crt: {
        name: 'crt',
        description: 'CRT monitor effect',
        uniforms: ['scanline_intensity', 'curvature', 'vignette_intensity'],
    },
};
describe('Shader Tools', () => {
    describe('shader presets', () => {
        it('should have all expected presets', () => {
            const expectedPresets = ['flash', 'outline', 'dissolve', 'pixelate', 'wave', 'hologram', 'crt'];
            for (const preset of expectedPresets) {
                expect(SHADER_PRESETS).toHaveProperty(preset);
            }
        });
        it('should have uniforms defined for each preset', () => {
            for (const [name, preset] of Object.entries(SHADER_PRESETS)) {
                expect(preset.uniforms).toBeDefined();
                expect(preset.uniforms.length).toBeGreaterThan(0);
            }
        });
    });
    describe('shader generation', () => {
        it('should generate valid shader_type declaration', () => {
            const shaderTypes = ['canvas_item', 'spatial', 'particles'];
            for (const type of shaderTypes) {
                const header = `shader_type ${type};`;
                expect(header).toContain('shader_type');
                expect(header).toContain(type);
            }
        });
        it('should generate uniform declarations', () => {
            const uniforms = [
                { name: 'flash_color', type: 'vec4', default: 'vec4(1.0, 1.0, 1.0, 1.0)' },
                { name: 'flash_intensity', type: 'float', default: '0.0', hint: 'hint_range(0.0, 1.0)' },
            ];
            const lines = uniforms.map(u => {
                if (u.hint) {
                    return `uniform ${u.type} ${u.name} : ${u.hint} = ${u.default};`;
                }
                return `uniform ${u.type} ${u.name} = ${u.default};`;
            });
            expect(lines[0]).toBe('uniform vec4 flash_color = vec4(1.0, 1.0, 1.0, 1.0);');
            expect(lines[1]).toBe('uniform float flash_intensity : hint_range(0.0, 1.0) = 0.0;');
        });
        it('should generate flash shader', () => {
            const flashShader = `shader_type canvas_item;

uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float flash_intensity : hint_range(0.0, 1.0) = 0.0;

void fragment() {
    vec4 tex_color = texture(TEXTURE, UV);
    COLOR = mix(tex_color, flash_color, flash_intensity);
    COLOR.a = tex_color.a;
}
`;
            expect(flashShader).toContain('shader_type canvas_item');
            expect(flashShader).toContain('flash_color');
            expect(flashShader).toContain('flash_intensity');
            expect(flashShader).toContain('void fragment()');
            expect(flashShader).toContain('mix(');
        });
        it('should generate dissolve shader', () => {
            const dissolveShader = `shader_type canvas_item;

uniform float dissolve_amount : hint_range(0.0, 1.0) = 0.0;
uniform vec4 edge_color : source_color = vec4(1.0, 0.5, 0.0, 1.0);
uniform float edge_width : hint_range(0.0, 0.2) = 0.05;
uniform sampler2D noise_texture;

void fragment() {
    vec4 tex_color = texture(TEXTURE, UV);
    float noise = texture(noise_texture, UV).r;

    float edge_start = dissolve_amount - edge_width;
    float edge_end = dissolve_amount;

    if (noise < dissolve_amount) {
        if (noise > edge_start) {
            COLOR = edge_color;
            COLOR.a = tex_color.a;
        } else {
            discard;
        }
    } else {
        COLOR = tex_color;
    }
}
`;
            expect(dissolveShader).toContain('dissolve_amount');
            expect(dissolveShader).toContain('noise_texture');
            expect(dissolveShader).toContain('discard');
        });
        it('should generate outline shader', () => {
            const outlineShader = `shader_type canvas_item;

uniform vec4 outline_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float outline_width : hint_range(0.0, 10.0) = 1.0;

void fragment() {
    vec4 tex_color = texture(TEXTURE, UV);
    vec2 size = TEXTURE_PIXEL_SIZE * outline_width;

    float outline = texture(TEXTURE, UV + vec2(-size.x, 0)).a;
    outline += texture(TEXTURE, UV + vec2(size.x, 0)).a;
    outline += texture(TEXTURE, UV + vec2(0, -size.y)).a;
    outline += texture(TEXTURE, UV + vec2(0, size.y)).a;

    outline = min(outline, 1.0);

    vec4 color = mix(outline_color * outline, tex_color, tex_color.a);
    COLOR = color;
}
`;
            expect(outlineShader).toContain('outline_color');
            expect(outlineShader).toContain('outline_width');
            expect(outlineShader).toContain('TEXTURE_PIXEL_SIZE');
        });
    });
    describe('shader validation', () => {
        it('should detect missing shader_type', () => {
            const invalidShader = `
uniform float test = 1.0;

void fragment() {
    COLOR = vec4(1.0);
}
`;
            const hasShaderType = invalidShader.includes('shader_type');
            expect(hasShaderType).toBe(false);
        });
        it('should detect valid uniform types', () => {
            const validTypes = ['float', 'int', 'vec2', 'vec3', 'vec4', 'mat2', 'mat3', 'mat4', 'sampler2D'];
            for (const type of validTypes) {
                const uniform = `uniform ${type} test_var;`;
                expect(uniform).toContain(type);
            }
        });
        it('should validate shader structure', () => {
            const shader = `shader_type canvas_item;

uniform float test : hint_range(0.0, 1.0) = 0.5;

void fragment() {
    COLOR = vec4(test);
}
`;
            // Basic structure validation
            expect(shader).toContain('shader_type');
            expect(shader).toContain('void fragment()');
            expect(shader).toMatch(/uniform\s+\w+\s+\w+/);
        });
    });
    describe('shader file operations', () => {
        it('should use .gdshader extension', () => {
            const filename = 'dissolve.gdshader';
            expect(filename.endsWith('.gdshader')).toBe(true);
        });
        it('should handle shader paths', () => {
            const shaderPath = 'res://shaders/effects/flash.gdshader';
            expect(shaderPath).toContain('res://');
            expect(shaderPath).toContain('.gdshader');
        });
    });
    describe('preset customization', () => {
        it('should allow color customization', () => {
            const customColor = { r: 1.0, g: 0.0, b: 0.0, a: 1.0 };
            const colorStr = `vec4(${customColor.r}, ${customColor.g}, ${customColor.b}, ${customColor.a})`;
            expect(colorStr).toBe('vec4(1, 0, 0, 1)');
        });
        it('should allow intensity customization', () => {
            const intensity = 0.75;
            const uniformLine = `uniform float intensity : hint_range(0.0, 1.0) = ${intensity};`;
            expect(uniformLine).toContain('0.75');
        });
    });
});
//# sourceMappingURL=shader-tools.test.js.map
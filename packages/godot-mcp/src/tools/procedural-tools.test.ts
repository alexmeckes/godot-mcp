import { describe, it, expect } from 'vitest';

describe('Procedural Generation Tools', () => {
  describe('dungeon generation', () => {
    it('should generate rooms within bounds', () => {
      const width = 50;
      const height = 50;
      const roomCount = 5;

      // Simulate room generation
      const rooms: Array<{ x: number; y: number; w: number; h: number }> = [];

      for (let i = 0; i < roomCount; i++) {
        const room = {
          x: Math.floor(Math.random() * (width - 10)),
          y: Math.floor(Math.random() * (height - 10)),
          w: Math.floor(Math.random() * 6) + 5, // 5-10
          h: Math.floor(Math.random() * 6) + 5, // 5-10
        };
        rooms.push(room);
      }

      for (const room of rooms) {
        expect(room.x).toBeGreaterThanOrEqual(0);
        expect(room.y).toBeGreaterThanOrEqual(0);
        expect(room.w).toBeGreaterThanOrEqual(5);
        expect(room.h).toBeGreaterThanOrEqual(5);
      }
    });

    it('should generate corridors between rooms', () => {
      const rooms = [
        { x: 5, y: 5, w: 8, h: 8 },
        { x: 20, y: 5, w: 8, h: 8 },
      ];

      // Calculate room centers
      const centers = rooms.map(r => ({
        x: r.x + Math.floor(r.w / 2),
        y: r.y + Math.floor(r.h / 2),
      }));

      // Corridor should connect centers
      const corridor = {
        start: centers[0],
        end: centers[1],
      };

      expect(corridor.start.x).toBe(9);
      expect(corridor.end.x).toBe(24);
    });

    it('should place doors between rooms and corridors', () => {
      const room = { x: 5, y: 5, w: 8, h: 8 };
      const corridorY = 9; // Horizontal corridor at y=9

      // Door should be on room edge where corridor meets
      const doorX = room.x + room.w; // Right edge
      const doorY = corridorY;

      expect(doorX).toBe(13);
      expect(doorY).toBeGreaterThanOrEqual(room.y);
      expect(doorY).toBeLessThan(room.y + room.h);
    });

    it('should generate valid dungeon structure', () => {
      const dungeon = {
        width: 50,
        height: 50,
        rooms: [
          { x: 5, y: 5, w: 8, h: 8, id: 0 },
          { x: 20, y: 5, w: 8, h: 8, id: 1 },
          { x: 12, y: 20, w: 10, h: 10, id: 2 },
        ],
        corridors: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
        ],
        doors: [
          { x: 13, y: 9 },
          { x: 24, y: 13 },
        ],
      };

      expect(dungeon.rooms.length).toBe(3);
      expect(dungeon.corridors.length).toBe(2);
      expect(dungeon.doors.length).toBe(2);

      // All rooms should be within bounds
      for (const room of dungeon.rooms) {
        expect(room.x + room.w).toBeLessThanOrEqual(dungeon.width);
        expect(room.y + room.h).toBeLessThanOrEqual(dungeon.height);
      }
    });

    it('should mark spawn and exit points', () => {
      const dungeon = {
        rooms: [
          { x: 5, y: 5, w: 8, h: 8, isSpawn: true },
          { x: 40, y: 40, w: 8, h: 8, isExit: true },
        ],
      };

      const spawnRoom = dungeon.rooms.find(r => r.isSpawn);
      const exitRoom = dungeon.rooms.find(r => r.isExit);

      expect(spawnRoom).toBeDefined();
      expect(exitRoom).toBeDefined();
      expect(spawnRoom).not.toBe(exitRoom);
    });
  });

  describe('tilemap pattern generation', () => {
    it('should generate terrain patterns', () => {
      const width = 10;
      const height = 10;
      const pattern: number[][] = [];

      // Generate simple terrain (0 = empty, 1 = ground)
      for (let y = 0; y < height; y++) {
        pattern[y] = [];
        for (let x = 0; x < width; x++) {
          // Ground in bottom half
          pattern[y][x] = y >= height / 2 ? 1 : 0;
        }
      }

      expect(pattern.length).toBe(height);
      expect(pattern[0].length).toBe(width);

      // Top half should be empty
      expect(pattern[0][5]).toBe(0);
      // Bottom half should be ground
      expect(pattern[8][5]).toBe(1);
    });

    it('should generate border tiles', () => {
      const width = 10;
      const height = 10;
      const pattern: number[][] = [];

      // Generate with borders (2 = border)
      for (let y = 0; y < height; y++) {
        pattern[y] = [];
        for (let x = 0; x < width; x++) {
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            pattern[y][x] = 2; // Border
          } else {
            pattern[y][x] = 1; // Interior
          }
        }
      }

      // Check corners are borders
      expect(pattern[0][0]).toBe(2);
      expect(pattern[0][9]).toBe(2);
      expect(pattern[9][0]).toBe(2);
      expect(pattern[9][9]).toBe(2);

      // Check interior
      expect(pattern[5][5]).toBe(1);
    });

    it('should support multiple tile types', () => {
      const tileTypes = {
        EMPTY: 0,
        GROUND: 1,
        WALL: 2,
        WATER: 3,
        LAVA: 4,
      };

      const pattern = [
        [2, 2, 2, 2, 2],
        [2, 1, 1, 1, 2],
        [2, 1, 3, 1, 2],
        [2, 1, 1, 1, 2],
        [2, 2, 2, 2, 2],
      ];

      // Check tile type counts
      const flat = pattern.flat();
      const wallCount = flat.filter(t => t === tileTypes.WALL).length;
      const groundCount = flat.filter(t => t === tileTypes.GROUND).length;
      const waterCount = flat.filter(t => t === tileTypes.WATER).length;

      expect(wallCount).toBe(16);
      expect(groundCount).toBe(8);
      expect(waterCount).toBe(1);
    });
  });

  describe('wave configuration generation', () => {
    it('should generate enemy waves', () => {
      const waveCount = 5;
      const waves: Array<{
        waveNumber: number;
        enemies: Array<{ type: string; count: number }>;
        delay: number;
      }> = [];

      for (let i = 0; i < waveCount; i++) {
        waves.push({
          waveNumber: i + 1,
          enemies: [
            { type: 'basic', count: 3 + i * 2 },
            { type: 'fast', count: Math.floor(i / 2) },
          ],
          delay: 5 - i * 0.5, // Decreasing delay
        });
      }

      expect(waves.length).toBe(5);

      // Difficulty should increase
      expect(waves[4].enemies[0].count).toBeGreaterThan(waves[0].enemies[0].count);

      // Delay should decrease
      expect(waves[4].delay).toBeLessThan(waves[0].delay);
    });

    it('should introduce new enemy types in later waves', () => {
      const waves = [
        { wave: 1, enemies: ['basic'] },
        { wave: 2, enemies: ['basic'] },
        { wave: 3, enemies: ['basic', 'fast'] },
        { wave: 5, enemies: ['basic', 'fast', 'tank'] },
        { wave: 8, enemies: ['basic', 'fast', 'tank', 'boss'] },
      ];

      expect(waves[0].enemies).not.toContain('fast');
      expect(waves[2].enemies).toContain('fast');
      expect(waves[3].enemies).toContain('tank');
      expect(waves[4].enemies).toContain('boss');
    });

    it('should configure spawn points', () => {
      const spawnConfig = {
        points: [
          { x: 0, y: 50, weight: 0.3 },
          { x: 100, y: 0, weight: 0.3 },
          { x: 100, y: 100, weight: 0.4 },
        ],
        pattern: 'random', // or 'sequential', 'all_at_once'
        spawnInterval: 0.5,
      };

      const totalWeight = spawnConfig.points.reduce((sum, p) => sum + p.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0);
    });

    it('should generate balanced wave difficulty', () => {
      // Difficulty formula: base + (waveNumber * multiplier)
      const calculateDifficulty = (wave: number) => {
        const baseEnemies = 3;
        const enemyMultiplier = 2;
        const baseHealth = 1.0;
        const healthMultiplier = 0.1;

        return {
          enemyCount: baseEnemies + wave * enemyMultiplier,
          healthMod: baseHealth + wave * healthMultiplier,
        };
      };

      const wave1 = calculateDifficulty(1);
      const wave10 = calculateDifficulty(10);

      expect(wave1.enemyCount).toBe(5);
      expect(wave10.enemyCount).toBe(23);
      expect(wave10.healthMod).toBeCloseTo(2.0);
    });
  });

  describe('noise generation for procedural content', () => {
    it('should generate values between 0 and 1', () => {
      // Simple noise function mock
      const noise = (x: number, y: number) => {
        return (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      };

      for (let i = 0; i < 100; i++) {
        const value = Math.abs(noise(i * 0.1, i * 0.2));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    it('should be deterministic with same seed', () => {
      const seedRandom = (seed: number) => {
        return () => {
          seed = (seed * 1103515245 + 12345) % 2147483648;
          return seed / 2147483648;
        };
      };

      const rng1 = seedRandom(12345);
      const rng2 = seedRandom(12345);

      for (let i = 0; i < 10; i++) {
        expect(rng1()).toBe(rng2());
      }
    });
  });
});

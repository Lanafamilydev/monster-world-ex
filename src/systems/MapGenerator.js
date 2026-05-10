// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Map Generator System
// Procedurally generates game maps with terrain, special tiles,
// capture points, and scalable grid sizes per mode/floor
// ═══════════════════════════════════════════════════════════════

// ── Map size configs per mode ──
const MAP_CONFIGS = {
  campaign: [
    { rows:8, cols:10 }, // Floor 1-2
    { rows:8, cols:10 }, // Floor 3-4
    { rows:9, cols:10 }, // Floor 5-6
    { rows:10,cols:10 }, // Floor 7+
  ],
  endless: [
    { rows:5, cols:6  }, // Floor 1
    { rows:6, cols:8  }, // Floor 2
    { rows:7, cols:9  }, // Floor 3-4
    { rows:8, cols:10 }, // Floor 5-7
    { rows:9, cols:10 }, // Floor 8-10
    { rows:10,cols:10 }, // Floor 11+
  ],
  arena: [
    { rows:8, cols:10 },
  ],
};

// ── Terrain distribution weights ──
const TERRAIN_WEIGHTS = {
  plains:   40,
  forest:   18,
  mountain: 10,
  water:    8,
  castle:   6,
  ruin:     5,
  trap:     5,
  speedup:  4,
  fire_shrine:  1,
  water_shrine: 1,
  dark_shrine:  1,
  heal_spring:  1,
};

/** Weighted random terrain pick */
function weightedTerrain(pool) {
  const total = pool.reduce((s, [,w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of pool) {
    r -= w;
    if (r <= 0) return type;
  }
  return 'plains';
}

/** BFS reachability check — ensures no region is fully isolated */
function isFullyConnected(map, rows, cols) {
  let start = null;
  const passable = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (map[r][c] !== 'water' && map[r][c] !== 'mountain') {
        passable.push([r, c]);
        if (!start) start = [r, c];
      }
    }
  }
  if (!start || passable.length < 6) return false;
  const visited = new Set();
  const queue = [start];
  visited.add(`${start[0]},${start[1]}`);
  while (queue.length) {
    const [cr, cc] = queue.shift();
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = cr + dr, nc = cc + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const k = `${nr},${nc}`;
      if (visited.has(k)) continue;
      if (map[nr][nc] !== 'water' && map[nr][nc] !== 'mountain') {
        visited.add(k);
        queue.push([nr, nc]);
      }
    }
  }
  // At least 70% of passable cells must be connected
  return visited.size >= passable.length * 0.7;
}

/** Place N cells of a given terrain, avoiding occupied positions */
function placeTiles(map, rows, cols, type, count, avoid = new Set()) {
  let placed = 0, attempts = 0;
  while (placed < count && attempts < 200) {
    attempts++;
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const k = `${r},${c}`;
    if (!avoid.has(k) && map[r][c] === 'plains') {
      map[r][c] = type;
      avoid.add(k);
      placed++;
    }
  }
}

/** Generate capture points spread across the map */
function generateCapturePoints(rows, cols, count = 4) {
  // Place capture points in quadrants for strategic balance
  const points = [];
  const quadrants = [
    [Math.floor(rows * 0.2), Math.floor(rows * 0.45), Math.floor(cols * 0.1), Math.floor(cols * 0.45)],
    [Math.floor(rows * 0.2), Math.floor(rows * 0.45), Math.floor(cols * 0.55), Math.floor(cols * 0.9)],
    [Math.floor(rows * 0.55), Math.floor(rows * 0.8), Math.floor(cols * 0.1), Math.floor(cols * 0.45)],
    [Math.floor(rows * 0.55), Math.floor(rows * 0.8), Math.floor(cols * 0.55), Math.floor(cols * 0.9)],
  ];
  for (let i = 0; i < Math.min(count, quadrants.length); i++) {
    const [rMin, rMax, cMin, cMax] = quadrants[i];
    const r = rMin + Math.floor(Math.random() * (rMax - rMin + 1));
    const c = cMin + Math.floor(Math.random() * (cMax - cMin + 1));
    points.push([Math.min(r, rows - 1), Math.min(c, cols - 1)]);
  }
  return points;
}

/**
 * Main map generation function.
 * @param {string} mode - 'campaign' | 'endless' | 'arena'
 * @param {number} floor - Current floor/level number
 * @returns {{ map, rows, cols, capturePoints }}
 */
export function generateMap(mode = 'campaign', floor = 1) {
  const configs = MAP_CONFIGS[mode] || MAP_CONFIGS.campaign;
  const idx = Math.min(Math.max(0, Math.floor((floor - 1) / 2)), configs.length - 1);
  const { rows, cols } = configs[idx];

  // Difficulty-based terrain density
  const difficultyFactor = Math.min(1, (floor - 1) / 10);
  const waterCount   = Math.floor((rows * cols * 0.05) + difficultyFactor * rows);
  const mountainCount= Math.floor((rows * cols * 0.04) + difficultyFactor * rows * 0.5);
  const forestCount  = Math.floor((rows * cols * 0.15) + difficultyFactor * 3);
  const castleCount  = 2 + Math.floor(difficultyFactor * 2);
  const trapCount    = 2 + Math.floor(difficultyFactor * 4);
  const speedupCount = 2 + Math.floor(difficultyFactor * 2);
  const shrineCount  = Math.floor(difficultyFactor * 3 + 1);
  const healCount    = 1 + Math.floor(difficultyFactor);

  let map, attempts = 0;
  const MAX_ATTEMPTS = 15;

  // Regenerate until connectivity check passes
  do {
    attempts++;
    map = Array.from({ length: rows }, () => Array(cols).fill('plains'));

    const reserved = new Set();
    // Keep corners free for player/enemy spawns
    [[0,0],[0,cols-1],[rows-1,0],[rows-1,cols-1]].forEach(([r,c]) => reserved.add(`${r},${c}`));
    // Row 0 and row rows-1 are spawn zones — keep mostly open
    for (let c = 0; c < cols; c++) {
      reserved.add(`0,${c}`);
      reserved.add(`${rows-1},${c}`);
    }

    placeTiles(map, rows, cols, 'water',    waterCount,    reserved);
    placeTiles(map, rows, cols, 'mountain', mountainCount, reserved);
    placeTiles(map, rows, cols, 'forest',   forestCount,   reserved);
    placeTiles(map, rows, cols, 'castle',   castleCount,   reserved);
    placeTiles(map, rows, cols, 'trap',     trapCount,     reserved);
    placeTiles(map, rows, cols, 'speedup',  speedupCount,  reserved);

    // V5.1 special tiles
    const shrineTypes = ['fire_shrine', 'water_shrine', 'dark_shrine', 'heal_spring'];
    for (let i = 0; i < shrineCount; i++) {
      const type = shrineTypes[i % shrineTypes.length];
      placeTiles(map, rows, cols, type, 1, reserved);
    }
    for (let i = 0; i < healCount; i++) {
      placeTiles(map, rows, cols, 'heal_spring', 1, reserved);
    }

    // Add some ruin tiles for flavor
    placeTiles(map, rows, cols, 'ruin', Math.floor(rows * 0.5), reserved);

  } while (!isFullyConnected(map, rows, cols) && attempts < MAX_ATTEMPTS);

  // Generate capture points on passable tiles
  const rawPoints = generateCapturePoints(rows, cols, 4);
  const capturePoints = rawPoints.map(([r, c]) => {
    // Ensure capture point is always a castle for gameplay consistency
    map[r][c] = 'castle';
    return [r, c];
  });

  return { map, rows, cols, capturePoints };
}

/** Generate the static campaign map (original V5 maps) */
export function getCampaignMap(floor) {
  // Campaign has fixed maps per floor for designed difficulty
  const FIXED_MAPS = [
    // Floor 1 — tutorial-ish
    [
      ['plains','forest','forest','mountain','water','water','mountain','forest','forest','plains'],
      ['plains','forest','ruin',  'plains',  'water','water','plains',  'ruin',  'forest','plains'],
      ['plains','plains','castle','plains',  'speedup','speedup','plains','castle','plains','plains'],
      ['forest','plains','plains','forest',  'mountain','mountain','forest','plains','plains','forest'],
      ['forest','plains','plains','mountain','mountain','mountain','mountain','plains','plains','forest'],
      ['plains','plains','castle','plains',  'speedup','speedup','plains','castle','plains','plains'],
      ['plains','forest','ruin',  'plains',  'water','water','plains',  'ruin',  'forest','plains'],
      ['plains','forest','forest','mountain','water','water','mountain','forest','forest','plains'],
    ],
    // Floor 2 — more obstacles
    [
      ['plains','forest','mountain','forest','water','water','forest','mountain','forest','plains'],
      ['forest','plains','ruin',   'plains', 'trap', 'trap', 'plains','ruin',   'plains','forest'],
      ['plains','castle','plains', 'forest', 'speedup','speedup','forest','plains','castle','plains'],
      ['plains','plains','forest', 'mountain','mountain','mountain','mountain','forest','plains','plains'],
      ['forest','plains','plains', 'mountain','mountain','mountain','mountain','plains','plains','forest'],
      ['plains','castle','plains', 'forest', 'speedup','speedup','forest','plains','castle','plains'],
      ['forest','plains','ruin',   'plains', 'trap', 'trap', 'plains','ruin',   'plains','forest'],
      ['plains','forest','mountain','forest','water','water','forest','mountain','forest','plains'],
    ],
  ];
  const idx = Math.min(floor - 1, FIXED_MAPS.length - 1);
  const base = FIXED_MAPS[idx];
  // V5.1: overlay special tiles
  const map = base.map(r => [...r]);
  // Add a heal spring and shrine
  if (floor >= 2) {
    map[3][4] = 'fire_shrine';
    map[4][5] = 'heal_spring';
  }
  
  // V5.1: Capture points are ALWAYS the castles
  const capturePoints = [];
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === 'castle') {
        capturePoints.push([r, c]);
      }
    }
  }

  return {
    map,
    rows: map.length,
    cols: map[0].length,
    capturePoints,
  };
}

/** Get spawn positions for player and enemy based on map size */
export function getSpawnPositions(rows, cols) {
  // Player spawns in bottom rows, enemy in top rows
  const playerPositions = [
    [rows-1, cols-1],
    [rows-1, 0],
    [rows-2, Math.floor(cols/2)],
    [rows-2, Math.floor(cols/2)+1],
    [rows-1, Math.floor(cols/2)],
  ];
  const enemyPositions = [
    [0, 0],
    [0, Math.floor(cols/3)],
    [0, Math.floor(cols*2/3)],
    [0, cols-1],
    [1, Math.floor(cols/2)],
  ];
  return { playerPositions, enemyPositions };
}

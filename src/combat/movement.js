// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Movement & Range Module
// Grid navigation helpers used by combat and AI
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { TERRAIN, SKILLS } from '../core/data.js';

/** Find the [row, col] position of a unit by id */
export function findU(id) {
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (G.grid[r][c] === id) return [r, c];
    }
  }
  return null;
}

/** BFS to find all reachable cells within speed range */
export function getReach(r, c, spd, size = 1) {
  const cells = [];
  const q     = [[r, c, spd]];
  const vis   = new Set([`${r},${c}`]);
  while (q.length) {
    const [cr, cc, rem] = q.shift();
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = cr + dr, nc = cc + dc;
      if (nr < 0 || nr + size > G.rows || nc < 0 || nc + size > G.cols) continue;
      const k = `${nr},${nc}`;
      if (vis.has(k)) continue;

      // V6.0: Check all cells for size-N unit
      let blocked = false;
      for (let sr = 0; sr < size; sr++) {
        for (let sc = 0; sc < size; sc++) {
          const tr = nr + sr, tc = nc + sc;
          const terr = TERRAIN[G.activeMap[tr]?.[tc]] || TERRAIN.plains;
          if (terr.block) { blocked = true; break; }
          const occupant = G.grid[tr][tc];
          // Allow passing through self
          if (occupant && occupant !== G.grid[r][c]) { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (blocked) continue;

      const t = TERRAIN[G.activeMap[nr]?.[nc]] || TERRAIN.plains;
      const cost = 1 + t.spd;
      if (rem >= cost) {
        vis.add(k);
        cells.push([nr, nc]);
        if (rem - cost > 0) q.push([nr, nc, rem - cost]);
      }
    }
  }
  return cells;
}

/** Manhattan-range adjacency (for attacks / AOE) */
export function getAdj(r, c, range = 1, size = 1) {
  const cells = [];
  // For each cell occupied by the unit, find adjacent targets
  for (let sr = 0; sr < size; sr++) {
    for (let sc = 0; sc < size; sc++) {
      const br = r + sr, bc = c + sc;
      for (let dr = -range; dr <= range; dr++) {
        for (let dc = -range; dc <= range; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (Math.abs(dr) + Math.abs(dc) > range) continue;
          const nr = br + dr, nc = bc + dc;
          if (nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols) {
            // Avoid adding same cell multiple times for larger units
            if (!cells.some(([ar, ac]) => ar === nr && ac === nc)) {
              // Also avoid adding cells occupied by the unit itself
              if (nr < r || nr >= r + size || nc < c || nc >= c + size) {
                cells.push([nr, nc]);
              }
            }
          }
        }
      }
    }
  }
  return cells;
}

/** Get cells with attackable enemies adjacent to (r,c) */
export function getAtkbl(r, c, own) {
  return getAdj(r, c, 1).filter(([a, b]) => {
    const uid = G.grid[a][b];
    return uid && G.units[uid].alive && G.units[uid].o !== own;
  });
}

/** Get valid skill target cells */
export function getSkTgts(r, c, sid, own) {
  const sk = SKILLS[sid];
  if (!sk) return [];
  if (sk.t === 'buff' || sk.t === 'ulti') return [[r, c]];
  if (sk.t === 'heal') {
    return [
      ...getAdj(r, c, sk.r).filter(([a, b]) => {
        const uid = G.grid[a][b];
        return uid && G.units[uid].alive && G.units[uid].o === own;
      }),
      [r, c],
    ];
  }
  if (sk.t === 'move') return getReach(r, c, sk.r);

  // V6.0: AOE Patterns for Bosses
  if (sk.pattern) {
    return getAOEPattern(r, c, sk.pattern, sk.r);
  }

  const cells = [];
  for (let dr = -sk.r; dr <= sk.r; dr++) {
    for (let dc = -sk.r; dc <= sk.r; dc++) {
      if (dr === 0 && dc === 0) continue;
      if (Math.abs(dr) + Math.abs(dc) > sk.r) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= G.rows || nc < 0 || nc >= G.cols) continue;
      if (sk.aoe) {
        cells.push([nr, nc]);
      } else {
        const uid = G.grid[nr][nc];
        if (uid && G.units[uid].alive && G.units[uid].o !== own) cells.push([nr, nc]);
      }
    }
  }
  return cells;
}

/** V6.0: Get AOE pattern cells */
export function getAOEPattern(r, c, pattern, range = 2) {
  const cells = [];
  if (pattern === 'cross') {
    for (let i = 1; i <= range; i++) {
      [[-i, 0], [i, 0], [0, -i], [0, i]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols) cells.push([nr, nc]);
      });
    }
  } else if (pattern === 'horizontal') {
    for (let dc = -range; dc <= range; dc++) {
      const nr = r, nc = c + dc;
      if (nc >= 0 && nc < G.cols) cells.push([nr, nc]);
    }
  } else if (pattern === 'circular') {
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        if (Math.sqrt(dr*dr + dc*dc) <= range) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols) cells.push([nr, nc]);
        }
      }
    }
  }
  return cells;
}

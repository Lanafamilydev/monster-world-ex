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
export function getReach(r, c, spd) {
  const cells = [];
  const q     = [[r, c, spd]];
  const vis   = new Set([`${r},${c}`]);
  while (q.length) {
    const [cr, cc, rem] = q.shift();
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = cr + dr, nc = cc + dc;
      if (nr < 0 || nr >= G.rows || nc < 0 || nc >= G.cols) continue;
      const k = `${nr},${nc}`;
      if (vis.has(k)) continue;
      const t = TERRAIN[G.activeMap[nr]?.[nc]] || TERRAIN.plains;
      if (t.block) continue;
      if (G.grid[nr][nc]) { vis.add(k); continue; }
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
export function getAdj(r, c, range = 1) {
  const cells = [];
  for (let dr = -range; dr <= range; dr++) {
    for (let dc = -range; dc <= range; dc++) {
      if (dr === 0 && dc === 0) continue;
      if (Math.abs(dr) + Math.abs(dc) > range) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols) cells.push([nr, nc]);
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

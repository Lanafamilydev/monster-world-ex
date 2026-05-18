// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Session Manager
// Manages game modes: Campaign, Endless (Roguelite), Arena
// Presents mode selection screen and configures battle parameters
// ═══════════════════════════════════════════════════════════════

import { P, savePlayer, computePowerScore } from '../core/playerState.js';
import { G, resetG } from '../core/gameState.js';
import { toast, addLog, addLogSep } from '../ui/UIHelpers.js';
import { generateMap, getCampaignMap, getSpawnPositions } from './MapGenerator.js';
import { spawnEnemies, getEndlessRewards } from './EnemySpawner.js';
import { EVOLUTIONS, PLAYER_POSITIONS, getMonsterBase } from '../core/data.js';
import { render, renderUnitDetail, renderItemBar } from '../ui/Renderer.js';
import { switchTab } from '../ui/Tabs.js';
import { applyEndlessReward } from '../features/Roster.js';

// Current session config
export const Session = {
  mode:   'campaign',
  floor:  1,
  active: false,
};

/** Show mode selection overlay before starting battle */
export function showModeSelect() {
  // Make sure roster is synced from localStorage
  const rosterCount = (P.roster || []).length;
  if (!rosterCount) {
    toast('⚠ Đội hình trống! Vào Kho để thêm quái.');
    switchTab('storage');
    return;
  }

  const powerScore = computePowerScore();
  const overlay = document.getElementById('mode-select-overlay');
  if (!overlay) { startSession('campaign'); return; }

  // Update power score display
  const psEl = overlay.querySelector('#mode-ps-value');
  if (psEl) psEl.textContent = powerScore;

  // Update floor displays
  overlay.querySelector('#mode-camp-floor').textContent  = `Tầng ${P.campaignFloor || 1}`;
  overlay.querySelector('#mode-end-floor').textContent   = `Tầng cao nhất: ${P.endlessFloor || 0}`;
  overlay.querySelector('#mode-arena-rating').textContent = `Rating: ${P.arenaRating || 1000}`;
  const pvpRatingEl = overlay.querySelector('#mode-pvp-rating');
  if (pvpRatingEl) pvpRatingEl.textContent = `Rating: ${P.arenaRating || 1000}`;

  overlay.classList.add('show');
}

/** Hide mode selection */
export function hideModeSelect() {
  document.getElementById('mode-select-overlay')?.classList.remove('show');
}

/** Begin a session with the chosen mode */
export function startSession(mode) {
  if (mode === 'pvp') {
    hideModeSelect();
    import('../features/PVPArena.js').then(m => m.PVPArena.startMatchmaking());
    return;
  }

  hideModeSelect();
  Session.mode   = mode;
  Session.active = true;

  if (mode === 'campaign') {
    Session.floor = P.campaignFloor || 1;
  } else if (mode === 'endless') {
    Session.floor = (P.endlessFloor || 0) + 1;
  } else if (mode === 'arena') {
    Session.floor = 1;
  }

  initBattle();
}

/**
 * Core battle initialization — called by SessionManager when mode is chosen.
 * Fresh-loads P.roster from localStorage, generates map and enemies,
 * places units, resets G, and begins the battle tab.
 */
export function initBattle() {
  // ── CRITICAL: Re-load player state to ensure perfect roster sync ──
  // This guarantees newly purchased shop items are in sync
  const freshRoster = JSON.parse(localStorage.getItem('mwex5_player_v51'))?.roster
    || P.roster || [];

  resetG();

  // ── Generate map ──
  let mapData;
  if (Session.mode === 'campaign') {
    mapData = getCampaignMap(Session.floor);
  } else {
    mapData = generateMap(Session.mode, Session.floor);
  }

  G.rows      = mapData.rows;
  G.cols      = mapData.cols;
  G.activeMap = mapData.map;
  G.mode      = Session.mode;
  G.floor     = Session.floor;

  // Update board CSS grid columns
  const board = document.getElementById('board');
  if (board) {
    board.style.gridTemplateColumns = `repeat(${G.cols}, 1fr)`;
    board.style.aspectRatio = `${G.cols}/${G.rows}`;
  }

  // ── Setup captures ──
  const captureGoal = Session.mode === 'arena' ? 2 : 3;
  G.captureGoal = captureGoal;
  mapData.capturePoints.forEach(([r, c]) => {
    G.captures[`${r},${c}`] = 'neutral';
  });

  // ── Place enemy units ──
  const { playerPositions, enemyPositions } = getSpawnPositions(G.rows, G.cols);
  const grid = Array.from({ length: G.rows }, () => Array(G.cols).fill(null));
  G.grid = grid;

  const enemies = spawnEnemies(Session.mode, Session.floor);
  enemies.forEach((def, idx) => {
    if (idx >= enemyPositions.length) return;
    const pos = enemyPositions[idx];
    let r = pos[0], c = pos[1];

    const uid = def.id || `enemy_${idx}`;
    G.units[uid] = {
      ...def, id: uid,
      curHp: def.hp, curMp: def.mp,
      alive: true, moved: false, attacked: false, usedSkill: false,
      xp: 0, status: [], evolved: false, evoReady: false,
      o: 'enemy',
    };
    
    // V6.0: Multi-cell placement for large units (e.g. 2x2 boss)
    const size = def.size || 1;
    for (let dr = 0; dr < size; dr++) {
      for (let dc = 0; dc < size; dc++) {
        const nr = r + dr, nc = c + dc;
        if (G.grid[nr] !== undefined && G.grid[nr][nc] !== undefined) {
          G.grid[nr][nc] = uid;
          // Ensure all occupied cells are passable
          if (G.activeMap[nr] && (G.activeMap[nr][nc] === 'water' || G.activeMap[nr][nc] === 'mountain')) {
            G.activeMap[nr][nc] = 'plains';
          }
        }
      }
    }
  });

  // ── Place player units from roster (freshly loaded) ──
  const rosterToUse = freshRoster.slice(0, playerPositions.length);
  rosterToUse.forEach((id, idx) => {
    if (idx >= playerPositions.length) return;
    const base = getMonsterBase(id);
    if (!base) return;

    let pos = playerPositions[idx];
    let pr = pos[0], pc = pos[1];
    if (G.activeMap[pr] && (G.activeMap[pr][pc] === 'water' || G.activeMap[pr][pc] === 'mountain')) {
      G.activeMap[pr][pc] = 'plains';
    }

    const u = {
      ...base, id,
      curHp: base.hp, curMp: base.mp,
      alive: true, moved: false, attacked: false, usedSkill: false,
      xp: 0, status: [], evolved: false, evoReady: false,
      evoPathId: null, runes: [null, null, null],
    };

    // Apply persistent levels
    const ml = P.monsterLevels?.[id];
    if (ml && ml.lv > base.lv) {
      const gainLvs = ml.lv - base.lv;
      u.hp  += gainLvs * 3;
      u.atk += gainLvs;
      u.def += gainLvs;
      u.lv   = ml.lv;
      u.xp   = ml.xp || 0;
      u.curHp = u.hp;
      u.curMp = u.mp;
    } else if (ml) {
      u.lv = ml.lv;
      u.xp = ml.xp || 0;
    }

    // Re-apply saved evolution
    if (ml?.evolved && ml?.evoPathId) {
      const paths = EVOLUTIONS[id];
      if (paths) {
        const path = paths.find(p => p.pathId === ml.evoPathId);
        if (path) {
          u.n = path.n; u.e = path.e; u.elem = path.elem || u.elem;
          u.hp += path.hp;   u.curHp = u.hp;
          u.atk += path.atk; u.def += path.def;
          u.mp += (path.mp || 0); u.curMp = u.mp;
          if (path.spd) u.spd = Math.max(1, u.spd + path.spd);
          if (path.newSkill && !u.sk.includes(path.newSkill)) u.sk.push(path.newSkill);
          u.evolved = true;
          u.evoPathId = ml.evoPathId;
        }
      }
    }
    if (u.lv >= 10 && EVOLUTIONS[id] && !u.evolved) u.evoReady = true;
    
    // V6.0 Hybrid Trait bonus
    if (P.traits?.[id] === 'hybrid') {
      u.hp  = Math.ceil(u.hp * 1.1);
      u.atk = Math.ceil(u.atk * 1.1);
      u.def = Math.ceil(u.def * 1.1);
      u.curHp = u.hp;
      u.n += ' ✦'; 
    }

    // Affinity bonus
    const aff = P.affinity?.[id] || 0;
    if (aff >= 80)      { u.atk = Math.ceil(u.atk * 1.07); u.def = Math.ceil(u.def * 1.07); u.spd = Math.min(u.spd + 1, 10); }
    else if (aff >= 50) { u.atk = Math.ceil(u.atk * 1.03); u.def = Math.ceil(u.def * 1.03); }

    // Fatigue penalty
    const fat = P.fatigue?.[id] || 0;
    if (fat > 80)      u.spd = Math.max(1, u.spd - 2);
    else if (fat > 50) u.spd = Math.max(1, u.spd - 1);

    // V6.0 Rune Bonuses
    import('../features/Runes.js').then(({ RuneSystem }) => {
      const b = RuneSystem.getBonuses(id);
      u.atk = Math.ceil(u.atk * (1 + b.atk_pct / 100));
      u.spd = Math.max(1, u.spd + b.speed);
      u.crit = (u.crit || 0) + b.crit_chance;
      u.lifesteal = (u.lifesteal || 0) + b.lifesteal;
    });

    // V6.0 Talent Bonuses
    if (P.talents?.nature_blessing && u.elem === 'grass') {
      u.hp = Math.ceil(u.hp * 1.05);
      u.curHp = u.hp;
    }
    if (P.talents?.tactician) {
      u.crit = (u.crit || 0) + 5;
    }

    G.units[id] = u;
    G.grid[pr][pc] = id;
  });

  // ── Switch to battle tab and render ──
  switchTab('battle');

  const modeLabel = { campaign:'📖 CAMPAIGN', endless:'♾ ENDLESS', arena:'⚔ ARENA' }[Session.mode] || '';
  addLogSep('player', 1);
  addLog(`${modeLabel} — Tầng ${Session.floor} bắt đầu!`, 'ls');
  addLog(`⚡ Điểm mạnh: ${computePowerScore()} · Đội: ${rosterToUse.length} quái · Địch: ${enemies.length}`, 'ls');
  addLog('💡 Chiếm cứ điểm ⚑ hoặc tiêu diệt toàn địch để thắng!', 'ls');
  addLog('⚗ 🔥>🌿>💧 | ✨>🌑 · LV10+💎→ EVO · ×8 Combo→Tuyệt Chiêu', 'ls');

  renderUnitDetail(null);
  renderItemBar();
  render();
}

/** Called on game over — determines mode-specific rewards & progression */
export function handleSessionEnd(winner) {
  if (Session.mode === 'campaign') {
    if (winner === 'player') {
      P.campaignFloor = (P.campaignFloor || 1) + 1;
      // Campaign rewards Evo Stones
      P.inventory.evo_stone = (P.inventory.evo_stone || 0) + 1;
      toast('🏆 Campaign thắng! +1 💎 Đá Tiến Hóa · Tiến tầng mới!');
    }
    savePlayer();
  } else if (Session.mode === 'endless') {
    if (winner === 'player') {
      P.endlessFloor = Math.max(P.endlessFloor || 0, Session.floor);
      savePlayer();
      // Show roguelite reward picker
      setTimeout(() => showEndlessRewardPicker(), 800);
      
      // V6.0 Rune Drop (40% chance)
      if (Math.random() < 0.4) {
        import('../features/Runes.js').then(({ RuneSystem }) => {
          const rarity = Session.floor > 10 ? 'epic' : Session.floor > 5 ? 'rare' : 'common';
          const rune = RuneSystem.generateRune(rarity);
          P.runes.push(rune);
          savePlayer();
          toast(`💎 RƠI NGỌC: Nhận được 1 ngọc ${rune.rarity.toUpperCase()}!`);
        });
      }
      
      // V6.0 Gem Drop (1-3 Gems)
      const gems = 1 + Math.floor(Math.random() * 3);
      P.gems = (P.gems || 0) + gems;
      savePlayer();
      toast(`✨ Nhận ${gems} 💎 Gems!`);
    } else {
      toast('💀 Endless kết thúc tại tầng ' + Session.floor);
      savePlayer();
    }
  } else if (Session.mode === 'arena') {
    if (winner === 'player') {
      P.arenaRating = (P.arenaRating || 1000) + 25;
      toast('🏆 Arena thắng! Rating +25');
    } else {
      P.arenaRating = Math.max(800, (P.arenaRating || 1000) - 15);
      toast('💀 Arena thua. Rating -15');
    }
    savePlayer();
  }
}

/** Endless roguelite: show reward choice after clearing a floor */
export function showEndlessRewardPicker() {
  const rewards = getEndlessRewards();
  const overlay = document.getElementById('endless-reward-overlay');
  const list    = document.getElementById('endless-reward-list');
  if (!overlay || !list) return;

  list.innerHTML = '';
  rewards.forEach(rw => {
    const btn = document.createElement('div');
    btn.className = 'endless-reward-card';
    btn.innerHTML = `
      <div class="erc-label">${rw.label}</div>
      <div class="erc-desc">${rw.desc}</div>`;
    btn.addEventListener('click', () => {
      applyEndlessReward(rw);
      overlay.classList.remove('show');
      // Continue to next floor
      Session.floor++;
      initBattle();
    });
    list.appendChild(btn);
  });

  overlay.classList.add('show');
}

/** Dismiss endless reward overlay (skip) */
export function dismissEndlessReward() {
  document.getElementById('endless-reward-overlay')?.classList.remove('show');
  Session.floor++;
  initBattle();
}

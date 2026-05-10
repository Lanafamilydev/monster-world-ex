// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Turn System (fixed, no circular require)
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { SKILLS, getElemMult } from '../core/data.js';
import { addLog, addLogSep, hideCancel } from '../ui/UIHelpers.js';
import { render, renderUnitDetail } from '../ui/Renderer.js';
import { findU, getReach, getAtkbl, getSkTgts } from '../combat/movement.js';
import {
  procStatus, doAttack, doSkillAtk, applyStatus,
  checkCapture, checkSpecialTile, checkGameOver,
  getProvokeTarget, procTileStatuses,
} from '../combat/combat.js';
import { selectBestTarget, selectBestSkill } from './EnemySpawner.js';

export function endTurn() {
  if (G.gameOver) return;
  G.sel = null; G.reach = []; G.atkbl = []; G.skTgts = [];
  G.activeSk = null; G.phase = 'sel';
  Object.values(G.units).filter(u => u.o === 'player').forEach(u => {
    u.moved = false; u.attacked = false; u.usedSkill = false;
    u.status = u.status.filter(s => s.type !== 'speedup');
  });
  procStatus('player');
  addLog('─── Kết thúc lượt Yugi ───', 'ls');
  G.turn = 'enemy';
  hideCancel();
  renderUnitDetail(null);
  render();
  checkGameOver();
  if (!G.gameOver) { addLogSep('enemy', G.round); setTimeout(enemyTurn, 700); }
}

export function cancelAct() {
  G.sel = null; G.reach = []; G.atkbl = []; G.skTgts = [];
  G.activeSk = null; G.phase = 'sel';
  renderUnitDetail(null);
  render();
  hideCancel();
}

export function enemyTurn() {
  if (G.gameOver) return;
  const aiBar = document.getElementById('ai-bar');
  if (aiBar) aiBar.style.display = 'block';
  procStatus('enemy');
  render();
  const enemies = Object.values(G.units).filter(u => u.o === 'enemy' && u.alive);
  let idx = 0;
  function next() {
    if (idx >= enemies.length || G.gameOver) { finishEnemy(); return; }
    const u = enemies[idx++];
    if (!findU(u.id)) { next(); return; }
    if (u.status.some(s => s.type === 'stun' || s.type === 'freeze')) {
      addLog(`${u.e} bị khóa, bỏ lượt`, 'ls'); render(); setTimeout(next, 250); return;
    }
    smartAIAct(u); render(); setTimeout(next, 320);
  }
  setTimeout(next, 450);
}

function smartAIAct(u) {
  const pos = findU(u.id);
  if (!pos) return;
  let [ur, uc] = pos;
  const playerUnits = Object.values(G.units).filter(p => p.o === 'player' && p.alive);
  const isHighLevel = u.lv >= 6;

  // Step 1: Try skill
  if (!u.usedSkill && Math.random() < (isHighLevel ? 0.42 : 0.25)) {
    const sid = isHighLevel
      ? selectBestSkill(u, playerUnits)
      : (u.sk?.length ? u.sk[Math.floor(Math.random() * u.sk.length)] : null);
    if (sid) {
      const sk = SKILLS[sid];
      if (sk && !sk.ulti && u.curMp >= sk.mp) {
        u.curMp -= sk.mp; u.usedSkill = true;
        if (sk.t === 'buff') {
          applyStatus(u, sk.fx); addLog(`${u.e} dùng ${sk.i} ${sk.n}`, 'lsk');
        } else if (sk.t === 'heal') {
          const h = Math.min(Math.floor(sk.pw), u.hp - u.curHp);
          u.curHp = Math.min(u.hp, u.curHp + h); addLog(`${u.e} hồi +${h}HP`, 'lsk');
        } else if (sk.t === 'attack') {
          const tgts = getSkTgts(ur, uc, sid, 'enemy')
            .filter(([r,c]) => { const t=G.grid[r]?.[c]; return t && G.units[t]?.o==='player'; });
          if (tgts.length) {
            const best = isHighLevel ? selectBestTarget(u, tgts) : tgts[Math.floor(Math.random()*tgts.length)];
            if (best) {
              const tid = G.grid[best[0]]?.[best[1]];
              if (tid && G.units[tid]?.o === 'player') doSkillAtk(u, G.units[tid], best[0], best[1], sk);
            }
          }
        }
      }
    }
  }

  // Step 2: Melee if adjacent
  const adj = getAtkbl(ur, uc, 'enemy');
  if (adj.length && !u.attacked) {
    // V6.0: Provoke — TANK forces attack
    const provoked = getProvokeTarget(u);
    if (provoked) {
      const tid = G.grid[provoked.pos[0]]?.[provoked.pos[1]];
      if (tid && G.units[tid]) {
        addLog(`💢 ${u.e} bị khiêu khích bởi ${provoked.unit.e}!`, 'lsk');
        doAttack(u, G.units[tid], provoked.pos[0], provoked.pos[1], false);
        u.attacked = true;
      }
      return;
    }
    const best = isHighLevel ? selectBestTarget(u, adj) : adj[0];
    if (best) {
      const tid = G.grid[best[0]]?.[best[1]];
      if (tid && G.units[tid]) { doAttack(u, G.units[tid], best[0], best[1], false); u.attacked = true; }
    }
    return;
  }

  // Step 3: Move
  if (!u.moved) {
    let tgt = null, minScore = Infinity;
    Object.entries(G.captures).forEach(([k, own]) => {
      if (own !== 'enemy') {
        const [cr,cc] = k.split(',').map(Number);
        const d = Math.abs(ur-cr) + Math.abs(uc-cc);
        if (d < minScore) { minScore = d; tgt = [cr,cc]; }
      }
    });
    playerUnits.forEach(p => {
      const pp = findU(p.id); if (!pp) return;
      const d = Math.abs(ur-pp[0]) + Math.abs(uc-pp[1]);
      const elemBonus = (isHighLevel && getElemMult(u.elem, p.elem) > 1.1) ? -2 : 0;
      if (d + elemBonus < minScore - 1) { minScore = d; tgt = pp; }
    });
    const rch = getReach(ur, uc, u.spd);
    if (rch.length && tgt) {
      let best = null, bd = Infinity;
      rch.forEach(([mr,mc]) => { const d=Math.abs(mr-tgt[0])+Math.abs(mc-tgt[1]); if(d<bd){bd=d;best=[mr,mc];} });
      if (best) {
        const size = u.size || 1;
        // Clear old
        for (let dr = 0; dr < size; dr++) {
          for (let dc = 0; dc < size; dc++) {
            if (G.grid[ur + dr]?.[uc + dc] === u.id) G.grid[ur + dr][uc + dc] = null;
          }
        }
        // Set new
        for (let dr = 0; dr < size; dr++) {
          for (let dc = 0; dc < size; dc++) {
            G.grid[best[0] + dr][best[1] + dc] = u.id;
          }
        }
        u.moved = true; ur = best[0]; uc = best[1];
        checkCapture(ur, uc, u.id); checkSpecialTile(ur, uc, u.id);
        addLog(`${u.e} di chuyển (${ur},${uc})`, 'lm');
      }
    }
    // Step 4: Attack after move
    if (!u.attacked) {
      const adj2 = getAtkbl(ur, uc, 'enemy');
      if (adj2.length) {
        const best2 = isHighLevel ? selectBestTarget(u, adj2) : adj2[0];
        if (best2) {
          const tid = G.grid[best2[0]]?.[best2[1]];
          if (tid && G.units[tid]) { doAttack(u, G.units[tid], best2[0], best2[1], false); u.attacked = true; }
        }
      }
    }
  }
  checkGameOver();
}

function finishEnemy() {
  const aiBar = document.getElementById('ai-bar');
  if (aiBar) aiBar.style.display = 'none';
  if (G.gameOver) return;
  Object.values(G.units).filter(u => u.o === 'enemy').forEach(u => {
    u.moved = false; u.attacked = false; u.usedSkill = false;
    u.status = u.status.filter(s => s.type !== 'speedup');
  });
  G.turn = 'player'; G.round++;
  // V6.0: Weather update every 3 rounds
  if (G.round % 3 === 0) {
    const weathers = ['CLEAR', 'RAIN', 'FOG'];
    G.weather = weathers[Math.floor(Math.random() * weathers.length)];
    addLog(`🌤 Thời tiết chuyển sang: ${G.weather}`, 'lc');
    import('../ui/UIHelpers.js').then(m => m.toast(`🌤 Thời tiết: ${G.weather}`));
  }
  procTileStatuses();
  addLogSep('player', G.round);
  render();
}

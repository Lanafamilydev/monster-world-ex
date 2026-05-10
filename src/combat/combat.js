// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Combat Module (self-contained, no dynamic import loops)
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P, savePlayer, persistMonsterLevel } from '../core/playerState.js';
import { SKILLS, TERRAIN, STATUS, EVOLUTIONS, ELEM_ICONS, ELEM_COLORS, getElemMult } from '../core/data.js';
import { toast, addLog, floatTxt, shakeBoard } from '../ui/UIHelpers.js';
import { findU, getAdj, getReach, getAtkbl, getSkTgts } from './movement.js';

export { findU, getAdj, getReach, getAtkbl, getSkTgts };

// ── Status helpers ────────────────────────────────────────────

export function applyStatus(u, type) {
  if (!STATUS[type]) return;
  const ex = u.status.find(s => s.type === type);
  if (ex) { ex.turns = STATUS[type].dur; return; }
  u.status.push({ type, turns: STATUS[type].dur });
  addLog(`${u.e} bị ${STATUS[type].icon} ${type}!`, 'lsk');
}

export function procStatus(own) {
  Object.values(G.units).filter(u => u.o === own && u.alive).forEach(u => {
    const pos = findU(u.id);
    u.status = u.status.filter(s => {
      if (s.type === 'poison') {
        const d = 2; u.curHp -= d;
        addLog(`${u.e} độc −${d}HP`, 'la');
        if (pos) floatTxt(pos[0], pos[1], `-${d}`, '#88ff44');
      }
      if (s.type === 'burn') {
        const d = 3; u.curHp -= d;
        if (u.def > 1) u.def = Math.max(1, u.def - 1);
        addLog(`${u.e} 🔥bỏng −${d}HP`, 'la');
        if (pos) floatTxt(pos[0], pos[1], `🔥-${d}`, '#ff8800');
      }
      if (s.type === 'regen') {
        const h = 3; u.curHp = Math.min(u.hp, u.curHp + h);
        addLog(`${u.e} hồi +${h}HP`, 'lm');
        if (pos) floatTxt(pos[0], pos[1], `+${h}`, '#44ff88');
      }
      if (u.curHp <= 0 && u.alive) {
        u.curHp = 0; u.alive = false;
        if (pos) G.grid[pos[0]][pos[1]] = null;
        addLog(`💥 ${u.e} chết vì trạng thái!`, 'ld');
        if (u.o === 'enemy') G.killed.p++; else G.killed.e++;
      }
      s.turns--;
      return s.turns > 0;
    });
    // Terrain heal
    if (pos && u.alive) {
      const terrainHeal = TERRAIN[G.activeMap[pos[0]]?.[pos[1]]]?.heal || 0;
      if (terrainHeal > 0) u.curHp = Math.min(u.hp, u.curHp + terrainHeal);
    }
  });
}

// ── Level up ─────────────────────────────────────────────────

export function checkLevelUp(u) {
  if (u.o !== 'player' || u.lv >= 20) return;
  const need = u.lv * 30;
  if (u.xp < need) return;
  u.lv++; u.xp -= need;
  u.hp += 3; u.atk += 1; u.def += 1;
  u.curHp = Math.min(u.hp, u.curHp + 5);
  u.curMp = Math.min(u.mp, u.curMp + 3);
  if (u.lv >= 10 && EVOLUTIONS[u.id] && !u.evolved) u.evoReady = true;
  persistMonsterLevel(u);
  savePlayer();
  const evoMsg = (u.evoReady && !u.evolved) ? ' ✨ EVO sẵn sàng!' : '';
  addLog(`⬆ ${u.e} LV${u.lv}!${evoMsg}`, 'lev');
  const hasStone = (P.inventory.evo_stone || 0) > 0;
  if (u.evoReady && !u.evolved)
    toast(`⬆✨ ${u.n} LV${u.lv}! ${hasStone ? 'Bấm [✨ EVO]!' : 'Cần 💎 Đá Tiến Hóa!'}`);
  else
    toast(`⬆ ${u.n} LV${u.lv}!`);
}

// ── Core attack ───────────────────────────────────────────────

export function doAttack(atker, defer, tr, tc, isSk = false, overDmg = null, skillElem = null) {
  if (!defer.alive) return 0;

  const pos   = findU(defer.id);
  const t     = pos ? (G.activeMap[pos[0]]?.[pos[1]] || 'plains') : 'plains';
  const td    = TERRAIN[t] || TERRAIN.plains;
  const shld  = defer.status.some(s => s.type === 'shield');
  const bsk   = atker.status.some(s => s.type === 'berserk');

  const atkElem  = skillElem || atker.elem || 'neutral';
  const defElem  = defer.elem || 'neutral';
  const elemMult = getElemMult(atkElem, defElem);
  const isStrong = elemMult > 1.1;
  const isWeak   = elemMult < 0.9;

  // V5.1 shrine boost
  const atkPos   = findU(atker.id);
  const atkTile  = atkPos ? G.activeMap[atkPos[0]]?.[atkPos[1]] : null;
  const SHRINE_MAP = { fire_shrine:'fire', water_shrine:'water', dark_shrine:'dark' };
  const shrineBoost = (atkTile && SHRINE_MAP[atkTile] === atkElem) ? 1.25 : 1.0;

  const eAtk = Math.floor(atker.atk * (bsk ? 1.5 : 1) * shrineBoost);
  const eDef = defer.def + td.def + (shld ? 5 : 0);
  let dmg = overDmg !== null
    ? overDmg
    : Math.max(1, eAtk - eDef + Math.floor(Math.random() * 5) - 2);

  dmg = Math.floor(dmg * elemMult);

  // Flanking
  let flank = false;
  if (pos) {
    const fk = getAdj(pos[0], pos[1], 1).some(([a,b]) => {
      const aid = G.grid[a]?.[b];
      return aid && G.units[aid]?.o === atker.o && aid !== atker.id;
    });
    if (fk) { dmg = Math.floor(dmg * 1.25); flank = true; }
  }

  let crit = false;
  if (Math.random() < 0.15) { dmg = Math.floor(dmg * 2); crit = true; }
  dmg = Math.max(1, dmg);

  defer.curHp -= dmg;
  if (atker.o === 'player') { atker.xp = (atker.xp || 0) + 10; checkLevelUp(atker); }

  // Drain
  if (isSk && atker.sk?.includes('drain')) {
    const h = Math.floor(dmg * 0.4);
    atker.curHp = Math.min(atker.hp, atker.curHp + h);
    const ap2 = findU(atker.id);
    if (ap2) floatTxt(ap2[0], ap2[1], '+' + h, '#44ff88');
  }

  // Combo
  G.combo = Math.min(G.combo + 1, G.comboMax * 2);
  clearTimeout(G.comboTimer);
  G.comboTimer = setTimeout(() => { G.combo = Math.max(1, G.combo - 1); }, 5000);
  if (G.combo >= G.comboMax && !G.ultiReady) {
    G.ultiReady = true;
    toast('★ TUYỆT CHIÊU SẴN SÀNG!');
    addLog('★ COMBO×8! TUYỆT CHIÊU SẴN SÀNG!', 'lu');
  }

  G.score += dmg * Math.min(G.combo, G.comboMax) * (crit ? 2 : 1);

  const fClr = isStrong ? '#ffdd00' : isWeak ? '#8888ff' : '#ff4444';
  floatTxt(tr, tc, crit ? `CRIT!-${dmg}` : isStrong ? `★-${dmg}` : isWeak ? `▽-${dmg}` : `-${dmg}`, fClr);

  if (crit)          addLog(`${atker.e} CRITICAL! ${defer.e} −${dmg}HP`, 'lcr');
  else if (isStrong) addLog(`${ELEM_ICONS[atkElem]||''}KHẮC CHẾ! ${atker.e}→${defer.e} −${dmg}HP`, 'lelem');
  else if (flank)    addLog(`${atker.e} flanking→${defer.e} −${dmg}HP`, 'la');
  else               addLog(`${atker.e}→${defer.e} −${dmg}HP`, 'la');

  // Counter-attack
  if (!isSk && defer.alive && defer.curHp > 0 && pos) {
    const ap = findU(atker.id);
    if (ap && Math.abs(pos[0]-ap[0])+Math.abs(pos[1]-ap[1]) <= 1 && Math.random() < 0.4) {
      const cd = Math.max(1, Math.floor(defer.atk * 0.5) - atker.def);
      atker.curHp -= cd;
      addLog(`↩ ${defer.e} phản đòn −${cd}HP`, 'la');
      floatTxt(ap[0], ap[1], `-${cd}`, '#ff8844');
      if (atker.curHp <= 0) {
        atker.curHp = 0; atker.alive = false;
        G.grid[ap[0]][ap[1]] = null;
        addLog(`💥 ${atker.e} bị tiêu diệt!`, 'ld');
        if (atker.o === 'enemy') G.killed.p++; else G.killed.e++;
      }
    }
  }

  if (defer.curHp <= 0) {
    defer.curHp = 0; defer.alive = false;
    if (pos) G.grid[pos[0]][pos[1]] = null;
    addLog(`💥 ${defer.e} ${defer.n} bị tiêu diệt!`, 'ld');
    G.score += defer.lv * 100 * Math.min(G.combo, G.comboMax);
    if (defer.o === 'enemy') G.killed.p++; else G.killed.e++;
    checkGameOver();
  }
  return dmg;
}

// ── Skill attack ──────────────────────────────────────────────

export function doSkillAtk(atker, defer, dr, dc, sk) {
  const bd = Math.floor(atker.atk * sk.pw);
  doAttack(atker, defer, dr, dc, true, bd, sk.elem || atker.elem || 'neutral');
  if (sk.fx && defer.alive) applyStatus(defer, sk.fx);
}

// ── Execute skill ─────────────────────────────────────────────

export function execSkill(fromPos, toPos, sid) {
  const [fr, fc] = fromPos;
  const [tr, tc] = toPos;
  const uid = G.grid[fr][fc];
  const u   = G.units[uid];
  const sk  = SKILLS[sid];
  if (!u || !sk) return;

  if (sk.ulti) {
    _doUltiSkill(u, fr, fc, sk);
    G.ultiReady = false; G.combo = 1;
  } else {
    u.curMp -= sk.mp;
  }
  u.usedSkill = true;

  if (sk.t === 'attack') {
    if (sk.aoe) {
      getAdj(tr, tc, 1).concat([[tr, tc]]).forEach(([ar, ac]) => {
        const tid = G.grid[ar]?.[ac];
        if (tid && G.units[tid]?.alive && G.units[tid].o !== u.o) doSkillAtk(u, G.units[tid], ar, ac, sk);
      });
    } else {
      const tid = G.grid[tr]?.[tc];
      if (tid && G.units[tid]?.alive) doSkillAtk(u, G.units[tid], tr, tc, sk);
    }
  } else if (sk.t === 'heal') {
    const tid = G.grid[tr]?.[tc];
    const tgt = tid ? G.units[tid] : u;
    const h   = Math.min(sk.pw, tgt.hp - tgt.curHp);
    tgt.curHp += h;
    if (sk.fx) applyStatus(tgt, sk.fx);
    addLog(`${u.e} ${sk.i} chữa +${h}HP`, 'lsk');
    floatTxt(tr, tc, '+' + h, '#44ff88');
  } else if (sk.t === 'buff') {
    if (sk.aoe) {
      getAdj(fr, fc, 2).concat([[fr, fc]]).forEach(([ar, ac]) => {
        const tid = G.grid[ar]?.[ac];
        if (tid && G.units[tid]?.o === u.o) applyStatus(G.units[tid], sk.fx);
      });
      addLog(`${u.e} ${sk.i} ${sk.n} toàn đội!`, 'lsk');
    } else {
      applyStatus(u, sk.fx);
      addLog(`${u.e} ${sk.i} ${sk.n}!`, 'lsk');
    }
  } else if (sk.t === 'move') {
    G.grid[tr][tc] = uid; G.grid[fr][fc] = null;
    u.moved = true; G.sel = [tr, tc];
    checkCapture(tr, tc, uid);
    checkSpecialTile(tr, tc, uid);
    addLog(`${u.e} dịch chuyển đến (${tr},${tc})`, 'lsk');
  }

  G.activeSk = null; G.phase = 'sel'; G.skTgts = [];
  const np = findU(uid);
  if (np) {
    G.reach = !u.moved    ? getReach(np[0], np[1], u.spd) : [];
    G.atkbl = !u.attacked ? getAtkbl(np[0], np[1], u.o)   : [];
  }
  checkGameOver();
}

// ── Ultimate ──────────────────────────────────────────────────

function _doUltiSkill(u, fr, fc, sk) {
  const ov = document.getElementById('ulti-overlay');
  const tt = document.getElementById('ulti-title');
  const sb = document.getElementById('ulti-sub');
  if (ov && tt) {
    tt.textContent = `${u.e} ${sk.n}`; if (sb) sb.textContent = sk.d;
    ov.classList.add('show'); setTimeout(() => ov.classList.remove('show'), 1800);
  }
  _spawnParticles();
  Object.values(G.units).filter(e => e.o === 'enemy' && e.alive).forEach(tgt => {
    const pos = findU(tgt.id); if (!pos) return;
    const bd = Math.floor(u.atk * sk.pw);
    doAttack(u, tgt, pos[0], pos[1], true, bd, sk.elem || u.elem || 'dark');
    if (sk.fx && tgt.alive) applyStatus(tgt, sk.fx);
  });
  addLog(`★ ${u.e} ${sk.n}! TUYỆT CHIÊU!`, 'lu');
}

function _spawnParticles() {
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div'); p.className = 'particle';
    const sz = 4 + Math.random() * 8;
    const ang = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 200;
    p.style.cssText = `width:${sz}px;height:${sz}px;background:hsl(${Math.random()*60+280},100%,70%);`
      + `left:${window.innerWidth/2}px;top:${window.innerHeight/2}px;`
      + `--dx:${Math.cos(ang)*dist}px;--dy:${Math.sin(ang)*dist}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}

// ── Capture + Special tiles ───────────────────────────────────

export function checkCapture(r, c, uid) {
  const k = `${r},${c}`;
  if (G.captures[k] === undefined) return;
  const u = G.units[uid]; if (!u) return;
  const prev = G.captures[k];
  G.captures[k] = u.o;
  if (prev !== u.o) {
    addLog(`⚑ ${u.e} chiếm (${r},${c})!`, 'lc');
    G.pCap = Object.values(G.captures).filter(v => v === 'player').length;
    G.eCap = Object.values(G.captures).filter(v => v === 'enemy').length;
    G.score += 200 * Math.min(G.combo, G.comboMax);
    checkGameOver();
  }
}

export function checkSpecialTile(r, c, uid) {
  const t = G.activeMap[r]?.[c];
  const u = G.units[uid];
  if (!t || !u) return;
  if (t === 'trap') {
    const key = `trap_${r}_${c}`;
    if (!G.trapsRevealed.has(key)) { G.trapsRevealed.add(key); G.activeMap[r][c] = 'ruin'; }
    const dmg = 5; u.curHp = Math.max(0, u.curHp - dmg);
    addLog(`⚠ ${u.e} dính bẫy! −${dmg}HP`, 'la');
    floatTxt(r, c, '⚠TRAP!', '#ff4444'); shakeBoard();
    if (u.curHp <= 0) { u.curHp = 0; u.alive = false; G.grid[r][c] = null;
      addLog(`💥 ${u.e} bị bẫy tiêu diệt!`, 'ld');
      if (u.o === 'enemy') G.killed.p++; else G.killed.e++; checkGameOver(); }
  }
  if (t === 'speedup') { applyStatus(u, 'speedup'); addLog(`⚡ ${u.e} tăng tốc!`, 'lm'); floatTxt(r, c, '+SPD', '#00e5ff'); }
  if (t === 'heal_spring') { const h=4; u.curHp=Math.min(u.hp,u.curHp+h); addLog(`💧 ${u.e} +${h}HP`, 'lm'); floatTxt(r,c,`+${h}`,'#44ff88'); }
  const SHRINE_MAP = { fire_shrine:'fire', water_shrine:'water', dark_shrine:'dark' };
  if (SHRINE_MAP[t] && SHRINE_MAP[t] === u.elem) { addLog(`${u.e} 🔥Đền ${SHRINE_MAP[t]}→+25%ATK!`, 'lsk'); floatTxt(r,c,'▲ATK','#ffdd00'); }
}

// ── Game over check ───────────────────────────────────────────

export function checkGameOver() {
  if (G.gameOver) return;
  const eA = Object.values(G.units).filter(u => u.o === 'enemy' && u.alive).length;
  const pA = Object.values(G.units).filter(u => u.o === 'player' && u.alive).length;
  if (G.pCap >= G.captureGoal || eA === 0) { _gameOver('player'); return; }
  if (G.eCap >= G.captureGoal || pA === 0) { _gameOver('enemy'); return; }
}

function _gameOver(winner) {
  G.gameOver = true;
  const aiBar = document.getElementById('ai-bar');
  if (aiBar) aiBar.style.display = 'none';
  document.getElementById('cancel-btn') && (document.getElementById('cancel-btn').style.display = 'none');

  Object.values(G.units).filter(u => u.o === 'player').forEach(u => {
    persistMonsterLevel(u);
    P.fatigue[u.id] = Math.min(100, (P.fatigue[u.id] || 0) + 15);
  });

  const goldEarned = G.killed.p * 20 + G.pCap * 50 + (winner === 'player' ? 100 : 20);
  P.gold       += goldEarned;
  P.totalScore += G.score;
  P.battles++;
  if (winner === 'player') P.wins++; else P.losses++;
  savePlayer();

  // Import header update lazily
  import('../core/playerState.js').then(m => m.updateGlobalHeader());
  // Notify SessionManager
  import('../systems/SessionManager.js').then(m => m.handleSessionEnd(winner));

  const ov    = document.getElementById('go-overlay');
  const title = document.getElementById('go-title');
  const sub   = document.getElementById('go-sub');
  const stats = document.getElementById('go-stats');
  const rew   = document.getElementById('go-reward');
  if (!ov) return;

  const modeLabel = { campaign:'Campaign', endless:'Endless', arena:'Arena' }[G.mode] || '';
  if (winner === 'player') { title.textContent = '⚡ CHIẾN THẮNG!'; title.style.color = 'var(--gold)'; }
  else                     { title.textContent = '💀 THẤT BẠI';     title.style.color = 'var(--red)'; }
  sub.textContent = winner === 'player'
    ? `Yugi chinh phục ${modeLabel} Tầng ${G.floor}!`
    : `Bakura thống trị tầng ${G.floor}...`;

  const evos = Object.values(G.units).filter(u => u.evolved).map(u => u.n).join(', ') || 'Không có';
  stats.innerHTML =
    `[${modeLabel} T${G.floor}] Điểm: <b style="color:var(--gold)">${G.score}</b><br>
     Round: ${G.round} · Địch tiêu diệt: ${G.killed.p} · Quân mất: ${G.killed.e}<br>
     Pháo đài: ${G.pCap}/${G.captureGoal} · Combo: ×${G.combo}<br>
     Tiến hóa: ${evos}`;
  rew.innerHTML =
    `🏆 PHẦN THƯỞNG<br>
     💰 +${goldEarned} Vàng &nbsp;|&nbsp; ⭐ +${G.score} Điểm<br>
     <span style="font-size:9px;color:#555">Tổng Vàng: ${P.gold} · Tổng Điểm: ${P.totalScore}</span>`;
  ov.classList.add('show');
}

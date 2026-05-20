// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Input Handler
// Integrates with compact action drawer on mobile
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P } from '../core/playerState.js';
import { SKILLS, EVOLUTIONS } from '../core/data.js';
import { toast, showCancel, hideCancel } from '../ui/UIHelpers.js';
import { render, renderUnitDetail, isMobile, closeMobDrawer } from '../ui/Renderer.js';
import { findU, getReach, getAtkbl, getSkTgts } from '../combat/movement.js';
import { doAttack, execSkill, checkCapture, checkSpecialTile } from '../combat/combat.js';

// ── Helpers ───────────────────────────────────────────────────

/** Re-render skill chips in the drawer after state changes */
function _refreshDrawerSkills() {
  if (!isMobile()) return;
  const sel = G.sel;
  if (!sel) return;
  const uid = G.grid[sel[0]]?.[sel[1]];
  if (uid && G.units[uid]) renderUnitDetail(G.units[uid]);
}

// ── Main cell click handler ───────────────────────────────────

export function onCell(r, c) {
  if (G.gameOver) return;

  if (G.mode === 'pvp') {
    const pvpMod = window.PVPArena;
    if (!pvpMod) return;
    if (pvpMod.localRole === 'player1' && G.turn !== 'player') {
      toast('⏳ Lượt của đối thủ!');
      return;
    }
    if (pvpMod.localRole === 'player2' && G.turn !== 'enemy') {
      toast('⏳ Lượt của đối thủ!');
      return;
    }
  } else {
    if (G.turn !== 'player') return;
  }

  const uid = G.grid[r]?.[c];
  const u   = uid ? G.units[uid] : null;

  // ── Skill target selection ────────────────────────────────
  if (G.activeSk && G.phase === 'sk') {
    if (G.skTgts.some(([a, b]) => a === r && b === c)) {
      const fromSel = G.sel;
      const actSk = G.activeSk;
      execSkill(fromSel, [r, c], actSk);
      
      if (G.mode === 'pvp') {
        window.PVPArena?.broadcastAction({
          type: 'SKILL',
          from: fromSel,
          to: [r, c],
          skillId: actSk
        });
      }
      
      // Skill fired → refresh drawer state (MP changed)
      _refreshDrawerSkills();
      return;
    }
    // Tapped outside targets → cancel skill phase only
    G.activeSk = null;
    G.phase    = 'sel';
    G.skTgts   = [];
    if (G.sel) {
      const selUid = G.grid[G.sel[0]]?.[G.sel[1]];
      if (selUid && G.units[selUid]) {
        const selU = G.units[selUid];
        G.reach = !selU.moved    ? getReach(G.sel[0], G.sel[1], selU.spd, selU.size || 1) : [];
        G.atkbl = !selU.attacked ? getAtkbl(G.sel[0], G.sel[1], selU.o)   : [];
        renderUnitDetail(selU);
      }
    }
    render();
    return;
  }

  // ── Move selected unit ────────────────────────────────────
  if (G.sel && G.reach.some(([a, b]) => a === r && b === c)) {
    const [sr, sc] = G.sel;
    const mid = G.grid[sr][sc];
    const mu  = G.units[mid];
    if (mu && !mu.moved) {
      const size = mu.size || 1;
      // Clear old cells
      for (let dr = 0; dr < size; dr++) {
        for (let dc = 0; dc < size; dc++) {
          if (G.grid[sr + dr]?.[sc + dc] === mid) G.grid[sr + dr][sc + dc] = null;
        }
      }
      // Fill new cells
      for (let dr = 0; dr < size; dr++) {
        for (let dc = 0; dc < size; dc++) {
          G.grid[r + dr][c + dc] = mid;
        }
      }
      mu.moved = true;
      G.sel    = [r, c];
      G.reach  = [];
      G.atkbl  = !mu.attacked ? getAtkbl(r, c, mu.o) : [];
      G.skTgts = [];
      import('../ui/UIHelpers.js').then(m => m.addLog(`${mu.e} ${mu.n} di chuyển`, 'lm'));
      checkCapture(r, c, mid);
      checkSpecialTile(r, c, mid);

      if (G.mode === 'pvp') {
        window.PVPArena?.broadcastAction({
          type: 'MOVE',
          from: [sr, sc],
          to: [r, c]
        });
      }

      if (mu.alive) renderUnitDetail(mu);  // updates drawer state badge
      render();
      showCancel();
    }
    return;
  }

  // ── Attack ───────────────────────────────────────────────
  // V6.1: Resolve multi-cell boss attacks — clicking any boss cell works
  let atkR = r, atkC = c;
  let isAtkblHit = G.sel && G.atkbl.some(([a, b]) => a === r && b === c);

  // If clicked cell has a multi-cell enemy but isn't directly in atkbl,
  // find an atkbl cell that belongs to this same enemy
  if (!isAtkblHit && G.sel && uid && u && u.alive && u.o !== (G.mode === 'pvp' ? (window.PVPArena?.localRole === 'player1' ? 'player' : 'enemy') : 'player')) {
    const bossSize = u.size || 1;
    if (bossSize > 1) {
      for (const [ar, ac] of G.atkbl) {
        if (G.grid[ar]?.[ac] === uid) {
          atkR = ar; atkC = ac;
          isAtkblHit = true;
          break;
        }
      }
    }
  }

  if (isAtkblHit) {
    const [sr, sc] = G.sel;
    const aid   = G.grid[sr][sc];
    const atker = G.units[aid];
    const did   = G.grid[atkR][atkC];
    const defer = G.units[did];
    if (atker && defer && !atker.attacked && defer.o !== atker.o) {
      doAttack(atker, defer, atkR, atkC, false);
      atker.attacked = true;

      if (G.mode === 'pvp') {
        window.PVPArena?.broadcastAction({
          type: 'ATTACK',
          from: [sr, sc],
          to: [atkR, atkC]
        });
      }

      G.reach = []; G.atkbl = []; G.skTgts = [];
      // Refresh drawer to show "done" state
      if (isMobile() && G.units[aid]) renderUnitDetail(G.units[aid]);
      render();
      hideCancel();
    }
    return;
  }

  const isLocalUnit = G.mode === 'pvp'
    ? (window.PVPArena?.localRole === 'player1' ? u?.o === 'player' : u?.o === 'enemy')
    : u?.o === 'player';

  const isEnemyUnit = G.mode === 'pvp'
    ? (window.PVPArena?.localRole === 'player1' ? u?.o === 'enemy' : u?.o === 'player')
    : u?.o === 'enemy';

  // ── Select local player unit ──────────────────────────────
  if (u && u.alive && isLocalUnit) {
    G.activeSk = null;
    G.sel      = [r, c];
    G.phase    = 'sel';
    G.reach    = !u.moved    ? getReach(r, c, u.spd, u.size || 1) : [];
    G.atkbl    = !u.attacked ? getAtkbl(r, c, u.o)   : [];
    G.skTgts   = [];
    renderUnitDetail(u);   // opens drawer on mobile
    render();
    showCancel();
    if (u.o === 'player' && u.evoReady && !u.evolved && (P.inventory.evo_stone || 0) > 0) {
      toast(`✨ ${u.n} sẵn sàng tiến hóa! Bấm [EVO] trong drawer.`);
    }
    return;
  }

  // ── Tap enemy: show info in drawer (read-only) ────────────
  if (u && u.alive && isEnemyUnit) {
    G.sel = null; G.reach = []; G.atkbl = []; G.skTgts = [];
    renderUnitDetail(u);   // shows enemy stats in drawer
    render();
    hideCancel();
    return;
  }

  // ── Tap empty cell: deselect ──────────────────────────────
  cancelSel();
}

// ── Cancel selection ──────────────────────────────────────────
function cancelSel() {
  G.sel = null; G.reach = []; G.atkbl = []; G.skTgts = [];
  G.activeSk = null; G.phase = 'sel';
  renderUnitDetail(null);   // null → closes drawer
  render();
  hideCancel();
}

export function cancelAct() { cancelSel(); }

// ── Skill picker (from drawer chips or desktop skill buttons) ─
export function pickSkill(uid, sid) {
  if (G.gameOver) return;
  if (G.mode === 'pvp') {
    const pvpMod = window.PVPArena;
    if (pvpMod?.localRole === 'player1' && G.turn !== 'player') return;
    if (pvpMod?.localRole === 'player2' && G.turn !== 'enemy') return;
  } else {
    if (G.turn !== 'player') return;
  }
  const u  = G.units[uid];
  const sk = SKILLS[sid];
  if (!u?.alive || u.usedSkill) { toast('Không thể dùng kỹ năng!'); return; }
  if (!sk.ulti && u.curMp < sk.mp) { toast(`Không đủ MP! (cần ${sk.mp})`); return; }
  if (sk.ulti && !G.ultiReady)     { toast('Combo chưa đủ ×8!'); return; }

  const pos = findU(uid);
  if (!pos) return;

  // Auto-select unit
  if (!G.sel || G.grid[G.sel[0]]?.[G.sel[1]] !== uid) {
    G.sel   = pos;
    G.reach = !u.moved ? getReach(pos[0], pos[1], u.spd, u.size || 1) : [];
    G.atkbl = [];
  }
  G.activeSk = sid;
  G.phase    = 'sk';
  G.skTgts   = getSkTgts(pos[0], pos[1], sid, u.o);
  render();
  renderUnitDetail(u);  // refresh drawer: highlight active chip
  toast(`${sk.i} ${sk.n} — Chọn mục tiêu trên bản đồ`);
  showCancel();
}

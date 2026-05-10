// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Evolution System
// Supports TWO modes:
//   • In-battle: modifies live G.units unit immediately
//   • From Roster: saves choice to P.monsterLevels; applied next battle
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P, savePlayer, persistMonsterLevel } from '../core/playerState.js';
import { EVOLUTIONS, SKILLS, ELEM_ICONS, ELEM_COLORS, UDEFS, GACHA_POOL } from '../core/data.js';
import { toast, addLog } from '../ui/UIHelpers.js';
import { render, renderUnitDetail } from '../ui/Renderer.js';
import { findU } from '../combat/movement.js';

// ── Shared: build branch cards into #evo-branches ─────────────

function _buildBranchCards(uid, branches, onChoose) {
  const wrap = document.getElementById('evo-branches');
  if (!wrap) return;
  wrap.innerHTML = '';

  branches.forEach(path => {
    const sk     = SKILLS[path.newSkill];
    const eClr   = path.elem ? (ELEM_COLORS[path.elem] || '#888') : '#888';
    const eIcon  = path.elem ? (ELEM_ICONS[path.elem]  || '')     : '';

    const card = document.createElement('div');
    card.className = 'evo-branch-card';
    card.innerHTML = `
      <div class="ebc-label" style="color:${eClr}">${path.label}</div>
      <div class="ebc-emoji">${path.e}</div>
      <div class="ebc-name">${path.n}</div>
      <div class="ebc-desc">${path.desc}</div>
      <div class="ebc-stats">
        <div class="ebs"><span class="ebs-l">HP</span><span class="ebs-v">+${path.hp}</span></div>
        <div class="ebs"><span class="ebs-l">ATK</span><span class="ebs-v">+${path.atk}</span></div>
        <div class="ebs"><span class="ebs-l">DEF</span><span class="ebs-v">+${path.def}</span></div>
        ${path.mp  ? `<div class="ebs"><span class="ebs-l">MP</span><span class="ebs-v">+${path.mp}</span></div>`  : ''}
        ${path.spd ? `<div class="ebs"><span class="ebs-l">SPD</span><span class="ebs-v">+${path.spd}</span></div>` : ''}
        <div class="ebs"><span class="ebs-l">Nguyên tố</span>
          <span class="ebs-v" style="color:${eClr}">${eIcon} ${path.elem}</span></div>
      </div>
      ${sk ? `<div class="ebc-skill">🆕 Kỹ năng mới: ${sk.i} ${sk.n}</div>` : ''}
      <button class="ebc-btn">✨ Chọn hướng này</button>`;

    card.querySelector('button').addEventListener('click', () => onChoose(path));
    wrap.appendChild(card);
  });
}

// ─────────────────────────────────────────────────────────────
// MODE A — IN-BATTLE EVOLUTION (modifies live G.units unit)
// ─────────────────────────────────────────────────────────────

/** Show evo modal for a unit currently in battle (called from battle UI) */
export function showEvoModal(uid) {
  const branches = EVOLUTIONS[uid];
  if (!branches?.length) return;

  const modal = document.getElementById('evo-modal');
  const hdr   = document.getElementById('evo-modal-title');
  if (!modal) return;

  const u = G.units[uid];
  if (!u)         { toast('Quái không có trong trận!'); return; }
  if (u.evolved)  { toast('Quái đã tiến hóa rồi!');    return; }
  if (!u.evoReady){ toast('Quái chưa đạt LV10!');       return; }
  if ((P.inventory.evo_stone || 0) <= 0) { toast('Cần 1 💎 Đá Tiến Hóa!'); return; }

  if (hdr) hdr.textContent = `✨ TIẾN HÓA (Trận) — ${u.e} ${u.n} LV${u.lv}`;

  _buildBranchCards(uid, branches, (path) => {
    _applyEvoInBattle(uid, path);
    modal.classList.remove('show');
  });

  modal.classList.add('show');
}

function _applyEvoInBattle(uid, path) {
  const u = G.units[uid];
  if (!u || u.evolved) return;
  if ((P.inventory.evo_stone || 0) <= 0) { toast('Cần 1 💎 Đá Tiến Hóa!'); return; }

  P.inventory.evo_stone--;

  // Apply stats to live unit
  u.n    = path.n;  u.e = path.e;  u.elem = path.elem || u.elem;
  u.hp  += path.hp;  u.curHp = Math.min(u.curHp + path.hp, u.hp);
  u.atk += path.atk; u.def  += path.def;
  if (path.mp)  { u.mp += path.mp;   u.curMp = Math.min(u.curMp + path.mp, u.mp); }
  if (path.spd) { u.spd = Math.max(1, u.spd + path.spd); }
  if (path.newSkill && !u.sk.includes(path.newSkill)) u.sk.push(path.newSkill);
  u.evolved = true;  u.evoReady = false;  u.evoPathId = path.pathId;

  // Persist
  persistMonsterLevel(u);
  const ml = P.monsterLevels[uid];
  if (ml) { ml.evolved = true; ml.evoPathId = path.pathId; }
  savePlayer();

  _flashEvo(path);
  addLog(`✨ ${u.e} ${u.n} TIẾN HÓA theo hướng ${path.label}!`, 'lev');
  toast(`✨ TIẾN HÓA! ${u.e} ${u.n} — ${path.desc}`);
  renderUnitDetail(u);
  render();
}

// ─────────────────────────────────────────────────────────────
// MODE B — ROSTER EVOLUTION (no live battle unit needed)
// Saves choice to P.monsterLevels; SessionManager applies it
// when the monster next enters battle via initBattle()
// ─────────────────────────────────────────────────────────────

/** Show evo modal from the Roster/Storage tab — works outside battle */
export function showEvoModalForRoster(uid) {
  const branches = EVOLUTIONS[uid];
  if (!branches?.length) return;

  const modal = document.getElementById('evo-modal');
  const hdr   = document.getElementById('evo-modal-title');
  if (!modal) return;

  // Eligibility from P.monsterLevels (persisted progress)
  const ml  = P.monsterLevels?.[uid];
  const lv  = ml?.lv || _getBaseLv(uid);

  if (ml?.evolved) { toast('Quái đã tiến hóa rồi! ★'); return; }
  if (lv < 10)     { toast(`Cần LV10 để tiến hóa! (LV${lv}/10)`); return; }
  if ((P.inventory.evo_stone || 0) <= 0) { toast('Cần 1 💎 Đá Tiến Hóa!'); return; }

  const def = UDEFS[uid] || GACHA_POOL.find(m => m.id === uid);
  const emoji = def?.e || '?';
  const name  = def?.n || uid;

  if (hdr) hdr.textContent = `✨ TIẾN HÓA (Kho) — ${emoji} ${name} LV${lv}`;

  // Add roster-mode sub-label
  const subEl = modal.querySelector('.evo-roster-note');
  if (!subEl) {
    const note = document.createElement('div');
    note.className = 'evo-roster-note';
    note.textContent = '⚡ Hiệu lực từ trận đấu tiếp theo';
    note.style.cssText = 'font-size:10px;color:var(--cyan);letter-spacing:1px;text-align:center;margin-bottom:6px';
    modal.insertBefore(note, modal.querySelector('.evo-branches') || modal.firstChild.nextSibling);
  }

  _buildBranchCards(uid, branches, (path) => {
    _applyEvoFromRoster(uid, path);
    modal.classList.remove('show');
    // Clean up roster note
    modal.querySelector('.evo-roster-note')?.remove();
  });

  modal.classList.add('show');
}

function _applyEvoFromRoster(uid, path) {
  if ((P.inventory.evo_stone || 0) <= 0) { toast('Cần 1 💎 Đá Tiến Hóa!'); return; }

  P.inventory.evo_stone--;

  if (!P.monsterLevels)     P.monsterLevels     = {};
  if (!P.monsterLevels[uid]) P.monsterLevels[uid] = {
    lv: _getBaseLv(uid), xp: 0, evolved: false, evoPathId: null
  };

  P.monsterLevels[uid].evolved   = true;
  P.monsterLevels[uid].evoPathId = path.pathId;
  savePlayer();

  _flashEvo(path);
  toast(`✨ ${path.e} ${path.n} — ${path.desc}\n⚡ Áp dụng từ trận tiếp theo!`);

  // Re-render roster so EVO state updates immediately
  import('./Roster.js').then(m => m.renderRosterTab());
}

// ── Shared helpers ────────────────────────────────────────────

function _flashEvo(path) {
  const ov = document.getElementById('ulti-overlay');
  const tt = document.getElementById('ulti-title');
  const sb = document.getElementById('ulti-sub');
  if (ov && tt) {
    tt.textContent = `${path.e} ${path.n}`;
    if (sb) sb.textContent = path.desc;
    ov.classList.add('show');
    setTimeout(() => ov.classList.remove('show'), 2000);
  }
}

function _getBaseLv(uid) {
  const ud = UDEFS[uid];
  if (ud) return ud.lv || 1;
  const gm = GACHA_POOL.find(m => m.id === uid);
  return gm ? 1 : 1;
}

export function closeEvoModal() {
  const modal = document.getElementById('evo-modal');
  if (modal) modal.classList.remove('show');
  modal?.querySelector('.evo-roster-note')?.remove();
}

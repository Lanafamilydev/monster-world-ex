// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Roster & Storage System
// Roster cards now include EVO buttons (roster-mode evolution)
// ═══════════════════════════════════════════════════════════════

import { P, savePlayer, addToRoster, removeFromRoster } from '../core/playerState.js';
import { UDEFS, GACHA_POOL, RARITY_CLR, EVOLUTIONS, getAllMonsters, ELEM_ICONS, ELEM_COLORS } from '../core/data.js';
import { toast } from '../ui/UIHelpers.js';

export function renderRosterTab() {
  renderRosterDisplay();
  renderBenchDisplay();
  renderPokedex();
}

// ── Get full unit definition ──────────────────────────────────
function getDefById(id) {
  return UDEFS[id] || GACHA_POOL.find(m => m.id === id) || null;
}

function getMonsterInfo(id) {
  const def = getDefById(id);
  if (!def) return null;
  const ml       = P.monsterLevels?.[id];
  const lv       = ml?.lv || def.lv || 1;
  const evolved  = ml?.evolved  || false;
  const evoPathId= ml?.evoPathId|| null;
  let evoName    = null;
  if (evolved && evoPathId && EVOLUTIONS[id]) {
    const path = EVOLUTIONS[id].find(p => p.pathId === evoPathId);
    if (path) evoName = `${path.e} ${path.n}`;
  }
  return { ...def, id, lv, evolved, evoPathId, evoName };
}

// ── EVO state helper ──────────────────────────────────────────
/** Returns evo status: 'evolved' | 'ready' | 'need-stone' | 'locked' | 'none' */
function _evoStatus(id, lv, evolved) {
  if (!EVOLUTIONS[id]) return 'none';
  if (evolved)         return 'evolved';
  const stone = P.inventory.evo_stone || 0;
  if (lv >= 10 && stone > 0) return 'ready';
  if (lv >= 10)              return 'need-stone';
  return 'locked';
}

/** Build the EVO row HTML for a card */
function _evoRowHTML(id, lv, evolved, evoName) {
  const status = _evoStatus(id, lv, evolved);
  if (status === 'none')    return '';
  if (status === 'evolved') return `<div class="rc-evo-done">★ ${evoName || 'Đã tiến hóa'}</div>`;
  if (status === 'ready')   return `<button class="rc-evo-btn" data-evoid="${id}">✨ TIẾN HÓA (${EVOLUTIONS[id].length} hướng)</button>`;
  if (status === 'need-stone') return `<div class="rc-evo-info need-stone">✨ Sẵn sàng — Cần 1 💎 Đá EVO</div>`;
  // locked
  const pct = Math.round((lv / 10) * 100);
  return `<div class="rc-evo-info locked">🔒 EVO tại LV10 <span class="rc-evo-pct">${lv}/10</span></div>`;
}

// ── Roster display ────────────────────────────────────────────
function renderRosterDisplay() {
  const el = document.getElementById('roster-display');
  if (!el) return;
  el.innerHTML = '';
  const roster = P.roster || [];
  if (!roster.length) {
    el.innerHTML = '<div style="color:#555;font-size:10px;padding:8px">Đội hình trống. Thêm quái từ Kho bên dưới.</div>';
    return;
  }

  roster.forEach(id => {
    const info = getMonsterInfo(id);
    if (!info) return;
    const fat   = P.fatigue[id]  || 0;
    const aff   = P.affinity[id] || 0;
    const elem  = info.elem || 'neutral';
    const eIcon = ELEM_ICONS[elem] || '';
    const eClr  = ELEM_COLORS[elem] || '#888';
    const rClr  = RARITY_CLR[info.t || 'B'] || '#888';
    const evoRow = _evoRowHTML(id, info.lv, info.evolved, info.evoName);

    const card = document.createElement('div');
    card.className = 'roster-card' + (info.evolved ? ' evolved-card' : '');
    card.innerHTML = `
      <div class="rc-emoji">${info.e}</div>
      <div class="rc-info">
        <div class="rc-name">${info.evoName || info.n}${info.evolved ? ' ★' : ''}</div>
        <div class="rc-stats">
          <span class="rc-lv" style="color:var(--gold)">LV${info.lv}</span>
          <span style="color:${rClr}">[${info.t || 'B'}]</span>
          <span style="color:${eClr}">${eIcon}${elem}</span>
        </div>
        <div class="rc-bars">
          <div style="font-size:8px;color:${fat>80?'#ff4444':fat>50?'#ff8800':'#555'}">😴${fat}%</div>
          <div style="font-size:8px;color:${aff>=80?'#44ff88':aff>=50?'#ffdd00':'#555'}">💚${aff}%</div>
        </div>
        ${evoRow}
      </div>
      <button class="rc-remove" title="Rút khỏi đội">✕</button>`;

    // Remove from roster
    card.querySelector('.rc-remove').addEventListener('click', () => {
      removeFromRoster(id);
      renderRosterTab();
      toast(`${info.e} ${info.evoName||info.n} đã rút khỏi đội.`);
    });

    // EVO button (only rendered when status === 'ready')
    card.querySelector('.rc-evo-btn')?.addEventListener('click', () => {
      import('./Evolution.js').then(m => m.showEvoModalForRoster(id));
    });

    el.appendChild(card);
  });
}

// ── Bench display ─────────────────────────────────────────────
function renderBenchDisplay() {
  const el = document.getElementById('bench-display');
  if (!el) return;
  el.innerHTML = '';

  const roster = P.roster || [];
  const bench  = (P.collection || []).filter(id => !roster.includes(id));

  if (!bench.length) {
    el.innerHTML = '<div style="color:#555;font-size:10px;padding:8px">Không có quái trong kho.</div>';
    return;
  }

  bench.forEach(id => {
    const info   = getMonsterInfo(id);
    if (!info) return;
    const canAdd = roster.length < 5;
    const elem   = info.elem || 'neutral';
    const eIcon  = ELEM_ICONS[elem] || '';
    const eClr   = ELEM_COLORS[elem] || '#888';
    const rClr   = RARITY_CLR[info.t || 'B'] || '#888';
    const evoRow = _evoRowHTML(id, info.lv, info.evolved, info.evoName);

    const card = document.createElement('div');
    card.className = 'bench-card' + (info.evolved ? ' evolved-card' : '');
    card.innerHTML = `
      <div class="rc-emoji">${info.e}</div>
      <div class="rc-info">
        <div class="rc-name">${info.evoName || info.n}${info.evolved ? ' ★' : ''}</div>
        <div class="rc-stats">
          <span class="rc-lv" style="color:var(--gold)">LV${info.lv}</span>
          <span style="color:${rClr}">[${info.t || 'B'}]</span>
          <span style="color:${eClr}">${eIcon}${elem}</span>
        </div>
        ${evoRow}
      </div>
      <button class="rc-add${canAdd ? '' : ' disabled'}" ${canAdd ? '' : 'disabled'}
        title="${canAdd ? 'Thêm vào đội' : 'Đội đã đầy (5/5)'}">
        ${canAdd ? '+ Vào Đội' : '🔒 Đầy'}
      </button>`;

    card.querySelector('.rc-add').addEventListener('click', () => {
      if (!canAdd) { toast('Đội hình đã đầy! Rút quái trước.'); return; }
      if (addToRoster(id)) {
        renderRosterTab();
        toast(`✓ ${info.e} ${info.evoName||info.n} đã vào đội!`);
      }
    });

    card.querySelector('.rc-evo-btn')?.addEventListener('click', () => {
      import('./Evolution.js').then(m => m.showEvoModalForRoster(id));
    });

    el.appendChild(card);
  });
}

// ── Pokedex ───────────────────────────────────────────────────
export function renderPokedex() {
  const grid    = document.getElementById('pokedex-grid');
  const ownedEl = document.getElementById('pdx-owned');
  const totalEl = document.getElementById('pdx-total');
  if (!grid) return;
  const all   = getAllMonsters();
  const owned = all.filter(m => P.collection.includes(m.id));
  if (ownedEl) ownedEl.textContent = owned.length;
  if (totalEl) totalEl.textContent = all.length;
  grid.innerHTML = '';
  all.forEach(m => {
    const isOwned = P.collection.includes(m.id);
    const card    = document.createElement('div');
    card.className = 'pdx-card' + (isOwned ? ' owned' : ' unowned');
    const clr  = RARITY_CLR[m.t] || '#888';
    const eIcon= m.elem ? (ELEM_ICONS[m.elem] || '') : '';
    const eClr = m.elem ? (ELEM_COLORS[m.elem] || '#888') : '#888';
    const ml   = P.monsterLevels?.[m.id];
    card.innerHTML = `
      <div class="pdx-emoji">${isOwned ? m.e : '❓'}</div>
      <div class="pdx-name" style="color:${isOwned ? '#ccc' : '#444'}">${isOwned ? m.n : '???'}</div>
      <div>
        <span class="pdx-tier" style="color:${clr};background:${clr}22">${m.t}</span>
        ${isOwned ? `<span style="font-size:8px;color:${eClr}">${eIcon}</span>` : ''}
      </div>
      ${isOwned && ml ? `<div style="font-size:8px;color:var(--gold)">LV${ml.lv}${ml.evolved?'★':''}</div>` : ''}`;
    grid.appendChild(card);
  });
}

// ── Endless reward ────────────────────────────────────────────
export function applyEndlessReward(reward) {
  if (!reward) return;
  switch (reward.id) {
    case 'team_atk':
      (P.roster || []).forEach(id => {
        if (!P.monsterLevels[id]) P.monsterLevels[id] = { lv:1, xp:0, evolved:false, evoPathId:null };
        P.monsterLevels[id]._atkBonus = (P.monsterLevels[id]._atkBonus||0) + 2;
      });
      toast('💪 Toàn đội +2 ATK!'); break;
    case 'team_def':
      (P.roster || []).forEach(id => {
        if (!P.monsterLevels[id]) P.monsterLevels[id] = { lv:1, xp:0, evolved:false, evoPathId:null };
        P.monsterLevels[id]._defBonus = (P.monsterLevels[id]._defBonus||0) + 2;
      });
      toast('🛡 Toàn đội +2 DEF!'); break;
    case 'team_hp':
      (P.roster || []).forEach(id => {
        if (!P.monsterLevels[id]) P.monsterLevels[id] = { lv:1, xp:0, evolved:false, evoPathId:null };
        P.monsterLevels[id]._hpBonus = (P.monsterLevels[id]._hpBonus||0) + 5;
      });
      toast('💚 Toàn đội +5 HP!'); break;
    case 'evo_stone':
      P.inventory.evo_stone = (P.inventory.evo_stone||0) + 1;
      toast('💎 Nhận 1 Đá Tiến Hóa!'); break;
    case 'hp_potion_x3':
      P.inventory.hp_potion = Math.min(9,(P.inventory.hp_potion||0)+3);
      toast('❤️ Nhận 3 Bình HP!'); break;
    case 'gold_200': P.gold += 200; toast('💰 +200 Vàng!'); break;
    case 'gold_300': P.gold += 300; toast('💰 +300 Vàng!'); break;
    case 'free_gacha': P.gold += 100; toast('🎴 +100 Vàng (gacha miễn phí)'); break;
    default: toast(`✓ ${reward.label}`);
  }
  savePlayer();
  import('../core/playerState.js').then(m => m.updateGlobalHeader());
}

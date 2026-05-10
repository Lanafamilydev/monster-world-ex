// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Tab Navigation (desktop + mobile synced)
// ═══════════════════════════════════════════════════════════════

import { P, savePlayer, updateGlobalHeader } from '../core/playerState.js';
import { toast } from './UIHelpers.js';
import { renderItemShop } from '../features/Shop.js';
import { renderRosterTab } from '../features/Roster.js';

/** Switch visible tab — syncs BOTH desktop .tnb AND mobile .mnb */
export function switchTab(name) {
  // ── Panels ──────────────────────────────────────────────────
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('act'));
  document.getElementById('tab-' + name)?.classList.add('act');

  // ── Desktop tab buttons ──────────────────────────────────────
  document.querySelectorAll('.tnb').forEach(b => b.classList.remove('act'));
  document.getElementById('tn-' + name)?.classList.add('act');

  // ── Mobile bottom-nav buttons ────────────────────────────────
  document.querySelectorAll('.mnb').forEach(b => b.classList.remove('act'));
  document.getElementById('mn-' + name)?.classList.add('act');

  // ── Dismiss mobile overlays when leaving battle ──────────────
  if (name !== 'battle') {
    import('./Renderer.js').then(m => m.closeMobUd?.());
    document.getElementById('mob-log-panel')?.classList.remove('log-open');
  }

  // ── body.tab-{name} class: lets CSS scope rules per active tab
  document.body.className = document.body.className.replace(/\btab-\S+/g, '').trim();
  document.body.classList.add('tab-' + name);

  // ── Dismiss mobile overlays / drawer when leaving battle
  if (name !== 'battle') {
    import('./Renderer.js').then(m => { m.closeMobUd?.(); m.closeMobDrawer?.(); });
    document.getElementById('mob-log-panel')?.classList.remove('log-open');
  }

  // ── Body padding: only on mobile ─────────────────────────────
  // CSS handles this via media query, but JS ensures no stale
  // inline style from a previous viewport size remains.
  if (window.innerWidth >= 768) {
    document.body.style.paddingBottom = '0';
  } else {
    document.body.style.paddingBottom = '';  // let CSS media query rule apply
  }

  // ── Tab content ──────────────────────────────────────────────
  if (name === 'shop')    renderItemShop();
  if (name === 'storage') renderRosterTab();
  if (name === 'account') renderAccountTab();
  if (name === 'care')    renderCareList();
}

/* ── Account tab ─────────────────────────────────────────────── */
export function renderAccountTab() {
  const el = document.getElementById('acc-info');
  if (!el) return;
  el.innerHTML = `
    <div class="acc-row"><span class="acc-lbl">👤 Tên</span><span class="acc-val">${P.name||'Yugi'}</span></div>
    <div class="acc-row"><span class="acc-lbl">💰 Vàng</span><span class="acc-val" style="color:var(--gold)">${P.gold}</span></div>
    <div class="acc-row"><span class="acc-lbl">⭐ Tổng điểm</span><span class="acc-val" style="color:var(--purple)">${P.totalScore}</span></div>
    <div class="acc-row"><span class="acc-lbl">🏆 Thắng/Thua</span><span class="acc-val">${P.wins}/${P.losses}</span></div>
    <div class="acc-row"><span class="acc-lbl">⚔ Trận đấu</span><span class="acc-val">${P.battles}</span></div>
    <div class="acc-row"><span class="acc-lbl">📖 Campaign Tầng</span><span class="acc-val" style="color:var(--cyan)">${P.campaignFloor||1}</span></div>
    <div class="acc-row"><span class="acc-lbl">♾ Endless Max</span><span class="acc-val" style="color:var(--green)">${P.endlessFloor||0}</span></div>
    <div class="acc-row"><span class="acc-lbl">⚔ Arena Rating</span><span class="acc-val" style="color:var(--orange)">${P.arenaRating||1000}</span></div>`;
  renderInventoryDisplay();
  import('../features/LevelUp.js').then(m => m.renderLevelUpList());
}

/* ── Care tab ────────────────────────────────────────────────── */
export function renderCareList() {
  const el = document.getElementById('care-list');
  if (!el) return;
  el.innerHTML = '';
  (P.collection || []).forEach(id => {
    const fat = P.fatigue[id]  || 0;
    const aff = P.affinity[id] || 0;
    import('../core/data.js').then(({ UDEFS, GACHA_POOL }) => {
      const def = UDEFS[id] || GACHA_POOL.find(m => m.id === id);
      if (!def) return;
      const fatClr  = fat > 80 ? '#ff4444' : fat > 50 ? '#ff8800' : '#888';
      const affClr  = aff >= 80 ? '#44ff88' : aff >= 50 ? '#ffdd00' : '#888';
      const fatDesc = fat > 80 ? '😫 Kiệt sức' : fat > 50 ? '😓 Mệt mỏi' : '😊 Khỏe mạnh';
      const card = document.createElement('div');
      card.className = 'care-card';
      card.innerHTML = `
        <div class="care-header">
          <span class="care-emoji">${def.e}</span>
          <span class="care-name">${def.n}</span>
        </div>
        <div class="care-bars">
          <div class="care-bar-row">
            <span style="color:${fatClr};width:36px">😴 Mệt</span>
            <div class="care-bar-bg"><div class="care-bar-fill" style="width:${fat}%;background:${fatClr}"></div></div>
            <span style="color:${fatClr};width:28px;text-align:right">${fat}%</span>
          </div>
          <div class="care-bar-row">
            <span style="color:${affClr};width:36px">💚 Thân</span>
            <div class="care-bar-bg"><div class="care-bar-fill" style="width:${aff}%;background:${affClr}"></div></div>
            <span style="color:${affClr};width:28px;text-align:right">${aff}%</span>
          </div>
        </div>
        <div style="font-size:8px;color:#555;margin-bottom:6px">
          ${fatDesc} · ${aff>=80?'+7% ATK/DEF':aff>=50?'+3% ATK/DEF':'Không có bonus'}
        </div>
        <div class="care-btns">
          <button class="cbtn${fat===0?' disabled':''}" data-rest="${id}" ${fat===0?'disabled':''}>😴 Nghỉ ngơi</button>
          <button class="cbtn${(P.inventory.food_basic||0)===0?' disabled':''}" data-feed="${id}" ${(P.inventory.food_basic||0)===0?'disabled':''}>🍖 Cho ăn</button>
        </div>`;
      card.querySelector('[data-rest]')?.addEventListener('click', () => _restMonster(id));
      card.querySelector('[data-feed]')?.addEventListener('click', () => _feedMonster(id));
      el.appendChild(card);
    });
  });
}

function _restMonster(id) {
  const fat = P.fatigue[id] || 0;
  if (fat === 0) { toast('Quái đang rất khỏe!'); return; }
  const reduced = Math.min(50, fat);
  P.fatigue[id] = Math.max(0, fat - 50);
  savePlayer(); renderCareList();
  import('../core/data.js').then(({ UDEFS, GACHA_POOL }) => {
    const def = UDEFS[id] || GACHA_POOL.find(m => m.id === id);
    toast(`😴 ${def?.e||''} nghỉ ngơi! −${reduced} Mệt`);
  });
}

function _feedMonster(id) {
  if ((P.inventory.food_basic || 0) <= 0) { toast('Không có thức ăn! Mua tại Shop.'); return; }
  const aff = P.affinity[id] || 0;
  if (aff >= 100) { toast('Thân thiện đã tối đa!'); return; }
  P.inventory.food_basic--;
  P.affinity[id] = Math.min(100, aff + 10);
  savePlayer(); renderCareList(); renderItemShop();
  const newAff = P.affinity[id];
  import('../core/data.js').then(({ UDEFS, GACHA_POOL }) => {
    const def = UDEFS[id] || GACHA_POOL.find(m => m.id === id);
    let msg = `🍖 ${def?.e||''} ${def?.n||''} +10 Thân thiện (${newAff}%)`;
    if (newAff >= 80) msg += ' ✨ +7% ATK/DEF!';
    else if (newAff >= 50) msg += ' ✨ +3% ATK/DEF';
    toast(msg);
  });
}

export function renderInventoryDisplay() {
  const el = document.getElementById('inv-display');
  if (!el) return;
  import('../core/data.js').then(({ ITEMS }) => {
    el.innerHTML = Object.entries(ITEMS).map(([k, it]) =>
      `<span class="inv-item">${it.e} ${it.n}: <b style="color:var(--gold)">×${P.inventory[k]||0}</b></span>`
    ).join('');
  });
}

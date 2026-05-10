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
  if (name === 'fusion')  renderFusionTab();
}

/* ── Account tab ─────────────────────────────────────────────── */
export function renderAccountTab() {
  const el = document.getElementById('acc-info');
  if (!el) return;
  el.innerHTML = `
    <div class="acc-row"><span class="acc-lbl">👤 Tên</span><span class="acc-val">${P.name||'Yugi'}</span></div>
    <div class="acc-row"><span class="acc-lbl">💰 Vàng</span><span class="acc-val" style="color:var(--gold)">${P.gold}</span></div>
    <div class="acc-row"><span class="acc-lbl">💎 Gems</span><span class="acc-val" style="color:var(--cyan)">${P.gems||0}</span></div>
    <div class="acc-row"><span class="acc-lbl">⭐ Tổng điểm</span><span class="acc-val" style="color:var(--purple)">${P.totalScore}</span></div>
    <div class="acc-row"><span class="acc-lbl">🏆 Thắng/Thua</span><span class="acc-val">${P.wins}/${P.losses}</span></div>
    <div class="acc-row"><span class="acc-lbl">⚔ Trận đấu</span><span class="acc-val">${P.battles}</span></div>
    <div class="acc-row"><span class="acc-lbl">📖 Campaign Tầng</span><span class="acc-val" style="color:var(--cyan)">${P.campaignFloor||1}</span></div>
    <div class="acc-row"><span class="acc-lbl">♾ Endless Max</span><span class="acc-val" style="color:var(--green)">${P.endlessFloor||0}</span></div>
    <div class="acc-row"><span class="acc-lbl">⚔ Arena Rating</span><span class="acc-val" style="color:var(--orange)">${P.arenaRating||1000}</span></div>`;
  renderInventoryDisplay();
  renderTalentTree();
  import('../features/LevelUp.js').then(m => m.renderLevelUpList());
}

/* ── Talent Tree ─────────────────────────────────────────────── */
export function renderTalentTree() {
  const el = document.getElementById('talent-tree-display');
  if (!el) return;
  
  import('../core/data.js').then(({ TALENTS }) => {
    let html = '<div class="talent-grid">';
    Object.entries(TALENTS).forEach(([tid, t]) => {
      const isUnlocked = P.talents?.[tid];
      const canAfford = (P.gems || 0) >= t.cost;
      
      html += `
        <div class="talent-node ${isUnlocked?'unlocked':''} ${!isUnlocked && !canAfford?'cant-afford':''}" onclick="unlockTalent('${tid}')">
          <div class="talent-icon">${t.icon}</div>
          <div class="talent-name">${t.n}</div>
          <div class="talent-desc">${t.desc}</div>
          <div class="talent-cost">${isUnlocked ? 'ĐÃ MỞ' : `💎 ${t.cost}`}</div>
        </div>
      `;
    });
    html += '</div>';
    el.innerHTML = html;
  });
}

window.unlockTalent = function(tid) {
  import('../core/data.js').then(({ TALENTS }) => {
    const t = TALENTS[tid];
    if (P.talents?.[tid]) { toast('Thiên phú đã được mở!'); return; }
    if ((P.gems || 0) < t.cost) { toast('Không đủ Gems!'); return; }
    
    P.gems -= t.cost;
    if (!P.talents) P.talents = {};
    P.talents[tid] = true;
    
    savePlayer();
    updateGlobalHeader();
    renderAccountTab();
    toast(`✨ Đã mở thiên phú: ${t.n}!`);
  });
};

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

/* ── Fusion Tab ──────────────────────────────────────────────── */
let _fSlots = [null, null]; // P.roster indices

export function renderFusionTab() {
  const el = document.getElementById('tab-fusion-inner');
  if (!el) return;
  
  // Refresh slots display
  _updateFusionSlotsUI();
}

function _updateFusionSlotsUI() {
  const s1 = document.getElementById('fusion-slot-1');
  const s2 = document.getElementById('fusion-slot-2');
  const preview = document.getElementById('fusion-preview');
  const btn = document.getElementById('fusion-btn');
  if (!s1 || !s2 || !preview || !btn) return;

  import('../core/data.js').then(({ getMonsterBase, FUSION_COST }) => {
    const m1 = _fSlots[0] !== null ? getMonsterBase(P.roster[_fSlots[0]]) : null;
    const m2 = _fSlots[1] !== null ? getMonsterBase(P.roster[_fSlots[1]]) : null;

    s1.innerHTML = m1 ? `<div class="fusion-monster"><span>${m1.e}</span><div class="f-lv">LV${P.monsterLevels[m1.id]||1}</div></div>` : '<div class="slot-placeholder">?</div>';
    s2.innerHTML = m2 ? `<div class="fusion-monster"><span>${m2.e}</span><div class="f-lv">LV${P.monsterLevels[m2.id]||1}</div></div>` : '<div class="slot-placeholder">?</div>';

    if (m1 && m2) {
      import('../features/Fusion.js').then(({ FusionSystem }) => {
        const res = FusionSystem.getPreview(m1.id, m2.id);
        if (res) {
          preview.innerHTML = `
            <div style="font-size:10px;color:var(--gold);margin-bottom:5px">DỰ ĐOÁN KẾT QUẢ:</div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:24px">${res.e}</span>
              <div style="text-align:left">
                <div style="font-weight:bold;color:#fff">${res.n}</div>
                <div style="font-size:9px;color:#888">${res.desc}</div>
              </div>
            </div>
          `;
          btn.disabled = false;
          btn.style.opacity = '1';
        } else {
          preview.innerHTML = '<div style="color:var(--red)">Cặp quái này không thể dung hợp!</div>';
          btn.disabled = true;
          btn.style.opacity = '0.5';
        }
      });
    } else {
      preview.innerHTML = '<div style="color:#555">Chọn 2 quái thú để xem kết quả</div>';
      btn.disabled = true;
      btn.style.opacity = '0.5';
    }
  });
}

window.openFusionPicker = function(slotNum) {
  const picker = document.createElement('div');
  picker.className = 'fusion-picker-overlay';
  
  import('../core/data.js').then(({ getMonsterBase }) => {
    let html = `
      <div class="fusion-picker-content">
        <div class="shop-title">CHỌN QUÁI THÚ ${slotNum}</div>
        <div class="fusion-picker-grid">
    `;
    
    P.roster.forEach((id, idx) => {
      const m = getMonsterBase(id);
      const lv = P.monsterLevels[id] || 1;
      const isSelected = _fSlots.includes(idx);
      const canFuse = lv >= 10;
      
      html += `
        <div class="fusion-picker-item ${isSelected?'selected':''} ${!canFuse?'locked':''}" onclick="${canFuse && !isSelected ? `selectFusionMonster(${idx}, ${slotNum})` : ''}">
          <div style="font-size:20px">${m.e}</div>
          <div style="font-size:10px">${m.n}</div>
          <div style="font-size:9px; color:${canFuse?'var(--gold)':'#f44'}">LV ${lv}</div>
          ${!canFuse ? '<div style="font-size:8px;color:#f44">Cần LV10</div>' : ''}
        </div>
      `;
    });
    
    html += `
        </div>
        <button class="pb" style="margin-top:15px; background:#444" onclick="this.closest('.fusion-picker-overlay').remove()">ĐÓNG</button>
      </div>
    `;
    picker.innerHTML = html;
    document.body.appendChild(picker);
  });
};

window.selectFusionMonster = function(idx, slotNum) {
  _fSlots[slotNum - 1] = idx;
  document.querySelector('.fusion-picker-overlay')?.remove();
  _updateFusionSlotsUI();
};

window.executeFusion = function() {
  if (_fSlots[0] === null || _fSlots[1] === null) return;
  
  import('../features/Fusion.js').then(({ FusionSystem }) => {
    const success = FusionSystem.fuse(_fSlots[0], _fSlots[1]);
    if (success) {
      _fSlots = [null, null];
      renderFusionTab();
      updateGlobalHeader();
    }
  });
};

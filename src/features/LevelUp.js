// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Manual Level Up System
// ═══════════════════════════════════════════════════════════════

import { P, savePlayer, updateGlobalHeader } from '../core/playerState.js';
import { UDEFS, GACHA_POOL, EVOLUTIONS } from '../core/data.js';
import { toast } from '../ui/UIHelpers.js';

function getDefById(id) {
  return UDEFS[id] || GACHA_POOL.find(m => m.id === id) || null;
}

export function renderLevelUpList() {
  const el = document.getElementById('levelup-display');
  if (!el) return;
  el.innerHTML = '';
  
  const collection = P.collection || [];
  if (collection.length === 0) {
    el.innerHTML = '<div style="color:#555;font-size:10px">Bạn chưa sở hữu quái thú nào.</div>';
    return;
  }

  collection.forEach(id => {
    const def = getDefById(id);
    if (!def) return;
    
    if (!P.monsterLevels) P.monsterLevels = {};
    const ml = P.monsterLevels[id] || { lv: def.lv || 1, xp: 0, evolved: false, evoPathId: null };
    const currentLv = ml.lv || def.lv || 1;
    
    if (currentLv >= 20) {
      // Max level
      return; 
    }
    
    const cost = currentLv * 100; // Formula for Level Up cost
    const gainLvs = currentLv - (def.lv || 1);
    const hp = def.hp + (gainLvs > 0 ? gainLvs * 3 : 0);
    const atk = def.atk + (gainLvs > 0 ? gainLvs : 0);
    const defStat = def.def + (gainLvs > 0 ? gainLvs : 0);
    
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid #333;border-radius:6px;padding:8px;display:flex;justify-content:space-between;align-items:center;';
    
    let evoReadyText = '';
    if (currentLv >= 10 && EVOLUTIONS[id] && !ml.evolved) {
       evoReadyText = `<span style="color:var(--gold);font-size:8px;display:block;margin-top:2px;">✨ Tiến Hóa Sẵn Sàng (Kho)</span>`;
    }

    card.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">
        <div style="font-family:'Rajdhani',sans-serif;font-size:14px;color:#eee">
          ${def.e} ${def.n} <span style="color:var(--gold);font-size:10px">LV${currentLv}</span>
          ${evoReadyText}
        </div>
        <div style="font-size:10px;color:#aaa">
          HP: ${hp} | ATK: ${atk} | DEF: ${defStat}
        </div>
      </div>
      <button class="pb" style="width:auto;padding:6px 12px;font-size:10px;margin:0" data-up="${id}">
        ⬆ LÊN CẤP (💰${cost})
      </button>
    `;
    
    const btn = card.querySelector('[data-up]');
    if (P.gold < cost) {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.disabled = true;
    }
    
    btn.addEventListener('click', () => {
      manualLevelUp(id, cost);
    });
    
    el.appendChild(card);
  });
}

export function manualLevelUp(id, cost) {
  if (!P.monsterLevels) P.monsterLevels = {};
  if (!P.monsterLevels[id]) {
    const def = getDefById(id);
    P.monsterLevels[id] = { lv: def?.lv || 1, xp: 0, evolved: false, evoPathId: null };
  }

  const currentLv = P.monsterLevels[id].lv;
  if (currentLv >= 20) {
    toast('Đã đạt cấp tối đa!');
    return;
  }

  const actualCost = currentLv * 100;
  if (P.gold < actualCost) {
    toast('Không đủ vàng!');
    return;
  }
  
  P.gold -= actualCost;
  P.monsterLevels[id].lv += 1;
  const newLv = P.monsterLevels[id].lv;
  
  savePlayer();
  updateGlobalHeader();
  renderLevelUpList();
  
  const def = getDefById(id);
  let msg = `⬆ ${def.e} lên LV${newLv}!`;
  
  if (newLv >= 10 && EVOLUTIONS[id] && !P.monsterLevels[id].evolved) {
    msg += ' ✨ Sẵn sàng Tiến Hóa!';
  }
  
  toast(msg);
}

// Ensure the function is exposed globally for backward compatibility if any legacy code calls it from HTML
window.manualLevelUp = manualLevelUp;

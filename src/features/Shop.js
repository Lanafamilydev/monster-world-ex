// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Shop & Gacha System
// Item purchasing and monster gacha with roster sync
// ═══════════════════════════════════════════════════════════════

import { P, savePlayer, addToCollection, spendGold, updateGlobalHeader } from '../core/playerState.js';
import { ITEMS, GACHA_POOL, GACHA_RATES, RARITY_CLR, RARITY_LBL } from '../core/data.js';
import { toast } from '../ui/UIHelpers.js';
import { renderPokedex } from './Roster.js';
import { renderItemBar } from '../ui/Renderer.js';

/** Render the item shop grid */
export function renderItemShop() {
  const el = document.getElementById('item-shop-list');
  if (!el) return;
  el.innerHTML = '';

  Object.entries(ITEMS).forEach(([k, it]) => {
    const qty  = P.inventory[k] || 0;
    const full = qty >= it.max;
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-icon">${it.e}</div>
      <div class="item-info">
        <div class="item-name">${it.n}</div>
        <div class="item-desc">${it.desc}</div>
        <div class="item-cost">💰 ${P.talents?.greedy_merchant ? Math.floor(it.price * 0.9) : it.price} Vàng</div>
      </div>
      <div style="text-align:right">
        <div class="item-stock" style="margin-bottom:4px">×${qty}</div>
        <button class="pb pb-end" style="width:auto;padding:4px 10px;font-size:9px;${full?'opacity:.3;cursor:not-allowed':''}"
          ${full ? 'disabled' : ''}>Mua</button>
      </div>`;
    card.querySelector('button').addEventListener('click', () => buyItem(k));
    el.appendChild(card);
  });
}

/** Buy a single item */
export function buyItem(key) {
  const it = ITEMS[key];
  if (!it) { toast('Vật phẩm không tồn tại!'); return; }
  const price = P.talents?.greedy_merchant ? Math.floor(it.price * 0.9) : it.price;
  if (P.gold < price) { toast(`Không đủ Vàng! Cần ${price}💰`); return; }
  const qty = P.inventory[key] || 0;
  if (qty >= it.max) { toast('Đã đạt giới hạn tối đa!'); return; }

  P.gold -= price;
  P.inventory[key] = qty + 1;
  savePlayer();  // ← CRITICAL: saves immediately after purchase
  updateGlobalHeader();
  renderItemShop();
  renderItemBar();
  toast(`✓ Đã mua ${it.e} ${it.n}! (×${P.inventory[key]})`);
}

/** Open a gacha pack */
export function openGacha(type) {
  let cost = type === 'common' ? 100 : 500;
  if (P.talents?.greedy_merchant) cost = Math.floor(cost * 0.9);
  if (P.gold < cost) { toast(`Không đủ Vàng! Cần ${cost}💰`); return; }

  const rates  = GACHA_RATES[type];
  const tiers  = ['C', 'B', 'A', 'S'];
  const roll   = Math.random() * 100;
  let cum = 0, pickedTier = 'C';
  for (let i = 0; i < rates.length; i++) {
    cum += rates[i];
    if (roll < cum) { pickedTier = tiers[i]; break; }
  }

  const pool = GACHA_POOL.filter(m => m.t === pickedTier);
  if (!pool.length) { toast('Lỗi gacha pool!'); return; }
  const monster = pool[Math.floor(Math.random() * pool.length)];

  P.gold -= cost;
  const isNew = addToCollection(monster.id);
  // addToCollection calls savePlayer internally
  updateGlobalHeader();
  renderPokedex();
  showGachaResult(monster, pickedTier, isNew);
}

/** Show the gacha result modal */
function showGachaResult(monster, tier, isNew) {
  const el  = document.getElementById('gacha-res-card');
  const clr = RARITY_CLR[tier];
  if (!el) return;
  el.style.borderColor = clr;
  el.style.boxShadow   = `0 0 30px ${clr}66`;
  el.innerHTML = `
    <div class="gr-rarity" style="color:${clr}">${RARITY_LBL[tier]}</div>
    <div class="gr-emoji">${monster.e}</div>
    <div class="gr-name" style="color:${clr}">${monster.n}</div>
    <div class="gr-desc">${monster.desc}</div>
    <div style="margin-top:8px;font-size:9px;color:#555">
      HP:${monster.hp} ATK:${monster.atk} DEF:${monster.def} SPD:${monster.spd}
    </div>
    ${isNew
      ? '<div class="gr-new">✨ QUÁI MỚI! Đã thêm vào Pokedex</div>'
      : '<div style="font-size:9px;color:#555;margin-top:8px">Đã sở hữu — Bộ sưu tập cập nhật</div>'}`;
  document.getElementById('gacha-result')?.classList.add('show');
}

export function closeGachaResult() {
  document.getElementById('gacha-result')?.classList.remove('show');
}

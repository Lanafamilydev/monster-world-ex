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
  renderPremiumShopSection();
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
  
  // V6.0: Duplicate System
  let dustGain = 0;
  if (!isNew) {
    const dustMap = { C: 5, B: 15, A: 40, S: 100 };
    dustGain = dustMap[pickedTier] || 0;
    P.inventory.magic_dust = (P.inventory.magic_dust || 0) + dustGain;
  }

  updateGlobalHeader();
  renderPokedex();
  showGachaResult(monster, pickedTier, isNew, dustGain);
}

/** Show the gacha result modal */
function showGachaResult(monster, tier, isNew, dustGain) {
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
      : `<div style="font-size:9px;color:var(--gold);margin-top:8px">TRÙNG LẶP! +${dustGain} ✨ Bụi Ma Thuật</div>`}`;
  document.getElementById('gacha-result')?.classList.add('show');
}

export function closeGachaResult() {
  document.getElementById('gacha-result')?.classList.remove('show');
}

/** V6.0: Open Rune Gacha */
export function openRuneGacha() {
  const cost = 300;
  if (P.gold < cost) { toast(`Không đủ Vàng! Cần ${cost}💰`); return; }

  import('../features/Runes.js').then(({ RuneSystem }) => {
    P.gold -= cost;
    const roll = Math.random() * 100;
    const rarity = roll < 10 ? 'epic' : roll < 40 ? 'rare' : 'common';
    const rune = RuneSystem.generateRune(rarity);
    P.runes.push(rune);
    savePlayer();
    updateGlobalHeader();
    toast(`💎 CHÚC MỪNG! Bạn nhận được Cổ Ngọc [${rarity.toUpperCase()}]!`);
    
    // Show visual feedback (reusing gacha result for now or custom)
    const mockMonster = { n: `Cổ Ngọc ${rarity.toUpperCase()}`, e: '💎', desc: 'Trang bị trong Kho Đội Hình' };
    showGachaResult(mockMonster, rarity === 'epic' ? 'S' : rarity === 'rare' ? 'A' : 'B', true);
  });
}

// ── V6.1: Premium Shop (SePay) ────────────────────────────────
let orderSubscription = null;
let orderPollingInterval = null;

export async function buyPremium(amountVND, gemsReward) {
  const { supabase } = await import('../core/supabaseClient.js');
  
  let userId = P.id;
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (user) {
      userId = user.id;
      P.id = user.id;
    }
  }

  if (!userId) {
    toast('⚠ Bạn cần tạo tài khoản (Đăng nhập Email) để nạp thẻ!');
    document.getElementById('name-modal')?.classList.add('show');
    return;
  }

  // Generate unique transaction code
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const transCode = `MW${userId.substring(0,4).toUpperCase()}${randomSuffix}`;

  // Insert pending order into database
  const { data, error } = await supabase
    .from('orders')
    .insert({
      player_id: userId,
      amount: amountVND,
      gems_reward: gemsReward,
      transaction_code: transCode,
      order_code: transCode,
      package_id: `gems_${gemsReward}`
    })
    .select()
    .single();

  if (error) {
    console.error('Lỗi tạo đơn hàng:', error);
    toast('⚠ Không thể tạo đơn hàng, vui lòng thử lại sau.');
    return;
  }

  // Show Payment Modal
  const modal = document.getElementById('payment-overlay');
  if (!modal) return;
  
  document.getElementById('vietqr-amount').innerText = amountVND.toLocaleString();
  document.getElementById('vietqr-desc').innerText = transCode;
  
  // Construct VietQR URL dynamically
  let bank = 'Vietcombank';
  let acc = '0271000845142';
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'payment_config')
      .single();
    if (data && data.value) {
      bank = data.value.bank || bank;
      acc = data.value.account_no || acc;
    }
  } catch (e) {
    console.warn('Using default payment configs:', e);
  }

  const qrUrl = `https://qr.sepay.vn/img?acc=${acc}&bank=${bank}&amount=${amountVND}&des=${transCode}`;
  document.getElementById('vietqr-img').src = qrUrl;
  
  modal.classList.add('show');
  
  // Start polling/listening to this order
  startOrderListener(data.id, gemsReward);
}

// ── V6.2: Dynamic Premium Packages ────────────────────────────
const DEFAULT_PAYMENT = {
  bank: 'Vietcombank',
  account_no: '0271000845142',
  account_holder: 'TRAN NAM',
  packages: [
    { vnd: 2000, gems: 200, name: 'Gói Tập Sự', desc: 'Chỉ để test SePay', icon: '💎', hue: 180 },
    { vnd: 10000, gems: 1100, name: 'Gói Tiêu Chuẩn', desc: 'Khuyến mãi +10%', icon: '👑', hue: 250 },
    { vnd: 20000, gems: 2500, name: 'Gói Vua Chơi', desc: 'Khuyến mãi +25%', icon: '🏆', hue: 300 }
  ]
};

export async function renderPremiumShopSection() {
  const el = document.getElementById('premium-packages-list');
  if (!el) return;

  const { supabase } = await import('../core/supabaseClient.js');

  let payment = DEFAULT_PAYMENT;
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('key', 'payment_config')
      .single();
    if (data && data.value) {
      payment = data.value;
    }
  } catch (err) {
    // Expected if table doesn't exist yet or is empty
  }

  const pkgs = payment.packages || DEFAULT_PAYMENT.packages;
  el.innerHTML = pkgs.map(p => `
    <div class="gacha-card gc-premium" onclick="buyPremium(${p.vnd}, ${p.gems})">
      <div class="gacha-card-icon" style="filter: hue-rotate(${p.hue || 180}deg);">${p.icon || '💎'}</div>
      <div class="gacha-card-name">${p.name}</div>
      <div class="gacha-card-cost" style="color: #00ff88">💵 ${p.vnd.toLocaleString()} VNĐ</div>
      <div class="gacha-card-desc">${p.desc}</div>
      <div class="gacha-card-rates">Nhận ngay ${p.gems.toLocaleString()} Gems</div>
    </div>
  `).join('');
}

async function claimOrderOnServer(orderId, gemsReward) {
  try {
    const res = await fetch('/api/claim-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ orderId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi đồng bộ nạp ngọc');

    const { P, savePlayer } = await import('../core/playerState.js');
    P.gems = data.newGems;
    await savePlayer();

    // Update UI elements securely
    const headerGems = document.getElementById('header-gems') || document.querySelector('.acc-val[style*="var(--cyan)"]');
    if (headerGems) headerGems.innerText = P.gems;

    toast(`💎 NẠP THÀNH CÔNG! Bạn nhận được ${gemsReward} Gems!`);
    return true;
  } catch (err) {
    console.error('[Shop Claim Error]:', err);
    return false;
  }
}

function startOrderListener(orderId, gemsReward) {
  import('../core/supabaseClient.js').then(({ supabase }) => {
    // 1. Realtime listener (requires table replication enabled)
    orderSubscription = supabase
      .channel(`order_${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, async (payload) => {
         if (payload.new.status === 'paid') {
           closePaymentModal(true);
           await claimOrderOnServer(orderId, gemsReward);
         }
      })
      .subscribe();

    // 2. Foolproof Polling Fallback (runs every 3 seconds in case Realtime is disabled/blocked)
    orderPollingInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();
      
      if (!error && data && data.status === 'paid') {
        closePaymentModal(true);
        await claimOrderOnServer(orderId, gemsReward);
      }
    }, 3000);
  });
}

export function closePaymentModal(stopListening = false) {
  document.getElementById('payment-overlay')?.classList.remove('show');
  
  if (stopListening) {
    if (orderSubscription) {
      import('../core/supabaseClient.js').then(({ supabase }) => {
        supabase.removeChannel(orderSubscription);
        orderSubscription = null;
      });
    }

    if (orderPollingInterval) {
      clearInterval(orderPollingInterval);
      orderPollingInterval = null;
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// Monster World EX — Standalone Admin Portal Script
// ═══════════════════════════════════════════════════════════════

import { supabase } from './core/supabaseClient.js';

// Default configs
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

let currentTab = 'overview';
let isLoggedIn = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Bind Login
  document.getElementById('btn-admin-login').addEventListener('click', handleAdminLogin);
  document.getElementById('admin-passcode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });

  // Bind globals to window for onclick attributes
  window.switchTab = switchTab;
  window.logoutAdmin = logoutAdmin;
  window.saveSettings = saveSettings;
  window.searchPlayers = searchPlayers;
  window.updatePlayerGems = updatePlayerGems;
  window.approveOrder = approveOrder;
  window.saveGameConfig = saveGameConfig;
  window.sendBroadcast = sendBroadcast;
});

// Admin Login
function handleAdminLogin() {
  const passcode = document.getElementById('admin-passcode').value;
  if (passcode === 'admin123') {
    isLoggedIn = true;
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'flex';
    showToast('🔑 Đăng nhập Admin thành công!');
    switchTab('overview');
  } else {
    showToast('❌ Mật mã Admin không chính xác!');
  }
}

function logoutAdmin() {
  isLoggedIn = false;
  document.getElementById('admin-passcode').value = '';
  document.getElementById('admin-login-screen').style.display = 'flex';
  document.getElementById('admin-dashboard').style.display = 'none';
}

// Show Custom Admin Toast
function showToast(msg) {
  const t = document.getElementById('admin-toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Switch Sidebar Tabs
async function switchTab(tabName) {
  if (!isLoggedIn) return;
  currentTab = tabName;

  // Visual Nav Toggle
  document.querySelectorAll('.admin-nav-item').forEach(item => item.classList.remove('active'));
  document.getElementById(`nav-${tabName}`)?.classList.add('active');

  // Title Update
  const titles = {
    overview: 'Tổng Quan & Thống Kê',
    payment: 'Cấu Hình Ngân Hàng & Gói Gems',
    players: 'Quản Lý Người Chơi',
    orders: 'Lịch Sử Giao Dịch',
    gameconfig: 'Cấu Hình Game',
    broadcast: 'Thông Báo Toàn Server',
    analytics: 'Phân Tích & Thống Kê'
  };
  document.getElementById('admin-current-title').innerText = titles[tabName] || 'Bảng Điều Khiển';

  // Panes Toggle
  document.querySelectorAll('.admin-tab-pane').forEach(pane => pane.style.display = 'none');
  document.getElementById(`tab-${tabName}`).style.display = 'block';

  // Load Data
  if (tabName === 'overview') await loadOverview();
  if (tabName === 'payment') await loadPaymentSettings();
  if (tabName === 'players') await searchPlayers();
  if (tabName === 'orders') await loadOrdersHistory();
  if (tabName === 'gameconfig') await loadGameConfig();
  if (tabName === 'analytics') await loadAnalytics();
}

// ── Tab 1: Overview & Active Pending Orders ──────────────────
async function loadOverview() {
  try {
    const data = await runAdminAction('get-overview');
    
    document.getElementById('stat-total-players').innerText = data.totalPlayers || 0;
    document.getElementById('stat-total-revenue').innerText = data.revenue.toLocaleString() + 'đ';
    document.getElementById('stat-paid-orders').innerText = data.paidCount;
    document.getElementById('stat-pending-orders').innerText = data.pendingCount;

    // Render pending orders table
    const tableBody = document.querySelector('#table-pending-orders tbody');
    if (!tableBody) return;

    const pendingOrders = data.pendingOrders || [];
    if (pendingOrders.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 25px; color: #555;">🎉 Không có giao dịch nào đang chờ duyệt!</td></tr>`;
      return;
    }

    tableBody.innerHTML = pendingOrders.map(o => `
      <tr>
        <td style="font-family: 'Orbitron', sans-serif; color: var(--gold); font-weight: bold;">${o.order_code || o.transaction_code}</td>
        <td style="font-size: 11px; color: #888;">${o.player_id.substring(0, 10)}...</td>
        <td style="color: #00ff88; font-weight: bold;">${o.amount.toLocaleString()}đ</td>
        <td style="color: var(--cyan);">${o.gems_reward} 💎</td>
        <td style="text-align: center;">
          <button class="pb pb-end" style="border: none; font-size: 10px; padding: 4px 10px; width: auto;" onclick="approveOrder('${o.id}', ${o.gems_reward}, '${o.player_id}')">⚡ DUYỆT</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Overview error:', err);
    showToast('❌ Không thể tải số liệu thống kê.');
  }
}

// ── Tab 2: Payment Bank & Dynamic Gems Packages Settings ──────
async function loadPaymentSettings() {
  try {
    const { data: dbConfig } = await supabase
      .from('admin_settings')
      .select('*');

    const configs = {};
    (dbConfig || []).forEach(row => {
      configs[row.key] = row.value;
    });

    const payment = configs['payment_config'] || DEFAULT_PAYMENT;
    const pkgs = payment.packages || DEFAULT_PAYMENT.packages;

    document.getElementById('pay-bank-name').value = payment.bank || '';
    document.getElementById('pay-bank-acc').value = payment.account_no || '';
    document.getElementById('pay-bank-holder').value = payment.account_holder || '';

    document.getElementById('pkg1-vnd').value = pkgs[0]?.vnd || 2000;
    document.getElementById('pkg1-gems').value = pkgs[0]?.gems || 200;

    document.getElementById('pkg2-vnd').value = pkgs[1]?.vnd || 10000;
    document.getElementById('pkg2-gems').value = pkgs[1]?.gems || 1100;

    document.getElementById('pkg3-vnd').value = pkgs[2]?.vnd || 20000;
    document.getElementById('pkg3-gems').value = pkgs[2]?.gems || 2500;

  } catch (err) {
    console.error('Load configs error:', err);
  }
}

async function saveSettings() {
  const bank = document.getElementById('pay-bank-name').value.trim();
  const acc = document.getElementById('pay-bank-acc').value.trim();
  const holder = document.getElementById('pay-bank-holder').value.trim().toUpperCase();

  const p1V = parseInt(document.getElementById('pkg1-vnd').value) || 2000;
  const p1G = parseInt(document.getElementById('pkg1-gems').value) || 200;

  const p2V = parseInt(document.getElementById('pkg2-vnd').value) || 10000;
  const p2G = parseInt(document.getElementById('pkg2-gems').value) || 1100;

  const p3V = parseInt(document.getElementById('pkg3-vnd').value) || 20000;
  const p3G = parseInt(document.getElementById('pkg3-gems').value) || 2500;

  if (!bank || !acc || !holder) {
    showToast('❌ Vui lòng nhập đầy đủ thông tin VietQR!');
    return;
  }

  const newConfig = {
    bank,
    account_no: acc,
    account_holder: holder,
    packages: [
      { vnd: p1V, gems: p1G, name: 'Gói Tập Sự', desc: 'Chỉ để test SePay', icon: '💎', hue: 180 },
      { vnd: p2V, gems: p2G, name: 'Gói Tiêu Chuẩn', desc: 'Khuyến mãi +10%', icon: '👑', hue: 250 },
      { vnd: p3V, gems: p3G, name: 'Gói Vua Chơi', desc: 'Khuyến mãi +25%', icon: '🏆', hue: 300 }
    ]
  };

  try {
    await runAdminAction('save-settings', { key: 'payment_config', value: newConfig });
    showToast('✅ Đã lưu cấu hình thanh toán thành công!');
  } catch (err) {
    console.error('Save configs error:', err);
    showToast(`❌ Không thể lưu cấu hình: ${err.message || err}`);
  }
}

// ── Tab 3: Players Management & direct values update ──────────
async function searchPlayers() {
  const query = document.getElementById('search-player-input')?.value.trim() || '';
  const tableBody = document.querySelector('#table-players tbody');
  if (!tableBody) return;

  try {
    const data = await runAdminAction('get-players', { query });
    const players = data.players || [];

    if (players.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 25px; color: #555;">🔍 Không tìm thấy người chơi nào.</td></tr>`;
      return;
    }

    tableBody.innerHTML = players.map(p => `
      <tr>
        <td style="font-size: 11px; color: #888;">${p.id}</td>
        <td style="font-weight: bold; color: #fff;">${p.name}</td>
        <td>
          <input type="number" class="admin-input" id="player-gold-${p.id}" value="${p.gold}" style="width: 100px; padding: 4px 8px; text-align: center; display: inline-block;">
        </td>
        <td>
          <input type="number" class="admin-input" id="player-gems-${p.id}" value="${p.gems || 0}" style="width: 100px; padding: 4px 8px; text-align: center; display: inline-block;">
        </td>
        <td style="text-align: center;">
          <button class="pb pb-end" style="border: none; font-size: 10px; padding: 4px 10px; width: auto;" onclick="updatePlayerGems('${p.id}')">💾 LƯU SỐ LIỆU</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Search players error:', err);
    showToast('❌ Lỗi tải danh sách người chơi.');
  }
}

async function updatePlayerGems(playerId) {
  const gold = parseInt(document.getElementById(`player-gold-${playerId}`).value) || 0;
  const gems = parseInt(document.getElementById(`player-gems-${playerId}`).value) || 0;

  try {
    await runAdminAction('update-player', { targetPlayerId: playerId, gold, gems });
    showToast('✅ Cập nhật dữ liệu người chơi thành công!');
  } catch (err) {
    console.error('Update player error:', err);
    showToast(`❌ Không thể lưu: ${err.message || err}`);
  }
}

// ── Tab 4: All Orders Transactions History ────────────────────
async function loadOrdersHistory() {
  const tableBody = document.querySelector('#table-all-orders tbody');
  if (!tableBody) return;

  try {
    const data = await runAdminAction('get-orders');
    const orders = data.orders || [];

    if (orders.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: #555;">Không có đơn hàng nào trong lịch sử.</td></tr>`;
      return;
    }

    tableBody.innerHTML = orders.map(o => `
      <tr>
        <td style="font-family: 'Orbitron', sans-serif; color: var(--gold); font-weight: bold;">${o.order_code || o.transaction_code}</td>
        <td style="font-size: 11px; color: #888;">${o.player_id.substring(0, 10)}...</td>
        <td style="color: #00ff88; font-weight: bold;">${o.amount.toLocaleString()}đ</td>
        <td style="color: var(--cyan);">${o.gems_reward} 💎</td>
        <td>
          <span style="font-weight: bold; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: ${(o.status === 'paid' || o.status === 'completed') ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)'}; color: ${(o.status === 'paid' || o.status === 'completed') ? '#00ff88' : '#ff4444'};">
            ${(o.status === 'paid' || o.status === 'completed') ? 'THÀNH CÔNG' : 'CHỜ DUYỆT'}
          </span>
        </td>
        <td style="font-size: 11px; color: #666;">${new Date(o.created_at).toLocaleString()}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Load all orders error:', err);
    showToast('❌ Lỗi tải lịch sử đơn hàng.');
  }
}

// ── RLS-Resilient Quick Order Approval ────────────────────────
async function approveOrder(orderId, gemsReward, playerId) {
  const confirmApprove = confirm(`XÁC NHẬN DUYỆT THỦ CÔNG đơn hàng này?\nNgười chơi sẽ nhận ngay ${gemsReward} Gems khi họ đang chơi game hoặc khi họ mở game!`);
  if (!confirmApprove) return;

  try {
    await runAdminAction('approve-order', { orderId, playerId, gemsReward });
    showToast('⚡ Duyệt đơn thành công! Trạng thái đơn đã được cập nhật thành PAID.');
    await loadOverview();
  } catch (err) {
    console.error('Approve order error:', err);
    showToast(`❌ Duyệt đơn thất bại: ${err.message || err}`);
  }
}

// ── Generic API Action Runner ───────────────────────────
async function runAdminAction(action, payload) {
  try {
    const res = await fetch('/api/admin-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action,
        passcode: 'admin123',
        payload
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Yêu cầu xử lý thất bại');
    }
    return data;
  } catch (err) {
    console.error(`[Admin API] Action ${action} failed:`, err);
    throw err;
  }
}
// ── Tab 5: Game Config ──────────────────────────────────────────────
async function loadGameConfig() {
  try {
    const { data: dbConfig } = await supabase
      .from('admin_settings')
      .select('*');

    const configs = {};
    (dbConfig || []).forEach(row => {
      configs[row.key] = row.value;
    });

    const gc = configs['game_config'] || {
      gacha_common_rates: [60, 30, 9, 1],
      gacha_premium_rates: [0, 30, 50, 20],
      xp_per_kill: 10,
      gold_per_kill: 20,
      max_roster: 5
    };

    const el = document.getElementById('gc-content');
    if (!el) return;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <label style="font-size:11px;color:#666">GACHA THƯỜNG (C/B/A/S %)</label>
          <input type="text" id="gc-gacha-common" class="admin-input" style="margin-top:5px" value="${gc.gacha_common_rates?.join(', ') || '60, 30, 9, 1'}">
        </div>
        <div>
          <label style="font-size:11px;color:#666">GACHA PREMIUM (C/B/A/S %)</label>
          <input type="text" id="gc-gacha-premium" class="admin-input" style="margin-top:5px" value="${gc.gacha_premium_rates?.join(', ') || '0, 30, 50, 20'}">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <label style="font-size:11px;color:#666">XP/KILL</label>
          <input type="number" id="gc-xp-kill" class="admin-input" style="margin-top:5px" value="${gc.xp_per_kill || 10}">
        </div>
        <div>
          <label style="font-size:11px;color:#666">GOLD/KILL</label>
          <input type="number" id="gc-gold-kill" class="admin-input" style="margin-top:5px" value="${gc.gold_per_kill || 20}">
        </div>
        <div>
          <label style="font-size:11px;color:#666">MAX ROSTER</label>
          <input type="number" id="gc-max-roster" class="admin-input" style="margin-top:5px" value="${gc.max_roster || 5}">
        </div>
      </div>
      <button class="pb pb-end" style="border:none;font-weight:bold;font-size:13px" onclick="saveGameConfig()">LƯU CẤU HÌNH GAME</button>
    `;
  } catch (err) {
    console.error('Load game config error:', err);
  }
}

async function saveGameConfig() {
  const commonStr = document.getElementById('gc-gacha-common')?.value || '60,30,9,1';
  const premStr = document.getElementById('gc-gacha-premium')?.value || '0,30,50,20';
  const commonRates = commonStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  const premRates = premStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

  const config = {
    gacha_common_rates: commonRates.length === 4 ? commonRates : [60, 30, 9, 1],
    gacha_premium_rates: premRates.length === 4 ? premRates : [0, 30, 50, 20],
    xp_per_kill: parseInt(document.getElementById('gc-xp-kill')?.value) || 10,
    gold_per_kill: parseInt(document.getElementById('gc-gold-kill')?.value) || 20,
    max_roster: parseInt(document.getElementById('gc-max-roster')?.value) || 5
  };

  try {
    await runAdminAction('save-settings', { key: 'game_config', value: config });
    showToast('✅ Đã lưu cấu hình game!');
  } catch (err) {
    showToast(`❌ Lỗi: ${err.message || err}`);
  }
}

// ── Tab 6: Broadcast ───────────────────────────────────────────────
async function sendBroadcast() {
  const msg = document.getElementById('bc-message')?.value.trim();
  const type = document.getElementById('bc-type')?.value || 'info';
  if (!msg) { showToast('❌ Nhập nội dung thông báo!'); return; }

  try {
    const channel = supabase.channel('game_broadcasts');
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'admin_broadcast',
      payload: { message: msg, type, timestamp: Date.now() }
    });
    channel.unsubscribe();

    // Also save to DB for history
    await supabase.from('admin_settings').upsert({
      key: 'last_broadcast',
      value: { message: msg, type, timestamp: new Date().toISOString() }
    });

    document.getElementById('bc-message').value = '';
    showToast('📢 Thông báo đã được gửi thành công!');
  } catch (err) {
    showToast(`❌ Lỗi: ${err.message || err}`);
  }
}

// ── Tab 7: Analytics ───────────────────────────────────────────────
async function loadAnalytics() {
  const el = document.getElementById('analytics-content');
  if (!el) return;

  try {
    const data = await runAdminAction('get-overview');

    const { data: players } = await supabase
      .from('players')
      .select('wins, losses, battles, gold, gems, arena_rating, campaign_floor')
      .limit(100);

    const totalPlayers = data.totalPlayers || 0;
    const totalBattles = (players || []).reduce((s, p) => s + (p.battles || 0), 0);
    const avgRating = Math.round((players || []).reduce((s, p) => s + (p.arena_rating || 1000), 0) / Math.max(1, totalPlayers));
    const topFloor = Math.max(1, ...(players || []).map(p => p.campaign_floor || 1));
    const totalGold = (players || []).reduce((s, p) => s + (p.gold || 0), 0);
    const totalGems = (players || []).reduce((s, p) => s + (p.gems || 0), 0);

    // Simple bar chart using CSS
    const ratingBuckets = { '<900':0, '900-999':0, '1000-1099':0, '1100-1199':0, '1200+':0 };
    (players || []).forEach(p => {
      const r = p.arena_rating || 1000;
      if (r < 900) ratingBuckets['<900']++;
      else if (r < 1000) ratingBuckets['900-999']++;
      else if (r < 1100) ratingBuckets['1000-1099']++;
      else if (r < 1200) ratingBuckets['1100-1199']++;
      else ratingBuckets['1200+']++;
    });
    const maxBucket = Math.max(1, ...Object.values(ratingBuckets));

    el.innerHTML = `
      <div class="admin-stats-grid" style="margin-bottom:30px">
        <div class="admin-stat-card"><div style="font-size:11px;color:#666;margin-bottom:5px">⚔ TỔNG TRẬN ĐẤU</div><div style="font-size:28px;font-weight:bold;color:var(--cyan)">${totalBattles}</div></div>
        <div class="admin-stat-card"><div style="font-size:11px;color:#666;margin-bottom:5px">🏆 RATING TB</div><div style="font-size:28px;font-weight:bold;color:var(--gold)">${avgRating}</div></div>
        <div class="admin-stat-card"><div style="font-size:11px;color:#666;margin-bottom:5px">📖 CAMPAIGN MAX</div><div style="font-size:28px;font-weight:bold;color:#00ff88">${topFloor}</div></div>
        <div class="admin-stat-card"><div style="font-size:11px;color:#666;margin-bottom:5px">💰 TỔNG VÀNG</div><div style="font-size:28px;font-weight:bold;color:var(--gold)">${totalGold.toLocaleString()}</div></div>
        <div class="admin-stat-card"><div style="font-size:11px;color:#666;margin-bottom:5px">💎 TỔNG GEMS</div><div style="font-size:28px;font-weight:bold;color:var(--cyan)">${totalGems.toLocaleString()}</div></div>
      </div>

      <div class="admin-card">
        <div class="admin-card-title"><span>📊</span> Phân Bố Rating Người Chơi</div>
        <div style="display:flex;align-items:flex-end;gap:12px;height:120px;padding:10px 0">
          ${Object.entries(ratingBuckets).map(([label, count]) => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="font-size:11px;color:var(--cyan);font-weight:bold">${count}</div>
              <div style="width:100%;background:linear-gradient(to top, var(--cyan), rgba(0,229,255,0.3));border-radius:4px 4px 0 0;height:${Math.max(4, (count/maxBucket)*100)}px;transition:height 0.5s"></div>
              <div style="font-size:9px;color:#666;white-space:nowrap">${label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Analytics error:', err);
    el.innerHTML = '<div style="color:var(--red);padding:20px">❌ Không thể tải analytics</div>';
  }
}

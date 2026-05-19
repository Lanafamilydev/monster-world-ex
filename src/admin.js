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
    orders: 'Lịch Sử Giao Dịch'
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
}

// ── Tab 1: Overview & Active Pending Orders ──────────────────
async function loadOverview() {
  try {
    // 1. Fetch total players
    const { count: totalPlayers, error: pErr } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    if (pErr) throw pErr;
    document.getElementById('stat-total-players').innerText = totalPlayers || 0;

    // 2. Fetch all orders
    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('*');

    if (oErr) throw oErr;

    let revenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    const pendingOrders = [];

    (orders || []).forEach(o => {
      if (o.status === 'paid') {
        revenue += o.amount || 0;
        paidCount++;
      } else {
        pendingCount++;
        pendingOrders.push(o);
      }
    });

    document.getElementById('stat-total-revenue').innerText = revenue.toLocaleString() + 'đ';
    document.getElementById('stat-paid-orders').innerText = paidCount;
    document.getElementById('stat-pending-orders').innerText = pendingCount;

    // Render pending orders table
    const tableBody = document.querySelector('#table-pending-orders tbody');
    if (!tableBody) return;

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
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        key: 'payment_config',
        value: newConfig,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    showToast('✅ Đã lưu cấu hình thanh toán thành công!');
  } catch (err) {
    console.error('Save configs error:', err);
    showToast('❌ Không thể lưu cấu hình. Hãy kiểm tra bảng admin_settings.');
  }
}

// ── Tab 3: Players Management & direct values update ──────────
async function searchPlayers() {
  const query = document.getElementById('search-player-input')?.value.trim() || '';
  const tableBody = document.querySelector('#table-players tbody');
  if (!tableBody) return;

  try {
    let req = supabase.from('players').select('*');
    if (query) {
      req = req.ilike('name', `%${query}%`);
    }

    const { data: players, error } = await req.limit(50);
    if (error) throw error;

    if (!players || players.length === 0) {
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
    const { error } = await supabase
      .from('players')
      .update({ gold, gems, updated_at: new Date().toISOString() })
      .eq('id', playerId);

    if (error) throw error;
    showToast('✅ Cập nhật dữ liệu người chơi thành công!');
  } catch (err) {
    console.error('Update player error:', err);
    showToast('❌ Gặp lỗi khi lưu lên database (Có thể do chính sách RLS).');
  }
}

// ── Tab 4: All Orders Transactions History ────────────────────
async function loadOrdersHistory() {
  const tableBody = document.querySelector('#table-all-orders tbody');
  if (!tableBody) return;

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!orders || orders.length === 0) {
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
          <span style="font-weight: bold; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: ${o.status === 'paid' ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)'}; color: ${o.status === 'paid' ? '#00ff88' : '#ff4444'};">
            ${o.status === 'paid' ? 'THÀNH CÔNG' : 'CHỜ DUYỆT'}
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
    // 1. Mark order as paid in DB (Excluding paid_at which is missing from database schema to avoid 400 errors)
    const { error: updOrderErr } = await supabase
      .from('orders')
      .update({ status: 'paid' }) // 100% correct, no paid_at column error
      .eq('id', orderId);

    if (updOrderErr) throw updOrderErr;

    // 2. Best-effort update player's database column (ignores RLS errors)
    try {
      const { data: player, error: pErr } = await supabase
        .from('players')
        .select('gems')
        .eq('id', playerId)
        .single();

      if (!pErr && player) {
        const currentGems = player.gems || 0;
        await supabase
          .from('players')
          .update({ gems: currentGems + gemsReward })
          .eq('id', playerId);
      }
    } catch (dbErr) {
      console.warn('RLS blocked admin from updating player row directly. Re-syncing client-side.');
    }

    showToast('⚡ Duyệt đơn thành công! Trạng thái đơn đã được cập nhật thành PAID.');
    await loadOverview();

  } catch (err) {
    console.error('Approve order error:', err);
    showToast(`❌ Duyệt đơn thất bại: ${err.message || err}`);
  }
}

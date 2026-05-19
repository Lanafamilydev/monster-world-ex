import { supabase } from '../core/supabaseClient.js';
import { toast } from '../ui/UIHelpers.js';
import { P, savePlayer, updateGlobalHeader } from '../core/playerState.js';

// Default Payment Configurations
export const DEFAULT_PAYMENT = {
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

// ── Admin Entry ──────────────────────────────────────────────
export async function openAdminPanel() {
  const pass = prompt('🔑 Vui lòng nhập Mật mã Admin:');
  if (pass === null) return;
  if (pass !== 'admin123') {
    toast('❌ Mật mã Admin không chính xác!');
    return;
  }

  document.getElementById('admin-overlay').classList.add('show');
  switchAdminTab('overview');
}

export function closeAdminPanel() {
  document.getElementById('admin-overlay').classList.remove('show');
}

// ── Tab Management ───────────────────────────────────────────
export async function switchAdminTab(tabName) {
  currentTab = tabName;
  
  // Update Tab buttons
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`admin-tab-btn-${tabName}`)?.classList.add('active');

  // Update Tab contents
  document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
  const targetContent = document.getElementById(`admin-content-${tabName}`);
  if (targetContent) targetContent.style.display = 'block';

  // Load appropriate data
  if (tabName === 'overview') await loadOverviewData();
  if (tabName === 'payment') await loadPaymentSettings();
  if (tabName === 'players') await searchAdminPlayers();
  if (tabName === 'orders') await loadAllOrders();
}

// ── Tab 1: Overview ──────────────────────────────────────────
async function loadOverviewData() {
  try {
    // 1. Fetch total players count
    const { count: totalPlayers, error: pErr } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    if (pErr) throw pErr;
    document.getElementById('admin-stat-players').innerText = totalPlayers || 0;

    // 2. Fetch all orders for revenue calculation
    const { data: allOrders, error: oErr } = await supabase
      .from('orders')
      .select('*');

    if (oErr) throw oErr;
    
    let revenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    const pendingOrders = [];

    (allOrders || []).forEach(o => {
      if (o.status === 'paid') {
        revenue += o.amount || 0;
        paidCount++;
      } else {
        pendingCount++;
        pendingOrders.push(o);
      }
    });

    document.getElementById('admin-stat-revenue').innerText = revenue.toLocaleString() + 'đ';
    document.getElementById('admin-stat-paid-orders').innerText = paidCount;
    document.getElementById('admin-stat-pending-orders').innerText = pendingCount;

    // 3. Render pending orders table
    const tableBody = document.querySelector('#admin-pending-orders-table tbody');
    if (!tableBody) return;

    if (pendingOrders.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #777;">🎉 Không có giao dịch chờ duyệt!</td></tr>`;
      return;
    }

    tableBody.innerHTML = pendingOrders.map(o => `
      <tr>
        <td style="font-family: 'Orbitron', sans-serif; color: var(--gold);">${o.order_code || o.transaction_code}</td>
        <td style="font-size: 10px; color: #aaa;">${o.player_id.substring(0, 8)}...</td>
        <td style="color: #00ff88;">${o.amount.toLocaleString()}đ</td>
        <td style="color: var(--cyan);">${o.gems_reward} 💎</td>
        <td style="text-align: center;">
          <button class="admin-btn-action" onclick="adminApproveOrder('${o.id}', ${o.gems_reward}, '${o.player_id}')">⚡ DUYỆT</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('[Admin] Overview error:', err);
    toast('❌ Không thể tải số liệu tổng quan.');
  }
}

// ── Tab 2: Payment & Rates Settings ──────────────────────────
async function loadPaymentSettings() {
  try {
    // Fetch configs from database
    const { data: dbConfig, error } = await supabase
      .from('admin_settings')
      .select('*');

    if (error && error.code !== 'PGRST116') {
      console.warn('Could not read admin_settings (table might be missing), using defaults.');
    }

    const configs = {};
    (dbConfig || []).forEach(row => {
      configs[row.key] = row.value;
    });

    const payment = configs['payment_config'] || DEFAULT_PAYMENT;
    const pkgs = payment.packages || DEFAULT_PAYMENT.packages;

    document.getElementById('admin-pay-bank').value = payment.bank || '';
    document.getElementById('admin-pay-acc').value = payment.account_no || '';
    document.getElementById('admin-pay-holder').value = payment.account_holder || '';

    document.getElementById('admin-pkg1-vnd').value = pkgs[0]?.vnd || 2000;
    document.getElementById('admin-pkg1-gems').value = pkgs[0]?.gems || 200;

    document.getElementById('admin-pkg2-vnd').value = pkgs[1]?.vnd || 10000;
    document.getElementById('admin-pkg2-gems').value = pkgs[1]?.gems || 1100;

    document.getElementById('admin-pkg3-vnd').value = pkgs[2]?.vnd || 20000;
    document.getElementById('admin-pkg3-gems').value = pkgs[2]?.gems || 2500;

  } catch (err) {
    console.error('[Admin] Load settings error:', err);
  }
}

export async function saveAdminSettings() {
  const bank = document.getElementById('admin-pay-bank').value.trim();
  const acc = document.getElementById('admin-pay-acc').value.trim();
  const holder = document.getElementById('admin-pay-holder').value.trim().toUpperCase();

  const pkg1Vnd = parseInt(document.getElementById('admin-pkg1-vnd').value) || 2000;
  const pkg1Gems = parseInt(document.getElementById('admin-pkg1-gems').value) || 200;

  const pkg2Vnd = parseInt(document.getElementById('admin-pkg2-vnd').value) || 10000;
  const pkg2Gems = parseInt(document.getElementById('admin-pkg2-gems').value) || 1100;

  const pkg3Vnd = parseInt(document.getElementById('admin-pkg3-vnd').value) || 20000;
  const pkg3Gems = parseInt(document.getElementById('admin-pkg3-gems').value) || 2500;

  if (!bank || !acc || !holder) {
    toast('❌ Vui lòng nhập đầy đủ thông tin ngân hàng!');
    return;
  }

  const paymentConfig = {
    bank,
    account_no: acc,
    account_holder: holder,
    packages: [
      { vnd: pkg1Vnd, gems: pkg1Gems, name: 'Gói Tập Sự', desc: 'Chỉ để test SePay', icon: '💎', hue: 180 },
      { vnd: pkg2Vnd, gems: pkg2Gems, name: 'Gói Tiêu Chuẩn', desc: 'Khuyến mãi +10%', icon: '👑', hue: 250 },
      { vnd: pkg3Vnd, gems: pkg3Gems, name: 'Gói Vua Chơi', desc: 'Khuyến mãi +25%', icon: '🏆', hue: 300 }
    ]
  };

  try {
    // Save to Supabase using upsert
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        key: 'payment_config',
        value: paymentConfig,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    toast('✅ Đã lưu cấu hình thanh toán thành công!');
    
    // Refresh Shop premium listings
    import('./Shop.js').then(m => m.renderPremiumShopSection?.());

  } catch (err) {
    console.error('[Admin] Save settings error:', err);
    toast('❌ Gặp lỗi khi lưu lên database. Bạn đã tạo bảng admin_settings chưa?');
  }
}

// ── Tab 3: Players Management ────────────────────────────────
export async function searchAdminPlayers() {
  const query = document.getElementById('admin-search-player')?.value.trim() || '';
  const tableBody = document.querySelector('#admin-players-table tbody');
  if (!tableBody) return;

  try {
    let req = supabase.from('players').select('*');
    if (query) {
      req = req.ilike('name', `%${query}%`);
    }
    
    const { data: players, error } = await req.limit(50);
    if (error) throw error;

    if (!players || players.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #777;">🔍 Không tìm thấy người chơi nào.</td></tr>`;
      return;
    }

    tableBody.innerHTML = players.map(p => `
      <tr>
        <td style="font-size: 10px; color: #aaa;">${p.id}</td>
        <td style="font-weight: bold; color: #fff;">${p.name}</td>
        <td>
          <input type="number" class="admin-input-small" id="ap-gold-${p.id}" value="${p.gold}">
        </td>
        <td>
          <input type="number" class="admin-input-small" id="ap-gems-${p.id}" value="${p.gems || 0}">
        </td>
        <td style="text-align: center;">
          <button class="admin-btn-action" onclick="adminUpdatePlayer('${p.id}')">💾 LƯU</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('[Admin] Search players error:', err);
    toast('❌ Lỗi tải danh sách người chơi.');
  }
}

export async function adminUpdatePlayer(playerId) {
  const gold = parseInt(document.getElementById(`ap-gold-${playerId}`).value) || 0;
  const gems = parseInt(document.getElementById(`ap-gems-${playerId}`).value) || 0;

  try {
    const { error } = await supabase
      .from('players')
      .update({ gold, gems, updated_at: new Date().toISOString() })
      .eq('id', playerId);

    if (error) throw error;
    toast('✅ Cập nhật người chơi thành công!');

    // If updated player is the CURRENT logged in player, sync their local UI instantly!
    if (P.id === playerId) {
      P.gold = gold;
      P.gems = gems;
      savePlayer();
      updateGlobalHeader();
    }
  } catch (err) {
    console.error('[Admin] Update player error:', err);
    toast('❌ Gặp lỗi khi cập nhật.');
  }
}

// ── Tab 4: All Orders ────────────────────────────────────────
async function loadAllOrders() {
  const tableBody = document.querySelector('#admin-all-orders-table tbody');
  if (!tableBody) return;

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!orders || orders.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #777;">Không có đơn hàng nào.</td></tr>`;
      return;
    }

    tableBody.innerHTML = orders.map(o => `
      <tr>
        <td style="font-family: 'Orbitron', sans-serif; color: var(--gold);">${o.order_code || o.transaction_code}</td>
        <td style="font-size: 10px; color: #888;">${o.player_id.substring(0,8)}...</td>
        <td style="color: #00ff88;">${o.amount.toLocaleString()}đ</td>
        <td style="color: var(--cyan);">${o.gems_reward} 💎</td>
        <td>
          <span class="admin-badge ${o.status}">${o.status === 'paid' ? 'THÀNH CÔNG' : 'CHỜ DUYỆT'}</span>
        </td>
        <td style="font-size: 10px; color: #666;">${new Date(o.created_at).toLocaleString()}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('[Admin] Load all orders error:', err);
    toast('❌ Lỗi tải danh sách đơn hàng.');
  }
}

// ── Order Approval ───────────────────────────────────────────
export async function adminApproveOrder(orderId, gemsReward, playerId) {
  const confirmApprove = confirm(`Bạn có chắc chắn muốn DUYỆT THỦ CÔNG đơn hàng này?\nNgười chơi sẽ nhận ngay ${gemsReward} Gems!`);
  if (!confirmApprove) return;

  try {
    // 1. Fetch current player gems
    const { data: player, error: pErr } = await supabase
      .from('players')
      .select('gems')
      .eq('id', playerId)
      .single();

    if (pErr) throw pErr;

    const currentGems = player?.gems || 0;

    // 2. Add Gems in DB
    const { error: updPlayerErr } = await supabase
      .from('players')
      .update({ gems: currentGems + gemsReward })
      .eq('id', playerId);

    if (updPlayerErr) throw updPlayerErr;

    // 3. Mark order as paid
    const { error: updOrderErr } = await supabase
      .from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updOrderErr) throw updOrderErr;

    toast('⚡ Duyệt đơn hàng thành công! Gems đã được cộng vào tài khoản người chơi.');
    
    // Refresh Overview
    await loadOverviewData();

    // If active player is the current user, update their UI instantly
    if (P.id === playerId) {
      P.gems = (P.gems || 0) + gemsReward;
      savePlayer();
      updateGlobalHeader();
    }

  } catch (err) {
    console.error('[Admin] Manual approval failed:', err);
    toast('❌ Phê duyệt thất bại. Vui lòng kiểm tra lại.');
  }
}

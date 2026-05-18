// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Auth Modal Controller (Sprint 2)
// Handles Login, Registration, Guest Mode, and Google OAuth
// ═══════════════════════════════════════════════════════════════

import { P, savePlayer, savePlayerToCloud, loadPlayerFromCloud, updateGlobalHeader } from '../core/playerState.js';
import { supabase } from '../core/supabaseClient.js';
import { toast } from './UIHelpers.js';
import { renderAccountTab } from './Tabs.js';
import { renderItemShop } from '../features/Shop.js';
import { renderRosterTab, renderPokedex } from '../features/Roster.js';

/** Switch visible screen in the authentication modal */
export function showAuthScreen(screenId) {
  document.querySelectorAll('.auth-screen').forEach(s => s.classList.remove('show'));
  const target = document.getElementById(`auth-screen-${screenId}`);
  if (target) {
    target.classList.add('show');
    // Autofocus inputs if available
    target.querySelector('input')?.focus();
  }
}

/** Handle Email/Password Login */
export async function handleEmailLogin() {
  const emailInput = document.getElementById('auth-login-email');
  const passInput = document.getElementById('auth-login-pass');
  const email = emailInput?.value.trim();
  const password = passInput?.value;

  if (!email || !password) {
    toast('❌ Vui lòng nhập đầy đủ Email và Mật khẩu!');
    return;
  }

  // Show loading indicator
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('show');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data?.user) {
      // Check if player has made substantial guest progress (to migrate)
      const hasGuestProgress = P.gold !== 500 || P.totalScore > 0 || P.wins > 0 || P.collection.length > 5;
      
      if (hasGuestProgress) {
        const confirmMigrate = confirm("⚠️ Phát hiện tiến trình chơi Khách (Guest) trên máy này. Bạn có muốn ĐỒNG BỘ dữ liệu chơi này lên tài khoản mới đăng nhập không?\n\n- Chọn 'OK': Đồng bộ dữ liệu hiện tại lên tài khoản.\n- Chọn 'Cancel': Tải dữ liệu cũ từ đám mây (nếu có).");
        if (confirmMigrate) {
          await savePlayerToCloud(data.user.id);
          toast('✨ Đồng bộ tiến trình chơi lên tài khoản thành công!');
        } else {
          await loadPlayerFromCloud(data.user.id);
        }
      } else {
        await loadPlayerFromCloud(data.user.id);
      }

      // Close modal
      document.getElementById('name-modal')?.classList.remove('show');
      updateGlobalHeader();
      
      // Re-render UI components
      renderAccountTab();
      renderItemShop();
      renderRosterTab();
      renderPokedex();

      toast(`⚡ Chào mừng chiến binh ${P.name} trở lại!`);
    }
  } catch (err) {
    toast(`❌ Đăng nhập thất bại: ${err.message}`);
  } finally {
    if (loading) loading.classList.remove('show');
  }
}

/** Handle Email/Password Registration */
export async function handleEmailRegister() {
  const emailInput = document.getElementById('auth-reg-email');
  const passInput = document.getElementById('auth-reg-pass');
  const nameInput = document.getElementById('auth-reg-name');
  
  const email = emailInput?.value.trim();
  const password = passInput?.value;
  const regName = nameInput?.value.trim() || 'Yugi';

  if (!email || !password) {
    toast('❌ Vui lòng nhập đầy đủ Email và Mật khẩu!');
    return;
  }
  if (password.length < 6) {
    toast('❌ Mật khẩu phải có tối thiểu 6 ký tự!');
    return;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('show');

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data?.user) {
      // 1. Set name
      P.name = regName;
      
      // If email confirmation is enabled in Supabase, data.session is null
      if (!data.session) {
        toast('✉️ Đăng ký thành công! Vui lòng xác nhận email để kích hoạt tài khoản.');
        alert('✨ Đăng ký tài khoản thành công!\n\nHệ thống phát hiện dự án Supabase đang bật chế độ "Confirm email" (Xác nhận Email).\nVui lòng:\n1. Kiểm tra hòm thư của bạn để xác nhận email.\n2. HOẶC vào Supabase Dashboard -> Authentication -> Providers -> Email -> Tắt "Confirm email" để tự động kích hoạt tài khoản đăng ký mới ngay lập tức!');
        showAuthScreen('email-login');
        return;
      }

      // 2. Save fresh player database record immediately
      const saved = await savePlayerToCloud(data.user.id);
      if (!saved) {
        console.warn("Could not save initial player state to cloud, retrying...");
        await savePlayerToCloud(data.user.id);
      }

      // Close modal
      document.getElementById('name-modal')?.classList.remove('show');
      updateGlobalHeader();

      // Re-render
      renderAccountTab();
      renderItemShop();
      renderRosterTab();
      renderPokedex();

      toast(`✨ Đăng ký thành công! Chào mừng chiến binh ${P.name}!`);
    }
  } catch (err) {
    toast(`❌ Đăng ký thất bại: ${err.message}`);
  } finally {
    if (loading) loading.classList.remove('show');
  }
}

/** Handle Google OAuth Login */
export async function handleGoogleLogin() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  } catch (err) {
    toast(`❌ Đăng nhập Google thất bại: ${err.message}`);
  }
}

/** Handle Account Sign Out */
export async function handleSignOut() {
  const confirmLogout = confirm("Bạn có chắc chắn muốn đăng xuất tài khoản không?\n\n*Tiến trình sẽ được lưu đám mây an toàn.");
  if (!confirmLogout) return;

  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('show');

  try {
    await supabase.auth.signOut();
    
    // Clear local storage to prevent stale local data
    localStorage.clear();
    
    toast('🚪 Đã đăng xuất thành công! Đang tải lại...');
    setTimeout(() => {
      window.location.reload();
    }, 850);
  } catch (err) {
    toast(`❌ Lỗi đăng xuất: ${err.message}`);
  } finally {
    if (loading) loading.classList.remove('show');
  }
}

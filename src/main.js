// ═══════════════════════════════════════════════════════════════

import { P, loadPlayer, initFreshPlayer, updateGlobalHeader, exportSave, importSave } from './core/playerState.js';
import { switchTab, renderAccountTab, renderInventoryDisplay } from './ui/Tabs.js';
import { renderItemShop, openGacha, closeGachaResult } from './features/Shop.js';
import { renderRosterTab, renderPokedex } from './features/Roster.js';
import { showEvoModal, closeEvoModal, showEvoModalForRoster } from './features/Evolution.js';
import { showModeSelect, hideModeSelect, startSession, dismissEndlessReward } from './systems/SessionManager.js';
import { endTurn, cancelAct } from './systems/TurnSystem.js';
import { activateUlti, closeMobUd, closeMobDrawer, initDrawerBindings, toggleMobLog, calcBoardSize, isMobile } from './ui/Renderer.js';
import { createAccount, renamePlayer } from './core/playerState.js';
import { toggleCodex } from './ui/Codex.js';

// ── Expose all functions needed by HTML onclick ───────────────
window.switchTab            = switchTab;
window.openGacha            = openGacha;
window.closeGachaResult     = closeGachaResult;
window.showEvoModal         = showEvoModal;
window.closeEvoModal           = closeEvoModal;
window.showEvoModalForRoster   = showEvoModalForRoster;
window.showModeSelect       = showModeSelect;
window.hideModeSelect       = hideModeSelect;
window.startSession         = startSession;
window.dismissEndlessReward = dismissEndlessReward;
window.endTurn              = endTurn;
window.cancelAct            = cancelAct;
window.activateUlti         = activateUlti;
window.createAccount        = createAccount;
window.renamePlayer         = renamePlayer;
window.closeMobUd           = closeMobUd;
window.closeMobDrawer       = closeMobDrawer;
window.toggleMobLog         = toggleMobLog;
window.toggleCodex          = toggleCodex;
window.exportData           = () => {
  const code = exportSave();
  prompt('Copy mã lưu trữ của bạn:', code);
};
window.importData           = async () => {
  const code = prompt('Dán mã lưu trữ (Base64) vào đây:');
  if (code) await importSave(code);
};

window.closeGameOverGoShop = () => {
  document.getElementById('go-overlay')?.classList.remove('show');
  switchTab('shop');
};

window.resetGame = () => {
  document.getElementById('go-overlay')?.classList.remove('show');
  document.getElementById('evo-modal')?.classList.remove('show');
  document.getElementById('ulti-overlay')?.classList.remove('show');
  document.getElementById('mob-ud-overlay')?.classList.remove('open');
  closeMobDrawer();
  document.getElementById('mob-log-panel')?.classList.remove('log-open');
  const aiBar = document.getElementById('ai-bar');
  if (aiBar) aiBar.style.display = 'none';
  document.querySelectorAll('.cancel-btn-all').forEach(b => b.style.display = 'none');
  const log = document.getElementById('log');
  if (log) log.innerHTML = '';
  const mobLog = document.getElementById('mob-log-content');
  if (mobLog) mobLog.innerHTML = '';
  showModeSelect();
};

// ── Resize / orientation handlers ─────────────────────────────
let _resizeTimer;

function onResize() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    calcBoardSize();
    // Correct body padding when viewport crosses 768px boundary
    if (window.innerWidth >= 768) {
      document.body.style.paddingBottom = '0';
    } else {
      document.body.style.paddingBottom = ''; // let CSS take over
    }
  }, 100);
}

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 350));

// VisualViewport API — fires on mobile keyboard open/close
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(calcBoardSize, 80);
  });
}

// ── Mobile gestures ───────────────────────────────────────────
(function initMobileGestures() {
  // Swipe-down to close unit detail overlay
  const overlay = document.getElementById('mob-ud-overlay');
  if (!overlay) return;
  let startY = 0;
  overlay.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - startY > 60) closeMobUd();
  }, { passive: true });
})();

// Tap outside overlay to close it
document.addEventListener('click', e => {
  // Mobile unit detail overlay
  const ov = document.getElementById('mob-ud-overlay');
  if (ov?.classList.contains('open') && !ov.contains(e.target)) closeMobUd();
  
  // Codex overlay
  const codex = document.getElementById('codex-overlay');
  if (codex?.classList.contains('show') && !codex.querySelector('.codex-content')?.contains(e.target) && !e.target.closest('#codex-btn')) {
    toggleCodex();
  }
}, { capture: false });

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  try {
    const hasSave = await loadPlayer();

    if (hasSave) {
      updateGlobalHeader();
      renderItemShop();
      renderRosterTab();
      renderPokedex();
    } else {
      initFreshPlayer('Yugi');
      document.getElementById('name-modal')?.classList.add('show');
    }

    // Guarantee correct body padding at startup
    document.body.style.paddingBottom = window.innerWidth >= 768 ? '0' : '';

    switchTab('battle');
    document.body.classList.add('tab-battle'); // initial state
    setTimeout(() => showModeSelect(), 300);
    calcBoardSize();

    // Bind drawer ctrl buttons once — ES-module safe, no onclick= needed
    initDrawerBindings();
  } catch (err) {
    console.error('Initialization failed:', err);
  } finally {
    // Hide loading screen
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.opacity = '0';
      setTimeout(() => {
        loading.classList.remove('show');
        loading.style.opacity = '';
      }, 400);
    }
  }
}

init();

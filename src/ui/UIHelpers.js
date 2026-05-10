// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 Mobile — UI Helpers
// Toast, battle log (desktop + mobile mirror), cancel sync
// ═══════════════════════════════════════════════════════════════

import { syncMobLog } from './Renderer.js';

let _toastTimer = null;

/** Show a brief toast notification */
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) { console.log('[Toast]', msg); return; }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('on'), 2800);
}

/** Add a line to the battle log (desktop + mirrors to mobile panel) */
export function addLog(msg, type = 'ls') {
  const log = document.getElementById('log');
  if (!log) return;
  const e = document.createElement('div');
  e.className = 'le ' + type;
  e.textContent = msg;
  log.appendChild(e);
  if (log.children.length > 150) log.children[0].remove();
  log.scrollTop = log.scrollHeight;
  // Mirror to mobile log panel
  syncMobLog();
}

/** Add a turn separator line */
export function addLogSep(turn, round) {
  const log = document.getElementById('log');
  if (!log) return;
  const e = document.createElement('div');
  e.className = 'lsep ' + (turn === 'player' ? 'lsep-p' : 'lsep-e');
  e.textContent = turn === 'player'
    ? `── ⚡ YUGI (Round ${round}) ──`
    : `── 👺 BAKURA (Round ${round}) ──`;
  log.appendChild(e);
  if (log.children.length > 150) log.children[0].remove();
  log.scrollTop = log.scrollHeight;
  syncMobLog();
}

/** Float damage/heal/reaction text over a board cell */
export function floatTxt(r, c, text, type = 'damage', color = '#fff') {
  const bd = document.getElementById('board');
  if (!bd) return;
  const cells  = bd.querySelectorAll('.cell');
  const G_cols = parseInt(
    bd.style.gridTemplateColumns?.match(/repeat\((\d+)/)?.[1] || '10'
  );
  const idx = r * G_cols + c;
  if (idx >= cells.length) return;
  const cell  = cells[idx];
  const rect  = cell.getBoundingClientRect();
  const brect = bd.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'df ' + type;
  el.textContent = text;
  if (color) el.style.color = color;
  el.style.left  = (rect.left - brect.left + rect.width / 2 - 20) + 'px';
  el.style.top   = (rect.top  - brect.top) + 'px';
  bd.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/** Shake the board or whole container with varying intensity */
export function screenShake(intensity = 'lite') {
  const bd = document.getElementById('board');
  if (!bd) return;
  const cls = 'shake-' + intensity;
  bd.classList.add(cls);
  setTimeout(() => bd.classList.remove(cls), intensity === 'heavy' ? 500 : 300);
}

/** Shake the board (legacy support) */
export function shakeBoard() { screenShake('lite'); }

/**
 * Show cancel button — targets ALL .cancel-btn-all elements
 * so both desktop (#cancel-btn) and mobile (#mob-cancel-btn) sync
 */
export function showCancel() {
  document.querySelectorAll('.cancel-btn-all').forEach(b => {
    b.style.display = 'block';
  });
}

/** Hide cancel button — syncs both desktop and mobile */
export function hideCancel() {
  document.querySelectorAll('.cancel-btn-all').forEach(b => {
    b.style.display = 'none';
  });
}

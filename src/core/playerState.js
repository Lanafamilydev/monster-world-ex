// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Player State Module
// Manages persistent player data with localStorage sync
// ═══════════════════════════════════════════════════════════════

import { SAVE_KEY, DEFAULT_PLAYER } from './data.js';

// Mutable player object — imported by all modules
export const P = {};

/** Save player state to localStorage */
export function savePlayer() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(P));
  } catch (e) {
    console.warn('Cannot save:', e);
  }
}

/** Load player from localStorage — returns true if found */
export function loadPlayer() {
  try {
    const d = localStorage.getItem(SAVE_KEY);
    if (!d) return false;
    const saved = JSON.parse(d);
    // Deep merge with defaults for forward compatibility
    const merged = Object.assign({}, DEFAULT_PLAYER, saved, {
      inventory:     Object.assign({}, DEFAULT_PLAYER.inventory, saved.inventory || {}),
      affinity:      Object.assign({}, saved.affinity || {}),
      fatigue:       Object.assign({}, saved.fatigue || {}),
      monsterLevels: Object.assign({}, saved.monsterLevels || {}),
      roster:        (saved.roster && saved.roster.length) ? saved.roster : [...DEFAULT_PLAYER.roster],
      collection:    saved.collection || [...DEFAULT_PLAYER.collection],
    });
    Object.assign(P, merged);
    return true;
  } catch (e) {
    console.warn('Load error:', e);
    return false;
  }
}

/** Initialize fresh player state */
export function initFreshPlayer(name = 'Yugi') {
  Object.assign(P, { ...DEFAULT_PLAYER, name });
  savePlayer();
}

/** Update displayed header in global nav */
export function updateGlobalHeader() {
  const nameEl  = document.getElementById('g-name');
  const goldEl  = document.getElementById('g-gold');
  const scoreEl = document.getElementById('g-score');
  if (nameEl)  nameEl.textContent  = `⚡ ${P.name || 'Yugi'}`;
  if (goldEl)  goldEl.textContent  = `💰 ${P.gold}`;
  if (scoreEl) scoreEl.textContent = `⭐ ${P.totalScore}`;
}

/** Rename player */
export function renamePlayer(name) {
  const n = name.trim();
  if (!n) return;
  P.name = n;
  savePlayer();
  updateGlobalHeader();
}

/** Create account from name modal */
export function createAccount() {
  const input = document.getElementById('nm-input');
  const name  = (input ? input.value.trim() : '') || 'Yugi';
  Object.assign(P, { ...DEFAULT_PLAYER, name });
  savePlayer();
  document.getElementById('name-modal')?.classList.remove('show');
  updateGlobalHeader();
  import('../features/Shop.js').then(m => m.renderItemShop());
  import('../ui/Tabs.js').then(m => m.renderAccountTab());
  showToast(`⚡ Chào mừng ${name}! Bắt đầu hành trình!`);
}

// Lazy toast import to avoid circular deps
function showToast(msg) {
  import('../ui/UIHelpers.js').then(m => m.toast(msg));
}

/** Add gold with save */
export function addGold(amount) {
  P.gold = Math.max(0, P.gold + amount);
  savePlayer();
  updateGlobalHeader();
}

/** Spend gold — returns false if insufficient */
export function spendGold(amount) {
  if (P.gold < amount) return false;
  P.gold -= amount;
  savePlayer();
  updateGlobalHeader();
  return true;
}

/** Add monster to collection (deduped) */
export function addToCollection(monsterId) {
  if (!P.collection.includes(monsterId)) {
    P.collection.push(monsterId);
    savePlayer();
    return true; // is new
  }
  return false;
}

/** Add monster to roster (max 5) — returns true if added */
export function addToRoster(monsterId) {
  if (!P.collection.includes(monsterId)) return false;
  if (P.roster.length >= 5) return false;
  if (P.roster.includes(monsterId)) return false;
  P.roster.push(monsterId);
  savePlayer();
  return true;
}

/** Remove from roster */
export function removeFromRoster(monsterId) {
  P.roster = P.roster.filter(id => id !== monsterId);
  savePlayer();
}

/** Persist monster level from battle to P.monsterLevels */
export function persistMonsterLevel(unitObj) {
  if (!P.monsterLevels) P.monsterLevels = {};
  const existing = P.monsterLevels[unitObj.id];
  if (!existing) {
    P.monsterLevels[unitObj.id] = {
      lv: unitObj.lv, xp: unitObj.xp,
      evolved: unitObj.evolved, evoPathId: unitObj.evoPathId || null
    };
  } else {
    // Prevent battle from overwriting a higher manual level
    if (unitObj.lv > existing.lv) {
      existing.lv = unitObj.lv;
      existing.xp = unitObj.xp;
    } else if (unitObj.lv === existing.lv) {
      existing.xp = Math.max(existing.xp || 0, unitObj.xp || 0);
    }
    
    // Always preserve evolution state
    if (unitObj.evolved) existing.evolved = true;
    if (unitObj.evoPathId) existing.evoPathId = unitObj.evoPathId;
  }
}

/** Compute player "Power Score" for enemy scaling */
export function computePowerScore() {
  const roster = P.roster || [];
  if (!roster.length) return 100;
  let total = 0;
  roster.forEach(id => {
    const ml = P.monsterLevels?.[id];
    const lv = ml ? ml.lv : 1;
    const evoBonus = ml?.evolved ? 1.5 : 1;
    total += lv * 20 * evoBonus;
  });
  return Math.round(total / roster.length);
}

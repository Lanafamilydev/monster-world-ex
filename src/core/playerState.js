// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Player State Module
// Manages persistent player data with localStorage sync
// ═══════════════════════════════════════════════════════════════

import { SAVE_KEY, DEFAULT_PLAYER } from './data.js';

// Mutable player object — imported by all modules
export const P = {};

// ── IndexedDB Wrapper ──
const DB_NAME = 'MonsterWorldDB';
const DB_VERSION = 1;
const STORE_NAME = 'saveData';

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function dbSet(key, value) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Save player state to localStorage and IndexedDB */
export async function savePlayer() {
  try {
    const json = JSON.stringify(P);
    localStorage.setItem(SAVE_KEY, json);
    await dbSet(SAVE_KEY, P);
  } catch (e) {
    console.warn('Cannot save:', e);
  }
}

/** Load player from IndexedDB or localStorage fallback */
export async function loadPlayer() {
  try {
    let data = await dbGet(SAVE_KEY);
    if (!data) {
      const d = localStorage.getItem(SAVE_KEY);
      if (d) data = JSON.parse(d);
    }
    if (!data) return false;

    // Deep merge with defaults for forward compatibility
    const merged = Object.assign({}, DEFAULT_PLAYER, data, {
      inventory:     Object.assign({}, DEFAULT_PLAYER.inventory, data.inventory || {}),
      affinity:      Object.assign({}, data.affinity || {}),
      fatigue:       Object.assign({}, data.fatigue || {}),
      monsterLevels: Object.assign({}, data.monsterLevels || {}),
      roster:        (data.roster && data.roster.length) ? data.roster : [...DEFAULT_PLAYER.roster],
      collection:    data.collection || [...DEFAULT_PLAYER.collection],
      talents:       Object.assign({}, data.talents || {}),
      monsterRunes:  Object.assign({}, data.monsterRunes || {}),
      runes:         data.runes || [],
    });
    Object.assign(P, merged);
    return true;
  } catch (e) {
    console.warn('Load error:', e);
    return false;
  }
}

/** Export save data as Base64 string */
export function exportSave() {
  const json = JSON.stringify(P);
  return btoa(unescape(encodeURIComponent(json)));
}

/** Import save data from Base64 string */
export async function importSave(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(json);
    if (data && data.name) {
      Object.assign(P, data);
      await savePlayer();
      location.reload(); 
    }
  } catch (e) {
    showToast('❌ Lỗi: Mã lưu trữ không hợp lệ!');
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
      evolved: unitObj.evolved, evoPathId: unitObj.evoPathId || null,
      cls: unitObj.cls || null, status: unitObj.status || []
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
    if (unitObj.cls) existing.cls = unitObj.cls;
    if (unitObj.status) existing.status = unitObj.status;
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

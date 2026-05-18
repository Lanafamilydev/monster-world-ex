// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Player State Module
// Manages persistent player data with localStorage sync
// ═══════════════════════════════════════════════════════════════

import { SAVE_KEY, DEFAULT_PLAYER } from './data.js';
import { supabase } from './supabaseClient.js';

// Mutable player object — initialized with defaults, merged on load
export const P = { ...DEFAULT_PLAYER };

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

/** Save player state to localStorage, IndexedDB and Supabase cloud if logged in */
export async function savePlayer() {
  try {
    const json = JSON.stringify(P);
    localStorage.setItem(SAVE_KEY, json);
    await dbSet(SAVE_KEY, P);

    // Save to Supabase Cloud if user is authenticated
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: {} }));
    if (user) {
      await savePlayerToCloud(user.id);
    }
  } catch (e) {
    console.warn('Cannot save:', e);
  }
}

/** Save player state to Supabase Cloud */
export async function savePlayerToCloud(userId) {
  try {
    // 1. Save to 'players' table
    const { error: pErr } = await supabase.from('players').upsert({
      id: userId,
      name: P.name,
      gold: P.gold,
      gems: P.gems || 0,
      total_score: P.totalScore || 0,
      wins: P.wins || 0,
      losses: P.losses || 0,
      battles: P.battles || 0,
      campaign_floor: P.campaignFloor || 1,
      endless_floor: P.endlessFloor || 0,
      arena_rating: P.arenaRating || 1000,
      talents: P.talents || {},
      traits: P.traits || {},
      updated_at: new Date().toISOString()
    });
    if (pErr) throw pErr;

    // 2. Save to 'player_inventory' table
    if (P.inventory) {
      const invRows = Object.entries(P.inventory).map(([itemId, qty]) => ({
        player_id: userId,
        item_id: itemId,
        quantity: qty
      }));
      if (invRows.length > 0) {
        const { error: iErr } = await supabase.from('player_inventory').upsert(invRows);
        if (iErr) throw iErr;
      }
    }

    // 3. Save to 'player_monsters' table
    if (P.collection) {
      const monsterRows = P.collection.map(monsterId => {
        const ml = P.monsterLevels?.[monsterId] || {};
        const isInRoster = P.roster.includes(monsterId);
        const slot = isInRoster ? P.roster.indexOf(monsterId) + 1 : null;
        return {
          player_id: userId,
          monster_id: monsterId,
          level: ml.lv || 1,
          xp: ml.xp || 0,
          is_in_roster: isInRoster,
          roster_slot: slot,
          evolved: ml.evolved || false,
          evo_path_id: ml.evoPathId || null,
          cls: ml.cls || null,
          affinity: P.affinity?.[monsterId] || 0,
          fatigue: P.fatigue?.[monsterId] || 0,
          runes: P.monsterRunes?.[monsterId] || [null, null, null]
        };
      });
      if (monsterRows.length > 0) {
        const { error: mErr } = await supabase.from('player_monsters').upsert(monsterRows, { onConflict: 'player_id,monster_id' });
        if (mErr) throw mErr;
      }
    }
    return true;
  } catch (err) {
    console.warn('Failed to save to cloud:', err);
    return false;
  }
}

/** Load player from Supabase Cloud */
export async function loadPlayerFromCloud(userId) {
  try {
    // 1. Fetch player base stats
    const { data: pData, error: pErr } = await supabase
      .from('players')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!pData) return false;

    // 2. Fetch inventory
    const { data: invData, error: invErr } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_id', userId);
    if (invErr) throw invErr;

    // 3. Fetch monsters
    const { data: monsterData, error: mErr } = await supabase
      .from('player_monsters')
      .select('*')
      .eq('player_id', userId);
    if (mErr) throw mErr;

    // Reconstruct player object P
    const newP = {
      name: pData.name || 'Yugi',
      gold: pData.gold ?? 500,
      gems: pData.gems ?? 10,
      totalScore: pData.total_score ?? 0,
      wins: pData.wins ?? 0,
      losses: pData.losses ?? 0,
      battles: pData.battles ?? 0,
      campaignFloor: pData.campaign_floor ?? 1,
      endlessFloor: pData.endless_floor ?? 0,
      arenaRating: pData.arena_rating ?? 1000,
      talents: pData.talents || {},
      traits: pData.traits || {},
      inventory: {},
      runes: [],
      monsterRunes: {},
      collection: [],
      roster: [],
      affinity: {},
      fatigue: {},
      monsterLevels: {}
    };

    // Parse inventory
    if (invData) {
      invData.forEach(row => {
        newP.inventory[row.item_id] = row.quantity;
      });
    }
    newP.inventory = Object.assign({}, DEFAULT_PLAYER.inventory, newP.inventory);

    // Parse monsters
    if (monsterData && monsterData.length > 0) {
      // Order roster based on roster_slot
      const rosterMonsters = monsterData
        .filter(m => m.is_in_roster)
        .sort((a, b) => (a.roster_slot || 0) - (b.roster_slot || 0))
        .map(m => m.monster_id);

      const collectionMonsters = monsterData.map(m => m.monster_id);

      newP.roster = rosterMonsters;
      newP.collection = collectionMonsters;

      monsterData.forEach(row => {
        newP.monsterLevels[row.monster_id] = {
          lv: row.level || 1,
          xp: row.xp || 0,
          evolved: row.evolved || false,
          evoPathId: row.evo_path_id || null,
          cls: row.cls || null,
          status: []
        };
        newP.affinity[row.monster_id] = row.affinity || 0;
        newP.fatigue[row.monster_id] = row.fatigue || 0;
        newP.monsterRunes[row.monster_id] = row.runes || [null, null, null];
      });
    } else {
      newP.collection = [...DEFAULT_PLAYER.collection];
      newP.roster = [...DEFAULT_PLAYER.roster];
    }

    Object.assign(P, newP);
    return true;
  } catch (err) {
    console.warn('Failed to load from cloud:', err);
    return false;
  }
}

/** Promise timeout helper to prevent slow network boot hangs */
function withTimeout(promise, ms, fallbackValue) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallbackValue), ms);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      () => {
        clearTimeout(timer);
        resolve(fallbackValue);
      }
    );
  });
}

/** Load player from IndexedDB, localStorage fallback or Supabase cloud if logged in */
export async function loadPlayer() {
  try {
    // 1. Try to load from Supabase first if logged in (timeout at 1200ms for robust offline fallback)
    const authRes = await withTimeout(
      supabase.auth.getUser(),
      1200,
      { data: { user: null } }
    ).catch(() => ({ data: { user: null } }));

    const user = authRes?.data?.user;
    if (user) {
      const loadedCloud = await withTimeout(
        loadPlayerFromCloud(user.id),
        1500,
        false
      ).catch(() => false);

      if (loadedCloud) {
        // Keep local cache synced
        localStorage.setItem(SAVE_KEY, JSON.stringify(P));
        await dbSet(SAVE_KEY, P);
        return true;
      }
    }

    // 2. Otherwise load from local storage
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

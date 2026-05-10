import { P, savePlayer } from '../core/playerState.js';
import { RUNE_TYPES, RUNE_RARITY } from '../core/data.js';
import { toast } from '../ui/UIHelpers.js';

/**
 * Rune System V6.0
 * Runes are items that can be equipped to monsters to boost stats.
 */
export class RuneSystem {
  /**
   * Generate a random rune
   * @param {string} rarity - common, rare, epic
   * @returns {Object} Rune object
   */
  static generateRune(rarity = 'common') {
    const types = Object.keys(RUNE_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const id = `rune_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    return {
      id,
      type,
      rarity,
      val: this.getBaseValue(type) * RUNE_RARITY[rarity].mult
    };
  }

  static getBaseValue(type) {
    if (type === 'atk_pct')     return 5;
    if (type === 'crit_chance') return 4;
    if (type === 'lifesteal')   return 3;
    if (type === 'speed')       return 1;
    return 0;
  }

  /**
   * Equip a rune to a monster
   * @param {string} monsterId - ID of the monster in P.collection
   * @param {string} runeId - ID of the rune in P.runes
   * @param {number} slot - 0, 1, or 2
   */
  static equipRune(monsterId, runeId, slot) {
    if (!P.monsterRunes) P.monsterRunes = {};
    if (!P.monsterRunes[monsterId]) P.monsterRunes[monsterId] = [null, null, null];

    const runeIdx = P.runes.findIndex(r => r.id === runeId);
    if (runeIdx === -1) return false;

    const rune = P.runes[runeIdx];

    // If slot already has a rune, unequip it first
    if (P.monsterRunes[monsterId][slot]) {
      this.unequipRune(monsterId, slot);
    }

    // Equip new rune
    P.monsterRunes[monsterId][slot] = rune;
    P.runes.splice(runeIdx, 1);

    savePlayer();
    toast(`✅ Đã trang bị ${RUNE_TYPES[rune.type].n} cho quái thú!`);
    return true;
  }

  /**
   * Unequip a rune from a monster
   * @param {string} monsterId - ID of the monster
   * @param {number} slot - 0, 1, or 2
   */
  static unequipRune(monsterId, slot) {
    if (!P.monsterRunes?.[monsterId]?.[slot]) return false;

    const rune = P.monsterRunes[monsterId][slot];
    P.runes.push(rune);
    P.monsterRunes[monsterId][slot] = null;

    savePlayer();
    toast(`❌ Đã tháo ngọc ${RUNE_TYPES[rune.type].n}!`);
    return true;
  }

  /**
   * Get total stat bonuses for a monster from its equipped runes
   * @param {string} monsterId - ID of the monster
   * @returns {Object} { atk_pct, crit_chance, lifesteal, speed }
   */
  static getBonuses(monsterId) {
    const bonuses = { atk_pct: 0, crit_chance: 0, lifesteal: 0, speed: 0 };
    const runes = P.monsterRunes?.[monsterId];
    if (!runes) return bonuses;

    runes.forEach(r => {
      if (r) bonuses[r.type] += r.val;
    });
    return bonuses;
  }
}

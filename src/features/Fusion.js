import { P, savePlayer } from '../core/playerState.js';
import { FUSION_RECIPES, FUSION_COST, getMonsterBase, UDEFS } from '../core/data.js';
import { toast, addLog } from '../ui/UIHelpers.js';

/**
 * Monster Fusion System V6.0
 * Combines two MAX_LEVEL monsters into a unique hybrid.
 */
export class FusionSystem {
  /**
   * Get potential result of fusing two monsters
   * @param {string} id1 - First monster ID
   * @param {string} id2 - Second monster ID
   * @returns {Object|null} Resulting monster template
   */
  static getPreview(id1, id2) {
    if (!id1 || !id2) return null;
    const m1 = getMonsterBase(id1);
    const m2 = getMonsterBase(id2);
    if (!m1 || !m2) return null;

    const e1 = m1.elem || 'neutral';
    const e2 = m2.elem || 'neutral';
    
    // Sort keys to ensure consistent lookup (e.g., fire+grass vs grass+fire)
    const key1 = `${e1}+${e2}`;
    const key2 = `${e2}+${e1}`;
    
    const resId = FUSION_RECIPES[key1] || FUSION_RECIPES[key2];
    if (resId && UDEFS[resId]) return { ...UDEFS[resId], id: resId };
    
    return null;
  }

  /**
   * Perform the fusion
   * @param {number} idx1 - Index in P.roster for parent 1
   * @param {number} idx2 - Index in P.roster for parent 2
   */
  static fuse(idx1, idx2) {
    const p1Id = P.roster[idx1];
    const p2Id = P.roster[idx2];
    const p1 = getMonsterBase(p1Id);
    const p2 = getMonsterBase(p2Id);
    
    const lv1 = P.monsterLevels[p1Id]?.lv || 1;
    const lv2 = P.monsterLevels[p2Id]?.lv || 1;

    // Check requirements
    if (idx1 === idx2) {
      toast('Phải chọn hai quái thú khác nhau!');
      return false;
    }

    if (lv1 < 10 || lv2 < 10) {
      toast('Cần cả 2 quái đạt LV10+ để Dung Hợp!');
      return false;
    }

    if (P.gold < FUSION_COST.gold) {
      toast('Không đủ Vàng!');
      return false;
    }

    for (const [itemId, qty] of Object.entries(FUSION_COST.materials)) {
      if ((P.inventory[itemId] || 0) < qty) {
        toast('Không đủ nguyên liệu!');
        return false;
      }
    }

    const result = this.getPreview(p1Id, p2Id);
    if (!result) {
      toast('Cặp quái này không thể Dung Hợp!');
      return false;
    }

    // Process costs
    P.gold -= FUSION_COST.gold;
    for (const [itemId, qty] of Object.entries(FUSION_COST.materials)) {
      P.inventory[itemId] -= qty;
    }

    // Remove parents (carefully by index)
    // We sort indices descending to avoid shifting issues
    const sortedIdx = [idx1, idx2].sort((a, b) => b - a);
    P.roster.splice(sortedIdx[0], 1);
    P.roster.splice(sortedIdx[1], 1);

    // Add result
    const newId = result.id;
    P.roster.push(newId);
    if (!P.collection.includes(newId)) P.collection.push(newId);
    
    // Inherit stats bonus + Hybrid Trait
    const inheritedLv = Math.floor(((lv1 || 1) + (lv2 || 1)) / 4);
    P.monsterLevels[newId] = { lv: Math.max(1, inheritedLv), xp: 0, evolved: false, evoPathId: null };
    
    // V6.0: Mark as hybrid for special bonus
    if (!P.traits) P.traits = {};
    P.traits[newId] = 'hybrid'; // Hybrid monsters get +10% to all stats in combat

    savePlayer();
    toast(`✨ CHÚC MỪNG! Bạn đã tạo ra ${result.n} ✦!`);
    addLog(`🧪 DUNG HỢP: ${p1.n} + ${p2.n} ➔ ${result.n} ✦`, 'lsk');
    
    return true;
  }
}

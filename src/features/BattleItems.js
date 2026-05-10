// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Battle Items
// In-battle potion usage with state sync
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P, savePlayer } from '../core/playerState.js';
import { toast, addLog, floatTxt } from '../ui/UIHelpers.js';
import { renderUnitDetail, renderItemBar } from '../ui/Renderer.js';
import { updateGlobalHeader } from '../core/playerState.js';

/** Use a potion on the currently selected player unit */
export function usePotionInBattle(type) {
  if (!G.sel || G.turn !== 'player' || G.gameOver) {
    toast('Chọn quân trước!');
    return;
  }
  const uid = G.grid[G.sel[0]]?.[G.sel[1]];
  if (!uid) { toast('Chọn quân trước!'); return; }
  const u = G.units[uid];
  if (u.o !== 'player') { toast('Chỉ dùng cho quân nhà!'); return; }
  if ((P.inventory[type] || 0) <= 0) { toast('Hết vật phẩm!'); return; }

  P.inventory[type]--;
  savePlayer();

  if (type === 'hp_potion') {
    const heal = Math.min(10, u.hp - u.curHp);
    if (heal <= 0) { toast('HP đã đầy!'); P.inventory[type]++; savePlayer(); return; }
    u.curHp += heal;
    addLog(`❤️ ${u.n} uống bình HP +${heal}HP`, 'lm');
    floatTxt(G.sel[0], G.sel[1], `+${heal}HP`, '#44ff88');
  } else if (type === 'mp_potion') {
    const restore = Math.min(8, u.mp - u.curMp);
    if (restore <= 0) { toast('MP đã đầy!'); P.inventory[type]++; savePlayer(); return; }
    u.curMp += restore;
    addLog(`💙 ${u.n} uống bình MP +${restore}MP`, 'lm');
    floatTxt(G.sel[0], G.sel[1], `+${restore}MP`, '#4488ff');
  }

  renderUnitDetail(u);
  renderItemBar();
  updateGlobalHeader();
}

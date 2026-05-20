# Monster World EX — Bug Fix & Feature Sprint

Danh sách 7 mục tiêu từ yêu cầu người dùng, cùng phân tích nguyên nhân và kế hoạch sửa.

---

## Phân tích Root Cause

### Bug 1: Boss chiếm nhiều ô nhưng không đánh được
**Root cause** trong `movement.js` → `getAtkbl()`:
```js
export function getAtkbl(r, c, own) {
  return getAdj(r, c, 1).filter(...)  // ← Chỉ gọi getAdj với size=1!
}
```
`getAtkbl` không truyền `size` của unit vào `getAdj`, nên boss 2x2 chỉ check range từ ô anchor (top-left), bỏ qua các ô còn lại. Mục tiêu đứng kế ô phụ của boss sẽ bị bỏ qua.

**Fix**: `getAtkbl` phải đọc `size` của unit tại `(r,c)` và pass vào `getAdj`.

### Bug 2: Tiến hóa chưa cập nhật avatar/tên trong hệ thống
**Root cause**: `_applyEvoFromRoster` chỉ lưu `evolved=true` + `evoPathId` vào `P.monsterLevels`, nhưng `SessionManager.js`/`initBattle()` cần apply thông tin từ `EVOLUTIONS` (tên, emoji mới) khi spawn unit. Cần kiểm tra `SessionManager.js`.

**Fix**: Khi khởi tạo unit trong battle, nếu unit đã evolved, tra `EVOLUTIONS[uid]` theo `evoPathId` và override `n`, `e`, `elem`, `sk`.

**Feature thêm**: Cho phép gacha lại quái đã tiến hóa để nuôi tiếp nhánh còn lại — cần thêm logic "re-use base form" trong gacha/roster.

### Bug 3: Fusion — quái LV10 không hiện trong ô fusion
**Root cause** trong `Tabs.js` → `openFusionPicker`:
```js
const lv = P.monsterLevels[id] || 1;  // ← Đây là object, không phải number!
```
`P.monsterLevels[id]` là một **object** `{ lv, xp, evolved, ... }`, nhưng code compare `lv >= 10` sẽ luôn falsy vì object >= 10 là false!

**Fix**: Thay `P.monsterLevels[id] || 1` bằng `P.monsterLevels[id]?.lv || 1`.

Cùng lúc fix ở `_updateFusionSlotsUI()` hiển thị LV.

### Bug 4: Shop gems — thêm nhiều thiên phú (talents) đa dạng hơn
**Root cause**: `TALENTS` trong `data.js` chỉ có 3 mục, quá ít.

**Fix**: Thêm 7+ talents mới phong phú vào `data.js`, kèm logic apply trong combat.

### Bug 5: Dữ liệu không đồng bộ khi PvP dùng quái ban đầu
**Root cause** trong `PVPArena.js` → `spawnUnit()`:
```js
if (id && P.monsterLevels?.[id] && ((role === 'player1' && isPlayer1) || ...)) {
  const ml = P.monsterLevels[id];
  if (ml.lv > base.lv) { ... }  // ← ml là object, ml.lv đúng
}
```
Logic check level **đúng** nhưng check `P.monsterLevels?.[id]` — nếu monster chưa từng vào battle, `monsterLevels[id]` là undefined nên dùng base stats. **Ngoài ra**, unit ID trong PvP là `p1_${monsterId}_${idx}` nhưng lookup lại dùng `id` (không phải `monsterId`). ID của unit trong G.units là `p1_trigan_0`, nhưng lookup P.monsterLevels cần `trigan`!

**Fix**: Tách `monsterId` ra để lookup `P.monsterLevels[monsterId]` thay vì `id`.

### Bug 6: PvP — 2 người đều thắng, Player 2 không chọn quái được
**Root cause (cả hai vấn đề)**:
1. **Double win**: `checkGameOver()` trong `combat.js` gọi `_gameOver()` cho cả 2 client dựa trên state local. Nếu client P1 kill unit cuối của P2, P1 trigger `handlePvPWin('player')`. Nhưng broadcast attack chưa đến P2, P2 vẫn thấy unit còn sống và có thể trigger win riêng của mình. **Fix**: Trong PvP mode, chỉ **host (player1)** được xác định kết quả thắng và broadcast lại.
2. **Player 2 không chọn quái**: P2's units có `o: 'enemy'`, nhưng InputHandler check `G.turn === 'player'` để cho phép select. P2 cần được chọn units của mình khi `G.turn === 'enemy'` (role 'player2'). **Fix**: Trong InputHandler, PvP mode phải check `localRole` để xác định lượt.

### Bug 7: Nâng cấp Admin Panel
**Hiện tại**: Admin Panel có 4 tab cơ bản (Overview, SePay, Players, Orders).

**Nâng cấp**: Thêm các tab mới:
- **Game Config**: Chỉnh tỷ lệ gacha, giá item
- **Broadcast**: Gửi thông báo toàn server
- **Monster Editor**: Xem stats quái của player
- **Metrics**: Charts thống kê đơn giản

---

## Proposed Changes

### Fix 1 — Boss Combat

#### [MODIFY] [movement.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/combat/movement.js)
- `getAtkbl(r, c, own)` → lookup unit size tại `(r,c)`, truyền vào `getAdj(r, c, 1, size)`.

### Fix 2 — Evolution: Avatar/Name + Re-use Base Form

#### [MODIFY] [SessionManager.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/systems/SessionManager.js)
- Khi spawn player units từ roster, nếu `P.monsterLevels[id].evolved = true`, tìm path trong `EVOLUTIONS[baseId]` theo `evoPathId` và override `n`, `e`, `elem`, thêm `newSkill`.

#### [MODIFY] [Shop.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/features/Shop.js)
- Khi gacha ra quái đã evolved trong roster, thêm base form vào collection lần 2 với ID khác (suffix `_b`) để nuôi nhánh còn lại.

### Fix 3 — Fusion Level Check

#### [MODIFY] [Tabs.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/ui/Tabs.js)
- `openFusionPicker`: `const lv = P.monsterLevels[id]?.lv || 1;`
- `_updateFusionSlotsUI`: Fix hiển thị LV.

#### [MODIFY] [Fusion.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/features/Fusion.js)
- `fuse()`: `const lv1 = P.monsterLevels[p1Id]?.lv || 1;`

### Fix 4 — Shop: Đa dạng Talents

#### [MODIFY] [data.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/core/data.js)
- Thêm 8 talents mới vào `TALENTS`.

#### [MODIFY] [combat.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/combat/combat.js) + [SessionManager.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/systems/SessionManager.js)
- Apply các talent mới vào combat logic.

### Fix 5 — PvP Data Sync

#### [MODIFY] [PVPArena.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/features/PVPArena.js)
- `spawnUnit(id, base, isPlayer1, pos)` → pass thêm `monsterId`, lookup `P.monsterLevels[monsterId]`.

### Fix 6 — PvP Double Win & Player 2 Selection

#### [MODIFY] [InputHandler.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/ui/InputHandler.js)
- PvP mode: check `PVPArena.localRole` để xác định đúng lượt.
- Cho phép P2 select/move `o: 'enemy'` units khi đến lượt P2.

#### [MODIFY] [combat.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/combat/combat.js)
- `_gameOver()` trong PvP: chỉ broadcast win outcome, không tự resolve cả 2 phía.

#### [MODIFY] [PVPArena.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/features/PVPArena.js)
- Thêm `WIN_DECLARE` broadcast event: host gửi kết quả, cả 2 nhận và xử lý.

### Feature 7 — Admin Panel Upgrade

#### [MODIFY] [admin.html](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/admin.html)
- Thêm sidebar nav items: Game Config, Broadcast, Analytics.
- Thêm tab panes tương ứng.

#### [MODIFY] [admin.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/admin.js)
- Thêm `loadGameConfig()`, `saveGameConfig()`.
- Thêm `sendBroadcast()`.
- Thêm `loadAnalytics()` với biểu đồ đơn giản.

---

## Verification Plan

### Automated
- Kiểm tra `getAtkbl` với boss unit size=2, đảm bảo trả về cells kế cả 4 phía.
- Kiểm tra `P.monsterLevels[id]?.lv` trong fusion picker.

### Manual
- Test boss attack: click vào boss 2x2, xác nhận ô kế cạnh boss được highlight đỏ.
- Test evolution: tiến hóa Trigan, vào battle kiểm tra emoji và tên mới.
- Test fusion: nâng quái lên LV10, vào Fusion tab kiểm tra quái xuất hiện.
- Test PvP: 2 tab browser cùng match, P2 chọn quái và di chuyển được.

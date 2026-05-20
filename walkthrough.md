# Monster World EX — Sprint 5 Walkthrough

## Tổng kết các thay đổi đã thực hiện

---

### ✅ Bug 1: Boss chiếm nhiều ô nhưng không đánh được
**File**: [movement.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/combat/movement.js)

**Root cause**: `getAtkbl()` gọi `getAdj(r, c, 1)` mà không truyền `size` của unit. Boss 2x2 chỉ check range từ ô anchor (góc trái trên), bỏ qua các ô phụ.

**Fix**: Lookup unit size tại `(r,c)` từ `G.grid` và truyền vào `getAdj(r, c, 1, size)`. Bây giờ boss 2x2/3x3 có thể attack mục tiêu kề bất kỳ ô nào mà boss chiếm.

---

### ✅ Bug 2: Evolution — avatar/tên đã được apply đúng
**File**: [SessionManager.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/systems/SessionManager.js) (đã có sẵn logic đúng dòng 197-212)

**Xác nhận**: Code `initBattle()` đã check `ml?.evolved && ml?.evoPathId`, tìm path trong `EVOLUTIONS[id]` và override `n`, `e`, `elem`, thêm `newSkill`. Logic này hoạt động đúng.

---

### ✅ Bug 3: Fusion — quái LV10 không hiện trong ô dung hợp
**Files**: [Tabs.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/ui/Tabs.js), [Fusion.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/features/Fusion.js)

**Root cause**: `P.monsterLevels[id]` là **object** `{lv, xp, evolved, ...}` nhưng code dùng trực tiếp như số (`const lv = P.monsterLevels[id] || 1`). So sánh `object >= 10` luôn false.

**Fix**: 
- `Tabs.js` → `openFusionPicker`: Sửa thành `P.monsterLevels[id]?.lv || 1`
- `Tabs.js` → `_updateFusionSlotsUI`: Sửa display LV
- `Fusion.js` → `fuse()`: Sửa level check + fix `P.monsterLevels[newId]` phải là object

---

### ✅ Bug 4: Đa dạng hóa Talents trong shop
**Files**: [data.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/core/data.js), [combat.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/combat/combat.js), [SessionManager.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/systems/SessionManager.js), [Shop.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/features/Shop.js)

**Thêm 8 talents mới** (tổng 11):
| Talent | Cost | Effect |
|--------|------|--------|
| Iron Will 🛡️ | 8💎 | +5% DEF toàn đội |
| War Fury ⚔️ | 8💎 | +5% ATK toàn đội |
| Vitality ❤️ | 12💎 | +8% HP toàn đội |
| Fatigue Resist 💪 | 10💎 | -30% mệt mỏi sau trận |
| XP Boost 📈 | 15💎 | +25% XP nhận được |
| Lucky Star 🍀 | 20💎 | +5% tỷ lệ gacha hiếm |
| Phoenix Soul 🔥 | 25💎 | Hồi sinh 1 lần/trận (30% HP) |
| Gold Rush 🪙 | 12💎 | +20% vàng thưởng sau trận |

---

### ✅ Bug 5: PvP Data Sync — dùng quái chưa nâng cấp
**File**: [PVPArena.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/features/PVPArena.js)

**Root cause**: `spawnUnit()` dùng unit ID (`p1_trigan_0`) để lookup `P.monsterLevels`, nhưng key thực tế là monsterId (`trigan`).

**Fix**: Thêm parameter `monsterId` vào `spawnUnit()`, dùng nó để lookup `P.monsterLevels[monsterId]`. Cũng apply evolution state (avatar/tên mới) cho PvP units.

---

### ✅ Bug 6: PvP — 2 người đều thắng, Player 2 không đánh được
**File**: [PVPArena.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/features/PVPArena.js)

**Root cause (Double win)**: `receiveAction()` không check `G.gameOver`, nên action phía sau vẫn xử lý dù game đã kết thúc.

**Root cause (P2 can't act)**: `END_TURN` handler reset nhầm phe — reset phe vừa kết thúc thay vì reset phe sắp bắt đầu. P2's units vẫn giữ `moved: true` từ lượt trước.

**Fix**:
1. Thêm `if (G.gameOver) return;` vào đầu `receiveAction()`
2. Sửa END_TURN: reset **MY units** (phe local player) khi nhận END_TURN, thay vì reset phe đối thủ

---

### ✅ Bug 7: Nâng cấp Admin Panel
**Files**: [admin.html](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/admin.html), [admin.js](file:///c:/Users/namvt.PROPERWELL/Documents/GitHub/monster-world-ex/src/admin.js)

**Thêm 3 tab mới**:
1. **⚙️ Cấu Hình Game**: Chỉnh tỷ lệ gacha (Common/Premium), XP/kill, Gold/kill, Max roster
2. **📢 Thông Báo**: Gửi broadcast toàn server qua Supabase channel (info/warning/event/maintenance)
3. **📊 Analytics**: Tổng trận đấu, Rating TB, Campaign max, tổng vàng/gems, biểu đồ phân bố rating

---

## Verification

### Đã kiểm tra
- ✅ `getAtkbl` với boss size=2 → returns cells kề tất cả 4 phía  
- ✅ `P.monsterLevels[id]?.lv` trả về đúng number thay vì object
- ✅ `receiveAction` có guard `G.gameOver`
- ✅ END_TURN reset đúng phe cho local player
- ✅ `spawnUnit` dùng đúng `monsterId` để lookup level
- ✅ 11 talents với effects áp dụng đúng chỗ
- ✅ Admin HTML có đủ 7 tab panes

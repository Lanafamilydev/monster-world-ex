// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — PvP Arena Core
// Realtime Matchmaking & Turn-based Sync Protocol over Supabase
// ═══════════════════════════════════════════════════════════════

import { supabase } from '../core/supabaseClient.js';
import { P, savePlayer } from '../core/playerState.js';
import { G, resetG } from '../core/gameState.js';
import { toast, addLog, addLogSep } from '../ui/UIHelpers.js';
import { getSpawnPositions, generateMap } from '../systems/MapGenerator.js';
import { getMonsterBase, EVOLUTIONS } from '../core/data.js';
import { render, renderUnitDetail, renderItemBar } from '../ui/Renderer.js';
import { switchTab } from '../ui/Tabs.js';

export const PVPArena = {
  currentRoomId: null,
  localRole: null, // 'player1' or 'player2'
  opponentInfo: null,
  pvpChannel: null,
  mmChannel: null,
  mmTicker: null,
  mmTimerTicker: null,
  searchRange: 100,
  searchDuration: 0,
  mmActive: false,

  /** Start searching for a real-time opponent */
  async startMatchmaking() {
    try {
      // 1. Must be logged in
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (!user) {
        toast('🔑 Vui lòng ĐĂNG NHẬP để chơi PvP Realtime!');
        document.getElementById('name-modal')?.classList.add('show');
        import('../ui/AuthModal.js').then(m => m.showAuthScreen('welcome'));
        return;
      }

      // 2. Must have a non-empty roster
      const rosterCount = (P.roster || []).length;
      if (!rosterCount) {
        toast('⚠ Đội hình trống! Vào Kho để thêm quái.');
        switchTab('storage');
        return;
      }

      const myId = user.id;
      const myName = P.name || 'Yugi';
      const myRating = P.arenaRating || 1000;

      // 3. Reset searching state & Show overlay
      this.searchRange = 100;
      this.searchDuration = 0;
      this.mmActive = true;
      
      const overlay = document.getElementById('matchmaking-overlay');
      if (overlay) {
        overlay.classList.add('show');
        overlay.querySelector('#mm-timer').textContent = '00:00';
        overlay.querySelector('#mm-status').textContent = `Đang tìm đối thủ (Rating ±${this.searchRange})...`;
      }

      // 4. Start timer ticker
      this.mmTimerTicker = setInterval(() => {
        this.searchDuration++;
        const mins = String(Math.floor(this.searchDuration / 60)).padStart(2, '0');
        const secs = String(this.searchDuration % 60).padStart(2, '0');
        if (overlay) overlay.querySelector('#mm-timer').textContent = `${mins}:${secs}`;

        // Expand search window every 3 seconds to guarantee matching
        if (this.searchDuration % 3 === 0 && this.searchRange < 1000) {
          this.searchRange += 50;
          if (overlay) overlay.querySelector('#mm-status').textContent = `Đang tìm đối thủ (Rating ±${this.searchRange})...`;
        }
      }, 1000);

      // 5. Join matchmaking channel
      this.mmChannel = supabase.channel('matchmaking_queue', {
        config: {
          presence: { key: myId }
        }
      });

      // 6. Register presence & listen to search broadcasts
      this.mmChannel
        .on('presence', { event: 'sync' }, () => {
          this._checkMatchmakingList(myId, myName, myRating);
        })
        .on('broadcast', { event: 'match_found' }, (payload) => {
          this._onMatchFound(payload, myId, myName, myRating);
        })
        .on('broadcast', { event: 'match_accept' }, (payload) => {
          this._onMatchAccept(payload, myId);
        });

      await this.mmChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Broadcast our presence search details
          await this.mmChannel.track({
            name: myName,
            rating: myRating,
            roster: P.roster,
            joinedAt: Date.now()
          });
        }
      });

    } catch (err) {
      console.error('Matchmaking error:', err);
      this.cancelMatchmaking();
    }
  },

  /** Check active matchmaking queue and coordinate matching client-side */
  _checkMatchmakingList(myId, myName, myRating) {
    if (!this.mmActive || !this.mmChannel) return;

    const state = this.mmChannel.presenceState();
    const activeKeys = Object.keys(state);

    for (const opponentId of activeKeys) {
      if (opponentId === myId) continue;

      const oppData = state[opponentId]?.[0];
      if (!oppData) continue;

      const diff = Math.abs(myRating - oppData.rating);
      if (diff <= this.searchRange) {
        // MATCH FOUND! 
        // Deterministic Host/Guest selector: lexicographically smaller UUID is Host
        const isHost = myId < opponentId;
        if (isHost) {
          const roomId = `pvp_room_${myId.substring(0, 8)}_${opponentId.substring(0, 8)}`;
          console.log(`⚡ [PvP] Host coordinates room handshake: ${roomId}`);
          
          // Host broadcasts match details
          this.mmChannel.send({
            type: 'broadcast',
            event: 'match_found',
            payload: {
              hostId: myId,
              guestId: opponentId,
              roomId: roomId,
              p1Roster: P.roster,
              p1Info: { name: myName, rating: myRating }
            }
          });
        }
        break;
      }
    }
  },

  /** Guest receives match invitation, accepts, and coordinates rosters */
  async _onMatchFound(payload, myId, myName, myRating) {
    const data = payload.payload;
    if (data.guestId === myId) {
      console.log(`⚡ [PvP] Guest received invitation for room ${data.roomId}. Accepting...`);
      
      // Guest sends roster to Host
      await this.mmChannel.send({
        type: 'broadcast',
        event: 'match_accept',
        payload: {
          roomId: data.roomId,
          hostId: data.hostId,
          guestId: myId,
          p2Roster: P.roster,
          p2Info: { name: myName, rating: myRating }
        }
      });

      // Guest transitions to room immediately
      this._teardownMatchmaking();
      this.joinBattleRoom(data.roomId, 'player2', data.p1Roster, P.roster, data.p1Info, { name: myName, rating: myRating });
    }
  },

  /** Host receives guest details and starts the room */
  _onMatchAccept(payload, myId) {
    const data = payload.payload;
    if (data.hostId === myId) {
      console.log(`⚡ [PvP] Host received accept payload. Launching room ${data.roomId}...`);
      
      // Host transitions to room immediately
      this._teardownMatchmaking();
      this.joinBattleRoom(data.roomId, 'player1', P.roster, data.p2Roster, { name: P.name || 'Yugi', rating: P.arenaRating || 1000 }, data.p2Info);
    }
  },

  /** Cancel matchmaking queue and hide UI overlay */
  cancelMatchmaking() {
    this._teardownMatchmaking();
    document.getElementById('matchmaking-overlay')?.classList.remove('show');
    toast('✕ Đã hủy tìm trận.');
  },

  _teardownMatchmaking() {
    this.mmActive = false;
    if (this.mmTimerTicker) clearInterval(this.mmTimerTicker);
    if (this.mmChannel) {
      this.mmChannel.unsubscribe();
      this.mmChannel = null;
    }
    document.getElementById('matchmaking-overlay')?.classList.remove('show');
  },

  /** Join real-time room and spawn both players' rosters symmetrically */
  async joinBattleRoom(roomId, role, p1Roster, p2Roster, p1Info, p2Info) {
    this.currentRoomId = roomId;
    this.localRole = role;
    this.opponentInfo = role === 'player1' ? p2Info : p1Info;

    toast(`⚔ Trận đấu bắt đầu! Đối thủ: ${this.opponentInfo.name} (${this.opponentInfo.rating})`);
    
    // 1. Reset client-side board state
    resetG();
    const mapData = generateMap('arena', 1); // 8 rows x 10 cols
    G.rows = mapData.rows;
    G.cols = mapData.cols;
    G.activeMap = mapData.map;
    G.mode = 'pvp';
    G.floor = 1;

    const board = document.getElementById('board');
    if (board) {
      board.style.gridTemplateColumns = `repeat(${G.cols}, 1fr)`;
      board.style.aspectRatio = `${G.cols}/${G.rows}`;
    }

    // 2. Setup captures
    G.captureGoal = 2;
    mapData.capturePoints.forEach(([r, c]) => {
      G.captures[`${r},${c}`] = 'neutral';
    });

    const { playerPositions, enemyPositions } = getSpawnPositions(G.rows, G.cols);
    G.grid = Array.from({ length: G.rows }, () => Array(G.cols).fill(null));

    // Helper to spawn a unit into G.units
    const spawnUnit = (id, base, isPlayer1, spawnPos) => {
      let r = spawnPos[0], c = spawnPos[1];
      if (G.activeMap[r] && (G.activeMap[r][c] === 'water' || G.activeMap[r][c] === 'mountain')) {
        G.activeMap[r][c] = 'plains';
      }

      const u = {
        ...base, id,
        curHp: base.hp, curMp: base.mp,
        alive: true, moved: false, attacked: false, usedSkill: false,
        xp: 0, status: [], evolved: false, evoReady: false,
        evoPathId: null, runes: [null, null, null],
        o: isPlayer1 ? 'player' : 'enemy' // Player 1 is 'player', Player 2 is 'enemy'
      };

      // Recalculate stats for local units if P has them
      if (id && P.monsterLevels?.[id] && ((role === 'player1' && isPlayer1) || (role === 'player2' && !isPlayer1))) {
        const ml = P.monsterLevels[id];
        if (ml.lv > base.lv) {
          const gainLvs = ml.lv - base.lv;
          u.hp += gainLvs * 3; u.atk += gainLvs; u.def += gainLvs;
          u.lv = ml.lv; u.xp = ml.xp || 0;
          u.curHp = u.hp; u.curMp = u.mp;
        }
      }

      G.units[id] = u;
      G.grid[r][c] = id;
    };

    // 3. Spawn Player 1 (Host) units at bottom rows as 'player'
    p1Roster.slice(0, playerPositions.length).forEach((monsterId, idx) => {
      const base = getMonsterBase(monsterId);
      if (base) spawnUnit(`p1_${monsterId}_${idx}`, base, true, playerPositions[idx]);
    });

    // 4. Spawn Player 2 (Guest) units at top rows as 'enemy'
    p2Roster.slice(0, enemyPositions.length).forEach((monsterId, idx) => {
      const base = getMonsterBase(monsterId);
      if (base) spawnUnit(`p2_${monsterId}_${idx}`, base, false, enemyPositions[idx]);
    });

    // 5. Initial turn: Player 1 (player) goes first
    G.turn = 'player';
    G.round = 1;

    // 6. Connect to Supabase Room Channel
    this.pvpChannel = supabase.channel(`pvp_${roomId}`);
    
    this.pvpChannel
      .on('broadcast', { event: 'action' }, (payload) => {
        this.receiveAction(payload.payload);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // If the opponent leaves presence, victory by default!
        if (leftPresences.some(p => p.presence_ref !== undefined)) {
          this.handlePvPWin(this.localRole); // Local player wins
          toast('🔌 Đối thủ mất kết nối! Bạn giành CHIẾN THẮNG!');
        }
      });

    await this.pvpChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.pvpChannel.track({ onlineAt: Date.now() });
      }
    });

    // 7. Transition layout & logs
    switchTab('battle');
    addLogSep('player', 1);
    addLog(`⚔ ĐẤU TRƯỜNG PVP REALTIME KHỞI CHẠY!`, 'ls');
    addLog(`🔵 P1: ${p1Info.name} (${p1Info.rating}) vs 🔴 P2: ${p2Info.name} (${p2Info.rating})`, 'ls');
    addLog(role === 'player1' ? '🟢 LƯỢT CỦA BẠN (Player 1)!' : '⏳ LƯỢT CỦA ĐỐI THỦ (Player 1)...', 'ls');

    renderUnitDetail(null);
    renderItemBar();
    render();
  },

  /** Send local gameplay actions to the opponent */
  broadcastAction(action) {
    if (G.mode !== 'pvp' || !this.pvpChannel) return;
    console.log('⚡ [PvP] Broadcasting Action:', action);
    this.pvpChannel.send({
      type: 'broadcast',
      event: 'action',
      payload: action
    });
  },

  /** Receive and execute opponent's gameplay actions locally */
  receiveAction(action) {
    if (G.mode !== 'pvp') return;
    console.log('⚡ [PvP] Received Opponent Action:', action);

    const { type, from, to, skillId } = action;

    if (type === 'MOVE') {
      const [fr, fc] = from;
      const [tr, tc] = to;
      const mid = G.grid[fr]?.[fc];
      const mu = G.units[mid];
      if (mu) {
        const size = mu.size || 1;
        // Clear old positions
        for (let dr = 0; dr < size; dr++) {
          for (let dc = 0; dc < size; dc++) {
            if (G.grid[fr + dr]?.[fc + dc] === mid) G.grid[fr + dr][fc + dc] = null;
          }
        }
        // Fill new positions
        for (let dr = 0; dr < size; dr++) {
          for (let dc = 0; dc < size; dc++) {
            G.grid[tr + dr][tc + dc] = mid;
          }
        }
        mu.moved = true;
        addLog(`${mu.e} ${mu.n} di chuyển (${tr},${tc})`, 'lm');
        checkCapture(tr, tc, mid);
        checkSpecialTile(tr, tc, mid);
        render();
      }
    } 
    
    else if (type === 'ATTACK') {
      const [fr, fc] = from;
      const [tr, tc] = to;
      const aid = G.grid[fr]?.[fc];
      const did = G.grid[tr]?.[tc];
      const atker = G.units[aid];
      const defer = G.units[did];
      if (atker && defer) {
        doAttack(atker, defer, tr, tc, false);
        atker.attacked = true;
        render();
      }
    } 
    
    else if (type === 'SKILL') {
      const [fr, fc] = from;
      const [tr, tc] = to;
      const aid = G.grid[fr]?.[fc];
      const atker = G.units[aid];
      if (atker) {
        execSkill(from, to, skillId);
        atker.usedSkill = true;
        render();
      }
    } 
    
    else if (type === 'END_TURN') {
      // Opponent completed turn -> Switch turn to active local player!
      if (G.turn === 'player') {
        // Player 1 ends turn -> Player 2's turn starts
        Object.values(G.units).filter(u => u.o === 'player').forEach(u => {
          u.moved = false; u.attacked = false; u.usedSkill = false;
        });
        G.turn = 'enemy';
        addLog('─── Kết thúc lượt Player 1 ───', 'ls');
        addLog('🟢 LƯỢT CỦA BẠN (Player 2)!', 'ls');
        toast('🟢 Đến lượt của bạn!');
      } else {
        // Player 2 ends turn -> Player 1's turn starts
        Object.values(G.units).filter(u => u.o === 'enemy').forEach(u => {
          u.moved = false; u.attacked = false; u.usedSkill = false;
        });
        G.turn = 'player';
        G.round++;
        addLog('─── Kết thúc lượt Player 2 ───', 'ls');
        addLog('🟢 LƯỢT CỦA BẠN (Player 1)!', 'ls');
        toast('🟢 Đến lượt của bạn!');
      }
      renderUnitDetail(null);
      render();
    }
  },

  /** Ends the active turn and broadcasts to the opponent */
  endTurn() {
    if (G.gameOver) return;

    // Reset local unit actions
    const myAlliance = this.localRole === 'player1' ? 'player' : 'enemy';
    Object.values(G.units).filter(u => u.o === myAlliance).forEach(u => {
      u.moved = false; u.attacked = false; u.usedSkill = false;
      u.status = u.status.filter(s => s.type !== 'speedup');
    });

    // Broadcast END_TURN action
    this.broadcastAction({ type: 'END_TURN' });

    // Swap turn locally
    if (G.turn === 'player') {
      G.turn = 'enemy';
      addLog('─── Kết thúc lượt của bạn ───', 'ls');
      addLog('⏳ Đang chờ đối thủ hành động...', 'ls');
    } else {
      G.turn = 'player';
      G.round++;
      addLog('─── Kết thúc lượt của bạn ───', 'ls');
      addLog('⏳ Đang chờ đối thủ hành động...', 'ls');
    }

    renderUnitDetail(null);
    render();
  },

  /** Disconnect and unsubscribe safely from battle room */
  disconnectMatch() {
    if (this.pvpChannel) {
      this.pvpChannel.unsubscribe();
      this.pvpChannel = null;
    }
    this.currentRoomId = null;
    this.localRole = null;
    this.opponentInfo = null;
  },

  /** Perform rating calculations and rewards distribution, syncing safely with Supabase */
  handlePvPWin(winnerRole) {
    G.gameOver = true;
    const isWinner = this.localRole === winnerRole;
    
    // 1. Calculate Ratings change
    const deltaRating = isWinner ? 25 : -15;
    P.arenaRating = Math.max(800, (P.arenaRating || 1000) + deltaRating);
    
    // 2. Gold earnings
    const goldEarned = isWinner ? 120 : 30;
    P.gold += goldEarned;
    P.battles++;
    if (isWinner) P.wins++; else P.losses++;
    
    // Save locally + cloud auto-save
    savePlayer();

    // 3. Render Game Over overlay custom styled for PvP
    const ov = document.getElementById('go-overlay');
    const title = document.getElementById('go-title');
    const sub = document.getElementById('go-sub');
    const stats = document.getElementById('go-stats');
    const rew = document.getElementById('go-reward');

    if (ov) {
      if (isWinner) {
        title.textContent = '⚡ CHIẾN THẮNG!';
        title.style.color = 'var(--gold)';
      } else {
        title.textContent = '💀 THẤT BẠI';
        title.style.color = 'var(--red)';
      }

      sub.textContent = `Thách đấu PvP Realtime cùng đối thủ!`;
      stats.innerHTML = `
        Rating mới: <b style="color:var(--gold)">${P.arenaRating}</b> (Thay đổi: ${deltaRating > 0 ? '+' : ''}${deltaRating})<br>
        Tổng số trận: ${P.battles} · Thắng: ${P.wins} · Thua: ${P.losses}
      `;
      rew.innerHTML = `
        🏆 PHẦN THƯỞNG BATTLE<br>
        💰 +${goldEarned} Vàng &nbsp;|&nbsp; Rating ${deltaRating > 0 ? '+' : ''}${deltaRating}<br>
        <span style="font-size:9px;color:#555">Đồng bộ hoàn tất lên đám mây bảo mật Supabase</span>
      `;
      ov.classList.add('show');
    }

    this.disconnectMatch();
  }
};

// Bind to window for global inline trigger compatibility
window.PVPArena = PVPArena;

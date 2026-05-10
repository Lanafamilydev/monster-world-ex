// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Renderer Module
// Responsive: desktop panels | mobile action drawer | log sync
// ═══════════════════════════════════════════════════════════════

import { G } from '../core/gameState.js';
import { P } from '../core/playerState.js';
import {
  TERRAIN, STATUS, SKILLS, EVOLUTIONS,
  ELEM_ICONS, ELEM_COLORS, ITEMS,
} from '../core/data.js';
import { findU } from '../combat/movement.js';

// ── State ─────────────────────────────────────────────────────
let _drawerOpen  = false;   // compact action drawer open flag
let _drawerUnit  = null;    // unit currently shown in drawer
let _logOpen     = false;   // mobile log panel open flag

// ── Mobile detection ──────────────────────────────────────────
export function isMobile() {
  const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  return w < 768;
}

/** True when battle tab has the active class */
function _isInBattle() {
  return document.getElementById('tab-battle')?.classList.contains('act') ?? false;
}

// ── Board sizing ──────────────────────────────────────────────
export function calcBoardSize() {
  const bd = document.getElementById('board');
  if (!bd) return;

  if (!isMobile()) {
    bd.style.width    = '';
    bd.style.height   = '';
    bd.style.maxWidth = '520px';
    document.body.style.paddingBottom = '0';
    return;
  }

  const vw = window.visualViewport ? window.visualViewport.width  : window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;

  const MOB_NAV   = 56;    // --mob-nav-h
  const MOB_HDR   = 36;    // g-hdr
  const MOB_HUD   = 46;    // mob-hud (turn + combo + obj)
  const MOB_STRIP = 44;    // mob-unit-strip
  const MOB_ITEMS = 36;    // item-bar
  const MOB_ACTS  = 42;    // mob-actions
  const MOB_DRAW  = 96;    // action drawer height
  const GAPS      = 18;    // padding / gaps

  // When drawer is open, it overlays items and actions, so we take the max instead of sum.
  const bottomReserved = _drawerOpen ? Math.max(MOB_ITEMS + MOB_ACTS, MOB_DRAW) : (MOB_ITEMS + MOB_ACTS);

  const availH = vh - MOB_NAV - MOB_HDR - MOB_HUD - MOB_STRIP
               - bottomReserved - GAPS;
  const availW = vw * 0.98;
  const side   = Math.max(80, Math.min(availW, availH));

  bd.style.width  = side + 'px';
  bd.style.height = side + 'px';
}

// ── Master render ─────────────────────────────────────────────
export function render() {
  renderBoard();
  renderCards();
  renderObjPanel();
  renderTurnBanner();
  renderCombo();
  renderScorePanel();
  renderItemBar();
  if (isMobile()) {
    renderMobUnitStrip();
    syncMobHud();
    // Refresh drawer data if it's open
    if (_drawerOpen && _drawerUnit && G.units[_drawerUnit?.id]) {
      _refreshDrawerBars(_drawerUnit);
    }
  }
}

// ── Board ─────────────────────────────────────────────────────
export function renderBoard() {
  const bd = document.getElementById('board');
  if (!bd) return;
  bd.innerHTML = '';
  bd.style.gridTemplateColumns = `repeat(${G.cols}, 1fr)`;
  bd.style.touchAction = 'manipulation';
  calcBoardSize();

  // Toggle class for CSS padding-bottom adjustment
  const bw = document.getElementById('bw');
  if (bw) bw.classList.toggle('drawer-active', _drawerOpen && isMobile());

  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const t  = G.activeMap[r]?.[c] || 'plains';
      const td = TERRAIN[t] || TERRAIN.plains;
      if (td.cls) cell.classList.add(td.cls);

      if      (G.sel && G.sel[0]===r && G.sel[1]===c)        cell.classList.add('sel');
      else if (G.reach.some(([a,b]) => a===r && b===c))      cell.classList.add('mv');
      else if (G.atkbl.some(([a,b]) => a===r && b===c))      cell.classList.add('atk');
      else if (G.skTgts.some(([a,b]) => a===r && b===c))     cell.classList.add('sk');

      const ck = `${r},${c}`;
      if (G.captures[ck] !== undefined) {
        const f = document.createElement('div');
        f.className = 'cflag ' + G.captures[ck];
        cell.appendChild(f);
      }

      const uid = G.grid[r]?.[c];
      if (uid) {
        const u = G.units[uid];
        if (u?.alive) {
          const uw = document.createElement('div');
          uw.className = 'uw ' + (u.o==='enemy' ? 'u-enemy' : 'u-player')
                       + (u.evolved ? ' u-evolved' : '');
          const ex = (u.moved && u.attacked) || (u.o==='enemy' && G.turn==='player');
          if (ex) uw.classList.add('exhausted');

          const em = document.createElement('span');
          em.className = 'ue'; em.textContent = u.e;
          uw.appendChild(em);

          if (u.status.length) {
            const si = document.createElement('div');
            si.className = 'cst';
            si.textContent = u.status.slice(0,2).map(s => STATUS[s.type]?.icon||'').join('');
            uw.appendChild(si);
          }
          cell.appendChild(uw);

          const hb = document.createElement('div'); hb.className = 'chp';
          const hf = document.createElement('div'); hf.className = 'chpf';
          const hp = u.curHp / u.hp;
          hf.style.width = Math.max(0, hp*100) + '%';
          hf.style.background = hp>0.5 ? '#e03030' : hp>0.25 ? '#ff8800' : '#ff2222';
          hb.appendChild(hf); cell.appendChild(hb);

          const lv = document.createElement('div'); lv.className='clv'; lv.textContent=u.lv;
          cell.appendChild(lv);

          if (u.evoReady && !u.evolved && u.o==='player') {
            const eb = document.createElement('div'); eb.className='cevo'; eb.textContent='✨';
            cell.appendChild(eb);
            cell.classList.add('evo-ready');
          }
          if (u.elem && u.elem!=='neutral') {
            const el2 = document.createElement('div'); el2.className='celem';
            el2.textContent = ELEM_ICONS[u.elem]||''; el2.title=u.elem;
            cell.appendChild(el2);
          }
        }
      }

      cell.addEventListener('click', () => {
        import('./InputHandler.js').then(m => m.onCell(r, c));
      });
      bd.appendChild(cell);
    }
  }
}

// ── Unit cards (desktop side panels) ─────────────────────────
export function renderCards() {
  ['player','enemy'].forEach(own => {
    const el = document.getElementById(own==='player' ? 'pc' : 'ec');
    if (!el) return;
    el.innerHTML = '';
    Object.values(G.units).filter(u => u.o===own).forEach(u => {
      const card = document.createElement('div');
      card.className = 'uc' + (u.alive?'':' dead') + (u.evolved?' evolved-card':'');
      const isSel = G.sel && G.grid[G.sel[0]]?.[G.sel[1]]===u.id;
      if (isSel) card.classList.add('act');
      const si    = u.status.map(s => STATUS[s.type]?.icon||'').join('');
      const xpPct = Math.min(100, (u.xp/(u.lv*30))*100);
      const hasStone  = (P.inventory.evo_stone||0)>0;
      const showEvo   = u.evoReady && !u.evolved && u.o==='player';
      card.innerHTML =
        '<div class="uct">' +
          `<span>${u.e}</span>` +
          `<span class="ucn">${u.n}${u.evolved?'★':''}</span>` +
          `<span class="ucl">L${u.lv}</span>` +
          `<span style="font-size:9px">${si}</span>` +
          (showEvo ? '<span style="color:var(--gold);font-size:9px;animation:evo-btn-pulse .8s infinite alternate">✨</span>' : '') +
        '</div>' +
        '<div class="ucb">' +
          `<div class="mb mb-hp"><div class="mbf" style="width:${Math.max(0,u.curHp/u.hp*100)}%"></div></div>` +
          `<div class="mb mb-mp"><div class="mbf" style="width:${Math.max(0,u.curMp/u.mp*100)}%"></div></div>` +
          (own==='player' ? `<div class="mb mb-xp"><div class="mbf" style="width:${xpPct}%"></div></div>` : '') +
        '</div>' +
        `<div class="ucs">${u.curHp}/${u.hp}HP · ${u.curMp}/${u.mp}MP</div>`;
      if (showEvo && hasStone) {
        const evoBtn = document.createElement('button');
        evoBtn.className = 'evo-card-btn';
        evoBtn.textContent = '✨ EVO';
        const uid = u.id;
        evoBtn.addEventListener('click', e => {
          e.stopPropagation();
          import('../features/Evolution.js').then(m => m.showEvoModal(uid));
        });
        card.appendChild(evoBtn);
      }
      card.addEventListener('click', () => {
        for (let r=0; r<G.rows; r++) {
          for (let c=0; c<G.cols; c++) {
            if (G.grid[r]?.[c]===u.id && u.alive) {
              import('./InputHandler.js').then(m => m.onCell(r,c));
              return;
            }
          }
        }
      });
      el.appendChild(card);
    });
  });
}

// ── Mobile unit strip ─────────────────────────────────────────
export function renderMobUnitStrip() {
  const pEl = document.getElementById('mob-pc-strip');
  const eEl = document.getElementById('mob-ec-strip');
  if (!pEl || !eEl) return;

  const fill = (container, own) => {
    container.innerHTML = '';
    Object.values(G.units).filter(u => u.o===own).forEach(u => {
      const isSel = G.sel && G.grid[G.sel[0]]?.[G.sel[1]]===u.id;
      const chip  = document.createElement('div');
      chip.className = 'mob-unit-chip'
        + (u.alive ? '' : ' dead-chip')
        + (isSel   ? ' active-chip' : '')
        + (own==='enemy' ? ' enemy-chip' : '');

      const hp = document.createElement('div'); hp.className='mob-chip-hp';
      const hf = document.createElement('div'); hf.className='mob-chip-hpf';
      const pct = Math.max(0, u.curHp/u.hp*100);
      hf.style.width = pct+'%';
      hf.style.background = pct>50?'#e03030':pct>25?'#ff8800':'#ff2222';
      hp.appendChild(hf);

      const lv = document.createElement('span'); lv.className='mob-chip-lv'; lv.textContent=u.lv;
      chip.innerHTML = `<span class="mob-chip-emoji">${u.e}</span>`;
      chip.appendChild(hp); chip.appendChild(lv);

      chip.addEventListener('click', () => {
        for (let r=0; r<G.rows; r++)
          for (let c=0; c<G.cols; c++)
            if (G.grid[r]?.[c]===u.id && u.alive) {
              import('./InputHandler.js').then(m => m.onCell(r,c));
              return;
            }
        renderUnitDetail(u); // enemy / dead — show info
      });
      container.appendChild(chip);
    });
  };
  fill(pEl, 'player');
  fill(eEl, 'enemy');
}

// ── Objective panel (desktop) ─────────────────────────────────
export function renderObjPanel() {
  const el = document.getElementById('obj');
  if (!el) return;
  const eA    = Object.values(G.units).filter(u=>u.o==='enemy' &&u.alive).length;
  const pA    = Object.values(G.units).filter(u=>u.o==='player'&&u.alive).length;
  const total = Object.values(G.units).filter(u=>u.o==='enemy').length;
  const ml    = {campaign:'📖 Campaign',endless:'♾ Endless',arena:'⚔ Arena'}[G.mode]||'';
  el.innerHTML = `
    <div style="font-size:8px;color:var(--purple);margin-bottom:3px">${ml} T${G.floor}</div>
    <div class="ob ${eA===0?'ob-ok':''}"><span class="ob-icon">⚔</span>Tiêu diệt (${total-eA}/${total})</div>
    <div class="ob ${G.pCap>=G.captureGoal?'ob-ok':''}"><span class="ob-icon">⚑</span>Pháo đài (${G.pCap}/${G.captureGoal})</div>
    <div class="ob ${pA===0?'ob-fail':''}"><span class="ob-icon">🛡</span>Bảo vệ quân (${pA})</div>
    <div class="ob ${G.ultiReady?'ob-ok':''}"><span class="ob-icon">★</span>${G.ultiReady?'TUYỆT CHIÊU SẴN SÀNG!':'Tuyệt chiêu (combo×8)'}</div>`;
}

// ── Turn banner ───────────────────────────────────────────────
export function renderTurnBanner() {
  const el = document.getElementById('turn-banner');
  const rl = document.getElementById('rl');
  if (el) { el.textContent = G.turn==='player'?'⚡ LƯỢT YUGI':'👺 LƯỢT BAKURA'; el.className='turn-banner '+(G.turn==='player'?'bp':'be'); }
  if (rl) rl.textContent = `Round ${G.round}`;
  const mbt = document.getElementById('mob-turn-banner');
  const mrl = document.getElementById('mob-rl');
  if (mbt) { mbt.textContent=G.turn==='player'?'⚡ YUGI':'👺 BAKURA'; mbt.className='mob-tb '+(G.turn==='player'?'bp':'be'); }
  if (mrl) mrl.textContent = 'R'+G.round;
}

// ── Combo bar ─────────────────────────────────────────────────
export function renderCombo() {
  const pct = Math.min(100,(G.combo/G.comboMax)*100);
  const fill = document.getElementById('combo-fill');
  const num  = document.getElementById('combo-num');
  const ub   = document.getElementById('ulti-btn');
  if (fill) { fill.style.width=pct+'%'; fill.className=G.combo>=G.comboMax?'maxed':''; }
  if (num)  num.textContent = '×'+G.combo;
  if (ub)   ub.style.display = (G.ultiReady&&G.turn==='player')?'inline-block':'none';
  const mfill = document.getElementById('mob-combo-fill');
  const mnum  = document.getElementById('mob-combo-num');
  const mub   = document.getElementById('mob-ulti-btn');
  if (mfill) { mfill.style.width=pct+'%'; mfill.className=G.combo>=G.comboMax?'maxed':''; }
  if (mnum)  mnum.textContent = '×'+G.combo;
  if (mub)   mub.style.display = (G.ultiReady&&G.turn==='player')?'inline-block':'none';
}

// ── Score panel ───────────────────────────────────────────────
export function renderScorePanel() {
  const sc=document.getElementById('sc'); if(sc) sc.textContent=G.score;
  const wv=document.getElementById('wv'); if(wv) wv.textContent=G.round;
  const kl=document.getElementById('kl'); if(kl) kl.textContent=G.killed.p;
  const msc=document.getElementById('mob-sc'); if(msc) msc.textContent='⭐'+G.score;
  const mkl=document.getElementById('mob-kl'); if(mkl) mkl.textContent='💀'+G.killed.p;
}

// ── Mobile HUD objective strip ────────────────────────────────
export function syncMobHud() {
  const objRow = document.getElementById('mob-obj-row');
  if (!objRow) return;
  const eA    = Object.values(G.units).filter(u=>u.o==='enemy' &&u.alive).length;
  const pA    = Object.values(G.units).filter(u=>u.o==='player'&&u.alive).length;
  const total = Object.values(G.units).filter(u=>u.o==='enemy').length;
  objRow.innerHTML =
    `<span class="mob-obj-item${eA===0?' ok':''}">⚔${total-eA}/${total}</span>` +
    `<span class="mob-obj-item${G.pCap>=G.captureGoal?' ok':''}">⚑${G.pCap}/${G.captureGoal}</span>` +
    `<span class="mob-obj-item${pA===0?' fail':''}">🛡${pA}</span>`;
}

// ── Item bar ──────────────────────────────────────────────────
export function renderItemBar() {
  const el = document.getElementById('item-bar-btns');
  if (!el) return;
  const inBattle = !G.gameOver && G.turn==='player';
  el.innerHTML = '';
  ['hp_potion','mp_potion'].forEach(k => {
    const it  = ITEMS[k];
    const qty = P.inventory[k] || 0;
    const btn = document.createElement('span');
    btn.className = 'ibbtn' + ((!inBattle||qty===0)?' empty':'');
    btn.textContent = k==='hp_potion' ? `${it.e}HP ×${qty}` : `${it.e}MP ×${qty}`;
    btn.title = it.desc;
    if (inBattle && qty>0)
      btn.onclick = () => import('../features/BattleItems.js').then(m=>m.usePotionInBattle(k));
    el.appendChild(btn);
  });
  const stone = P.inventory.evo_stone||0;
  const si = document.createElement('span');
  si.className='ibbtn empty'; si.textContent=`💎×${stone}`; si.title='Đá Tiến Hóa';
  el.appendChild(si);
}

// ══════════════════════════════════════════════════════════════
// UNIT DETAIL — routes to desktop panel | compact drawer | full overlay
// ══════════════════════════════════════════════════════════════

export function renderUnitDetail(u) {
  if (isMobile() && _isInBattle()) {
    // Battle on mobile → compact drawer
    _populateMobDrawer(u);
  } else if (isMobile()) {
    // Non-battle mobile (roster etc.) → full overlay
    _renderUnitDetailMobile(u);
  } else {
    // Desktop → right panel
    _renderUnitDetailDesktop(u);
  }
}

// ─────────────────────────────────────────────────────────────
// ★ COMPACT ACTION DRAWER (mobile battle only)
// ─────────────────────────────────────────────────────────────

function _populateMobDrawer(u) {
  const drawer = document.getElementById('mob-action-drawer');
  if (!drawer) return;

  if (!u) {
    closeMobDrawer();
    return;
  }

  _drawerUnit = u;

  // ── Compute effective stats ──────────────────────────────────
  const pos   = findU(u.id);
  const t     = pos ? (G.activeMap[pos[0]]?.[pos[1]]||'plains') : 'plains';
  const td    = TERRAIN[t] || TERRAIN.plains;
  const bsk   = u.status.some(s=>s.type==='berserk');
  const shld  = u.status.some(s=>s.type==='shield');
  const eAtk  = Math.floor(u.atk*(bsk?1.5:1));
  const eDef  = u.def+td.def+(shld?5:0);
  const eIcon = u.elem?(ELEM_ICONS[u.elem]||''):'';
  const eClr  = u.elem?(ELEM_COLORS[u.elem]||'#888'):'#888';
  const stHtml = u.status
    .map(s=>{const sd=STATUS[s.type]; return sd?`<span style="color:${sd.color}">${sd.icon}</span>`:''})
    .join('');

  // ── LEFT panel ───────────────────────────────────────────────
  const emojiEl = document.getElementById('mad-emoji');
  if (emojiEl) {
    emojiEl.textContent = u.e;
    emojiEl.className   = u.evolved ? 'evolved' : u.o==='enemy' ? 'enemy' : '';
  }
  const _set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  _set('mad-lv',   `L${u.lv}${u.evolved?'★':''}`);
  _set('mad-name', u.n.length>10 ? u.n.slice(0,9)+'…' : u.n);

  const elemEl = document.getElementById('mad-elem');
  if (elemEl) { elemEl.textContent=eIcon; elemEl.style.color=eClr; elemEl.title=u.elem||''; }

  const stEl = document.getElementById('mad-status-chips');
  if (stEl) stEl.innerHTML = stHtml || '';

  _refreshDrawerBars(u);

  // State badge
  const badge = document.getElementById('mad-state-badge');
  if (badge) {
    if (u.o === 'enemy') {
      badge.textContent = `⚔ ${eAtk} ATK  🛡 ${eDef} DEF`;
      badge.className   = 'state-enemy';
    } else if (u.moved && u.attacked) {
      badge.textContent = '✓ ĐÃ HÀNH ĐỘNG';
      badge.className   = 'state-done';
    } else if (u.moved && !u.attacked) {
      badge.textContent = '⚔ CHỌN MỤC TIÊU';
      badge.className   = 'state-atk';
    } else if (!u.moved) {
      badge.textContent = '🏃 CHỌN Ô DI CHUYỂN';
      badge.className   = 'state-move';
    }
  }

  // ── MIDDLE: skill chips ──────────────────────────────────────
  const skEl = document.getElementById('mad-skills');
  if (skEl) {
    skEl.innerHTML = '';
    const isPlayerTurn = G.turn==='player' && u.o==='player' && !G.gameOver;

    u.sk.forEach(sid => {
      const sk = SKILLS[sid]; if (!sk) return;
      const canUse   = isPlayerTurn && u.curMp>=sk.mp && !u.usedSkill && u.alive;
      const isUlti   = !!sk.ulti;
      const ultiOk   = isUlti && G.ultiReady;
      const isActive = G.activeSk===sid;
      const seClr    = sk.elem?(ELEM_COLORS[sk.elem]||''):'';

      const chip = document.createElement('button');
      chip.className = 'mad-skill-chip'
        + (isActive      ? ' chip-active' : '')
        + (!canUse&&!ultiOk ? ' chip-nomp'  : '')
        + (isUlti        ? ' chip-ulti'   : '');
      chip.disabled  = !canUse && !ultiOk;
      chip.setAttribute('aria-label', sk.n);

      chip.innerHTML =
        `<span class="mad-chip-icon" style="color:${seClr||'inherit'}">${sk.i}</span>` +
        `<span class="mad-chip-name">${_abbrev(sk.n, 7)}</span>` +
        `<span class="mad-chip-cost${isUlti?' ulti-cost':''}">${isUlti?'ULTI':sk.mp+'MP'}</span>`;

      chip.addEventListener('click', () => {
        import('./InputHandler.js').then(m => m.pickSkill(u.id, sid));
      });
      skEl.appendChild(chip);
    });

    // EVO chip (player unit only)
    const hasStone = (P.inventory.evo_stone||0)>0;
    if (u.o==='player' && u.evoReady && !u.evolved && hasStone && EVOLUTIONS[u.id]) {
      const evoChip = document.createElement('button');
      evoChip.className = 'mad-skill-chip mad-evo-chip';
      evoChip.setAttribute('aria-label', 'Tiến hóa');
      evoChip.innerHTML =
        `<span class="mad-chip-icon">✨</span>` +
        `<span class="mad-chip-name">EVO!</span>` +
        `<span class="mad-chip-cost" style="color:var(--gold)">💎×1</span>`;
      const uid = u.id;
      evoChip.addEventListener('click', () => {
        import('../features/Evolution.js').then(m => m.showEvoModal(uid));
      });
      skEl.appendChild(evoChip);
    }

    // Empty state
    if (!skEl.children.length) {
      const placeholder = document.createElement('span');
      placeholder.style.cssText = 'font-size:9px;color:#444;padding:0 8px;white-space:nowrap;font-family:Rajdhani,sans-serif';
      placeholder.textContent = u.o==='enemy' ? '👺 Kẻ địch — xem trạng thái' : '⏳ Đã dùng kỹ năng lượt này';
      skEl.appendChild(placeholder);
    }
  }

  // ── Open drawer ──────────────────────────────────────────────
  _openDrawer();
}

/** Update only the HP/MP bars (called each render tick) */
function _refreshDrawerBars(u) {
  const hpFill = document.getElementById('mad-hp-fill');
  const mpFill = document.getElementById('mad-mp-fill');
  const hpVal  = document.getElementById('mad-hp-val');
  const mpVal  = document.getElementById('mad-mp-val');

  if (hpFill) hpFill.style.width = Math.max(0, u.curHp/u.hp*100) + '%';
  if (mpFill) mpFill.style.width = Math.max(0, u.curMp/u.mp*100) + '%';
  if (hpVal)  hpVal.textContent  = `${u.curHp}/${u.hp}`;
  if (mpVal)  mpVal.textContent  = `${u.curMp}/${u.mp}`;
}

function _openDrawer() {
  if (_drawerOpen || !isMobile()) return;  // belt-and-suspenders: never open on desktop
  _drawerOpen = true;
  const d = document.getElementById('mob-action-drawer');
  if (d) { d.classList.add('open'); d.setAttribute('aria-hidden','false'); }
  const bw = document.getElementById('bw');
  if (bw) bw.classList.add('drawer-active');
  calcBoardSize();
}


/**
 * Called ONCE at boot (from main.js) to bind the static drawer control buttons.
 * Using addEventListener instead of onclick= attrs avoids ES-module scope timing
 * issues and prevents duplicate bindings on re-render.
 */
export function initDrawerBindings() {
  // Cancel button → cancelAct (InputHandler)
  document.getElementById('mad-cancel-btn')
    ?.addEventListener('click', () => {
      import('./InputHandler.js').then(m => m.cancelAct());
    });

  // End-turn button → endTurn (TurnSystem)
  document.getElementById('mad-end-btn')
    ?.addEventListener('click', () => {
      import('../systems/TurnSystem.js').then(m => m.endTurn());
    });
}

export function closeMobDrawer() {
  if (!_drawerOpen) return;
  _drawerOpen = false;
  _drawerUnit = null;
  const d = document.getElementById('mob-action-drawer');
  if (d) { d.classList.remove('open'); d.setAttribute('aria-hidden','true'); }
  const bw = document.getElementById('bw');
  if (bw) bw.classList.remove('drawer-active');
  calcBoardSize();
}

// ─────────────────────────────────────────────────────────────
// Full overlay (non-battle mobile contexts)
// ─────────────────────────────────────────────────────────────

function _renderUnitDetailMobile(u) {
  const overlay = document.getElementById('mob-ud-overlay');
  if (!overlay) return;
  if (!u) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    return;
  }
  const pos    = findU(u.id);
  const t      = pos ? (G.activeMap[pos[0]]?.[pos[1]]||'plains') : 'plains';
  const td     = TERRAIN[t] || TERRAIN.plains;
  const shld   = u.status.some(s=>s.type==='shield');
  const bsk    = u.status.some(s=>s.type==='berserk');
  const spdUp  = u.status.some(s=>s.type==='speedup');
  const eAtk   = Math.floor(u.atk*(bsk?1.5:1));
  const eDef   = u.def+td.def+(shld?5:0);
  const eSpd   = Math.max(1,u.spd-td.spd+(spdUp?2:0));
  const eIcon  = u.elem?(ELEM_ICONS[u.elem]||''):'';
  const eClr   = u.elem?(ELEM_COLORS[u.elem]||'#888'):'#888';
  const stHtml = u.status.map(s=>{const sd=STATUS[s.type];return sd?`<span style="color:${sd.color}">${sd.icon}${s.turns}t</span>`:''}).join(' ');
  const xpNeed = u.lv*30;
  const xpPct  = Math.min(100,(u.xp/xpNeed)*100);
  const hasStone    = (P.inventory.evo_stone||0)>0;
  const hasEvoPaths = !!(EVOLUTIONS[u.id]);

  const _set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const emojiEl = document.getElementById('mob-ud-emoji');
  if (emojiEl) {
    emojiEl.textContent = u.e;
    emojiEl.style.filter = u.evolved
      ? 'drop-shadow(0 0 8px var(--gold)) drop-shadow(0 0 20px rgba(255,200,0,.5))'
      : u.o==='player' ? 'drop-shadow(0 0 5px rgba(50,140,255,.8))'
                       : 'drop-shadow(0 0 5px rgba(220,40,60,.8))';
  }
  const nameEl = document.getElementById('mob-ud-name');
  if (nameEl) nameEl.textContent = `${u.n}${u.evolved?'★':''}  LV${u.lv}`;
  const elemEl = document.getElementById('mob-ud-elem-status');
  if (elemEl) elemEl.innerHTML = `<span style="color:${eClr}">${eIcon} ${u.elem}</span>` + (stHtml ? `&nbsp;${stHtml}` : '');
  _set('mob-ud-hp',  `${u.curHp}/${u.hp}`);
  _set('mob-ud-mp',  `${u.curMp}/${u.mp}`);
  _set('mob-ud-atk', eAtk+(eAtk!==u.atk?'*':''));
  _set('mob-ud-def', eDef+(eDef!==u.def?'*':''));
  _set('mob-ud-spd', eSpd+(eSpd!==u.spd?'*':''));
  _set('mob-ud-lv',  u.lv);

  const xpRow = document.getElementById('mob-ud-xp-row');
  if (xpRow && u.o==='player') {
    xpRow.innerHTML = `<div style="display:flex;align-items:center;gap:4px">
      <span>XP ${u.xp}/${xpNeed}</span>
      <div style="flex:1;height:4px;background:#111;border-radius:2px;overflow:hidden;border:1px solid #222">
        <div style="width:${xpPct}%;height:100%;background:var(--gold);border-radius:2px"></div>
      </div></div>`;
  } else if (xpRow) xpRow.innerHTML='';

  const evoRow = document.getElementById('mob-ud-evo-btn-row');
  if (evoRow) {
    if (u.o==='player' && hasEvoPaths && !u.evolved) {
      if (u.evoReady && hasStone) {
        const uid=u.id;
        evoRow.innerHTML=`<button class="evo-panel-btn" id="mob-evo-btn">✨ TIẾN HÓA! (${EVOLUTIONS[u.id].length} hướng)</button>`;
        evoRow.querySelector('#mob-evo-btn').onclick=()=>import('../features/Evolution.js').then(m=>m.showEvoModal(uid));
      } else if (u.evoReady) {
        evoRow.innerHTML=`<div class="evo-panel-info ready">✨ Cần 1 💎 Đá Tiến Hóa</div>`;
      } else {
        evoRow.innerHTML=`<div class="evo-panel-info">🔒 Tiến hóa LV10 + 💎 (LV${u.lv})</div>`;
      }
    } else evoRow.innerHTML='';
  }

  const skEl = document.getElementById('mob-ud-skills');
  if (skEl) {
    skEl.innerHTML='';
    u.sk.forEach(sid=>{
      const sk=SKILLS[sid]; if(!sk) return;
      const canUse = u.curMp>=sk.mp&&!u.usedSkill&&u.alive&&G.turn==='player'&&u.o==='player';
      const isUlti=!!sk.ulti; const isActive=G.activeSk===sid;
      const seClr=sk.elem?(ELEM_COLORS[sk.elem]||''):'#444';
      const seIcon=sk.elem?(ELEM_ICONS[sk.elem]||''):'';
      const btn=document.createElement('button');
      btn.className=`skbt${isActive?' aski':''}${canUse?'':' nomp'}${isUlti?' ulti-skill':''}`;
      btn.dataset.skid=sid; btn.dataset.uid=u.id;
      btn.innerHTML=`<span class="ski">${sk.i}</span>`+
        `<div style="flex:1"><div class="skn">${sk.n}${isUlti?' 🌟':''} <span style="color:${seClr}">${seIcon}</span></div>`+
        `<div class="skd">${sk.d}</div></div>`+
        `<div class="skc">${isUlti?'ULTI':sk.mp+'MP'}</div>`;
      btn.addEventListener('click',()=>import('./InputHandler.js').then(m=>m.pickSkill(u.id,sid)));
      skEl.appendChild(btn);
    });
  }
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
}

// ─────────────────────────────────────────────────────────────
// Desktop unit detail
// ─────────────────────────────────────────────────────────────

function _renderUnitDetailDesktop(u) {
  const el = document.getElementById('ud');
  if (!el) return;
  if (!u) {
    el.innerHTML='<div style="color:#333;font-size:10px;text-align:center;padding:16px 0">Chọn quân để xem</div>';
    return;
  }
  el.innerHTML = _buildDetailHTML(u);
  _attachDetailEvents(el, u);
}

// ── Ultimate overlay ──────────────────────────────────────────
export function showUltiOverlay(u, sk) {
  const ov=document.getElementById('ulti-overlay');
  const tt=document.getElementById('ulti-title');
  const sb=document.getElementById('ulti-sub');
  if (!ov||!tt) return;
  tt.textContent=`${u.e} ${sk.n}`; if(sb) sb.textContent=sk.d;
  ov.classList.add('show'); setTimeout(()=>ov.classList.remove('show'),1800);
}

export function activateUlti() {
  if (!G.ultiReady||G.turn!=='player'||G.gameOver) return;
  const ultiUnit=Object.values(G.units).find(u=>u.o==='player'&&u.alive&&u.sk.some(sid=>SKILLS[sid]?.ulti));
  if (!ultiUnit) return;
  const ultiSkId=ultiUnit.sk.find(sid=>SKILLS[sid]?.ulti);
  const pos=findU(ultiUnit.id); if(!pos) return;
  import('../combat/combat.js').then(m=>m.execSkill(pos,pos,ultiSkId));
}

// ── Kept for backwards compat (Tabs.js calls this) ───────────
export function closeMobUd() {
  const overlay = document.getElementById('mob-ud-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); }
  closeMobDrawer();
}

// ══════════════════════════════════════════════════════════════
// MOBILE LOG
// ══════════════════════════════════════════════════════════════

export function syncMobLog() {
  const src  = document.getElementById('log');
  const dest = document.getElementById('mob-log-content');
  if (!src||!dest) return;
  dest.innerHTML = src.innerHTML;
  dest.scrollTop = dest.scrollHeight;
  if (!_logOpen) {
    const badge = document.getElementById('mob-log-badge');
    if (badge) badge.classList.add('has-new');
  }
}

export function toggleMobLog() {
  const panel = document.getElementById('mob-log-panel');
  if (!panel) return;
  _logOpen = !panel.classList.contains('log-open');
  if (_logOpen) {
    syncMobLog();
    const badge=document.getElementById('mob-log-badge');
    if (badge) badge.classList.remove('has-new');
    panel.classList.add('log-open');
  } else {
    panel.classList.remove('log-open');
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function _abbrev(str, maxLen) {
  return str.length <= maxLen ? str : str.slice(0, maxLen-1) + '…';
}

function _buildDetailHTML(u) {
  const pos    = findU(u.id);
  const t      = pos?(G.activeMap[pos[0]]?.[pos[1]]||'plains'):'plains';
  const td     = TERRAIN[t]||TERRAIN.plains;
  const shld   = u.status.some(s=>s.type==='shield');
  const bsk    = u.status.some(s=>s.type==='berserk');
  const spdUp  = u.status.some(s=>s.type==='speedup');
  const eAtk   = Math.floor(u.atk*(bsk?1.5:1));
  const eDef   = u.def+td.def+(shld?5:0);
  const eSpd   = Math.max(1,u.spd-td.spd+(spdUp?2:0));
  const stHtml = u.status.map(s=>{const sd=STATUS[s.type];return sd?`<span style="color:${sd.color}" title="${sd.desc}">${sd.icon}${s.turns}t</span>`:''}).join(' ');
  const xpNeed = u.lv*30;
  const xpPct  = Math.min(100,(u.xp/xpNeed)*100);
  const hasStone    = (P.inventory.evo_stone||0)>0;
  const hasEvoPaths = !!(EVOLUTIONS[u.id]);
  const eIcon = u.elem?(ELEM_ICONS[u.elem]||''):'';
  const eClr  = u.elem?(ELEM_COLORS[u.elem]||'#888'):'#888';

  let html='';
  html+=`<div class="dp ${u.evolved?'dp-evolved':''}">${u.e}</div>`;
  html+=`<div class="dn">${u.n}${u.evolved?' ★':''}</div>`;
  html+=`<div style="text-align:center;margin-bottom:2px;font-size:10px;color:${eClr}">${eIcon} ${u.elem}</div>`;
  if(stHtml) html+=`<div style="text-align:center;margin-bottom:3px;font-size:11px">${stHtml}</div>`;
  html+='<div class="dsg">';
  html+=`<div class="dsi"><div class="dsil">HP</div><div class="dsiv" style="color:#ff6666">${u.curHp}/${u.hp}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">MP</div><div class="dsiv" style="color:#6699ff">${u.curMp}/${u.mp}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">ATK</div><div class="dsiv">${eAtk}${eAtk!==u.atk?'*':''}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">DEF</div><div class="dsiv">${eDef}${eDef!==u.def?'*':''}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">SPD</div><div class="dsiv">${eSpd}${eSpd!==u.spd?'*':''}</div></div>`;
  html+=`<div class="dsi"><div class="dsil">LV</div><div class="dsiv" style="color:var(--gold)">${u.lv}</div></div>`;
  html+='</div>';
  if(u.o==='player'){
    html+=`<div style="font-size:8px;color:#444;margin-bottom:1px">XP: ${u.xp}/${xpNeed}</div>`;
    html+=`<div class="mb mb-xp" style="margin-bottom:6px"><div class="mbf" style="width:${xpPct}%"></div></div>`;
  }
  if(u.o==='player'&&hasEvoPaths&&!u.evolved){
    if(u.evoReady&&hasStone)
      html+=`<button class="evo-panel-btn" id="evo-detail-btn">✨ TIẾN HÓA! (${EVOLUTIONS[u.id].length} hướng)</button>`;
    else if(u.evoReady&&!hasStone)
      html+=`<div class="evo-panel-info ready">✨ Sẵn sàng!<br>⚠ Cần 1 💎 Đá Tiến Hóa</div>`;
    else
      html+=`<div class="evo-panel-info">🔒 Tiến hóa: LV10+💎 (${u.lv}/10)</div>`;
  }
  html+='<div style="font-size:9px;color:#444;margin-bottom:3px;letter-spacing:1px">✦ KỸ NĂNG</div>';
  u.sk.forEach(sid=>{
    const sk=SKILLS[sid]; if(!sk) return;
    const canUse=u.curMp>=sk.mp&&!u.usedSkill&&u.alive&&G.turn==='player'&&u.o==='player';
    const isUlti=!!sk.ulti; const isActive=G.activeSk===sid;
    const seClr=sk.elem?(ELEM_COLORS[sk.elem]||''):'#444';
    const seIcon=sk.elem?(ELEM_ICONS[sk.elem]||''):'';
    html+=`<button class="skbt${isActive?' aski':''}${canUse?'':' nomp'}${isUlti?' ulti-skill':''}"
      data-skid="${sid}" data-uid="${u.id}">
      <span class="ski">${sk.i}</span>
      <div style="flex:1"><div class="skn">${sk.n}${isUlti?' 🌟':''} <span style="color:${seClr}">${seIcon}</span></div>
      <div class="skd">${sk.d}</div></div>
      <div class="skc">${isUlti?'ULTI':sk.mp+'MP'}</div>
    </button>`;
  });
  return html;
}

function _attachDetailEvents(el, u) {
  const evoBtn=el.querySelector('#evo-detail-btn');
  if(evoBtn){ const uid=u.id; evoBtn.addEventListener('click',()=>import('../features/Evolution.js').then(m=>m.showEvoModal(uid))); }
  el.querySelectorAll('.skbt[data-skid]').forEach(btn=>{
    const sid=btn.dataset.skid, uid2=btn.dataset.uid;
    btn.addEventListener('click',()=>import('./InputHandler.js').then(m=>m.pickSkill(uid2,sid)));
  });
}

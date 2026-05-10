// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Enemy Spawner System
// Calculates player power score and generates scaled enemy teams
// Smart AI target selection based on elemental advantages
// ═══════════════════════════════════════════════════════════════

import { UDEFS, GACHA_POOL, SKILLS, ELEM_ADV, getElemMult } from '../core/data.js';
import { P, computePowerScore } from '../core/playerState.js';
import { G } from '../core/gameState.js';

// ── Base enemy templates by role ──
const ENEMY_TEMPLATES = {
  // Original V5 enemies (available always)
  head_sucker:   { ...UDEFS.head_sucker,   id:'head_sucker',   role:'attacker' },
  ganbo:         { ...UDEFS.ganbo,         id:'ganbo',         role:'tank' },
  cobrada:       { ...UDEFS.cobrada,       id:'cobrada',       role:'speedster' },
  dinosaur_wing: { ...UDEFS.dinosaur_wing, id:'dinosaur_wing', role:'bruiser' },
  docra:         { ...UDEFS.docra,         id:'docra',         role:'support' },
  // V5.1 new enemies — spawned by EnemySpawner for higher floors
  shadow_wraith: { n:'Shadow Wraith', lv:6, hp:20, mp:14, atk:10, def:4, spd:4, e:'👻', o:'enemy', elem:'dark',    sk:['drain','teleport'],     desc:'Hồn ma bóng tối thoắt ẩn thoắt hiện' },
  fire_titan:    { n:'Fire Titan',    lv:7, hp:28, mp:10, atk:13, def:6, spd:2, e:'🔥', o:'enemy', elem:'fire',    sk:['flame_breath','stomp'],  desc:'Người khổng lồ lửa hủy diệt tất cả' },
  ice_golem:     { n:'Ice Golem',     lv:6, hp:30, mp:8,  atk:9,  def:10,spd:1, e:'🧊', o:'enemy', elem:'water',   sk:['ice_blast','barrier'],   desc:'Golem băng vĩnh cửu không thể phá vỡ' },
  thunder_lord:  { n:'Thunder Lord',  lv:8, hp:22, mp:16, atk:14, def:5, spd:5, e:'⚡', o:'enemy', elem:'thunder', sk:['thunder','thunder_wave'],desc:'Chúa sét tốc độ ánh sáng tuyệt đỉnh' },
  vine_queen:    { n:'Vine Queen',    lv:7, hp:24, mp:14, atk:11, def:7, spd:3, e:'🌿', o:'enemy', elem:'grass',   sk:['vine_trap','poison_bite'],desc:'Nữ hoàng dây leo độc tố nguy hiểm' },
  dark_emperor:  { n:'Dark Emperor',  lv:9, hp:26, mp:16, atk:15, def:8, spd:3, e:'👑', o:'enemy', elem:'dark',    sk:['ulti_yugi','drain'],     desc:'Hoàng đế bóng tối quyền lực tuyệt đỉnh' },
  // V6.0: Giant Bosses
  obelisk:       { n:'Obelisk',       lv:15, hp:80, mp:20, atk:25, def:15,spd:2, e:'🔷', o:'enemy', elem:'neutral',sk:['cross_slash','stomp'],     desc:'Vị thần khổng lồ với sức mạnh vô song', size: 2 },
  slifer:        { n:'Slifer',        lv:15, hp:70, mp:25, atk:30, def:10,spd:3, e:'🐉', o:'enemy', elem:'fire',   sk:['horizontal_sweep','flame_breath'], desc:'Rồng bầu trời của thần', size: 2 },
  ra:            { n:'Ra',            lv:18, hp:100, mp:30, atk:35, def:20,spd:1, e:'🌞', o:'enemy', elem:'light',  sk:['circular_shock','ulti_yugi'],     desc:'Thần mặt trời tối cao', size: 3 },
};

/** Scale a unit's stats by a multiplier */
function scaleUnit(template, mult) {
  return {
    ...template,
    lv:  Math.max(1, Math.round(template.lv * mult)),
    hp:  Math.max(5, Math.round(template.hp * mult)),
    atk: Math.max(2, Math.round(template.atk * mult)),
    def: Math.max(1, Math.round(template.def * mult)),
    mp:  template.mp,
    spd: Math.min(8, template.spd),
  };
}

/**
 * Generate enemy team for given mode and floor.
 * Scales stats to match player power score.
 * @param {string} mode - 'campaign' | 'endless' | 'arena'
 * @param {number} floor
 * @returns {Array} Array of enemy unit definitions
 */
export function spawnEnemies(mode, floor) {
  const powerScore = computePowerScore();

  if (mode === 'campaign') return spawnCampaignEnemies(floor, powerScore);
  if (mode === 'endless')  return spawnEndlessEnemies(floor, powerScore);
  if (mode === 'arena')    return spawnArenaEnemies(powerScore);
  return spawnCampaignEnemies(floor, powerScore);
}

/** Campaign enemies — fixed compositions, slight scaling */
function spawnCampaignEnemies(floor, powerScore) {
  const scaleMult = Math.max(0.8, Math.min(2.5, powerScore / 100));

  const compositions = [
    // Floor 1
    ['head_sucker','ganbo','cobrada','dinosaur_wing','docra'],
    // Floor 2
    ['head_sucker','ganbo','shadow_wraith','dinosaur_wing','docra'],
    // Floor 3
    ['fire_titan','ganbo','cobrada','dinosaur_wing','shadow_wraith'],
    // Floor 4
    ['fire_titan','ice_golem','cobrada','thunder_lord','docra'],
    // Floor 5
    ['dark_emperor','ice_golem','thunder_lord','vine_queen','shadow_wraith'],
    // Floor 6+
    ['dark_emperor','fire_titan','thunder_lord','vine_queen','ice_golem'],
    // Floor 7 (Giant Boss)
    ['obelisk'],
  ];

  const idx = Math.min(floor - 1, compositions.length - 1);
  return compositions[idx].map(id => {
    const tmpl = ENEMY_TEMPLATES[id];
    if (!tmpl) return null;
    const scaled = scaleUnit(tmpl, 0.9 + (floor * 0.05) + (scaleMult - 1) * 0.3);
    scaled.id = id; // preserve id for ENEMY_TEMPLATES lookup
    return scaled;
  }).filter(Boolean);
}

/** Endless enemies — procedural, escalating rapidly */
function spawnEndlessEnemies(floor, powerScore) {
  // Floors 1-3: basic pool
  // Floors 4-7: intermediate
  // Floors 8+: elite + scaled
  const scaleMult = Math.max(0.7, Math.min(3.5, (powerScore / 100) * (0.8 + floor * 0.08)));

  const basicPool    = ['head_sucker','ganbo','cobrada','dinosaur_wing','docra'];
  const midPool      = ['shadow_wraith','fire_titan','ice_golem','thunder_lord','vine_queen'];
  const elitePool    = ['dark_emperor','fire_titan','thunder_lord','vine_queen'];

  let pool;
  if      (floor <= 3)  pool = basicPool;
  else if (floor <= 7)  pool = [...basicPool, ...midPool];
  else                  pool = [...midPool, ...elitePool, ...elitePool]; // weight elites

  // V6.0: Occasionally include a giant boss in elite floors
  if (floor >= 7) {
    if (floor >= 15) pool.push('ra');
    else if (floor >= 10) pool.push('slifer');
    else pool.push('obelisk');
  }

  // Increased chance for Boss encounters every 5 floors
  const bossChance = (floor % 5 === 0) ? 0.5 : 0.1;
  if (Math.random() < bossChance && floor >= 7) {
    const bossId = floor >= 15 ? 'ra' : floor >= 10 ? 'slifer' : 'obelisk';
    pool = [...elitePool, bossId, bossId]; // Force boss presence in pool
  }

  // Pick 5 random from pool (allow repeats for higher floors)
  const count = Math.min(5, 3 + Math.floor(floor / 3));
  const team = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let id;
    // Try to avoid duplicates for first pick
    let attempts = 0;
    do {
      id = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (used.has(id) && attempts < 10);
    used.add(id);

    const tmpl = ENEMY_TEMPLATES[id];
    if (!tmpl) continue;
    const scaled = scaleUnit(tmpl, scaleMult);
    scaled.id = `${id}_f${floor}_${i}`;
    scaled._templateId = id;
    team.push(scaled);
  }
  return team;
}

/** Arena enemies — mirror player roster, scaled to player power */
function spawnArenaEnemies(powerScore) {
  // Build a mirrored enemy team from all templates
  const allTemplates = Object.values(ENEMY_TEMPLATES);
  const scaleMult = Math.max(0.85, Math.min(2.0, powerScore / 100));

  // Sort by "role balance": one tank, one support, rest attackers
  const tanks    = allTemplates.filter(t => t.role === 'tank');
  const supports = allTemplates.filter(t => t.role === 'support');
  const others   = allTemplates.filter(t => t.role !== 'tank' && t.role !== 'support');

  const team = [];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const roster = P.roster || [];
  const rosterSize = Math.min(5, Math.max(3, roster.length));

  if (tanks.length)    team.push(scaleUnit(pick(tanks),    scaleMult));
  if (supports.length && team.length < rosterSize) team.push(scaleUnit(pick(supports), scaleMult));
  while (team.length < rosterSize) {
    const t = scaleUnit(pick(others), scaleMult);
    t.id = `arena_${team.length}_${t.id}`;
    team.push(t);
  }
  team.forEach((u, i) => {
    if (!u.id) u.id = `arena_${i}`;
    u._templateId = u.id.split('_')[0];
  });
  return team;
}

// ═══════════════════════════════════════════════════════════════
// Smart AI Target Selection — uses elemental advantages
// ═══════════════════════════════════════════════════════════════

/**
 * Smart AI target priority:
 * 1. Prioritize targets with elemental weakness to this unit
 * 2. Among same advantage, target lowest HP
 * 3. Fallback to proximity
 * @param {Object} aiUnit - The enemy AI unit
 * @param {Array} targets - Array of [row, col] of reachable player units
 */
export function selectBestTarget(aiUnit, targets) {
  if (!targets.length) return null;

  const scored = targets.map(([r, c]) => {
    const tid = G.grid[r][c];
    if (!tid || !G.units[tid]) return null;
    const target = G.units[tid];

    // Elemental advantage score (0, 1, 2)
    const elemScore = getElemMult(aiUnit.elem, target.elem) > 1.1 ? 2
                    : getElemMult(target.elem, aiUnit.elem) > 1.1 ? -1
                    : 0;

    // HP priority: prefer low HP targets (1 = full HP, 10 = near-dead)
    const hpPriority = Math.floor((1 - target.curHp / target.hp) * 10);

    // Level advantage
    const lvScore = Math.max(0, target.lv - aiUnit.lv);

    // Distance penalty (prefer closer)
    const pos = findUnitPos(aiUnit.id);
    const dist = pos ? Math.abs(pos[0] - r) + Math.abs(pos[1] - c) : 0;

    const total = elemScore * 5 + hpPriority * 2 + lvScore - dist * 0.5;
    return { pos: [r, c], target, total };
  }).filter(Boolean);

  scored.sort((a, b) => b.total - a.total);
  return scored[0]?.pos || null;
}

/** Select best skill for AI to use based on elemental advantage */
export function selectBestSkill(aiUnit, playerUnits) {
  if (!aiUnit.sk?.length) return null;
  const availableSkills = aiUnit.sk.filter(sid => {
    const sk = SKILLS[sid];
    return sk && !sk.ulti && aiUnit.curMp >= sk.mp;
  });
  if (!availableSkills.length) return null;

  // Prefer skills with elemental advantage over player team
  for (const sid of availableSkills) {
    const sk = SKILLS[sid];
    if (!sk.elem || sk.elem === 'neutral') continue;
    const hasAdvantage = playerUnits.some(p =>
      p.alive && getElemMult(sk.elem, p.elem) > 1.1
    );
    if (hasAdvantage) return sid;
  }

  // Random from available
  return availableSkills[Math.floor(Math.random() * availableSkills.length)];
}

/** Helper: find unit position from G.grid */
function findUnitPos(id) {
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (G.grid[r][c] === id) return [r, c];
    }
  }
  return null;
}

/** Get endless roguelite reward options after clearing a floor */
export function getEndlessRewards() {
  const rewards = [
    { type:'buff',  label:'💪 +2 ATK để cả đội',      desc:'Toàn bộ quái trong đội +2 ATK vĩnh viễn',   id:'team_atk' },
    { type:'buff',  label:'🛡 +2 DEF toàn đội',        desc:'Toàn bộ quái trong đội +2 DEF vĩnh viễn',   id:'team_def' },
    { type:'buff',  label:'💚 +5 HP max toàn đội',     desc:'Toàn bộ quái trong đội +5 HP tối đa',       id:'team_hp' },
    { type:'item',  label:'💎 ×1 Đá Tiến Hóa',         desc:'Nhận 1 Đá Tiến Hóa ngay lập tức',           id:'evo_stone' },
    { type:'item',  label:'❤️ ×3 Bình HP',             desc:'Nhận 3 Bình HP ngay lập tức',               id:'hp_potion_x3' },
    { type:'gold',  label:'💰 +200 Vàng',               desc:'Nhận 200 Vàng thưởng',                      id:'gold_200' },
    { type:'gold',  label:'💰 +300 Vàng thưởng lớn',   desc:'Nhận 300 Vàng từ kho báu',                  id:'gold_300' },
    { type:'gacha', label:'🎴 Gacha miễn phí',          desc:'Mở 1 gói gacha thường miễn phí',            id:'free_gacha' },
  ];
  // Pick 3 random rewards
  const shuffled = [...rewards].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Core Data Module
// All constants, definitions, and static lookup tables
// ═══════════════════════════════════════════════════════════════

export const SAVE_KEY = 'mwex5_player_v51';

// ── Grid dimensions (default; MapGenerator overrides for procedural) ──
export const DEFAULT_ROWS = 8;
export const DEFAULT_COLS = 10;

// ── Elemental advantage table ──
export const ELEM_ADV = {
  fire:    ['grass'],
  grass:   ['water'],
  water:   ['fire'],
  light:   ['dark'],
  dark:    ['light'],
  thunder: ['water'],
  neutral: [],
};

export const ELEM_ICONS = {
  fire:'🔥', water:'💧', grass:'🌿', thunder:'⚡', dark:'🌑', light:'✨', neutral:'○'
};

export const ELEM_COLORS = {
  fire:'#ff6622', water:'#4488ff', grass:'#44bb44', thunder:'#ffdd00',
  dark:'#aa44ff', light:'#ffeeaa', neutral:'#888'
};

export function getElemMult(atkElem, defElem) {
  if (!atkElem || !defElem || atkElem === 'neutral' || defElem === 'neutral') return 1.0;
  if ((ELEM_ADV[atkElem] || []).includes(defElem)) return 1.5;
  if ((ELEM_ADV[defElem] || []).includes(atkElem)) return 0.75;
  return 1.0;
}

// ── Monster Classes ──
export const MONSTER_CLASSES = {
  TANK: { icon: '🛡️', desc: 'High HP/DEF, low range, has Provoke (enemies nearby must attack them).' },
  ASSASSIN: { icon: '🗡️', desc: 'Low HP, high Move, Critical damage bonus.' },
  MAGE: { icon: '🔮', desc: 'High MP, AOE skills, low DEF.' },
  SUPPORT: { icon: '💖', desc: 'Buffs/Heals, increases allies\' MP recovery.' }
};

// ── Elemental Reactions ──
export const ELEMENTAL_REACTIONS = {
  VAPORIZE: { desc: 'Instant 1.5x damage' },
  FROZEN: { desc: 'Stun 1 turn' },
  BURNING: { desc: 'Damage over time for 2 turns' }
};

// ── Fusion Recipes ──
export const FUSION_COST = { gold: 500, materials: { magic_dust: 50 } };
export const FUSION_RECIPES = {
  'fire+grass':   'lava_dragon',
  'water+thunder':'storm_serpent',
  'dark+light':   'chaos_soldier',
  'fire+thunder': 'plasma_beast',
  'water+grass':  'frost_treant',
};

// ── Status effects ──
export const STATUS = {
  poison: { icon:'☠',  color:'#88ff44', desc:'Mất 2HP/lượt', dur:3 },
  burn:   { icon:'🔥', color:'#ff8800', desc:'Mất 3HP/lượt + -1DEF tạm thời', dur:2 },
  freeze: { icon:'❄',  color:'#88ddff', desc:'Không thể di chuyển hoặc tấn công', dur:2 },
  stun:   { icon:'💫', color:'#ffff44', desc:'Bỏ lượt hoàn toàn', dur:1 },
  shield: { icon:'🛡',  color:'#88aaff', desc:'+5DEF', dur:2 },
  berserk:{ icon:'😡', color:'#ff4444', desc:'+50%ATK -50%DEF', dur:2 },
  regen:  { icon:'💚', color:'#44ff88', desc:'+3HP/lượt', dur:3 },
  speedup:{ icon:'⚡',  color:'#00e5ff', desc:'+2SPD lượt này', dur:1 },
  wet:    { icon:'💦', color:'#00eeff', desc:'Ẩm ướt, dễ bị điện và băng', dur:2 },
  provoke:{ icon:'💢', color:'#ff3333', desc:'Kẻ địch xung quanh phải tấn công', dur:2 },
  burning:{ icon:'🔥', color:'#ff4400', desc:'Cháy liên tục 2 lượt', dur:2 },
};

// ── Terrain types ──
export const TERRAIN = {
  plains:  { cls:'',           def:0, spd:0, heal:0, block:false, name:'Đồng bằng' },
  forest:  { cls:'t-forest',   def:2, spd:1, heal:0, block:false, name:'Rừng +2DEF' },
  mountain:{ cls:'t-mountain', def:3, spd:2, heal:0, block:false, name:'Núi +3DEF' },
  water:   { cls:'t-water',    def:0, spd:0, heal:0, block:true,  name:'Sông (chặn)' },
  castle:  { cls:'t-castle',   def:1, spd:0, heal:2, block:false, name:'Pháo đài +2HP' },
  ruin:    { cls:'t-ruin',     def:0, spd:0, heal:0, block:false, name:'Phế tích' },
  trap:    { cls:'t-trap',     def:0, spd:0, heal:0, block:false, name:'Bẫy ⚠ -5HP' },
  speedup: { cls:'t-speedup',  def:0, spd:0, heal:0, block:false, name:'Tăng tốc +2SPD' },
  fire_shrine: { cls:'t-fire-shrine', def:0, spd:0, heal:0, block:false, elemBoost:'fire',   name:'Đền Lửa +25% Fire ATK' },
  water_shrine:{ cls:'t-water-shrine',def:0, spd:0, heal:0, block:false, elemBoost:'water',  name:'Đền Nước +25% Water ATK' },
  dark_shrine: { cls:'t-dark-shrine', def:0, spd:0, heal:0, block:false, elemBoost:'dark',   name:'Đền Tối +25% Dark ATK' },
  heal_spring: { cls:'t-heal-spring', def:0, spd:0, heal:4, block:false, name:'Suối Chữa +4HP/lượt' },
};

// ── Skills ──
export const SKILLS = {
  poison_bite: { n:'Độc cắn',     i:'☠',  mp:4, t:'attack', r:1, aoe:false, pw:1.0, fx:'poison',  elem:'neutral', d:'Tấn công + gây độc 3 lượt' },
  flame_breath:{ n:'Lửa phun',    i:'🔥', mp:5, t:'attack', r:2, aoe:true,  pw:0.7, fx:'burn',    elem:'fire',    d:'AOE lửa 2 ô + gây bỏng' },
  ice_blast:   { n:'Băng đóng',   i:'❄',  mp:4, t:'attack', r:2, aoe:false, pw:0.9, fx:'freeze',  elem:'water',   d:'Xa + đóng băng 2 lượt' },
  thunder:     { n:'Sấm sét',     i:'⚡', mp:6, t:'attack', r:3, aoe:false, pw:1.4, fx:null,      elem:'thunder', d:'Sét đánh xa, sát thương cao' },
  heal:        { n:'Chữa lành',   i:'💚', mp:4, t:'heal',   r:1, aoe:false, pw:8,   fx:'regen',   elem:'light',   d:'Hồi 8HP + tái sinh 3 lượt' },
  war_cry:     { n:'Chiến hô',    i:'😡', mp:3, t:'buff',   r:0, aoe:true,  pw:0,   fx:'berserk', elem:'neutral', d:'Berserk toàn đội +ATK' },
  barrier:     { n:'Lá chắn',     i:'🛡', mp:3, t:'buff',   r:0, aoe:false, pw:0,   fx:'shield',  elem:'light',   d:'+5DEF, giảm sát thương' },
  teleport:    { n:'Dịch chuyển', i:'🌀', mp:5, t:'move',   r:4, aoe:false, pw:0,   fx:null,      elem:'dark',    d:'Dịch chuyển tức thì 4 ô' },
  drain:       { n:'Hút sức',     i:'🩸', mp:4, t:'attack', r:1, aoe:false, pw:0.8, fx:null,      elem:'dark',    d:'Hút HP kẻ địch về mình' },
  stomp:       { n:'Đạp mạnh',    i:'🦶', mp:3, t:'attack', r:1, aoe:false, pw:1.2, fx:'stun',    elem:'neutral', d:'Đạp mạnh + gây choáng 1 lượt' },
  vine_trap:   { n:'Cây gai',     i:'🌿', mp:4, t:'attack', r:2, aoe:true,  pw:0.6, fx:'freeze',  elem:'grass',   d:'AOE cây gai + cầm chân địch' },
  thunder_wave:{ n:'Sóng Điện',   i:'🌊', mp:4, t:'attack', r:2, aoe:false, pw:0.8, fx:'stun',    elem:'thunder', d:'Sóng điện + gây choáng mục tiêu' },
  ulti_yugi:   { n:'DARK MAGIC',  i:'✨', mp:0, t:'ulti',   r:3, aoe:true,  pw:2.5, fx:'stun',    elem:'dark',    d:'TUYỆT CHIÊU: AOE toàn bản đồ!', ulti:true },
  ulti_trigan: { n:'THUNDER GOD', i:'⚡', mp:0, t:'ulti',   r:5, aoe:false, pw:3.0, fx:'freeze',  elem:'thunder', d:'TUYỆT CHIÊU: Sét thần tức chết!', ulti:true },
  ulti_dark:   { n:'CHAOS VOID',  i:'🌑', mp:0, t:'ulti',   r:3, aoe:true,  pw:2.8, fx:'poison',  elem:'dark',    d:'TUYỆT CHIÊU: Hố đen hút tất cả!', ulti:true },
  cross_slash:     { n:'Thần Kiếm',   i:'⚔️', mp:6, t:'attack', r:3, aoe:true, pw:1.2, fx:null,      elem:'neutral', pattern:'cross',      d:'Đòn đánh hình chữ thập' },
  horizontal_sweep:{ n:'Quét Ngang',  i:'🌪', mp:5, t:'attack', r:2, aoe:true, pw:1.0, fx:null,      elem:'neutral', pattern:'horizontal', d:'Quét sạch hàng ngang' },
  circular_shock:  { n:'Xung Kích',   i:'⭕', mp:7, t:'attack', r:2, aoe:true, pw:1.1, fx:null,      elem:'neutral', pattern:'circular',   d:'Chấn động hình tròn xung quanh' },
};

// ── Evolutions ──
export const EVOLUTIONS = {
  trigan:[
    { pathId:'flame_sw',  n:'Flame Swordsman', e:'🦁', elem:'fire',    hp:5, mp:4, atk:6, def:3, spd:0, desc:'Kiếm sĩ lửa tấn công tối thượng', newSkill:'ulti_trigan', label:'⚔ Kiếm Sĩ Lửa' },
    { pathId:'thunder_ea',n:'Thunder Eagle',   e:'🦅', elem:'thunder', hp:3, mp:7, atk:3, def:1, spd:2, desc:'Đại bàng sấm sét tốc độ vô địch', newSkill:'thunder_wave', label:'⚡ Đại Bàng Sấm' },
  ],
  great_bar:[
    { pathId:'grand_kn',  n:'Grand Knight',    e:'⚔️', elem:'light',   hp:7, mp:3, atk:5, def:5, spd:0, desc:'Hiệp sĩ tối thượng cân bằng ATK và DEF', newSkill:'war_cry', label:'🛡 Hiệp Sĩ Ánh Sáng' },
    { pathId:'berserker', n:'Berserker King',  e:'💢', elem:'fire',    hp:3, mp:5, atk:9, def:2, spd:1, desc:'Chiến binh cuồng nộ — ATK cực cao', newSkill:'stomp', label:'💥 Cuồng Nộ Lửa' },
  ],
  eye_mouse:[
    { pathId:'shadow_nj', n:'Shadow Ninja',    e:'🥷', elem:'dark',    hp:3, mp:6, atk:7, def:2, spd:0, desc:'Nhẫn giả bóng tối tấn công từ bóng đêm', newSkill:'teleport', label:'🌑 Bóng Tối' },
    { pathId:'psychic_e', n:'Psychic Eye',     e:'🔮', elem:'light',   hp:5, mp:9, atk:4, def:4, spd:0, desc:'Mắt tâm linh ma thuật — MP rất cao', newSkill:'barrier', label:'✨ Tâm Linh' },
  ],
  flower_man:[
    { pathId:'tree_anc',  n:'Tree Ancient',    e:'🌳', elem:'grass',   hp:9, mp:5, atk:2, def:7, spd:0, desc:'Cổ thụ thiên nhiên — DEF cao + hồi máu', newSkill:'heal', label:'🌿 Cổ Thụ' },
    { pathId:'thorn_sh',  n:'Thorn Shaman',    e:'🌵', elem:'grass',   hp:4, mp:8, atk:5, def:3, spd:0, desc:'Pháp sư gai độc — tấn công AOE', newSkill:'vine_trap', label:'☠ Gai Độc' },
  ],
  devil_castle:[
    { pathId:'chaos_fort',n:'Chaos Fortress',  e:'🏰', elem:'dark',    hp:6, mp:4, atk:4, def:9, spd:0, desc:'Pháo đài hỗn loạn — DEF cực cao', newSkill:'ulti_yugi', label:'🏯 Pháo Đài' },
    { pathId:'dark_lord', n:'Dark Lord',       e:'🗼', elem:'dark',    hp:4, mp:7, atk:8, def:5, spd:0, desc:'Lãnh chúa tối cao — sát thương cao', newSkill:'ulti_dark', label:'🩸 Lãnh Chúa' },
  ],
};

// ── Unit definitions ──
export const UDEFS = {
  head_sucker:  { n:'Head Sucker',  lv:5, hp:22, mp:10, atk:9,  def:5, spd:2, e:'💀', o:'enemy',  elem:'dark',    sk:['drain','poison_bite'],    desc:'Quái đầu lâu hút sinh khí', cls:'ASSASSIN' },
  ganbo:        { n:'Ganbo',        lv:5, hp:25, mp:8,  atk:8,  def:8, spd:2, e:'🗿', o:'enemy',  elem:'neutral', sk:['war_cry','barrier'],       desc:'Khổng lồ đá phòng thủ tối cao', cls:'TANK' },
  cobrada:      { n:'Cobrada',      lv:4, hp:16, mp:12, atk:10, def:3, spd:4, e:'🐍', o:'enemy',  elem:'grass',   sk:['poison_bite','ice_blast'],  desc:'Rắn hổ mang tốc độ và độc', cls:'ASSASSIN' },
  dinosaur_wing:{ n:'Dino Wing',    lv:5, hp:20, mp:10, atk:11, def:4, spd:3, e:'🐉', o:'enemy',  elem:'fire',    sk:['flame_breath','thunder'],    desc:'Long thần hỏa lực mạnh nhất', cls:'MAGE' },
  docra:        { n:'Docrā',        lv:4, hp:18, mp:9,  atk:8,  def:7, spd:2, e:'👹', o:'enemy',  elem:'dark',    sk:['barrier','heal'],            desc:'Quỷ đầu sừng dẻo dai bất bại', cls:'SUPPORT' },
  trigan:       { n:'Trigan',       lv:2, hp:10, mp:14, atk:5,  def:2, spd:5, e:'🦅', o:'player', elem:'fire',    sk:['thunder','teleport'],        desc:'Đại bàng lửa — Tiến hóa đa nhánh LV10', cls:'ASSASSIN' },
  great_bar:    { n:'Great Bar',    lv:4, hp:16, mp:10, atk:8,  def:6, spd:2, e:'🛡️',o:'player', elem:'light',   sk:['barrier','war_cry'],          desc:'Chiến binh khiên — Tiến hóa đa nhánh LV10', cls:'TANK' },
  eye_mouse:    { n:'Eye Mouse',    lv:1, hp:7,  mp:10, atk:3,  def:1, spd:6, e:'👁️',o:'player', elem:'dark',    sk:['teleport','poison_bite'],     desc:'Chuột mắt — Tiến hóa đa nhánh LV10', cls:'MAGE' },
  flower_man:   { n:'Flower Man',   lv:1, hp:9,  mp:12, atk:4,  def:2, spd:3, e:'🌺', o:'player', elem:'grass',   sk:['heal','poison_bite'],         desc:'Hoa quỷ — Tiến hóa đa nhánh LV10', cls:'SUPPORT' },
  devil_castle: { n:'D.Castle',     lv:1, hp:12, mp:8,  atk:3,  def:6, spd:1, e:'🏯', o:'player', elem:'dark',    sk:['barrier','ice_blast'],        desc:'Lâu đài quỷ — Tiến hóa đa nhánh LV10', cls:'TANK' },
  lava_dragon:   { n:'Lava Dragon',   lv:10, hp:35, mp:15, atk:16, def:8, spd:3, e:'🐲', o:'player', elem:'fire',    sk:['flame_breath','stomp'],    desc:'Rồng nham thạch sinh ra từ lửa và đất', cls:'TANK' },
  storm_serpent: { n:'Storm Serpent', lv:10, hp:28, mp:20, atk:14, def:6, spd:5, e:'🐉', o:'player', elem:'thunder', sk:['thunder','ice_blast'],   desc:'Mãng xà bão tố làm chủ sấm sét', cls:'ASSASSIN' },
  chaos_soldier: { n:'Chaos Soldier', lv:10, hp:32, mp:18, atk:18, def:9, spd:4, e:'🛡️',o:'player', elem:'dark',    sk:['ulti_dark','barrier'],     desc:'Chiến binh hỗn mang hội tụ sáng tối', cls:'TANK' },
  plasma_beast:  { n:'Plasma Beast',  lv:10, hp:30, mp:16, atk:15, def:7, spd:6, e:'🐆',o:'player', elem:'thunder', sk:['thunder_wave','teleport'],  desc:'Mãnh thú plasma tốc độ cực nhanh', cls:'ASSASSIN' },
  frost_treant:  { n:'Frost Treant',  lv:10, hp:40, mp:12, atk:12, def:10,spd:2, e:'🌲',o:'player', elem:'water',   sk:['vine_trap','ice_blast'],   desc:'Cổ thụ băng giá phòng thủ vĩnh cửu', cls:'SUPPORT' },
};

// ── Gacha pool (80+ Monsters) ──
export const GACHA_POOL = [
  { id:'kuriboh',     n:'Kuriboh',            e:'🐭', t:'C', hp:8,  mp:8,  atk:2,  def:1, spd:4, elem:'neutral', sk:['poison_bite'], desc:'Quái thú nhỏ bé dễ thương' },
  { id:'flower_sp',   n:'Flower Sprite',      e:'🌸', t:'C', hp:9,  mp:10, atk:3,  def:2, spd:3, elem:'grass',   sk:['heal'],        desc:'Tiên hoa lành mạnh hồi HP' },
  { id:'stone_gol',   n:'Stone Golem',        e:'🪨', t:'C', hp:15, mp:6,  atk:4,  def:7, spd:1, elem:'neutral', sk:['stomp'],       desc:'Golem đá siêu phòng thủ' },
  { id:'river_nymph', n:'River Nymph',        e:'💧', t:'C', hp:10, mp:12, atk:3,  def:2, spd:4, elem:'water',   sk:['ice_blast'],   desc:'Tiên nước huyền bí nhẹ nhàng' },
  { id:'trigan_jr',   n:'Trigan Jr',          e:'🐣', t:'C', hp:8,  mp:8,  atk:4,  def:1, spd:5, elem:'fire',    sk:['flame_breath'],desc:'Đại bàng con nhỏ xinh xắn' },
  { id:'goblin_w',    n:'Goblin Warrior',     e:'👺', t:'C', hp:11, mp:6,  atk:5,  def:3, spd:3, elem:'neutral', sk:['stomp'],       desc:'Tiểu quỷ chiến binh hung hăng' },
  { id:'aqua_serpent', n:'Aqua Serpent',      e:'🐍', t:'C', hp:12, mp:10, atk:4,  def:3, spd:4, elem:'water',   sk:['ice_blast'],   desc:'Rắn nước linh hoạt' },
  { id:'sand_crawler', n:'Sand Crawler',      e:'🦂', t:'C', hp:14, mp:6,  atk:5,  def:5, spd:2, elem:'neutral', sk:['stomp'],       desc:'Bọ cạp sa mạc' },
  { id:'leaf_wing',    n:'Leaf Wing',         e:'🍃', t:'C', hp:10, mp:12, atk:4,  def:2, spd:5, elem:'grass',   sk:['vine_trap'],   desc:'Cánh bướm rừng xanh' },
  { id:'wind_raptor',  n:'Wind Raptor',       e:'🦅', t:'C', hp:11, mp:8,  atk:5,  def:2, spd:6, elem:'neutral', sk:['stomp'],       desc:'Khủng long gió' },
  { id:'swamp_frog',   n:'Swamp Frog',        e:'🐸', t:'C', hp:16, mp:10, atk:4,  def:4, spd:3, elem:'water',   sk:['poison_bite'], desc:'Ếch đầm lầy' },
  { id:'lava_bug',     n:'Lava Bug',          e:'🐞', t:'C', hp:12, mp:8,  atk:6,  def:3, spd:4, elem:'fire',    sk:['flame_breath'],desc:'Bọ lửa' },
  { id:'bush_cat',     n:'Bush Cat',          e:'🐈', t:'C', hp:13, mp:9,  atk:5,  def:3, spd:5, elem:'grass',   sk:['vine_trap'],   desc:'Mèo bụi rậm' },
  { id:'neon_fish',    n:'Neon Fish',         e:'🐟', t:'C', hp:10, mp:14, atk:4,  def:2, spd:4, elem:'water',   sk:['ice_blast'],   desc:'Cá neon ma thuật' },
  { id:'coral_crust',  n:'Coral Crustacean',  e:'🦀', t:'C', hp:15, mp:8,  atk:5,  def:9, spd:3, elem:'water',   sk:['barrier'],     desc:'Cua san hô' },
  { id:'desert_fox',   n:'Desert Fox',        e:'🦊', t:'C', hp:11, mp:10, atk:5,  def:2, spd:6, elem:'neutral', sk:['stomp'],       desc:'Cáo sa mạc' },
  { id:'lava_slime',   n:'Lava Slime',        e:'🔥', t:'C', hp:14, mp:8,  atk:6,  def:4, spd:3, elem:'fire',    sk:['flame_breath'],desc:'Slime nham thạch' },
  { id:'mud_shambler', n:'Mud Shambler',      e:'💩', t:'C', hp:18, mp:6,  atk:5,  def:6, spd:2, elem:'water',   sk:['stomp'],       desc:'Quái vật bùn lầy' },
  { id:'phantom_bat',  n:'Phantom Bat',       e:'🦇', t:'C', hp:10, mp:10, atk:6,  def:2, spd:5, elem:'dark',    sk:['drain'],       desc:'Dơi bóng ma' },
  { id:'leaf_deer',    n:'Leaf Deer',         e:'🦌', t:'C', hp:12, mp:12, atk:4,  def:4, spd:4, elem:'grass',   sk:['heal'],        desc:'Hươu lá rừng' },

  { id:'shadow_h',    n:'Shadow Hunter',      e:'🗡️',t:'B', hp:13, mp:10, atk:8,  def:3, spd:5, elem:'dark',    sk:['drain','teleport'],       desc:'Thợ săn bóng tối lợi hại' },
  { id:'ice_witch',   n:'Ice Witch',          e:'🧊', t:'B', hp:12, mp:14, atk:9,  def:2, spd:4, elem:'water',   sk:['ice_blast','barrier'],    desc:'Phù thủy băng lạnh lẽo' },
  { id:'war_horse',   n:'War Horse',          e:'🐴', t:'B', hp:18, mp:8,  atk:7,  def:5, spd:5, elem:'neutral', sk:['stomp','war_cry'],        desc:'Chiến mã dũng mãnh không ngại gian khó' },
  { id:'thunder_b',   n:'Thunder Bird',       e:'⚡', t:'B', hp:11, mp:12, atk:10, def:2, spd:6, elem:'thunder', sk:['thunder','thunder_wave'], desc:'Chim sấm sét tốc độ chóp mặt' },
  { id:'dark_fairy',  n:'Dark Fairy',         e:'🧚', t:'B', hp:14, mp:14, atk:8,  def:4, spd:5, elem:'dark',    sk:['drain','poison_bite'],    desc:'Tiên tối huyền bí đa năng' },
  { id:'spark_fox',    n:'Spark Fox',         e:'🦊', t:'B', hp:15, mp:14, atk:11, def:4, spd:6, elem:'thunder', sk:['thunder'],     desc:'Cáo điện tinh nghịch' },
  { id:'rock_rhino',   n:'Rock Rhino',        e:'🦏', t:'B', hp:22, mp:8,  atk:9,  def:9, spd:2, elem:'neutral', sk:['stomp'],       desc:'Tê giác đá kiên cường' },
  { id:'void_specter', n:'Void Specter',      e:'👻', t:'B', hp:18, mp:16, atk:12, def:3, spd:4, elem:'dark',    sk:['drain'],       desc:'Bóng ma hư không' },
  { id:'ghost_owl',    n:'Ghost Owl',         e:'🦉', t:'B', hp:15, mp:18, atk:9,  def:4, spd:5, elem:'dark',    sk:['teleport'],    desc:'Cú ma đêm' },
  { id:'iron_boar',    n:'Iron Boar',         e:'🐗', t:'B', hp:25, mp:6,  atk:11, def:10,spd:2, elem:'neutral', sk:['stomp'],       desc:'Lợn lòi sắt' },
  { id:'storm_cat',    n:'Storm Cat',         e:'🐆', t:'B', hp:18, mp:12, atk:12, def:5, spd:6, elem:'thunder', sk:['thunder_wave'],desc:'Báo bão tố' },
  { id:'glow_wasp',    n:'Glow Wasp',         e:'🐝', t:'B', hp:14, mp:12, atk:10, def:3, spd:7, elem:'light',   sk:['poison_bite'], desc:'Ong ánh sáng' },
  { id:'magma_tort',   n:'Magma Tortoise',    e:'🐢', t:'B', hp:30, mp:8,  atk:8,  def:12,spd:1, elem:'fire',    sk:['flame_breath'],desc:'Rùa dung nham' },
  { id:'ember_cub',    n:'Ember Cub',         e:'🦁', t:'B', hp:15, mp:10, atk:9,  def:5, spd:5, elem:'fire',    sk:['flame_breath'],desc:'Sư tử lửa con' },
  { id:'bolt_beetle',  n:'Bolt Beetle',       e:'🐞', t:'B', hp:14, mp:12, atk:11, def:8, spd:4, elem:'thunder', sk:['thunder_wave'],desc:'Bọ cánh cứng điện' },
  { id:'frost_wisp',   n:'Frost Wisp',        e:'👻', t:'B', hp:12, mp:18, atk:8,  def:4, spd:5, elem:'water',   sk:['ice_blast'],   desc:'Linh hồn băng giá' },
  { id:'jungle_ape',   n:'Jungle Ape',        e:'🦍', t:'B', hp:22, mp:10, atk:12, def:7, spd:4, elem:'grass',   sk:['stomp'],       desc:'Khỉ đột rừng già' },
  { id:'dark_moth',    n:'Dark Moth',         e:'🦋', t:'B', hp:12, mp:15, atk:9,  def:3, spd:6, elem:'dark',    sk:['poison_bite'], desc:'Bướm đêm hắc ám' },
  { id:'shadow_wolf',  n:'Shadow Wolf',       e:'🐺', t:'B', hp:16, mp:12, atk:11, def:4, spd:7, elem:'dark',    sk:['drain'],       desc:'Sói bóng đêm' },
  { id:'sky_serpent',  n:'Sky Serpent',       e:'🐍', t:'B', hp:16, mp:15, atk:10, def:6, spd:6, elem:'light',   sk:['thunder'],     desc:'Mãng xà thiên giới' },

  { id:'dark_mag',    n:'Dark Magician',      e:'🧙', t:'A', hp:20, mp:18, atk:14, def:5, spd:4, elem:'dark',    sk:['ulti_yugi','thunder'],    desc:'Pháp sư bóng tối huyền bí tối thượng' },
  { id:'red_eyes',    n:'Red-Eyes Dragon',    e:'🔴', t:'A', hp:22, mp:12, atk:13, def:7, spd:3, elem:'fire',    sk:['flame_breath','stomp'],   desc:'Long nhãn đỏ hung tàn bạo ngược' },
  { id:'insect_q',    n:'Insect Queen',       e:'🦋', t:'A', hp:18, mp:14, atk:12, def:6, spd:5, elem:'grass',   sk:['vine_trap','poison_bite'],desc:'Nữ hoàng côn trùng đa dạng' },
  { id:'exodia_arm',  n:'Exodia Arm',         e:'💪', t:'A', hp:25, mp:10, atk:15, def:8, spd:2, elem:'light',   sk:['war_cry','barrier'],      desc:'Cánh tay khổng lồ của Exodia' },
  { id:'solar_leo',    n:'Solar Leo',         e:'🦁', t:'A', hp:25, mp:15, atk:16, def:8, spd:5, elem:'light',   sk:['war_cry'],     desc:'Sư tử mặt trời dũng mãnh' },
  { id:'tsunami_kra',  n:'Tsunami Kraken',    e:'🦑', t:'A', hp:30, mp:20, atk:14, def:10,spd:3, elem:'water',   sk:['ice_blast'],   desc:'Kraken sóng thần' },
  { id:'jade_mantis',  n:'Jade Mantis',       e:'🦗', t:'A', hp:22, mp:14, atk:15, def:7, spd:6, elem:'grass',   sk:['vine_trap'],   desc:'Bọ ngựa ngọc bích' },
  { id:'star_dragon',  n:'Star Dragon',       e:'💫', t:'A', hp:28, mp:18, atk:17, def:9, spd:4, elem:'light',   sk:['barrier'],     desc:'Rồng tinh tú' },
  { id:'abyss_shark',  n:'Abyss Shark',       e:'🦈', t:'A', hp:35, mp:12, atk:16, def:11,spd:3, elem:'dark',    sk:['drain'],       desc:'Cá mập vực thẳm' },
  { id:'bolt_steed',   n:'Bolt Steed',        e:'🦄', t:'A', hp:24, mp:15, atk:14, def:6, spd:8, elem:'thunder', sk:['thunder'],     desc:'Ngựa tia chớp' },
  { id:'cinder_wolf',  n:'Cinder Wolf',       e:'🐺', t:'A', hp:20, mp:14, atk:18, def:5, spd:7, elem:'fire',    sk:['flame_breath'],desc:'Sói tàn tro' },
  { id:'crystal_gol',  n:'Crystal Golem',     e:'💎', t:'A', hp:25, mp:12, atk:12, def:15,spd:1, elem:'light',   sk:['barrier'],     desc:'Golem pha lê phản chiếu ánh sáng' },
  { id:'shadow_panth', n:'Shadow Panther',    e:'🐈‍⬛', t:'A', hp:18, mp:14, atk:16, def:5, spd:8, elem:'dark',    sk:['teleport'],    desc:'Báo đen bóng đêm' },
  { id:'obsidian_gar', n:'Obsidian Gargoyle', e:'🗿', t:'A', hp:28, mp:10, atk:13, def:12,spd:3, elem:'dark',    sk:['barrier'],     desc:'Gargoyle hắc diện thạch' },
  { id:'storm_hawk',   n:'Storm Hawk',        e:'🦅', t:'A', hp:20, mp:16, atk:15, def:6, spd:7, elem:'thunder', sk:['thunder'],     desc:'Diều hâu bão tố' },
  { id:'glade_spirit', n:'Glade Spirit',      e:'🧚', t:'A', hp:22, mp:20, atk:12, def:8, spd:6, elem:'grass',   sk:['heal'],        desc:'Linh hồn trảng cỏ' },
  { id:'frozen_yeti',  n:'Frozen Yeti',       e:'👹', t:'A', hp:30, mp:12, atk:14, def:11,spd:2, elem:'water',   sk:['ice_blast'],   desc:'Người tuyết vĩnh cửu' },
  { id:'lightning_cat',n:'Lightning Cat',     e:'🐈', t:'A', hp:18, mp:16, atk:15, def:5, spd:8, elem:'thunder', sk:['thunder'],     desc:'Mèo tia chớp' },
  { id:'sun_spirit',   n:'Sun Spirit',        e:'☀️', t:'A', hp:20, mp:22, atk:13, def:9, spd:5, elem:'light',   sk:['heal'],        desc:'Linh hồn mặt trời' },
  { id:'magma_golem',  n:'Magma Golem',       e:'🌋', t:'A', hp:32, mp:10, atk:16, def:13,spd:1, elem:'fire',    sk:['flame_breath'],desc:'Golem dung nham' },
  // Final Expansion (to 100+)
  { id:'yata_garasu',  n:'Yata-Garasu',       e:'🐦', t:'S', hp:15, mp:30, atk:10, def:5, spd:9, elem:'dark',    sk:['drain'],       desc:'Linh điểu ba chân huyền thoại' },
  { id:'chaos_emp',    n:'Chaos Emperor',     e:'🐉', t:'S', hp:40, mp:25, atk:24, def:14,spd:4, elem:'dark',    sk:['ulti_dark'],   desc:'Rồng hỗn mang tối thượng' },
  { id:'valkyrie_m',   n:'Valkyrie Maiden',   e:'⚔️', t:'A', hp:22, mp:18, atk:15, def:8, spd:6, elem:'light',   sk:['war_cry'],     desc:'Nữ chiến binh Valkyrie' },
  { id:'harpie_lady',  n:'Harpie Lady',       e:'🦅', t:'B', hp:14, mp:14, atk:10, def:4, spd:7, elem:'neutral', sk:['stomp'],       desc:'Nữ quái điểu quyến rũ' },
  { id:'marshmallon',  n:'Marshmallon',       e:'🍡', t:'B', hp:25, mp:10, atk:4,  def:15,spd:2, elem:'light',   sk:['barrier'],     desc:'Kẹo dẻo bất tử phòng thủ cao' },
  { id:'penguin_sol',  n:'Penguin Soldier',   e:'🐧', t:'C', hp:12, mp:10, atk:6,  def:5, spd:4, elem:'water',   sk:['ice_blast'],   desc:'Chiến binh chim cánh cụt' },
  { id:'man_eater_p',  n:'Man-Eater Plant',   e:'🌱', t:'C', hp:14, mp:8,  atk:8,  def:4, spd:3, elem:'grass',   sk:['vine_trap'],   desc:'Cây ăn thịt người nguy hiểm' },
  { id:'time_wizard',  n:'Time Wizard',       e:'⏰', t:'B', hp:10, mp:20, atk:5,  def:2, spd:5, elem:'light',   sk:['teleport'],    desc:'Pháp sư thời gian xoay chuyển vận mệnh' },
  { id:'baby_dragon',  n:'Baby Dragon',       e:'🐲', t:'C', hp:11, mp:8,  atk:7,  def:4, spd:5, elem:'fire',    sk:['flame_breath'],desc:'Rồng con tiềm năng' },
  { id:'dark_blade',   n:'Dark Blade',        e:'🗡️',t:'B', hp:18, mp:10, atk:12, def:7, spd:4, elem:'dark',    sk:['stomp'],       desc:'Kiếm sĩ bóng đêm' },
  { id:'winged_kur',   n:'Winged Kuriboh',    e:'👼', t:'A', hp:12, mp:15, atk:3,  def:1, spd:6, elem:'light',   sk:['barrier'],     desc:'Kuriboh có cánh thần thánh' },
  { id:'silent_mag',   n:'Silent Magician',   e:'🧙‍♀️', t:'S', hp:20, mp:25, atk:18, def:6, spd:5, elem:'light',   sk:['ulti_yugi'],   desc:'Nữ pháp sư im lặng cực mạnh' },
  { id:'jinzo_p',      n:'Jinzo',             e:'🤖', t:'S', hp:28, mp:18, atk:20, def:12,spd:4, elem:'thunder', sk:['thunder_wave'],desc:'Người máy vô hiệu hóa bẫy' },
  { id:'gauntlet_w',   n:'Gauntlet Warrior',  e:'🥊', t:'B', hp:22, mp:8,  atk:13, def:9, spd:3, elem:'neutral', sk:['stomp'],       desc:'Chiến binh bao tay thép' },
  { id:'flame_manip',  n:'Flame Manipulator', e:'🔥', t:'C', hp:13, mp:12, atk:7,  def:3, spd:4, elem:'fire',    sk:['flame_breath'],desc:'Kẻ điều khiển lửa' },
  { id:'mystic_box',   n:'Mystic Box',        e:'📦', t:'B', hp:18, mp:14, atk:6,  def:10,spd:3, elem:'dark',    sk:['teleport'],    desc:'Hộp ma thuật huyền bí' },
  { id:'sonic_duck',   n:'Sonic Duck',        e:'🦆', t:'C', hp:11, mp:6,  atk:6,  def:3, spd:8, elem:'neutral', sk:['stomp'],       desc:'Vịt tốc độ âm thanh' },
  { id:'giant_soldier',n:'Giant Soldier',     e:'🛡️', t:'B', hp:24, mp:8,  atk:10, def:14,spd:2, elem:'light',   sk:['barrier'],     desc:'Cự binh đá phòng thủ thép' },
  { id:'gemini_elf',   n:'Gemini Elf',        e:'👯‍♀️', t:'A', hp:19, mp:14, atk:16, def:5, spd:6, elem:'neutral', sk:['stomp'],       desc:'Cặp song sinh tiên tộc' },
  { id:'summoned_sk',  n:'Summoned Skull',    e:'💀', t:'S', hp:26, mp:20, atk:22, def:10,spd:5, elem:'thunder', sk:['thunder'],     desc:'Ác quỷ sấm sét triệu hồi' },
];

  { id:'blue_eyes',   n:'Blue-Eyes Dragon',   e:'🐲', t:'S', hp:30, mp:14, atk:18, def:8, spd:3, elem:'water',   sk:['ice_blast','thunder'],    desc:'Rồng mắt xanh huyền thoại' },
  { id:'dark_mag_g',  n:'Dark Magician Girl', e:'🌟', t:'S', hp:22, mp:20, atk:16, def:5, spd:5, elem:'dark',    sk:['ulti_dark','drain'],      desc:'Pháp sư nữ ma thuật tối thượng' },
  { id:'thousand_d',  n:'Thousand Dragon',    e:'🐉', t:'S', hp:28, mp:14, atk:20, def:7, spd:2, elem:'fire',    sk:['flame_breath','ulti_trigan'],desc:'Nghìn long thần thú huyền thoại' },
  { id:'inferno_ph',   n:'Inferno Phoenix',   e:'🦅', t:'S', hp:24, mp:25, atk:18, def:6, spd:7, elem:'fire',    sk:['flame_breath'],desc:'Phượng hoàng lửa vĩnh cửu' },
  { id:'gaia_titan',   n:'Gaia Titan',        e:'🏔️', t:'S', hp:45, mp:10, atk:22, def:15,spd:1, elem:'neutral', sk:['stomp'],       desc:'Titan đất mẹ vĩ đại' },
  { id:'nebula_serp',  n:'Nebula Serpent',    e:'🌌', t:'S', hp:35, mp:25, atk:20, def:12,spd:5, elem:'dark',    sk:['ulti_dark'],   desc:'Mãng xà tinh vân' },
  { id:'aurora_peg',   n:'Aurora Pegasus',    e:'🎠', t:'S', hp:32, mp:22, atk:19, def:10,spd:6, elem:'light',   sk:['heal'],        desc:'Thiên mã cực quang' },
  { id:'glacier_mon',  n:'Glacier Monarch',   e:'👑', t:'S', hp:40, mp:15, atk:21, def:14,spd:2, elem:'water',   sk:['ice_blast'],   desc:'Quân vương băng giá' },
  { id:'thunder_god',  n:'Thunder God',       e:'⚡', t:'S', hp:30, mp:30, atk:25, def:8, spd:7, elem:'thunder', sk:['ulti_trigan'], desc:'Thần sấm tối cao' },
  { id:'forest_guar',  n:'Forest Guardian',   e:'🌳', t:'S', hp:50, mp:15, atk:18, def:18,spd:1, elem:'grass',   sk:['vine_trap'],   desc:'Hộ vệ rừng già' },
  { id:'magma_drake',  n:'Magma Drake',       e:'🐉', t:'S', hp:35, mp:18, atk:22, def:10,spd:4, elem:'fire',    sk:['flame_breath'],desc:'Rồng lửa cổ đại' },
  { id:'ocean_hydra',  n:'Ocean Hydra',       e:'🐲', t:'S', hp:42, mp:20, atk:19, def:12,spd:3, elem:'water',   sk:['ice_blast'],   desc:'Hydra đại dương' },
  { id:'void_dragon',  n:'Void Dragon',       e:'🐉', t:'S', hp:38, mp:22, atk:21, def:11,spd:5, elem:'dark',    sk:['ulti_dark'],   desc:'Rồng hư không' },
  { id:'divine_stag',  n:'Divine Stag',       e:'🦌', t:'S', hp:36, mp:25, atk:18, def:14,spd:4, elem:'light',   sk:['heal'],        desc:'Hươu thần thánh' },
  { id:'storm_giant',  n:'Storm Giant',       e:'🌩️', t:'S', hp:48, mp:15, atk:24, def:16,spd:2, elem:'thunder', sk:['thunder_wave'],desc:'Khổng lồ bão tố' },
  { id:'sky_whale',    n:'Sky Whale',         e:'🐋', t:'S', hp:55, mp:20, atk:15, def:15,spd:2, elem:'light',   sk:['barrier'],     desc:'Cá voi bầu trời' },
];

export const GACHA_RATES = { common:[60,30,9,1], premium:[0,30,50,20] };
export const RARITY_CLR  = { C:'#888', B:'#4499ff', A:'#ff8800', S:'#ff44ff' };
export const RARITY_LBL  = { C:'THƯỜNG', B:'HIẾM', A:'CỰC HIẾM', S:'SĂN SAO ✦' };

// ── Items ──
export const ITEMS = {
  hp_potion:  { n:'Bình HP',      e:'❤️', price:50,  max:9,  desc:'Hồi 10HP cho quân được chọn' },
  mp_potion:  { n:'Bình MP',      e:'💙', price:40,  max:9,  desc:'Hồi 8MP cho quân được chọn' },
  evo_stone:  { n:'Đá Tiến Hóa', e:'💎', price:300, max:9,  desc:'Bắt buộc để tiến hóa quái thú' },
  food_basic: { n:'Thức ăn',     e:'🍖', price:30,  max:99, desc:'+10 Thân thiện với quái thú' },
  magic_dust: { n:'Bụi Ma Thuật', e:'✨', price:100, max:999,desc:'Dùng cho Lai tạo & Thiên phú (Từ Gacha trùng)' },
  potion_great: { n:'Đại HP',      e:'🧪', price:120, max:9,  desc:'Hồi đầy HP cho quân được chọn' },
  scroll_magic: { n:'Cuộn Phép',   e:'📜', price:150, max:5,  desc:'Hồi đầy MP cho quân được chọn' },
  drink_energy: { n:'Nước Tăng Lực',e:'🥤', price:80,  max:5,  desc:'Hồi 50% Fatigue cho quái thú' },
};

// ── V6.0 Rune System ──
export const RUNE_TYPES = {
  atk_pct:     { n: 'ATK%',       i: '⚔️', desc: '+% Sát thương' },
  crit_chance: { n: 'CRIT%',      i: '🎯', desc: '+% Tỷ lệ chí mạng' },
  lifesteal:   { n: 'Hút Máu',    i: '🩸', desc: '+% Hồi máu khi đánh' },
  speed:       { n: 'Tốc độ',     i: '⚡', desc: '+ Tốc độ di chuyển' }
};

export const RUNE_RARITY = {
  common: { n: 'Thường', clr: '#888', mult: 1 },
  rare:   { n: 'Hiếm',   clr: '#4499ff', mult: 2 },
  epic:   { n: 'Sử Thi', clr: '#ff44ff', mult: 3 }
};

// ── V6.0 Talent Tree ──
export const TALENTS = {
  nature_blessing: { n: "Nature's Blessing", desc: '+5% HP cho hệ Cỏ (Wood)', cost: 5, icon: '🌿' },
  greedy_merchant: { n: "Greedy Merchant",  desc: '-10% Giá vàng tại Shop',   cost: 10, icon: '💰' },
  tactician:       { n: "Tactician",        desc: '+5% Tỷ lệ chí mạng toàn đội', cost: 15, icon: '♟️' }
};

// ── Default player data ──
export const DEFAULT_PLAYER = {
  name:'Yugi', gold:500, gems:10, totalScore:0, wins:0, losses:0, battles:0,
  inventory:{ hp_potion:2, mp_potion:2, evo_stone:1, food_basic:3, magic_dust:0 },
  runes: [], 
  monsterRunes: {}, 
  talents: {}, 
  collection:['trigan','great_bar','eye_mouse','flower_man','devil_castle'],
  roster:['trigan','great_bar','eye_mouse','flower_man','devil_castle'],
  affinity:{}, fatigue:{}, monsterLevels:{}, traits:{},
  campaignFloor:1, endlessFloor:0, arenaRating:1000,
};

// ── Player unit positions on board ──
export const PLAYER_POSITIONS = [[7,9],[7,0],[6,4],[6,5],[7,4]];

/** Get monster base stats from id (UDEFS + GACHA_POOL) */
export function getMonsterBase(id) {
  const ud = UDEFS[id];
  if (ud && ud.o === 'player') return { ...ud, id };
  const gm = GACHA_POOL.find(m => m.id === id);
  if (gm) return {
    id: gm.id, n: gm.n, e: gm.e, o:'player', lv:1,
    hp: gm.hp, mp: gm.mp || 8, atk: gm.atk, def: gm.def, spd: gm.spd,
    elem: gm.elem || 'neutral', sk: gm.sk || ['poison_bite'], desc: gm.desc, t: gm.t
  };
  return null;
}

/** Get all monsters for pokedex */
export function getAllMonsters() {
  const all = [];
  Object.entries(UDEFS).filter(([,d]) => d.o === 'player').forEach(([id,d]) => {
    all.push({ id, n:d.n, e:d.e, t:'B', hp:d.hp, atk:d.atk, def:d.def, spd:d.spd, elem:d.elem||'neutral', desc:d.desc, isBattle:true });
  });
  GACHA_POOL.forEach(m => {
    if (!all.find(a => a.id === m.id)) all.push({ ...m, isBattle:false });
  });
  return all;
}

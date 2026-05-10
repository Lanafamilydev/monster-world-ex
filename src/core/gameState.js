// ═══════════════════════════════════════════════════════════════
// Monster World V5.1 — Game State Module
// Centralized mutable G object shared across all battle modules
// ═══════════════════════════════════════════════════════════════

// The single mutable game state object.
// All battle modules import and mutate this object directly.
export const G = {
  units:        {},      // { [id]: UnitObject }
  grid:         [],      // 2D array [row][col] = unitId | null
  activeMap:    [],      // 2D terrain string array
  rows:         8,
  cols:         10,
  turn:         'player',
  round:        1,
  sel:          null,    // [row, col] of selected cell
  reach:        [],      // movable cells
  atkbl:        [],      // attackable cells
  skTgts:       [],      // skill target cells
  activeSk:     null,    // active skill id
  phase:        'sel',   // 'sel' | 'sk'
  captures:     {},      // { 'r,c': 'player'|'enemy'|'neutral' }
  pCap:         0,
  eCap:         0,
  score:        0,
  combo:        1,
  comboMax:     8,
  comboTimer:   null,
  killed:       { p:0, e:0 },
  ultiReady:    false,
  gameOver:     false,
  trapsRevealed:null,    // Set
  // V5.1 mode info
  mode:         'campaign',   // 'campaign' | 'endless' | 'arena'
  floor:        1,
  captureGoal:  3,
  // V6.0 Advanced tactics
  weather:      'CLEAR', // 'CLEAR' | 'RAIN' | 'FOG'
  tileStatuses: {},      // { 'r,c': { type: 'WET'|'BURNING'|'FROZEN'|'ELECTRIFIED', turns: N } }
};

/** Reset G to initial battle state */
export function resetG() {
  G.units        = {};
  G.grid         = [];
  G.activeMap    = [];
  G.turn         = 'player';
  G.round        = 1;
  G.sel          = null;
  G.reach        = [];
  G.atkbl        = [];
  G.skTgts       = [];
  G.activeSk     = null;
  G.phase        = 'sel';
  G.captures     = {};
  G.pCap         = 0;
  G.eCap         = 0;
  G.score        = 0;
  G.combo        = 1;
  G.comboMax     = 8;
  G.comboTimer   = null;
  G.killed       = { p:0, e:0 };
  G.ultiReady    = false;
  G.gameOver     = false;
  G.trapsRevealed = new Set();
  G.weather      = 'CLEAR';
  G.tileStatuses = {};
}

// Lightweight smoke test for non-rendering logic.
const fs = require('fs');
const path = require('path');

// Stub minimal browser globals
const win = { addEventListener: () => {} };
global.window = win;
global.document = {
  getElementById: () => ({
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    addEventListener: () => {},
    appendChild: () => {},
    style: {},
    children: [],
    onclick: null, oninput: null, onchange: null,
    innerHTML: '', textContent: '', value: '',
  }),
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      fillRect: () => {}, drawImage: () => {},
      clearRect: () => {}, fillText: () => {},
      measureText: () => ({ width: 0 }),
      imageSmoothingEnabled: false,
    }),
  }),
  querySelectorAll: () => [],
  addEventListener: () => {},
};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.requestAnimationFrame = () => {};
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;

// Load modules in order
function load(p) {
  const code = fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  eval.call(global, code);
}

load('js/sprites.js');
load('js/maps.js');
load('js/input.js');
load('js/quests.js');
load('js/combat.js');

console.log('--- Sprites ---');
console.log('TILE size:', win.Sprites.TILE);
console.log('Enemies:', Object.keys(win.Sprites.enemies).join(', '));
console.log('Tile palettes:', Object.keys(win.Sprites.palettes).length);

console.log('\n--- Maps ---');
for (const id of Object.keys(win.Maps)) {
  const m = win.Maps[id];
  console.log(`  ${id}: ${m.cols}x${m.rows} tiles, ${m.objects.length} objects, ${m.houses.length} houses`);
}

console.log('\n--- Verify map tile shape ---');
let ok = true;
for (const id of Object.keys(win.Maps)) {
  const m = win.Maps[id];
  for (let r = 0; r < m.rows; r++) {
    if (m.tiles[r].length !== m.cols) { console.log(`  ${id} row ${r} len mismatch`); ok = false; }
    if (m.solid[r].length !== m.cols) { console.log(`  ${id} solid row ${r} len mismatch`); ok = false; }
    if (m.deco[r].length !== m.cols) { console.log(`  ${id} deco row ${r} len mismatch`); ok = false; }
  }
}
console.log('  shape OK?', ok);

console.log('\n--- Quests ---');
console.log('Quest count:', Object.keys(win.Quests.QUESTS).length);

console.log('\n--- Character sprite row widths ---');
// Inspect via internal access (we can't, but we test via render mock)
// Simpler: ensure each known map has at least one walkable tile next to objects.
for (const id of ['overworld','village','dungeon1','dungeon2','house_healer','house_smith','house_granny']) {
  const m = win.Maps[id];
  const portals = m.objects.filter(o => o.type === 'portal' || o.type === 'door');
  console.log(`  ${id}: portals=${portals.length}`);
  for (const p of portals) {
    const solid = m.solid[p.y] && m.solid[p.y][p.x];
    if (solid) console.log('    !! Portal tile is solid:', p.x, p.y);
  }
}

console.log('\n--- Quest progress ---');
const player = {
  name:'Test', cls:'warrior', level:1, xp:0, gold:0, hp:10, maxhp:10, mp:5, maxmp:5,
  stats:{atk:5, def:3, mag:2, spd:3}, inventory:[],
  quests: win.Quests.newQuestLog(), flags:{},
};
win.Quests.startQuest(player, 'q1');
console.log('Active:', Object.keys(player.quests.active));
win.Quests.trackKill(player, 'slime');
win.Quests.trackKill(player, 'slime');
win.Quests.trackKill(player, 'slime');
const completed = win.Quests.checkComplete(player);
console.log('Completed after 3 slime kills:', completed.map(q => q.id));

console.log('\nALL CHECKS DONE.');

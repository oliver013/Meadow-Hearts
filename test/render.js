// Render test — actually invoke the sprite functions and dump a PNG.
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

global.window = { addEventListener: () => {} };
global.document = {
  getElementById: () => null,
  createElement: () => createCanvas(16, 16),
};

function load(p) {
  const code = fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  eval.call(global, code);
}
load('js/sprites.js');
load('js/maps.js');

const Sprites = global.window.Sprites;
const Maps = global.window.Maps;

// Render a snapshot of overworld
function renderMap(id) {
  const m = Maps[id];
  const c = createCanvas(m.cols * 16, m.rows * 16);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < m.rows; r++) {
    for (let cc = 0; cc < m.cols; cc++) {
      Sprites.drawTile(ctx, m.tiles[r][cc], cc * 16, r * 16);
    }
  }
  for (let r = 0; r < m.rows; r++) {
    for (let cc = 0; cc < m.cols; cc++) {
      const sym = m.deco[r][cc];
      if (sym) Sprites.drawDeco(ctx, sym, cc * 16, r * 16);
    }
  }
  if (m.houses) for (const h of m.houses) Sprites.drawHouse(ctx, h.x, h.y);
  // Dynamic objects
  for (const obj of m.objects) {
    if (obj.type === 'sign') Sprites.drawDeco(ctx, 'sign', obj.x * 16, obj.y * 16);
    if (obj.type === 'chest') Sprites.drawDeco(ctx, 'chest', obj.x * 16, obj.y * 16);
    if (obj.type === 'enemy') Sprites.drawEnemy(ctx, obj.x * 16, obj.y * 16, obj.kind);
  }
  // Player
  Sprites.drawChar(ctx, 64, 64, {
    dir: 'down', frame: 0, skin: '#f0c896', hair: '#3a2418', shirt: '#3a6dc1', pants: '#2a2a3a',
  });
  fs.writeFileSync(path.join(__dirname, id + '.png'), c.toBuffer());
  console.log('Wrote', id + '.png', m.cols * 16, 'x', m.rows * 16);
}

['overworld','village','dungeon1','dungeon2','house_healer'].forEach(renderMap);

// Char preview
const c = createCanvas(96, 96);
const ctx = c.getContext('2d');
const off = createCanvas(16, 16);
Sprites.drawChar(off.getContext('2d'), 0, 0, {
  dir: 'down', frame: 0, skin: '#f0c896', hair: '#a02020', shirt: '#3aa657', pants: '#2a3a4a',
});
ctx.imageSmoothingEnabled = false;
ctx.drawImage(off, 0, 0, 96, 96);
fs.writeFileSync(path.join(__dirname, 'char.png'), c.toBuffer());
console.log('Wrote char.png');

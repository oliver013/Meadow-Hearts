// Map system. Maps are grids of tile codes (with optional decoration & objects).
// Each map declares its tiles[][] (base ground), deco[][] (overlay), solids,
// objects (NPCs, doors, signs, chests, exits, encounters).
(function (global) {
  // Tile codes for map authoring
  // g grass, d dirt, s sand, S stone, w wall, F floor, W water, P path, V void
  const CODE = {
    g: 'grass', d: 'dirt', s: 'sand', S: 'stone',
    w: 'wall', F: 'floor', W: 'water', P: 'path',
    V: 'void', R: 'rug',
  };

  const SOLID_TILES = new Set(['water', 'wall', 'void']);

  // Generate a simple deco layer using random noise
  function genDeco(rows, cols, seed, palette) {
    // palette: array of {sym, weight}
    const out = [];
    let s = seed;
    function rand() {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 10000) / 10000;
    }
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        let pick = '';
        let acc = 0;
        const total = palette.reduce((a, b) => a + b.weight, 0);
        const v = rand() * total;
        for (const p of palette) {
          acc += p.weight;
          if (v <= acc) { pick = p.sym; break; }
        }
        row.push(pick);
      }
      out.push(row);
    }
    return out;
  }

  // Convert string-rows -> 2D char array
  function rows(str) {
    return str.trim().split(/\n/).map(r => r.split(''));
  }

  // ============ OVERWORLD ============
  // Big outdoor map: grass, paths, water, trees, town entrance, dungeon entrance
  const overworldRows = rows(`
ggggggggggggggggggggggggggggggggggggggggg
ggggggggggggggggggggggggggggggggggggggggg
gggSSSSSSSSSgggggggggggggggggggggggggggggg
ggSSSSSSSSSSSgggggggggggWWWgggggggggggggg
ggSSSSSSSSSSSggggggggggWWWWWggggggggggggg
gggggSgSgggggggggggggWWWWWWWggggggggggggg
gggggggggggggggggggWWWWWWWWggggggggggggg
gggggggggggggggggggWWWWWWWggggggggggggggg
gggggggggggggggggggWWWWWggggggggggggggggg
ggggggggPPPPPPPgggggggggggggggggggggggggg
ggggggggPgggggPPPPPPPPPPPPPPPPgggggggggggg
ggggggggPgggggggggggggggggggggggggggggggg
ggggggggPgggggggggggggggggggggggggggggggg
ggggggggPgggggggggggggggggggggggggggggggg
ggggggggPgggggggggggggggggggggggggggggggg
ggggggggPgggggggggggggggggggggggggggggggg
ggggggggPgggggggggggggggggggggggggggggggg
ggggggggPgggggggggggggggggggggggggggggggg
ggggggggPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPgggg
gggggggggggggggggggggggggggggggggggggggggg
ggggggggggggggggggggggggggggggggggggggggggg
ggggggggggggggggggggggggggggggggggggggggggg
gggggggggggggggggggggggggggggggggggggggggg
ggggggggggggggggggggggggggggggggggggggggg
ggggggggggggggggggggggggggggggggggggggggg
ggggggggggggggggggggggggggggggggggggggggg
gggddddddddggggggggggggggggggggggggggggg
ggddddddddddgggggggggggggggggggggggggggg
ggddddddddddggggggggggggggggggggggggggggg
ggddddddddddgggggggggggggggggggggggggggg
gggddddddddggggggggggggggggggggggggggggg
ggggggggggggggggggggggggggggggggggggggggg
`);

  const overworld = makeMap('overworld', overworldRows, {
    bg: 'grass',
    decoSeed: 7,
    decoPalette: [
      { sym: 'tree', weight: 0.04, allow: ['grass'] },
      { sym: 'bush', weight: 0.05, allow: ['grass'] },
      { sym: 'flower', weight: 0.03, allow: ['grass'] },
      { sym: 'rock', weight: 0.02, allow: ['stone', 'dirt'] },
      { sym: '', weight: 0.86 },
    ],
    objects: [
      // Town entrance
      { type: 'sign', x: 13, y: 18, text: 'PIXEL VILLAGE — North' },
      // Town building (the village is a separate map)
      // Town gate teleporter (north-of-path)
      { type: 'portal', x: 16, y: 9, target: 'village', tx: 12, ty: 23, text: 'Enter Pixel Village' },
      // Dungeon
      { type: 'sign', x: 5, y: 28, text: 'CRYPT OF SHADOWS' },
      { type: 'portal', x: 6, y: 28, target: 'dungeon1', tx: 8, ty: 14, text: 'Descend into the Crypt' },
      // Boss dungeon (gated)
      { type: 'sign', x: 33, y: 6, text: 'DARK SPIRE — beware' },
      { type: 'portal', x: 33, y: 7, target: 'dungeon2', tx: 8, ty: 14, text: 'Climb the Dark Spire' , gated: true },
      // Sage on a clearing
      { type: 'npc', x: 25, y: 12, name: 'Sage Eolan', dialog: ['Welcome, traveller.', 'Slay 3 slimes near the village to prove your courage.'], questId: 'q1' },
      // Treasure chest
      { type: 'chest', x: 35, y: 4, item: 'Antique Coin', gold: 25 },
    ],
    music: 'overworld',
  });

  // ============ VILLAGE ============
  // 25x25 with 3 houses, NPCs, shop sign
  const villageRows = rows(`
gggggggggggggggggggggggggg
gggggggggggggggggggggggggg
ggSSSSSSSSSSSSSSSSSSSSSSgg
gSPPPPPPPPPPPPPPPPPPPPPSgg
gSPPPPPPPPPPPPPPPPPPPPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPPPPPPPPPPPPPPPPPPPPSgg
gSPPPPPPPPPPPPPPPPPPPPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPgggggggggggggggggPPSgg
gSPPPPPPPPPPPPPPPPPPPPPSgg
ggSSSSSSSSSSSSSSSSSSSSSgg
gggggggggggggggggggggggggg
`);

  const village = makeMap('village', villageRows, {
    bg: 'grass',
    decoSeed: 13,
    decoPalette: [
      { sym: 'flower', weight: 0.06, allow: ['grass'] },
      { sym: 'bush', weight: 0.03, allow: ['grass'] },
      { sym: '', weight: 0.91 },
    ],
    houses: [
      // 4-tile wide x 4-tile tall house
      { x: 4, y: 4, name: 'Healer Mira', interior: 'house_healer', door: { x: 5, y: 7 } },
      { x: 14, y: 4, name: 'Smith Bron', interior: 'house_smith', door: { x: 15, y: 7 } },
      { x: 9, y: 16, name: 'Old Granny Lin', interior: 'house_granny', door: { x: 10, y: 19 } },
    ],
    objects: [
      { type: 'sign', x: 12, y: 3, text: 'Pixel Village — A peaceful hamlet' },
      // Exit south to overworld
      { type: 'portal', x: 12, y: 24, target: 'overworld', tx: 16, ty: 10, text: 'Leave the village' },
      // Villagers
      { type: 'npc', x: 8, y: 14, name: 'Villager Tom', dialog: ['Hello stranger!', 'Have you spoken to Mira the healer?'] },
      { type: 'npc', x: 17, y: 14, name: 'Child Pip', dialog: ['I want to be a hero one day!', 'Did you know there is a crypt south of here?'] },
      { type: 'npc', x: 12, y: 21, name: 'Mayor Aldwin', dialog: ['Our spire to the northeast is overrun by darkness.', 'Defeat 3 goblins in the Crypt and report back!'], questId: 'q2' },
    ],
    music: 'village',
  });

  // ============ HOUSES (interiors) ============
  function makeHouseInterior(id, npc, dialog, items = []) {
    const r = rows(`
wwwwwwwwwwwww
wFFFFFFFFFFFw
wFFFFFFFFFFFw
wFFFRRRRRFFFw
wFFFRRRRRFFFw
wFFFRRRRRFFFw
wFFFFFFFFFFFw
wFFFFFFFFFFFw
wFFFFFFFFFFFw
wwwwwwDwwwwww
`);
    return makeMap(id, r, {
      bg: 'floor',
      objects: [
        { type: 'portal', x: 6, y: 9, target: 'village', tx: 0, ty: 0, useReturn: true, text: 'Leave home' },
        { type: 'npc', x: 6, y: 4, name: npc, dialog, ...(items[0] ? items[0] : {}) },
        ...items.slice(1),
      ],
      noDeco: true,
    });
  }

  const houseHealer = makeHouseInterior('house_healer', 'Healer Mira',
    [
      'Welcome, weary traveller.',
      'I can mend your wounds for a few coins.',
      '(Stand here to fully heal — first time free!)'
    ],
    [
      { questId: 'q3' },
      { type: 'chest', x: 2, y: 2, item: 'Health Potion', gold: 0 },
      { type: 'healer', x: 6, y: 5 },
    ],
  );

  const houseSmith = makeHouseInterior('house_smith', 'Smith Bron',
    [
      'Steel and fire — that\'s my trade.',
      'Bring me 5 ore from the spire and I\'ll forge you a fine blade!',
    ],
    [
      { questId: 'q4' },
      { type: 'chest', x: 2, y: 2, item: 'Iron Dagger', gold: 0 },
    ],
  );

  const houseGranny = makeHouseInterior('house_granny', 'Granny Lin',
    [
      'Oh hello, dear.',
      'My cat ran into the crypt. Could you find it for me?',
      '(Look for a little kitten in the dungeon!)',
    ],
    [
      { questId: 'q5' },
      { type: 'chest', x: 9, y: 2, item: 'Lucky Charm', gold: 12 },
    ],
  );

  // ============ DUNGEONS ============
  const dungeon1Rows = rows(`
wwwwwwwwwwwwwwwww
wVVVVVVVVVVVVVVVw
wVFFFFFFFFFFFFFVw
wVFFFwwwwwFFFFFVw
wVFFFwFFFwFFFFFVw
wVFFFwFFFwFFFFFVw
wVFFFwwDwwFFFFFVw
wVFFFFFFFFFFFFFVw
wVFFFFFFFFFFFFFVw
wVFFFwwwFFFFFFFVw
wVFFFwFwFFFFFFFVw
wVFFFwFwFFFFFFFVw
wVFFFwFFFFFFFFFVw
wVFFFFFFFFFFFFFVw
wVFFFFFFFFFFFFFVw
wwwwwwwwwwwwwwwwww
`);

  const dungeon1 = makeMap('dungeon1', dungeon1Rows, {
    bg: 'floor',
    noDeco: true,
    objects: [
      { type: 'portal', x: 8, y: 14, target: 'overworld', tx: 6, ty: 29, text: 'Climb out' },
      // encounters scattered around
      { type: 'enemy', x: 4, y: 8, kind: 'slime' },
      { type: 'enemy', x: 11, y: 11, kind: 'slime' },
      { type: 'enemy', x: 13, y: 4, kind: 'bat' },
      { type: 'enemy', x: 7, y: 4, kind: 'slime' },
      { type: 'enemy', x: 5, y: 12, kind: 'goblin' },
      { type: 'chest', x: 13, y: 13, item: 'Bronze Ring', gold: 30 },
      { type: 'npc', x: 6, y: 5, name: 'Lost Kitten', dialog: ['Mew!', 'The kitten purrs, then darts back home.'], questId: 'q5_complete' },
      { type: 'sign', x: 8, y: 13, text: 'A damp crypt. Footprints lead north.' },
    ],
    music: 'dungeon',
  });

  const dungeon2Rows = rows(`
wwwwwwwwwwwwwwwwwww
wVVVVVVVVVVVVVVVVVw
wVFFFFFFFFFFFFFFFVw
wVFFwwwwwwwFFFFFFVw
wVFFwFFFFFwFFFFFFVw
wVFFwFFFFFwFFFFFFVw
wVFFwFFwFFwFFFFFFVw
wVFFwFFwFFwwwwwFFVw
wVFFFFFwFFFFFFwFFVw
wVFFFFFwFFFFFFwFFVw
wVFFFFFwFFFFFFwFFVw
wVFFFFFwwwwwwwwFFVw
wVFFFFFFFFFFFFFFFVw
wVFFFFFFFFFFFFFFFVw
wVFFFFFFFFFFFFFFFVw
wwwwwwwwwwwwwwwwwww
`);

  const dungeon2 = makeMap('dungeon2', dungeon2Rows, {
    bg: 'floor',
    noDeco: true,
    objects: [
      { type: 'portal', x: 8, y: 14, target: 'overworld', tx: 33, ty: 8, text: 'Leave the spire' },
      { type: 'enemy', x: 4, y: 6, kind: 'skeleton' },
      { type: 'enemy', x: 12, y: 4, kind: 'skeleton' },
      { type: 'enemy', x: 7, y: 9, kind: 'goblin' },
      { type: 'enemy', x: 14, y: 9, kind: 'goblin' },
      { type: 'enemy', x: 4, y: 12, kind: 'bat' },
      { type: 'enemy', x: 14, y: 12, kind: 'bat' },
      { type: 'enemy', x: 9, y: 5, kind: 'boss', boss: true },
      { type: 'chest', x: 16, y: 2, item: 'Spire Ore x5', gold: 50 },
      { type: 'sign', x: 8, y: 13, text: 'A dark ascent. The boss waits at the top.' },
    ],
    music: 'dungeon',
  });

  // ============ Helpers ============
  function makeMap(id, charGrid, opts) {
    const rows = charGrid.length;
    const cols = Math.max(...charGrid.map(r => r.length));
    const tiles = [];
    const solid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      const srow = [];
      for (let c = 0; c < cols; c++) {
        const ch = charGrid[r][c] || (opts.bg === 'floor' ? 'F' : 'g');
        const tile = CODE[ch] || opts.bg || 'grass';
        row.push(tile);
        srow.push(SOLID_TILES.has(tile));
      }
      tiles.push(row);
      solid.push(srow);
    }

    // Decoration overlay
    let deco = [];
    if (!opts.noDeco && opts.decoPalette) {
      deco = genDeco(rows, cols, opts.decoSeed || 1, opts.decoPalette);
      // Mask deco where palette doesn't allow it
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sym = deco[r][c];
          if (!sym) continue;
          const item = opts.decoPalette.find(p => p.sym === sym);
          if (item && item.allow && !item.allow.includes(tiles[r][c])) {
            deco[r][c] = '';
          }
          if (deco[r][c] === 'tree' || deco[r][c] === 'rock') {
            solid[r][c] = true; // trees and rocks block
          }
        }
      }
    } else {
      for (let r = 0; r < rows; r++) deco.push(new Array(cols).fill(''));
    }

    // Clear decoration on tiles that hold interactive objects so they're walkable.
    if (opts.objects) {
      for (const obj of opts.objects) {
        if (typeof obj.x === 'number' && typeof obj.y === 'number') {
          if (deco[obj.y]) deco[obj.y][obj.x] = '';
          // Portals/doors must be walkable
          if (obj.type === 'portal' || obj.type === 'door') {
            if (solid[obj.y]) solid[obj.y][obj.x] = false;
          }
        }
      }
    }

    // Houses (placed on village map): mark solid + add door portals
    const houseSolids = [];
    if (opts.houses) {
      for (const h of opts.houses) {
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 4; dx++) {
            // Roof tiles (top 2) and walls (next 2) — door is a tile within the bottom row
            if (!(dx === 1 && dy === 3) && !(dx === 2 && dy === 3)) {
              if (solid[h.y + dy] && solid[h.y + dy][h.x + dx] !== undefined) {
                solid[h.y + dy][h.x + dx] = true;
              }
            }
          }
        }
        // Door portal at bottom-center
        if (!opts.objects) opts.objects = [];
        opts.objects.push({
          type: 'door',
          x: h.x + 1,
          y: h.y + 3,
          target: h.interior,
          tx: 6, ty: 8,
          text: 'Enter ' + h.name + '\'s house',
        });
        opts.objects.push({
          type: 'door',
          x: h.x + 2,
          y: h.y + 3,
          target: h.interior,
          tx: 6, ty: 8,
          text: 'Enter ' + h.name + '\'s house',
        });
      }
    }

    return {
      id,
      cols, rows,
      tiles, solid, deco,
      objects: opts.objects || [],
      houses: opts.houses || [],
      music: opts.music,
    };
  }

  global.Maps = {
    overworld, village,
    house_healer: houseHealer,
    house_smith: houseSmith,
    house_granny: houseGranny,
    dungeon1, dungeon2,
  };
  global.MapsAPI = {
    SOLID_TILES,
  };
})(window);
